"""Bounded report pagination and honest, component-scoped progress. No database writes."""
import hashlib,json
from datetime import date,timedelta
from decimal import Decimal

def money(v):
 n=Decimal(str(v or 0))
 if not n.is_finite():raise ValueError('Nilai laporan bukan angka valid')
 return n

def item_pages(moka,oid,start,end):
 endpoint=f'/v3/outlets/{oid}/reports/item_sales'
 base={'start':start.strftime('%d/%m/%Y'),'end':end.strftime('%d/%m/%Y'),'per_page':1000}
 path=endpoint;params={**base,'page':1};rows=[];seen=set();urls=set();page=1
 for _ in range(200):
  data=moka.get(path,params);batch=data.get('item_sales')
  if not isinstance(batch,list):raise ValueError('Item Sales tidak memiliki daftar baris')
  marker=hashlib.sha256(json.dumps(batch,sort_keys=True,separators=(',',':')).encode()).hexdigest()
  explicit=data.get('completed');count=data.get('total_count');pages=data.get('total_pages')
  if batch and marker in seen:
   # Unpaginated responses are returned once, then reconciled by the caller.
   # An explicit incomplete/count/page promise may never be ignored.
   if explicit is False or (count is not None and len(rows)!=int(count)) or (pages is not None and page<=int(pages)):
    raise ValueError('Pagination Item Sales berulang saat sumber belum lengkap')
   return {'item_sales':rows,'pagination':'unpaginated-repeated'}
  seen.add(marker);rows.extend(batch)
  nxt=data.get('next_url')
  if nxt:
   if nxt in urls:raise ValueError('Pagination Item Sales next_url berulang')
   urls.add(nxt);path=nxt;params={};page+=1;continue
  if explicit is True or (pages is not None and page>=int(pages)) or not batch:
   if count is not None and len(rows)!=int(count):raise ValueError('Jumlah Item Sales belum lengkap')
   if explicit is False:raise ValueError('Item Sales berhenti sebelum completed')
   return {'item_sales':rows,'pagination':'terminal'}
  page+=1;path=endpoint;params={**base,'page':page}
 raise ValueError('Batas 200 halaman Item Sales tercapai; data lama dipertahankan')

def sales_progress(results,phase='sales',total=None):
 stores=[]
 for r in results:
  net=float((r.get('summary')or{}).get('net_sales')or 0)
  stores.append({k:v for k,v in {'store_id':r.get('store_id'),'outlet':r.get('outlet'),'year':r.get('year'),'month':r.get('month'),'status':r.get('status'),'requested_through':r.get('end'),'saved_through':r.get('end')if (r.get('status')=='UNCHANGED' or (r.get('status')=='OK' and r.get('persisted')is True))else None,'summary':net,'item_total':r.get('item_total'),'sales_type_total':r.get('sales_type_total'),'difference':round(net-r['sales_type_total'],2)if r.get('sales_type_total')is not None else None,'errors':r.get('errors',[])[:3]}.items()if v is not None})
 saved=[r['saved_through']for r in stores if r.get('saved_through')]
 return {'phase':phase,'done':len(results),'total':len(results)if total is None else total,'latest_saved_until':max(saved)if saved else None,'per_store':stores,'partial':any(r.get('status')not in('OK','UNCHANGED')for r in stores)}

def daily_diagnostic(moka,result):
 """Summaries only: identify mismatching days, never fetch customer/invoice detail."""
 start=date.fromisoformat(result['start']);end=date.fromisoformat(result['end'])
 if (end-start).days>31:raise ValueError('Audit harian dibatasi satu bulan')
 aggregate=(result.get('agg')or{}).get('sales_types',{})
 fetched_start=result.get('fetch_from',result['start']);fetched_end=result.get('fetch_to',result['end'])
 days=[];cursor=start
 while cursor<=end:
  source=moka.sales_summary(result['outlet_id'],cursor,cursor)
  net=float(money(source.get('net_sales')));key=cursor.isoformat()
  detail=sum(float(v.get('amount')or 0)for v in aggregate.get(key,{}).values()) if fetched_start<=key<=fetched_end else None
  days.append({'date':key,'summary':net,'detail_fetched':detail,'difference':round(net-detail,2)if detail is not None else None})
  cursor+=timedelta(days=1)
 total=sum(d['summary']for d in days)
 return {'days':days,'sum_daily_summary':total,'monthly_summary':float(money((result.get('summary')or{}).get('net_sales'))),'note':'Diagnostik saja; tidak mengubah data atau status verifikasi.'}
