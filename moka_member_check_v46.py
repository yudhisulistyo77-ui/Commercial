#!/usr/bin/env python3
"""Bounded read-only member capability check. Never saves customer values or tokens.
Uses the two Customer Service paths observed in Moka browser Network.
A 200 response is not proof of Purchase History correctness or completeness.
"""
import json, os, re, time, urllib.request, urllib.error, urllib.parse
from datetime import datetime, timedelta
from pathlib import Path
from moka_sync import norm, LOCAL_TZ
from moka_member_v47 import member_authorization, MemberSourceError, customer_cursor_page, identifier, MEMBER_PAGE_SIZE, CUSTOMER_PAGE_SIZE

BASE='https://service-goauth.mokapos.com'
MAX_BYTES=2*1024*1024
FIELDS=set('business_id business_uuid outlet_id outlets is_deleted success data customers customer purchases purchase_history transactions payments customer_id id uuid customer_uuid name customer_name phone phone_number email address city state postal_code created_at updated_at transaction_date sale_date date outlet_name parent_payment_uuid payment_type payment_no invoice_no receipt_no total_collected amount net_sales subtotal discounts taxes gratuities is_refunded refund_amount refund_uuid refunded_date refund_type payment_refunds items checkouts quantity refunded_quantity total_pages total_count current_page per_page page completed next_url errors error message status'.split())

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        return None

# Only approved structural/property names are exposed. Unknown keys may be names/IDs.
FIELDS.update("next_cursor cursor result results response payload content body list records rows entries meta metadata pagination paging page_info pageInfo total totalCount totalPages count offset limit has_more hasMore next_page nextPage code msg status_code statusCode error_code errorCode error_type errorType error_message errorMessage error_description errorDescription response_code responseCode response_message responseMessage full_name first_name last_name mobile customerId customerName phoneNumber createdAt updatedAt".split())
WRAPPERS=('data','result','response','payload','content','body')

def shape(value,depth=0):
    if depth>8:return 'nested_limit'
    if isinstance(value,dict):
        result={};unknown=[]
        for index,(key,child) in enumerate(value.items()):
            if index>=64:
                result['remaining_field_count']=len(value)-index;break
            if key in FIELDS:result[key]=shape(child,depth+1)
            else:unknown.append(shape(child,depth+1))
        if unknown:
            result['unlisted_field_count']=sum(k not in FIELDS for k in value)
            # Position-only descriptors retain nested structure without exposing dynamic keys.
            result['unlisted_field_shapes']=unknown
        return result
    if isinstance(value,list):return {'type':'array','returned_count':len(value),'first_row_fields':shape(value[0],depth+1) if value else None}
    if value is None:return 'null'
    return type(value).__name__

def application_signals(body):
    """Categorical diagnostics only, never copy arbitrary message/code values."""
    nodes=[body];statuses=set();auth=False;failure=False;at=0
    while at<len(nodes) and at<32:
        node=nodes[at];at+=1
        if not isinstance(node,dict):continue
        for key in WRAPPERS:
            if isinstance(node.get(key),dict):nodes.append(node[key])
        if node.get('success') is False:failure=True
        for key in ('code','status','status_code','statusCode','error_code','errorCode','response_code','responseCode'):
            value=node.get(key)
            if type(value) is int and 100<=value<=599:statuses.add(value)
            elif isinstance(value,str) and re.fullmatch(r'[1-5][0-9]{2}',value.strip()):statuses.add(int(value.strip()))
        for key in ('code','error','error_type','errorType','error_code','errorCode','message','msg','error_message','errorMessage','error_description','errorDescription','response_message','responseMessage'):
            value=node.get(key)
            if isinstance(value,str) and len(value)<2048:
                auth=auth or bool(re.search(r'\bunauthori[sz]ed\b|\bunauthenticated\b|\bforbidden\b|invalid[_ ](?:access[_ ])?token|(?:access[_ ])?token[_ ](?:expired|invalid)|expired[_ ]token|authentication[_ ](?:required|failed)',value,re.IGNORECASE))
    return {'body_status_codes':sorted(statuses),'auth_error_indicated':auth or bool(statuses & {401,403}),'success_false':failure}

def safe_url(path,params):
    if not path.startswith('/customer/') or path.startswith('//'):raise ValueError('Path sumber tidak valid')
    url=BASE+path+('?' + urllib.parse.urlencode(params) if params else '')
    parsed=urllib.parse.urlsplit(url)
    if parsed.scheme!='https' or parsed.hostname!='service-goauth.mokapos.com' or parsed.username or parsed.password:raise ValueError('Host sumber tidak diizinkan')
    return url

def request(token,path,params,opener=None):
    url=safe_url(path,params)
    opener=opener or urllib.request.build_opener(NoRedirect())
    try:token=member_authorization(token)
    except MemberSourceError:return {'status':'invalid_token_format','body_saved':False},None
    req=urllib.request.Request(url,headers={'Authorization':token,'Accept':'application/json','User-Agent':'commercial-dashboard-moka-sync'})
    response_status=None;content_kind=None
    try:
        with opener.open(req,timeout=30) as response:
            response_status=response.status
            content_type=str(getattr(response,'headers',{}).get('Content-Type','')).lower()
            content_kind='json' if 'json' in content_type else 'html' if 'text/html' in content_type else 'other'
            raw=response.read(MAX_BYTES+1)
            if len(raw)>MAX_BYTES:return {'status':'response_too_large','body_saved':False},None
            body=json.loads(raw)
            return {'status':response.status,'schema':shape(body),'application_signals':application_signals(body),'body_saved':False},body
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
    if any(r['result'].get('application_signals',{}).get('auth_error_indicated') for r in results):return 'SOURCE_REPORTED_AUTH_ERROR'
    if any(r['result'].get('application_signals',{}).get('success_false') for r in results):return 'SOURCE_REPORTED_FAILURE'
    if any(r.get('checks',{}).get('continuation_valid') is False for r in results):return 'CURSOR_CONTINUATION_NEEDS_REVIEW'
    history=next((r for r in results if r.get('kind')=='purchase_history'),None)
    if history and all(s==200 for s in statuses) and history.get('checks',{}).get('recognized_history_array'):return 'SOURCE_REACHABLE_TEST_SYNC_REQUIRED'
    if 404 in statuses:return 'SOURCE_ROUTE_NOT_FOUND'
    return 'SCHEMA_OR_ACCESS_NEEDS_REVIEW'

def inspect(token,outlet=None,fetch=request):
    # Global Customer List schema only. No customer values or IDs enter the report.
    outcome,body=fetch(token,'/customer/v3/customers',{'type':'ALL','per_page':CUSTOMER_PAGE_SIZE})
    results=[{'kind':'customer_list','path_template':'/customer/v3/customers?type=ALL','result':outcome}]
    signals=application_signals(body)
    outcome.setdefault('application_signals',signals)
    cid=None if signals['auth_error_indicated'] or signals['success_false'] else first_customer_id(body)
    pagination={'style':'page_metadata','continuation_tested':False,'all_pages_verified':False}
    continuation_ok=True
    if isinstance(body,dict) and 'results' in body:
        pagination['style']='results_next_cursor'
        try:
            rows,cursor=customer_cursor_page(body)
            pagination['next_cursor_present']=cursor is not None
            if cursor and cid:
                outcome,second=fetch(token,'/customer/v3/customers',{'type':'ALL','per_page':CUSTOMER_PAGE_SIZE,'cursor':cursor})
                outcome.setdefault('application_signals',application_signals(second))
                pagination['continuation_tested']=True
                try:
                    next_rows,next_cursor=customer_cursor_page(second)
                    first_ids={identifier(r.get('customer_id',r.get('id'))) for r in rows}
                    next_ids=[identifier(r.get('customer_id',r.get('id'))) for r in next_rows]
                    continuation_ok=outcome['status']==200 and not (set(next_ids)&first_ids) and len(next_ids)==len(set(next_ids)) and next_cursor!=cursor and bool(next_rows or next_cursor is None)
                except Exception:continuation_ok=False
                results.append({'kind':'customer_list_continuation','path_template':'/customer/v3/customers?type=ALL&cursor={next_cursor}',
                  'result':outcome,'checks':{'continuation_valid':continuation_ok,'parameter':'cursor','all_pages_verified':False}})
        except MemberSourceError:
            continuation_ok=False;pagination['invalid_cursor_envelope']=True
        if not continuation_ok:pagination['continuation_valid']=False
    if cid and continuation_ok:
        outcome,body=fetch(token,'/customer/v1/customers/'+urllib.parse.quote(cid,safe='')+'/payments',{'page':1,'per_page':MEMBER_PAGE_SIZE})
        results.append({'kind':'purchase_history','path_template':'/customer/v1/customers/{customer_id}/payments','result':outcome,'checks':history_checks(body,cid)})
    result_class=classification(results) if continuation_ok else ('ACCESS_OR_SCOPE_NEEDS_REVIEW' if any(r['result']['status'] in (401,403) for r in results) else 'CURSOR_CONTINUATION_NEEDS_REVIEW')
    next_step=('Jalankan sinkron uji Member saja satu bulan; sampel bukan bukti semua halaman lengkap.' if result_class=='SOURCE_REACHABLE_TEST_SYNC_REQUIRED' else 'Kirim laporan struktur ini untuk review. Jangan jalankan sinkron Member sebelum sumber dan struktur terverifikasi.')
    return {'version':'47.5','schema_reporting_version':2,'http_200_proves_member_data':False,'read_only':True,'contains_customer_values':False,'contains_tokens':False,
      'source_routes_observed_in_browser':True,'production_sync_tested':False,'writes_performed':False,
      'per_page':{'customer_list':CUSTOMER_PAGE_SIZE,'purchase_history':MEMBER_PAGE_SIZE},'customer_sample_available':bool(cid),'customer_pagination':pagination,'classification':result_class,'results':results,
      'next_step':next_step}

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
    print('Belum melakukan sinkron Member. Unduh artifact moka-member-check; HTTP 200 belum membuktikan respons berisi data Member. Lihat klasifikasi dan struktur pada artifact.')

if __name__=='__main__':main()
