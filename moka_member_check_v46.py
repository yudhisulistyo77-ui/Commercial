#!/usr/bin/env python3
"""Bounded read-only member capability check. Never saves customer values or tokens.
Routes on the legacy Moka host are candidates, NOT claimed verified APIs.
A 200 response is not proof of Purchase History correctness or completeness.
"""
import json, os, re, urllib.request, urllib.error, urllib.parse
from datetime import datetime, timedelta
from pathlib import Path
from moka_sync import norm, LOCAL_TZ

BASE='https://api.mokapos.com'
MAX_BYTES=2*1024*1024
FIELDS=set('business_id business_uuid outlet_id outlets is_deleted success data customers customer purchases purchase_history transactions payments customer_id id uuid customer_uuid name customer_name phone email address city state postal_code created_at updated_at transaction_date sale_date date payment_no invoice_no receipt_no total_collected amount net_sales subtotal discounts taxes gratuities is_refunded refund_amount refund_uuid refunded_date refund_type payment_refunds items checkouts quantity refunded_quantity total_pages total_count current_page per_page page completed next_url errors error message status'.split())

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
    if not path.startswith('/') or path.startswith('//'):raise ValueError('Path sumber tidak valid')
    url=BASE+path+'?'+urllib.parse.urlencode(params)
    parsed=urllib.parse.urlsplit(url)
    if parsed.scheme!='https' or parsed.hostname!='api.mokapos.com' or parsed.username or parsed.password:raise ValueError('Host sumber tidak diizinkan')
    return url

def request(token,path,params,opener=None):
    url=safe_url(path,params)
    opener=opener or urllib.request.build_opener(NoRedirect())
    req=urllib.request.Request(url,headers={'Authorization':'Bearer '+token,'Accept':'application/json'})
    try:
        with opener.open(req,timeout=12) as response:
            raw=response.read(MAX_BYTES+1)
            if len(raw)>MAX_BYTES:return {'status':'response_too_large','body_saved':False},None
            body=json.loads(raw)
            return {'status':response.status,'schema':shape(body),'body_saved':False},body
    except urllib.error.HTTPError as e:return {'status':e.code,'body_saved':False},None
    except Exception as e:return {'status':'request_failed','error_type':type(e).__name__,'body_saved':False},None

def unwrap(body):
    return body.get('data',body) if isinstance(body,dict) else None

def first_customer_id(body):
    d=unwrap(body)
    rows=d.get('customers') if isinstance(d,dict) else None
    if not isinstance(rows,list) or not rows:return None
    value=rows[0].get('id') if isinstance(rows[0],dict) else None
    if isinstance(value,bool) or not isinstance(value,(int,str)) or not re.fullmatch(r'[A-Za-z0-9_-]{1,128}',str(value)):return None
    return str(value)

def history_checks(body,customer_id):
    data=unwrap(body)
    if not isinstance(data,dict):return {'recognized_history_array':False}
    key=next((k for k in ('purchase_history','purchases','transactions','payments') if isinstance(data.get(k),list)),None)
    rows=data.get(key,[]) if key else []
    rows=[r for r in rows if isinstance(r,dict)]
    ids=[str(r['customer_id']) for r in rows if r.get('customer_id') is not None]
    parent=data.get('customer')
    parent_id=parent.get('id') if isinstance(parent,dict) else data.get('customer_id')
    relation='MISMATCH' if any(cid!=customer_id for cid in ids) or (parent_id is not None and str(parent_id)!=customer_id) else 'MATCH' if ids or parent_id is not None else 'NOT_PROVIDED'
    return {'recognized_history_array':bool(key),'sample_rows':len(rows),
      'customer_relation':relation,
      'receipt_field_present':any(any(k in r for k in ('id','uuid','payment_no','invoice_no')) for r in rows),
      'date_field_present':any(any(k in r for k in ('transaction_date','sale_date','created_at','date')) for r in rows),
      'amount_field_present':any(any(k in r for k in ('net_sales','total_collected','amount')) for r in rows),
      'refund_fields_present':any(any(k in r for k in ('is_refunded','refund_amount','payment_refunds','refund_type')) for r in rows),
      'pagination_fields_present':any(k in data for k in ('total_pages','next_url','completed')),
      'approved_for_sync':False}

def classification(results):
    statuses=[r['result']['status'] for r in results]
    if any(s==200 for s in statuses):return 'HAS_RESPONSE_NEEDS_REVIEW'
    if any(s in (401,403) for s in statuses):return 'ACCESS_OR_SCOPE_NEEDS_REVIEW'
    if statuses and all(s==404 for s in statuses):return 'CANDIDATE_ROUTES_NOT_FOUND'
    return 'CHECK_INCOMPLETE'

def inspect(token,outlet,fetch=request):
    oid=urllib.parse.quote(str(outlet['id']),safe='')
    results=[];customer=None
    # Two small list probes; stop after the first structurally recognizable list.
    for version in ('v1','v2'):
        template=f'/{version}/outlets/{{outlet_id}}/customers'
        outcome,body=fetch(token,f'/{version}/outlets/{oid}/customers',{'per_page':1,'page':1})
        results.append({'kind':'customer_list_candidate','path_template':template,'result':outcome})
        cid=first_customer_id(body)
        if cid:
            customer=urllib.parse.quote(cid,safe='');break
    if customer:
        # Known only as candidate routes. No guessed data is published into the app.
        for version,suffix in [('v1','transactions'),('v2','transactions'),('v1','purchase_history')]:
            template=f'/{version}/outlets/{{outlet_id}}/customers/{{customer_id}}/{suffix}'
            outcome,body=fetch(token,f'/{version}/outlets/{oid}/customers/{customer}/{suffix}',{'per_page':1,'page':1})
            results.append({'kind':'purchase_history_candidate','path_template':template,'result':outcome,'checks':history_checks(body,cid)})
    return {'version':46,'read_only':True,'contains_customer_values':False,'contains_tokens':False,
      'source_routes_verified':False,'purchase_history_semantics_verified':False,'writes_performed':False,
      'customer_sample_available':bool(customer),'classification':classification(results),'results':results,
      'next_step':'Review fields, customer/store identity, date coverage, pagination and refund semantics before implementing sync.'}

def choose_outlet(outlets,requested='',allowed=''):
    allow={norm(x) for x in allowed.split(',') if x.strip()}
    candidates=[o for o in outlets if not allow or norm(o['name']) in allow]
    if requested:candidates=[o for o in candidates if norm(o['name'])==norm(requested)]
    if not requested:
        preferred=[o for o in candidates if not re.match(r'^(DC|GUDANG|DISTRIBUTION CENTER)(?:[ ._-]|$)',norm(o['name']))]
        if preferred:candidates=preferred
    if not candidates:raise RuntimeError('Tidak ada outlet audit yang cocok dengan cakupan akses.')
    return candidates[0]

def get_outlets(token,fetch=request):
    result,body=fetch(token,'/v1/profile/self',{})
    profile=unwrap(body)
    bid=profile.get('business_id') if isinstance(profile,dict) else None
    if result['status']!=200 or not isinstance(bid,(int,str)) or isinstance(bid,bool):
        return None,{'phase':'profile','status':result['status'],'schema':result.get('schema')}
    path='/v1/businesses/'+urllib.parse.quote(str(bid),safe='')+'/outlets'
    result,body=fetch(token,path,{})
    data=unwrap(body);rows=data.get('outlets') if isinstance(data,dict) else None
    if result['status']!=200 or not isinstance(rows,list):
        return None,{'phase':'outlets','status':result['status'],'schema':result.get('schema')}
    return [o for o in rows if isinstance(o,dict) and o.get('id') is not None and isinstance(o.get('name'),str) and not o.get('is_deleted')],None

def main():
    token=os.environ.get('MOKA_ACCESS_TOKEN','').strip()
    if not token:raise SystemExit('MOKA_ACCESS_TOKEN belum terpasang di GitHub Secrets.')
    outlets,failure=get_outlets(token)
    if failure:
        report={'version':46,'read_only':True,'contains_customer_values':False,'contains_tokens':False,
          'writes_performed':False,'source_routes_verified':False,'purchase_history_semantics_verified':False,
          'classification':'SOURCE_ACCESS_FAILED','failure':failure,'results':[]}
    else:
        outlet=choose_outlet(outlets,os.environ.get('AUDIT_OUTLET','').strip(),os.environ.get('ONLY_OUTLETS',''))
        report=inspect(token,outlet)
    report['checked_at']=datetime.now(LOCAL_TZ).isoformat()
    output=Path('moka-member-check');output.mkdir(exist_ok=True)
    (output/'source-schema.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print('Pemeriksaan read-only selesai:',report['classification'])
    for row in report['results']:print(row['kind'],row['path_template'],'HTTP',row['result']['status'])
    print('Belum melakukan sinkron Member. Unduh artifact moka-member-check untuk review sumber.')

if __name__=='__main__':main()
