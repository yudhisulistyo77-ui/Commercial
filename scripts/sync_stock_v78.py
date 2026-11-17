#!/usr/bin/env python3
"""Stock latest snapshot + exact reporting windows. Independent of sales/Price List writes."""
import sys,os,json,uuid
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from datetime import datetime,timedelta,timezone
from moka_sync import Moka,Supa,find_store,BRANDS,norm
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

def report_page_window(moka,oid,start,end):
    """Read every page. A full first page is not a terminal condition."""
    endpoint=f'/v3/outlets/{oid}/reports/item_sales';base={'start':start.strftime('%d/%m/%Y'),'end':end.strftime('%d/%m/%Y'),'per_page':500}
    summary=moka.sales_summary(oid,start,end);expected=numeric(summary.get('net_sales'))
    if expected is None:raise ValueError('Sales Summary tidak valid')
    out=[];seen_pages=set();seen_urls=set();path=endpoint;params={**base,'page':1};page=1
    for _ in range(200):
        d=moka.get(path,params,retries=2);batch=d.get('item_sales')
        if not isinstance(batch,list):raise ValueError('Item Sales tanpa daftar baris')
        marker=json.dumps(batch,sort_keys=True,separators=(',',':'))
        actual=sum((numeric(x.get('net_sales')) or 0 for x in out),0)
        if batch and marker in seen_pages:
            # Some report endpoints are unpaginated. Accept only a short, reconciled response without an explicit incomplete flag.
            if d.get('completed')is not False and len(batch)<base['per_page'] and abs(actual-expected)<=max(10,len(out)*0.5):break
            raise ValueError('Pagination Item Sales berulang/mengabaikan page; '+str(len(out))+' baris terbaca')
        seen_pages.add(marker);out.extend(batch)
        nxt=d.get('next_url')
        if nxt:
            if nxt in seen_urls:raise ValueError('Pagination Item Sales next_url berulang')
            seen_urls.add(nxt);path=nxt;params=None;page+=1;continue
        total_pages=d.get('total_pages');total_count=d.get('total_count')
        if d.get('completed')is True or (total_pages is not None and page>=int(total_pages)) or not batch:
            if total_count is not None and len(out)!=int(total_count):raise ValueError('Jumlah baris Item Sales belum lengkap')
            break
        page+=1;path=endpoint;params={**base,'page':page}
    else:raise ValueError('Batas 200 halaman Item Sales tercapai')
    actual=sum((numeric(x.get('net_sales')) or 0 for x in out),0)
    if abs(actual-expected)>max(10,len(out)*0.5):raise ValueError('Item Sales tidak cocok Sales Summary; demand belum digunakan')
    return out

def report(moka,oid,start,end):
    # Bound source queries to calendar months; validate each segment, never silently truncate 90-day demand.
    rows=[];cursor=start
    while cursor<=end:
        nxt=(cursor.replace(day=28)+timedelta(days=4)).replace(day=1)
        stop=min(end,nxt-timedelta(days=1));rows.extend(report_page_window(moka,oid,cursor,stop));cursor=stop+timedelta(days=1)
    return rows

def cleanup(db,sid):
    for _ in range(1000):
        d=db.rpc('commercial_stock_sync_v78',{'p_store':sid,'p_action':'cleanup','p_data':{}})
        if not d.get('deleted'):return
    print('WARNING: pembersihan generasi lama dilanjutkan pada penarikan berikutnya',flush=True)

def main():
    token=os.environ.get('MOKA_ACCESS_TOKEN','');url=os.environ.get('SUPABASE_URL','');key=os.environ.get('SUPABASE_KEY','')
    if not token or not url or not key or key.startswith('sb_publishable_'):raise ValueError('Secret MOKA_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_KEY diperlukan')
    moka=Moka(token);db=Supa(url,key);stores=db.sel('stores?select=id,name,is_active');aliases=db.sel('store_aliases?select=alias,store_id');_,outlets=moka.outlets()
    only={norm(x)for x in os.environ.get('ONLY_OUTLETS','').split(',')if x.strip()}
    if only:outlets=[o for o in outlets if norm(o['name'])in only]
    mapped=[]
    for o in outlets:
        sid=find_store(o['name'],stores,aliases)
        if sid is None:print('Stock: outlet belum dipetakan: '+o['name'],flush=True);continue
        mapped.append((o,sid))
    if not mapped or len(set(s for _,s in mapped))!=len(mapped):raise ValueError('Pemetaan outlet kosong/ganda; periksa stores/store_aliases, termasuk DC')
    today=datetime.now(timezone(timedelta(hours=8))).date();cut=today-timedelta(days=1);failed=0;errors=0;run=str(uuid.uuid4())
    db.rpc('commercial_stock_run_v78',{'p_run':run,'p_status':'running','p_done':0,'p_total':len(mapped),'p_message':'Menarik stock dan permintaan; stock saat ini, sales s.d. kemarin WITA'})
    for i,(o,sid) in enumerate(mapped):
        job=None;phase='begin'
        try:
            j=db.rpc('commercial_stock_sync_v78',{'p_store':sid,'p_action':'begin','p_data':{'cutoff':cut.isoformat()}});job=j['run_id']
            if j.get('storage_version')!=80:raise ValueError('Pasang v80/01-STOCK-ANALISIS-V80.sql sebelum menjalankan worker terbaru')
            phase='catalogue';print('Stock: '+o['name']+' · membaca katalog',flush=True)
            rows=catalogue(read_catalogue(moka,o['id']),BRANDS);reports={};warnings=[]
            for period,start,end in [('sold14',cut-timedelta(days=13),cut),('prior14',cut-timedelta(days=27),cut-timedelta(days=14))]:
                phase=period
                try:reports[period]=report(moka,o['id'],start,end)
                except Exception as e:reports[period]=None;warnings.append(period+': '+str(e)[:180])
            phase='sold30'
            try:
                extra2=report(moka,o['id'],cut-timedelta(days=29),cut-timedelta(days=28))
                reports['sold30']=None if reports['sold14']is None or reports['prior14']is None else extra2+reports['prior14']+reports['sold14']
            except Exception as e:reports['sold30']=None;warnings.append('sold30: '+str(e)[:180])
            phase='sold90'
            try:
                older=report(moka,o['id'],cut-timedelta(days=89),cut-timedelta(days=30))
                reports['sold90']=None if reports['sold30']is None else older+reports['sold30']
            except Exception as e:reports['sold90']=None;warnings.append('sold90: '+str(e)[:180])
            rows,unmatched=demand(rows,reports)
            if unmatched:warnings.append(str(unmatched)+' baris demand tidak cocok SKU/nama')
            for at in range(0,len(rows),250):
                phase='batch '+str(at+1)+'-'+str(min(at+250,len(rows)));print('Stock: '+o['name']+' · '+phase,flush=True)
                db.rpc('commercial_stock_sync_v78',{'p_store':sid,'p_action':'batch','p_run':job,'p_data':{'rows':rows[at:at+250]}})
            phase='publish';result=db.rpc('commercial_stock_sync_v78',{'p_store':sid,'p_action':'commit','p_run':job,'p_data':{'expected':len(rows),'message':'; '.join(warnings)[:1500]}})
            print(f"Stock: {o['name']}: {result['rows']} variant; {result['unknown']} qty belum tersedia; {result['demand_unknown']} demand 28 hari belum terverifikasi; {result.get('history_unknown',0)} histori 90 hari belum terverifikasi",flush=True)
            if result['unknown'] or result['demand_unknown'] or result.get('history_unknown') or result.get('demand30_unknown'):warnings.append('Qty/demand sebagian belum tersedia; lihat status cakupan Stock')
            if result.get('demand30_unknown'):print('Stock: '+str(result['demand30_unknown'])+' demand 30 hari belum terverifikasi',flush=True)
            if warnings:failed+=1;print('WARNING: '+'; '.join(warnings),flush=True)
            phase='cleanup'
            try:cleanup(db,sid)
            except Exception as e:
                failed+=1;print('WARNING: snapshot sudah terbit; pembersihan dilanjutkan pada tarikan berikutnya: '+str(e)[:250],flush=True)
        except Exception as e:
            failed+=1;errors+=1;message=str(e)[:1000];print('ERROR Stock '+o['name']+' ['+phase+']: '+message,flush=True)
            try:db.rpc('commercial_stock_sync_v78',{'p_store':sid,'p_action':'error','p_run':job,'p_data':{'message':message}})
            except Exception:pass
            try:cleanup(db,sid)
            except Exception:pass
        db.rpc('commercial_stock_run_v78',{'p_run':run,'p_status':'running','p_done':i+1,'p_total':len(mapped),'p_message':str(failed)+' outlet/periode perlu diperiksa'})
    db.rpc('commercial_stock_run_v78',{'p_run':run,'p_status':'error' if errors else 'warning' if failed else 'done','p_done':len(mapped),'p_total':len(mapped),'p_message':str(failed)+' outlet/periode perlu diperiksa' if failed else 'Snapshot stock selesai'})
    if errors:return 1
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

