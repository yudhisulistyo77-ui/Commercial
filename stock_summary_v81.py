"""Inventory Summary adapter. Routes/aliases are candidates, validated at runtime.
No live endpoint has been verified in this workspace. Never publish unknown schema.
"""
import json,os,re
from pathlib import Path
from decimal import Decimal
from stock_v78 import numeric,norm

ALIASES={
 'opening':['opening','beginning','starting','starting_stock','beginning_stock','opening_stock','stok_awal'],
 'incoming':['incoming','received','stock_in','incoming_stock','stok_masuk'],
 'sold':['sold','item_sold','sales_quantity','qty_sold','terjual'],
 'adjustment':['adjustment','adjusted','adjustments','stock_adjustment','penyesuaian'],
 'ending':['ending','ending_stock','closing_stock','ending_inventory','stok_akhir'],
 'variant_id':['variant_id','item_variant_id'], 'sku':['sku'],
 'name':['name_variant','name___variant','item_name','name','nama_item'],
}
def key(k):return re.sub('[^a-z0-9]+','_',str(k).strip().lower()).strip('_')
def normalized(row,mapping=None):
    if not isinstance(row,dict):raise ValueError('Summary bukan objek baris')
    values={key(k):v for k,v in row.items()};out={}
    for field,aliases in ALIASES.items():
        keys=[key(mapping[field])]if mapping and field in mapping else [key(x)for x in aliases]
        found=[values[k]for k in keys if k in values and values[k] is not None]
        if field in ('opening','incoming','sold','adjustment','ending'):
            nums=[numeric(v)for v in found]
            if not nums or any(x is None for x in nums)or len(set(nums))!=1:raise ValueError('Kolom Summary tidak dikenali/ambigu: '+field+'; kolom tersedia: '+', '.join(sorted(values)))
            out[field]=nums[0]
        else:
            if len({norm(v)for v in found})>1:raise ValueError('Identitas Summary ambigu: '+field)
            out[field]=str(found[0]).strip()if found else ''
    if out['sold']<0:raise ValueError('Qty terjual Summary negatif; semantik sumber perlu diperiksa')
    # Incoming must mean net incoming if outgoing transfers are present.
    # Never invent missing components by taking a residual.
    if abs(out['opening']+out['incoming']-out['sold']+out['adjustment']-out['ending'])>Decimal('0.000001'):
        raise ValueError('Summary tidak seimbang: awal + masuk - terjual + penyesuaian != akhir; periksa arti kolom transfer/refund')
    if not(out['variant_id']or out['sku']or out['name']):raise ValueError('Identitas item Summary kosong')
    # Scalar source columns are retained for inspection; never save credentials.
    out['source_columns']={str(k):v for k,v in row.items()if isinstance(v,(str,int,float,bool))or v is None}
    for k in list(out['source_columns']):
        if re.search('token|password|authorization|cookie|secret',k,re.I):del out['source_columns'][k]
    return out

def _rows(body):
    if isinstance(body,list):return body,{}
    if not isinstance(body,dict):raise ValueError('Summary bukan JSON objek/array')
    if isinstance(body.get('data'),dict):body=body['data']
    candidates=[body[k]for k in ('inventory_summary','inventory_summaries','item_inventories','inventories','items','rows')if isinstance(body.get(k),list)]
    if len(candidates)!=1:raise ValueError('Daftar Summary tidak dikenali/ambigu; kolom: '+', '.join(sorted(map(str,body))))
    return candidates[0],body

def fetch_summary(moka,oid,start,end):
    """Try only pre-existing audit candidates. 401/403 are not bypassed/retried."""
    configured=os.environ.get('MOKA_STOCK_SUMMARY_PATH','').strip()
    paths=[configured.format(outlet_id=oid)]if configured else [f'/v{v}/outlets/{oid}/reports/inventory_summary'for v in (1,2,3)]
    if any(not p.startswith('/v')or'://'in p or'?'in p for p in paths):raise ValueError('Path Summary harus path relatif Moka tanpa query/host')
    mapping=json.loads(os.environ.get('MOKA_STOCK_SUMMARY_COLUMNS','{}'))
    reasons=[];checks=[]
    def diagnostic(ok=False):
        folder=Path('stock-summary-diagnostics');folder.mkdir(exist_ok=True)
        (folder/('summary-'+str(oid)+'.json')).write_text(json.dumps({'schema_validated':ok,'live_verified_in_development':False,'requested_start':start.isoformat(),'requested_end':end.isoformat(),'checks':checks},indent=2))
    for endpoint in paths:
        page=1;rows=[];seen=set();path=endpoint;params=None
        try:
            for _ in range(200):
                if params is None:params={'start':start.strftime('%d/%m/%Y'),'end':end.strftime('%d/%m/%Y'),'page':page,'per_page':250}
                batch,meta=_rows(moka.get(path,params,retry_500=False,retries=1));marker=json.dumps(batch,sort_keys=True,separators=(',',':'))
                if page==1 and batch:checks.append({'path':endpoint,'columns':sorted(str(k)for k in batch[0]if not re.search('token|password|authorization|cookie|secret',str(k),re.I))})
                if batch and marker in seen:raise ValueError('Pagination Summary berulang; tidak diterbitkan')
                seen.add(marker);rows.extend(normalized(x,mapping)for x in batch)
                if meta.get('completed')is True or not batch or(meta.get('total_count')is not None and len(rows)==int(meta['total_count'])):
                    if meta.get('total_count')is not None and len(rows)!=int(meta['total_count']):raise ValueError('Jumlah Summary tidak lengkap')
                    if not rows:raise ValueError('Summary kosong; snapshot lama dipertahankan')
                    diagnostic(True);return rows,endpoint
                if meta.get('next_url'):
                    path=meta['next_url'];params={};page+=1
                else:page+=1;path=endpoint;params=None
            raise ValueError('Batas halaman Summary tercapai')
        except Exception as exc:
            status=getattr(exc,'status',getattr(exc,'code',None))
            if status in (401,403,429):
                checks.append({'path':endpoint,'status':status});diagnostic();raise ValueError('Akses Summary HTTP '+str(status)+'; penarikan dihentikan tanpa mencoba rute lain')from None
            # Error text is local validation only; HTTP bodies are not logged.
            reasons.append(endpoint+': '+('HTTP '+str(status)if status is not None else str(exc)[:550]))
            checks.append({'path':endpoint,'status':status,'validation_error':str(exc)[:550]if status is None else None})
    diagnostic()
    raise ValueError('Inventory Summary belum terverifikasi. '+' | '.join(reasons))

def attach_summary(rows,source):
    indices={k:{}for k in ('variant_id','sku','name')}
    for r in source:
        for k in indices:
            if r[k]:indices[k].setdefault(norm(r[k]),[]).append(r)
    catalogue_keys={k:{}for k in ('variant_id','sku','name')}
    for r in rows:
        for k,v in [('variant_id',r['variant_key']),('sku',r['sku']),('name',r['item_name'])]:
            if v:catalogue_keys[k][norm(v)]=catalogue_keys[k].get(norm(v),0)+1
    used=set();missing=0
    for r in rows:
        candidates=[];matched_by=None
        for k,value in [('variant_id',r['variant_key']),('sku',r['sku']),('name',r['item_name'])]:
            if value and norm(value)in indices[k]:
                if catalogue_keys[k].get(norm(value))!=1:continue
                candidates=indices[k][norm(value)];matched_by=k;break
        match=candidates[0]if len(candidates)==1 else None
        if match and match['sku']and r['sku']and norm(match['sku'])!=norm(r['sku']):match=None
        if match and matched_by=='sku'and match['name']and norm(match['name'])!=norm(r['item_name']):match=None
        if match and id(match)in used:match=None
        r['summary_known']=match is not None
        for k in ('opening','incoming','sold','adjustment','ending'):r['summary_'+k]=str(match[k])if match else None
        r['summary_columns']=match['source_columns']if match else {}
        if match:used.add(id(match))
        else:missing+=1
    if not used:raise ValueError('Tidak ada identitas Summary yang cocok katalog; snapshot tidak diterbitkan')
    return rows,missing,len(source)-len(used)
