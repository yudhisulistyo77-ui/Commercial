"""Customer List + Purchase History adapter for the two observed Moka Customer Service routes.
No browser cookies, order_token or raw response is stored/logged. Fail closed on incomplete pagination.
"""
import json, os, re, time, uuid, urllib.parse, urllib.request, urllib.error
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

BASE='https://service-goauth.mokapos.com'
# Customer List one-row requests have succeeded in the live diagnostic.
CUSTOMER_PAGE_SIZE=1
MEMBER_PAGE_SIZE=6  # Purchase History request size observed in Moka browser.
class MemberSourceError(RuntimeError):pass
def member_authorization(value):
    """Customer Service uses a raw authorization token as observed in the user's browser.
    Normalize outer clipboard whitespace and one accidental Bearer prefix only.
    Never log, decode, persist or return credentials in errors.
    """
    if not isinstance(value,str):raise MemberSourceError('Token Customer Service belum tersedia.')
    token=value.strip()
    token=re.sub(r'^Bearer[ \t]+','',token,flags=re.IGNORECASE).strip()
    if not token or token.lower()=='bearer':raise MemberSourceError('Token Customer Service belum tersedia.')
    if not re.fullmatch(r'[!-~]+',token) or token[0] in ('"',"'") or token[-1] in ('"',"'"):
        raise MemberSourceError('Format token Customer Service tidak valid: gunakan satu baris token tanpa kutip atau spasi di dalamnya.')
    return token

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None

def norm(value):return re.sub(r'\s+',' ',str(value or '')).strip().upper()
def identifier(value):
    if isinstance(value,bool) or not isinstance(value,(int,str)) or not re.fullmatch(r'[A-Za-z0-9_-]{1,128}',str(value)) or str(value)=='0':raise MemberSourceError('Customer List tidak memiliki ID sumber yang valid.')
    return str(value)
def amount(value):
    if isinstance(value,bool) or not isinstance(value,(int,float,str,Decimal)):raise MemberSourceError('total_collected bukan angka sumber.')
    if not re.fullmatch(r'-?\d+(?:\.\d+)?',str(value)):raise MemberSourceError('Format total_collected belum didukung; data tidak ditulis.')
    try:n=Decimal(str(value))
    except InvalidOperation:raise MemberSourceError('Nilai transaksi tidak valid.') from None
    if not n.is_finite():raise MemberSourceError('Nilai transaksi tidak finite.')
    return n

def envelope(body,kind):
    # Observed payments: {data:[...],total_count:N,total_pages:P}; accept one nested data wrapper too.
    nodes=[body]
    if isinstance(body,dict) and isinstance(body.get('data'),dict):nodes.append(body['data'])
    for node in reversed(nodes):
        if not isinstance(node,dict):continue
        for key in (('results','data','customers') if kind=='customers' else ('data','payments')):
            if isinstance(node.get(key),list):
                pages=node.get('total_pages',body.get('total_pages') if isinstance(body,dict) else None)
                count=node.get('total_count',body.get('total_count') if isinstance(body,dict) else None)
                return node[key],pages,count
    raise MemberSourceError('Struktur '+kind+' berbeda dari adapter; tidak ada penulisan Member.')

def page_number(value,field):
    if isinstance(value,bool) or not isinstance(value,int) or value<0:raise MemberSourceError('Metadata pagination '+field+' tidak valid atau tidak tersedia.')
    return value

def customer_cursor_page(body):
    if not isinstance(body,dict) or not isinstance(body.get('results'),list) or 'next_cursor' not in body:
        raise MemberSourceError('Struktur results/next_cursor Customer List berubah; data tidak ditulis.')
    cursor=body['next_cursor']
    if cursor is not None and (not isinstance(cursor,str) or len(cursor)>4096 or (cursor and not re.fullmatch(r'[!-~]+',cursor))):
        raise MemberSourceError('Cursor Customer List tidak valid; data tidak ditulis.')
    return body['results'],cursor or None

class CustomerService:
    def __init__(self,token,transport=None,max_requests=30000):
        self.token=member_authorization(token);self.transport=transport;self.requests=0;self.max_requests=max_requests;self.page_index=1;self.customer_ordinal=None
    def get(self,path,params):
        self.requests+=1
        if self.requests>self.max_requests:raise MemberSourceError('Batas permintaan Member tercapai; tidak menulis hasil parsial.')
        if not path.startswith('/customer/') or path.startswith('//'):raise MemberSourceError('Path Customer Service tidak diizinkan.')
        phase='Customer List' if path=='/customer/v3/customers' else 'Purchase History'
        size=CUSTOMER_PAGE_SIZE if phase=='Customer List' else MEMBER_PAGE_SIZE
        context=f'{phase}; halaman {self.page_index}; per_page {size}; permintaan {self.requests}'
        if phase=='Purchase History' and self.customer_ordinal is not None:context+=f'; customer urutan {self.customer_ordinal}'
        url=BASE+path+'?'+urllib.parse.urlencode(params)
        if self.transport:return self.transport(path,params)
        req=urllib.request.Request(url,headers={'Authorization':self.token,'Accept':'application/json','User-Agent':'commercial-dashboard-moka-sync'})
        try:
            with urllib.request.build_opener(NoRedirect()).open(req,timeout=45) as r:
                raw=r.read(8*1024*1024+1)
                if len(raw)>8*1024*1024:raise MemberSourceError('Respons Member terlalu besar; tidak menulis data parsial.')
                return json.loads(raw,parse_float=Decimal)
        except urllib.error.HTTPError as e:
            detail=('token ditolak atau tidak berlaku' if e.code==401 else 'permintaan ditolak Moka; batas ukuran, izin, sesi atau pembatasan layanan perlu diperiksa' if e.code==403 else 'permintaan sumber gagal')
            raise MemberSourceError(f'Customer Service HTTP {e.code} [{context}]: {detail}. Data analisis Member utama belum diganti.') from None
        except MemberSourceError:raise
        except Exception as e:raise MemberSourceError(f'Customer Service gagal [{context}] ({type(e).__name__}); data tidak ditulis.') from None
    def cursor_pages(self,path,params,body):
        seen_ids=set();seen_cursors=set()
        for cursor_page in range(1,10001):
            rows,cursor=customer_cursor_page(body)
            if not rows and cursor:raise MemberSourceError('Halaman cursor kosong tetapi masih berlanjut; data tidak ditulis.')
            for row in rows:
                if not isinstance(row,dict):raise MemberSourceError('Baris Customer List tidak valid.')
                key=identifier(row.get('customer_id',row.get('id')))
                if key in seen_ids:raise MemberSourceError('Customer ID/halaman cursor berulang; data tidak ditulis.')
                seen_ids.add(key)
                if len(seen_ids)>100000:raise MemberSourceError('Lebih dari 100.000 customer; tidak menulis hasil parsial.')
                yield row
            if cursor_page%100==0:print(f'Member: Customer List {cursor_page} halaman, {len(seen_ids)} customer terbaca; belum menulis data.',flush=True)
            if cursor is None:return
            if cursor in seen_cursors:raise MemberSourceError('Cursor berulang; parameter kelanjutan belum diterima sumber. Data tidak ditulis.')
            seen_cursors.add(cursor)
            # Cursor is opaque. Encode the exact returned value; never decode/log it.
            self.page_index=cursor_page+1
            body=self.get(path,{**params,'per_page':CUSTOMER_PAGE_SIZE,'cursor':cursor})
        raise MemberSourceError('Batas halaman cursor tercapai; data tidak ditulis.')
    def pages(self,path,params,kind):
        self.page_index=1
        size=CUSTOMER_PAGE_SIZE if kind=='customers' else MEMBER_PAGE_SIZE
        first=self.get(path,{**params,'per_page':size,**({} if kind=='customers' else {'page':1})})
        if kind=='customers' and isinstance(first,dict) and 'results' in first:
            yield from self.cursor_pages(path,params,first)
            return
        expected=None;total_pages=None;seen=set();received=0
        for page in range(1,10001):
            self.page_index=page
            body=first if page==1 else self.get(path,{**params,'page':page,'per_page':size})
            rows,pages,count=envelope(body,kind)
            pages=page_number(pages,'total_pages');count=page_number(count,'total_count')
            if page==1:
                expected=count;total_pages=pages
                if count==0:
                    if rows or pages not in (0,1):raise MemberSourceError('Pagination kosong tidak konsisten.')
                    return
                if not pages:raise MemberSourceError('Jumlah halaman tidak konsisten.')
            elif count!=expected or pages!=total_pages:raise MemberSourceError('Sumber berubah saat pagination; data tidak ditulis.')
            if not rows:raise MemberSourceError('Halaman Member terpotong; data tidak ditulis.')
            for row in rows:
                if not isinstance(row,dict):raise MemberSourceError('Baris Member tidak valid.')
                key=identifier(row.get('customer_id',row.get('id'))) if kind=='customers' else row.get('uuid')
                if key in seen:raise MemberSourceError('Halaman/UUID berulang; data tidak ditulis.')
                seen.add(key);received+=1;yield row
            if page==total_pages:
                if received!=expected:raise MemberSourceError('Jumlah baris tidak sama dengan total_count; data tidak ditulis.')
                return
        raise MemberSourceError('Batas halaman Member tercapai; data tidak ditulis.')
    def customers(self):return list(self.pages('/customer/v3/customers',{'type':'ALL'},'customers'))
    def payments(self,cid):return self.pages('/customer/v1/customers/'+urllib.parse.quote(cid,safe='')+'/payments',{},'payments')

def profile(row):
    cid=identifier(row.get('customer_id',row.get('id')))
    name=row.get('name',row.get('customer_name'))
    if not isinstance(name,str) or not name.strip():raise MemberSourceError('Nama Customer List belum dikenali; data tidak ditulis.')
    since=row.get('created_at');since=str(since)[:10] if since else None
    if since:
        try:datetime.strptime(since,'%Y-%m-%d')
        except ValueError:raise MemberSourceError('Tanggal pendaftaran customer tidak valid.') from None
    return {'customer_key':'MOKA:'+cid,'source_id':cid,'name':name.strip(),'city':row.get('city') if isinstance(row.get('city'),str) else None,
            'phone':next((row[k] for k in ('phone','phone_number') if isinstance(row.get(k),str)),None),'cust_since':since}

def payment(row,p,store_map,tz):
    try:key=str(uuid.UUID(str(row['uuid'])))
    except (ValueError,KeyError,AttributeError):raise MemberSourceError('UUID pembayaran tidak valid; id=0 tidak dipakai.') from None
    flag=row.get('is_refunded')
    if not isinstance(flag,bool):raise MemberSourceError('is_refunded harus boolean sumber.')
    net=amount(row.get('total_collected'))
    if (flag and net>0) or (not flag and net<0):raise MemberSourceError('Tanda nilai dan status refund tidak sesuai contoh terverifikasi; data tidak ditulis.')
    try:
        dt=datetime.fromisoformat(str(row['created_at']).replace('Z','+00:00'))
        if dt.tzinfo is None:raise ValueError()
    except (ValueError,KeyError):raise MemberSourceError('Waktu sumber tidak valid atau tanpa zona waktu.') from None
    explicit=row.get('customer_id')
    if explicit is not None and str(explicit)!=p['source_id']:raise MemberSourceError('Identitas customer pada riwayat tidak sesuai konteks URL.')
    outlet=row.get('outlet_name')
    if not isinstance(outlet,str):raise MemberSourceError('Nama outlet pada pembayaran tidak tersedia.')
    sid=store_map.get(norm(outlet))
    name=row.get('customer_name')
    return {'store_id':sid,'transaction_id':key,'customer_key':p['customer_key'],
      'customer_name':name.strip() if isinstance(name,str) and name.strip() else p['name'],
      'name_basis':'history' if isinstance(name,str) and name.strip() else 'customer_list_at_import',
      'created_at':dt.isoformat(),'sale_date':dt.astimezone(tz).date().isoformat(),'net':str(net),'kind':'refund' if flag else 'sale'}

def collect(api,store_map,scopes,tz,progress=None):
    raw_customers=api.customers()
    if not raw_customers:raise MemberSourceError('Customer List kosong; tidak menghapus data Member lama.')
    profiles=[profile(r) for r in raw_customers];records=[];selected=set();unknown=0
    if progress:progress(0,len(profiles),0)
    for i,p in enumerate(profiles):
        api.customer_ordinal=i+1
        for raw in api.payments(p['source_id']):
            row=payment(raw,p,store_map,tz)
            if row['store_id'] is None:
                if any(s['date_from']<=row['sale_date']<=s['date_to'] for s in scopes):unknown+=1
                continue
            if not any(row['store_id']==s['store_id'] and s['date_from']<=row['sale_date']<=s['date_to'] for s in scopes):continue
            if row['transaction_id'] in selected:raise MemberSourceError('UUID ditemukan pada lebih dari satu customer; data tidak ditulis.')
            selected.add(row['transaction_id']);records.append(row)
            if len(records)>500000:raise MemberSourceError('Lebih dari 500.000 nota terpilih; persempit rentang.')
        if progress and (i%50==0 or i+1==len(profiles)):progress(i+1,len(profiles),len(records))
    return {'profiles':profiles,'records':records,'unmapped_payments':unknown,'http_requests':api.requests}

def sync(db,mapped,stores,aliases,periods,tz,writing=True,progress=None,api=None):
    token=os.environ.get('MOKA_CUSTOMER_ACCESS_TOKEN') or os.environ.get('MOKA_ACCESS_TOKEN')
    api=api or CustomerService(token)
    allowed={int(sid) for _,sid in mapped};mapping={}
    pairs=[(r['name'],int(r['id'])) for r in stores]+[(r['alias'],int(r['store_id'])) for r in aliases]+[(o['name'],int(sid)) for o,sid in mapped]
    for name,sid in pairs:
        k=norm(name)
        if k in mapping and mapping[k]!=sid:raise MemberSourceError('Alias outlet ambigu; perbaiki mapping toko.')
        mapping[k]=sid
    scopes=[{'store_id':sid,'date_from':a.isoformat(),'date_to':b.isoformat()} for sid in sorted(allowed) for _,_,a,b in periods]
    data=collect(api,mapping,scopes,tz,progress)
    if writing:
        # No writes until ALL source pagination has completed successfully.
        db.rpc('commercial_member_replace_v47',{'p_scopes':scopes,'p_profiles':data['profiles'],'p_rows':data['records'],'p_complete':data['unmapped_payments']==0})
    return {'status':'WARN' if data['unmapped_payments'] else 'OK','customers':len(data['profiles']),'receipts':len(data['records']),'unmapped_payments':data['unmapped_payments'],'http_requests':data['http_requests']}
