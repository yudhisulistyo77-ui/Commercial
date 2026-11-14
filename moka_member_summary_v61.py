"""Lossless numeric aggregates. Invoice IDs never leave this module's output."""
from decimal import Decimal
from uuid import uuid5, NAMESPACE_URL
import json

def daily(rows):
    groups={}
    seen=set()
    for r in rows:
        identity=(r['store_id'],r.get('transaction_id'))
        if identity[1] is None or identity in seen:raise ValueError('UUID transaksi ganda/kosong; ringkasan tidak disimpan')
        seen.add(identity)
        key=(r['store_id'],r['customer_key'],r['sale_date'])
        g=groups.setdefault(key,dict(zip(('store_id','customer_key','sale_date'),key))|{'customer_name':r['customer_name'],'sales':Decimal(0),'refunds':Decimal(0),'trx':0,'refund_count':0})
        value=Decimal(str(r['net']))
        if not value.is_finite() or r['kind'] not in ('sale','refund') or (r['kind']=='sale' and value<0) or (r['kind']=='refund' and value>0):raise ValueError('Nilai sale/refund tidak valid')
        if r['kind']=='sale':g['sales']+=value;g['trx']+=1
        else:g['refunds']-=value;g['refund_count']+=1
    return [{k:str(v) if isinstance(v,Decimal) else v for k,v in g.items()} for _,g in sorted(groups.items())]

def items(rows):
    groups={}
    keys=('store_id','customer_key','sale_date','item_name','variant_name','category_name')
    for r in rows:
        key=tuple(r.get(k) if k not in ('variant_name','category_name') else (r.get(k) or '') for k in keys)
        g=groups.setdefault(key,dict(zip(keys,key))|{'qty':Decimal(0),'net':Decimal(0)})
        for k in ('qty','net'):
            value=Decimal(str(r[k]))
            if not value.is_finite():raise ValueError('Nilai item tidak valid')
            g[k]+=value
    return [{**g,'transaction_id':str(uuid5(NAMESPACE_URL,'CMC-SUMMARY:'+json.dumps(key,ensure_ascii=False))), 'line_no':0,'qty':str(g['qty']),'net':str(g['net'])}for key,g in sorted(groups.items())]
