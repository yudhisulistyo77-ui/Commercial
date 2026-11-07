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
async function main(){
 const outlet=process.argv[2];if(!outlet)throw Error('Nama outlet wajib diisi.');
 if(!E.city(outlet)){console.log('Price List dilewati (bukan kota katalog): '+outlet);return;}
 const base=(process.env.SUPABASE_URL||'').replace(/\/$/,''),key=process.env.SUPABASE_KEY;if(!base||!key)throw Error('Konfigurasi Supabase belum lengkap.');
 const headers={apikey:key,'Content-Type':'application/json'};if(key.startsWith('eyJ'))headers.Authorization='Bearer '+key;
 async function api(path,opts={}){const r=await fetch(base+'/rest/v1/'+path,{...opts,headers:{...headers,...opts.headers},signal:AbortSignal.timeout(60000)});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error('Supabase '+r.status+': '+(d.message||'Permintaan gagal'));return d;}
 const rows=[];for(let start=0;;){const batch=await api('moka_items?select=sku,item_name,category,brand,cogs,basic_price,prices&outlet_name=eq.'+encodeURIComponent(outlet)+'&order=variant_id',{headers:{Range:`${start}-${start+999}`,'Range-Unit':'items'}});rows.push(...batch);if(batch.length<1000)break;start+=batch.length;}
 if(!rows.length)throw Error('Library kosong; Price List lama dipertahankan.');
 for(let attempt=0;attempt<3;attempt++){
  const current=(await api('commercial_price_list_v24?select=*&outlet=eq.'+encodeURIComponent(outlet)))[0];const doc=buildLibrary(rows,outlet,current);
  try{await api('rpc/commercial_price_list_auto_v38',{method:'POST',body:JSON.stringify({p_outlet:doc.outlet,p_city:doc.city,p_data:doc.data,p_version:current?.version||0})});console.log('Price List tersimpan: '+outlet);return;}
  catch(e){if(attempt===2||!/sudah berubah|40001|409/.test(e.message))throw e;}
 }
}
module.exports={buildLibrary};if(require.main===module)main().catch(e=>{console.error(e.message);process.exit(1)});
