#!/usr/bin/env python3
"""Stock latest snapshot + exact reporting windows. Independent of sales/Price List writes."""
import sys,os,json,uuid
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from datetime import datetime,timedelta,timezone
from moka_sync import Moka,Supa,find_store,BRANDS
from stock_v78 import catalogue,demand,numeric

def read_catalogue(moka,oid):
    path=f'/v1/outlets/{oid}/items';params={'per_page':1000};out=[];seen=set()
    for _ in range(200):
        d=moka.get(path,params,retries=2);batch=d.get('items')
        if not isinstance(batch,list):raise ValueError('Katalog tanpa daftar items')
        out.extend(batch);nxt=d.get('next_url')
        if nxt:
            if nxt in seen:raise ValueError('Pagination katalog berulang')
            seen.add(nxt);path=nxt;params=None;continue
        if d.get('completed')is False or(len(batch)>=1000 and d.get('completed')is not True):raise ValueError('Kelengkapan katalog belum terverifikasi')
        if d.get('total_count')is not None and int(d['total_count'])!=len(out):raise ValueError('Jumlah katalog tidak lengkap')
        return out
    raise ValueError('Batas pagination katalog tercapai')

def report(moka,oid,start,end):
    path=f'/v3/outlets/{oid}/reports/item_sales';params={'start':start.strftime('%d/%m/%Y'),'end':end.strftime('%d/%m/%Y'),'per_page':1000}
    rows=[];seen=set()
    for page in range(1,201):
        d=moka.get(path,params,retries=2);batch=d.get('item_sales')
        if not isinstance(batch,list):raise ValueError('Item Sales tanpa daftar baris')
        rows.extend(batch)
        next_url=d.get('next_url')
        if next_url:
            if next_url in seen:raise ValueError('Pagination Item Sales berulang')
            seen.add(next_url);path=next_url;params=None;continue
        if d.get('completed') is False or (len(batch)>=1000 and d.get('completed')is not True):raise ValueError('Kelengkapan Item Sales belum terverifikasi')
        break
    else:raise ValueError('Batas pagination Item Sales tercapai')
    summary=moka.sales_summary(oid,start,end);expected=numeric(summary.get('net_sales'));actual=sum((numeric(x.get('net_sales')) or 0 for x in rows),0)
    if expected is None or abs(actual-expected)>max(10,len(rows)*0.5):raise ValueError('Item Sales tidak cocok Sales Summary; demand belum digunakan')
    return rows

def main():
    token=os.environ.get('MOKA_ACCESS_TOKEN','');url=os.environ.get('SUPABASE_URL','');key=os.environ.get('SUPABASE_KEY','')
    if not token or not url or not key or key.startswith('sb_publishable_'):raise ValueError('Secret MOKA_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_KEY diperlukan')
    moka=Moka(token);db=Supa(url,key);stores=db.sel('stores?select=id,name,is_active');aliases=db.sel('store_aliases?select=alias,store_id');_,outlets=moka.outlets()
    mapped=[]
    for o in outlets:
        sid=find_store(o['name'],stores,aliases)
        if sid is None:print('Stock: outlet belum dipetakan: '+o['name'],flush=True);continue
        mapped.append((o,sid))
    if not mapped or len(set(s for _,s in mapped))!=len(mapped):raise ValueError('Pemetaan outlet kosong/ganda; periksa stores/store_aliases, termasuk DC')
    today=datetime.now(timezone(timedelta(hours=8))).date();cut=today-timedelta(days=1);failed=0;run=str(uuid.uuid4())
    db.rpc('commercial_stock_run_v78',{'p_run':run,'p_status':'running','p_done':0,'p_total':len(mapped),'p_message':'Menarik stock dan permintaan; stock saat ini, sales s.d. kemarin WITA'})
    for i,(o,sid) in enumerate(mapped):
        job=None
        try:
            j=db.rpc('commercial_stock_sync_v78',{'p_store':sid,'p_action':'begin','p_data':{'cutoff':cut.isoformat()}});job=j['run_id']
            rows=catalogue(read_catalogue(moka,o['id']),BRANDS);reports={};warnings=[]
            for period,start,end in [('sold14',cut-timedelta(days=13),cut),('prior14',cut-timedelta(days=27),cut-timedelta(days=14)),('sold90',cut-timedelta(days=89),cut)]:
                try:reports[period]=report(moka,o['id'],start,end)
                except Exception as e:reports[period]=None;warnings.append(period+': '+str(e)[:180])
            rows,unmatched=demand(rows,reports)
            if unmatched:warnings.append(str(unmatched)+' baris demand tidak cocok SKU/nama')
            for at in range(0,len(rows),400):db.rpc('commercial_stock_sync_v78',{'p_store':sid,'p_action':'batch','p_run':job,'p_data':{'rows':rows[at:at+400]}})
            result=db.rpc('commercial_stock_sync_v78',{'p_store':sid,'p_action':'commit','p_run':job,'p_data':{'expected':len(rows),'message':'; '.join(warnings)[:1500]}})
            print(f"Stock: {o['name']}: {result['rows']} variant; {result['unknown']} qty belum tersedia; {result['demand_unknown']} demand belum terverifikasi",flush=True)
            if result['unknown'] or result['demand_unknown']:warnings.append('Qty/demand sebagian belum tersedia; lihat status cakupan Stock')
            if warnings:failed+=1;print('WARNING: '+'; '.join(warnings),flush=True)
        except Exception as e:
            failed+=1;message=str(e)[:1000];print('ERROR Stock '+o['name']+': '+message,flush=True)
            try:db.rpc('commercial_stock_sync_v78',{'p_store':sid,'p_action':'error','p_run':job,'p_data':{'message':message}})
            except Exception:pass
        db.rpc('commercial_stock_run_v78',{'p_run':run,'p_status':'running','p_done':i+1,'p_total':len(mapped),'p_message':str(failed)+' outlet/periode perlu diperiksa'})
    db.rpc('commercial_stock_run_v78',{'p_run':run,'p_status':'warning' if failed else 'done','p_done':len(mapped),'p_total':len(mapped),'p_message':str(failed)+' outlet/periode perlu diperiksa' if failed else 'Snapshot stock selesai'})
    if failed:return 1
    return 0
if __name__=='__main__':
    try:sys.exit(main())
    except Exception as exc:
        message=type(exc).__name__+': '+str(exc)[:500]
        print('Stock dihentikan: '+message,flush=True)
        try:
            db=Supa(os.environ['SUPABASE_URL'],os.environ['SUPABASE_KEY'])
            db.rpc('commercial_stock_run_v78',{'p_run':str(uuid.uuid4()),'p_status':'error','p_done':0,'p_total':0,'p_message':message})
        except Exception:pass
        sys.exit(1)

