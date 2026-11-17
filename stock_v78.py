"""Pure stock normalisation. Never interpret missing inventory or booleans as zero units."""
from decimal import Decimal, InvalidOperation
from datetime import date
import re, hashlib

def numeric(value):
    if value is None or isinstance(value,bool) or str(value).strip()=='': return None
    try:
        n=Decimal(str(value))
        return n if n.is_finite() else None
    except InvalidOperation: return None

def norm(value): return re.sub(r'\s+',' ',str(value or '').strip()).upper()

def quantity(variant,item):
    for obj in (variant,item):
        for flag in ('track_stock','is_inventory_tracked','track_inventory'):
            if obj.get(flag) is False: return None,'untracked'
    for key in ('in_stock','stock_quantity','stock'):
        n=numeric(variant.get(key))
        if n is not None:return n,key
    inventory=variant.get('inventory')
    if isinstance(inventory,dict):
        for key in ('in_stock','quantity','stock'):
            n=numeric(inventory.get(key))
            if n is not None:return n,'inventory.'+key
    return None,'unavailable'

def catalogue(items,brands=None):
    brands=brands or {};out=[];seen=set()
    for item in items:
        if item.get('is_deleted'):continue
        variants=item.get('item_variants',item.get('variants'))
        if not isinstance(variants,list):raise ValueError('Item Library tanpa daftar variant; snapshot tidak diterbitkan')
        for v in variants:
            if v.get('is_deleted'):continue
            key=str(v.get('id') or '')
            if not key or key in seen:raise ValueError('Variant ID kosong/ganda; snapshot tidak diterbitkan')
            seen.add(key);name=' '.join(str(x).strip() for x in (item.get('name') or '',v.get('name') or '') if str(x).strip())
            if not name:raise ValueError('Nama variant kosong')
            sku=norm(v.get('sku'));q,source=quantity(v,item)
            try:created_on=date.fromisoformat(str(v.get('created_at') or item.get('created_at') or '')[:10]).isoformat()
            except ValueError:created_on=None
            cat=(item.get('category') or {}).get('name') if isinstance(item.get('category'),dict) else item.get('category')
            brand=brands.get(str(item.get('brand_id'))) or item.get('brand_name') or 'LAINNYA'
            fingerprint=hashlib.sha256(norm(name).encode()).hexdigest()
            out.append(dict(created_on=created_on,variant_key=key,sku=sku or None,item_name=name,category=cat or '',brand=norm(brand),fingerprint=fingerprint,qty=None if q is None else str(q),qty_source=source,cogs=None if numeric(v.get('cogs')) is None else str(numeric(v.get('cogs')))))
    if not out:raise ValueError('Katalog kosong; snapshot lama dipertahankan')
    return out

def demand(rows,report_sets):
    """Reports must be reconciled before calling. Match exact SKU/name; ambiguity stays unknown."""
    by_sku={};by_name={}
    for r in rows:
        if r['sku']:by_sku.setdefault(r['sku'],[]).append(r)
        by_name.setdefault(norm(r['item_name']),[]).append(r)
    metrics={r['variant_key']:{'sold14':Decimal(0),'prior14':Decimal(0),'sold90':Decimal(0),'refund90':Decimal(0),'net90':Decimal(0),'demand_known':True,'history_known':True,'match_ok':bool(r['sku']) and len(by_sku[r['sku']])==1}for r in rows}
    unmatched=0
    for period,reports in report_sets.items():
        if reports is None:
            for m in metrics.values():m['history_known' if period=='sold90' else 'demand_known']=False
            continue
        for report in reports:
            sku=norm(report.get('sku'));name=norm(report.get('name'));matches=by_sku.get(sku,[]) if sku else by_name.get(name,[])
            if len(matches)!=1 or (name and name!=norm(matches[0]['item_name'])):
                unmatched+=1
                # Do not infer a zero for items that cannot be matched reliably.
                affected=matches or by_name.get(name,[])
                for r in affected:metrics[r['variant_key']]['history_known' if period=='sold90' else 'demand_known']=False
                continue
            m=metrics[matches[0]['variant_key']];sold=numeric(report.get('item_sold'));refund=numeric(report.get('item_refunded'))
            if sold is None or sold<0 or (refund is not None and refund<0):m['history_known' if period=='sold90' else 'demand_known']=False;continue
            m[period]+=sold
            if period=='sold90':m['refund90']+=refund or Decimal(0);m['net90']+=numeric(report.get('net_sales')) or Decimal(0)
    for r in rows:
        m=metrics[r['variant_key']]
        if r['sku'] and len(by_sku[r['sku']])>1:m['demand_known']=False
        if m['history_known'] and m['sold90']<m['sold14']+m['prior14']:m['history_known']=False
        r.update({k:str(v) if isinstance(v,Decimal) else v for k,v in m.items()})
    return rows,unmatched
