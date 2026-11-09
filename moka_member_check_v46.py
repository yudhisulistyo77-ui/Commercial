#!/usr/bin/env python3
"""Bounded read-only member capability check. Never saves customer values or tokens.
Uses the two Customer Service paths observed in Moka browser Network.
A 200 response is not proof of Purchase History correctness or completeness.
"""
import json, os, re, time, urllib.request, urllib.error, urllib.parse
from datetime import datetime, timedelta
from pathlib import Path
from moka_sync import norm, LOCAL_TZ

BASE='https://service-goauth.mokapos.com'
MAX_BYTES=2*1024*1024
FIELDS=set('business_id business_uuid outlet_id outlets is_deleted success data customers customer purchases purchase_history transactions payments customer_id id uuid customer_uuid name customer_name phone phone_number email address city state postal_code created_at updated_at transaction_date sale_date date outlet_name parent_payment_uuid payment_type payment_no invoice_no receipt_no total_collected amount net_sales subtotal discounts taxes gratuities is_refunded refund_amount refund_uuid refunded_date refund_type payment_refunds items checkouts quantity refunded_quantity total_pages total_count current_page per_page page completed next_url errors error message status'.split())

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        return None

def shape(value,depth=0):
    if depth>5:return 'nested'
    if isinstance(value,dict):
        result={k:shape(v,depth+1) for k,v in value.items() if k in FIELDS}
        unknown=sum(k not in FIELDS for k in value)
        if unknown:result['unlisted_field_count']=unknown
        return result
    if isinstance(value,list):return {'type':'array','returned_count':len(value),'first_row_fields':shape(value[0],depth+1) if value else None}
    if value is None:return 'null'
    return type(value).__name__

def safe_url(path,params):
    if not path.startswith('/customer/') or path.startswith('//'):raise ValueError('Path sumber tidak valid')
    url=BASE+path+('?' + urllib.parse.urlencode(params) if params else '')
    parsed=urllib.parse.urlsplit(url)
    if parsed.scheme!='https' or parsed.hostname!='service-goauth.mokapos.com' or parsed.username or parsed.password:raise ValueError('Host sumber tidak diizinkan')
    return url

def request(token,path,params,opener=None):
    url=safe_url(path,params)
    opener=opener or urllib.request.build_opener(NoRedirect())
    req=urllib.request.Request(url,headers={'Authorization':'Bearer '+token,'Accept':'application/json','User-Agent':'commercial-dashboard-moka-sync'})
    response_status=None;content_kind=None
    try:
        with opener.open(req,timeout=30) as response:
            response_status=response.status
            content_type=str(getattr(response,'headers',{}).get('Content-Type','')).lower()
            content_kind='json' if 'json' in content_type else 'html' if 'text/html' in content_type else 'other'
            raw=response.read(MAX_BYTES+1)
            if len(raw)>MAX_BYTES:return {'status':'response_too_large','body_saved':False},None
            body=json.loads(raw)
            return {'status':response.status,'schema':shape(body),'body_saved':False},body
    except urllib.error.HTTPError as e:return {'status':e.code,'body_saved':False},None
    except Exception as e:
        outcome={'status':'request_failed','error_type':type(e).__name__,'timeout_seconds':30,'body_saved':False}
        if response_status is not None:outcome.update(response_http_status=response_status,response_content_type=content_kind)
        if isinstance(e,urllib.error.URLError):outcome['reason_type']=type(e.reason).__name__
        return outcome,None

def unwrap(body):
    return body.get('data',body) if isinstance(body,dict) else None

def first_customer_id(body):
    from moka_member_v47 import envelope,identifier
    try:
        rows,_,_=envelope(body,'customers')
        return identifier(rows[0].get('customer_id',rows[0].get('id'))) if rows else None
    except Exception:return None

def history_checks(body,customer_id):
    from moka_member_v47 import envelope,page_number
    try:
        rows,pages,count=envelope(body,'payments')
        page_number(pages,'total_pages');page_number(count,'total_count')
    except Exception:return {'recognized_history_array':False,'approved_for_sync':False}
    rows=[r for r in rows if isinstance(r,dict)]
    return {'recognized_history_array':True,'sample_rows':len(rows),
      'customer_relation':'MISMATCH' if any(str(r['customer_id'])!=customer_id for r in rows if r.get('customer_id') is not None) else 'URL_CONTEXT',
      'uuid_field_present':all('uuid' in r for r in rows),
      'date_field_present':all('created_at' in r for r in rows),
      'signed_amount_field_present':all('total_collected' in r for r in rows),
      'refund_fields_present':all('is_refunded' in r for r in rows),
      'pagination_fields_present':True,'approved_for_sync':False}

def classification(results):
    statuses=[r['result']['status'] for r in results]
    if any(s in (401,403) for s in statuses):return 'ACCESS_OR_SCOPE_NEEDS_REVIEW'
    if len(results)==2 and all(s==200 for s in statuses) and results[-1].get('checks',{}).get('recognized_history_array'):return 'SOURCE_REACHABLE_TEST_SYNC_REQUIRED'
    if 404 in statuses:return 'SOURCE_ROUTE_NOT_FOUND'
    return 'SCHEMA_OR_ACCESS_NEEDS_REVIEW'

def inspect(token,outlet=None,fetch=request):
    # Global Customer List schema only. No customer values or IDs enter the report.
    outcome,body=fetch(token,'/customer/v3/customers',{'type':'ALL','page':1,'per_page':1})
    results=[{'kind':'customer_list','path_template':'/customer/v3/customers?type=ALL','result':outcome}]
    cid=first_customer_id(body)
    if cid:
        outcome,body=fetch(token,'/customer/v1/customers/'+urllib.parse.quote(cid,safe='')+'/payments',{'page':1,'per_page':1})
        results.append({'kind':'purchase_history','path_template':'/customer/v1/customers/{customer_id}/payments','result':outcome,'checks':history_checks(body,cid)})
    return {'version':'47','read_only':True,'contains_customer_values':False,'contains_tokens':False,
      'source_routes_observed_in_browser':True,'production_sync_tested':False,'writes_performed':False,
      'customer_sample_available':bool(cid),'classification':classification(results),'results':results,
      'next_step':'Jika sumber terjangkau, jalankan Member saja satu bulan. Pemeriksaan ini hanya sampel, bukan bukti kelengkapan semua halaman.'}

def choose_outlet(outlets,requested='',allowed=''):
    allow={norm(x) for x in allowed.split(',') if x.strip()}
    candidates=[o for o in outlets if not allow or norm(o['name']) in allow]
    if requested:candidates=[o for o in candidates if norm(o['name'])==norm(requested)]
    if not requested:
        preferred=[o for o in candidates if not re.match(r'^(DC|GUDANG|DISTRIBUTION CENTER)(?:[ ._-]|$)',norm(o['name']))]
        if preferred:candidates=preferred
    if not candidates:raise RuntimeError('Tidak ada outlet audit yang cocok dengan cakupan akses.')
    return candidates[0]

def main():
    token=(os.environ.get('MOKA_CUSTOMER_ACCESS_TOKEN') or os.environ.get('MOKA_ACCESS_TOKEN','')).strip()
    if not token:raise SystemExit('Token Moka belum terpasang di GitHub Secrets.')
    report=inspect(token)
    report['checked_at']=datetime.now(LOCAL_TZ).isoformat()
    output=Path('moka-member-check');output.mkdir(exist_ok=True)
    (output/'source-schema.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print('Pemeriksaan read-only selesai:',report['classification'])
    for row in report['results']:print(row['kind'],row['path_template'],'HTTP',row['result']['status'])
    print('Belum melakukan sinkron Member. Unduh artifact moka-member-check; HTTP 200 hanya membuktikan akses sampel, belum kelengkapan sinkron.')

if __name__=='__main__':main()
