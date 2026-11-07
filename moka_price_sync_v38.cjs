'use strict';
const E=require('./price-list-v24.js');const fs=require('fs');
function buildLibrary(rows,outlet,current){
 E.setColors(JSON.parse(fs.readFileSync(__dirname+'/price-colors-v24.json','utf8')));
 const types=[...new Set(rows.flatMap(r=>Object.keys(r.prices||{})))].sort();
 if(!types.length)throw Error('Library tidak memiliki kolom harga Sales Type; Price List lama dipertahankan.');
 const aoa=[['Category','Items Name (Do Not Edit)','Brand Name','SKU','Cost Amount','Basic - Price',...types.map(t=>t+' - Price')],...rows.map(r=>[r.category||'',r.item_name,r.brand||'',r.sku||'',r.cogs??'',r.basic_price??'',...types.map(t=>r.prices?.[t]??'')])];
 const next=E.compactDoc(E.build(aoa,'Item Library - '+outlet+'.csv',outlet));
 if(current){current=E.unpackDoc(current);const manual=current.data.groups.filter(g=>g.origin==='manual'),cols=[...new Set([...next.data.columns,...manual.flatMap(()=>current.data.columns)])],remap=(g,from)=>({...g,prices:cols.map(c=>{const i=from.indexOf(c);return i<0?null:g.prices[i]??null})});next.data.groups=next.data.groups.map(g=>remap(g,next.data.columns)).concat(manual.map(g=>remap(g,current.data.columns)));next.data.columns=cols;}
 E.validate(next);return E.packDoc(next);
}
function isDC(outlet){return /^(?:DC|DISTRIBUTION CENTER|GUDANG)(?:[\s._-]|$)/i.test(String(outlet||'').trim());}
function comparable(doc){if(!doc)return null;const data={...doc.data};delete data.imported_at;delete data.source_name;return {outlet:doc.outlet,city:doc.city,data};}
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
function sameDocument(a,b){return JSON.stringify(canonical(comparable(a)))===JSON.stringify(canonical(comparable(b)));}
const retryable=e=>/sudah berubah|40001|409|57014|statement timeout|Supabase (?:429|500|502|503|504)|fetch failed|network|timed out|timeout|aborted/i.test(e.message);
async function syncOutlet(outlet,api,{sleep=ms=>new Promise(r=>setTimeout(r,ms)),maxAttempts=4}={}){
 if(!outlet)throw Error('Nama outlet wajib diisi.');
 if(isDC(outlet))return {status:'skipped',outlet,reason:'DC/gudang tidak dimasukkan ke Price List'};
 if(!E.city(outlet))return {status:'skipped',outlet,reason:'Bukan kota katalog'};
 const rows=[];let pageSize=500;
 for(let start=0;;){let batch;
  for(let attempt=0;attempt<maxAttempts;attempt++){
   try{batch=await api('moka_items?select=sku,item_name,category,brand,cogs,basic_price,prices&outlet_name=eq.'+encodeURIComponent(outlet)+'&order=variant_id',{headers:{Range:`${start}-${start+pageSize-1}`,'Range-Unit':'items'}});break}
   catch(e){if(!retryable(e)||attempt+1>=maxAttempts)throw e;pageSize=Math.max(100,Math.floor(pageSize/2));await sleep(Math.min(8000,1000*2**attempt));}
  }
  rows.push(...batch);if(batch.length<pageSize)break;start+=batch.length;
 }
 if(!rows.length)throw Error('Library kosong; Price List lama dipertahankan.');
 for(let attempt=0;attempt<maxAttempts;attempt++){
  try{
   const current=(await api('commercial_price_list_v24?select=*&outlet=eq.'+encodeURIComponent(outlet)))[0],doc=buildLibrary(rows,outlet,current);
   if(current&&sameDocument(doc,current))return {status:'unchanged',outlet,reason:'Harga/katalog sama; tidak ditulis ulang',version:current.version};
   const result=await api('rpc/commercial_price_list_auto_v42',{method:'POST',body:JSON.stringify({p_outlet:doc.outlet,p_city:doc.city,p_data:doc.data,p_version:current?.version||0})});
   return {status:result.status==='unchanged'?'unchanged':'saved',outlet,version:result.version,attempts:attempt+1};
  }catch(e){if(!retryable(e)||attempt+1>=maxAttempts)throw e;await sleep(Math.min(8000,1000*2**attempt));}
 }
}
async function main(){
 const outlet=process.argv[2];
 // DC is skipped before reading credentials or making any network request.
 if(isDC(outlet)||outlet&&!E.city(outlet)){const result=await syncOutlet(outlet,()=>{throw Error('Network must not be called')});console.log('PRICE_RESULT_JSON='+JSON.stringify(result));return;}
 const base=(process.env.SUPABASE_URL||'').replace(/\/$/,''),key=process.env.SUPABASE_KEY;if(!base||!key)throw Error('Konfigurasi Supabase belum lengkap.');
 const headers={apikey:key,'Content-Type':'application/json'};if(key.startsWith('eyJ'))headers.Authorization='Bearer '+key;
 async function api(path,opts={}){const r=await fetch(base+'/rest/v1/'+path,{...opts,headers:{...headers,...opts.headers},signal:AbortSignal.timeout(60000)});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error('Supabase '+r.status+' ['+path.split('?')[0]+']: '+(d.code?d.code+' · ':'')+(d.message||'Permintaan gagal'));return d;}
 const result=await syncOutlet(outlet,api);console.log('PRICE_RESULT_JSON='+JSON.stringify(result));
}
module.exports={buildLibrary,isDC,sameDocument,syncOutlet};if(require.main===module)main().catch(e=>{console.error(e.message);process.exit(1)});
