/* Session-only bounded read cache and local JSON-payload diagnostics.
 * No telemetry uploads. Byte counts are uncompressed JSON estimates, not billed egress.
 */
(function(){'use strict';
const E=window.EGRESS_V44={ttl:60000,maxBytes:8*1024*1024,maxEntries:12,bytes:0,generation:0,cache:new Map(),pending:new Map(),stats:new Map(),now:()=>Date.now(),force:false};
const clone=x=>typeof structuredClone==='function'?structuredClone(x):JSON.parse(JSON.stringify(x));
const byteSize=x=>{try{return new Blob([JSON.stringify(x)]).size}catch{return 0}};
const scope=()=>S.url+'|'+(MASTER.session?.access_token||'')+'|'+(MASTER.session?.user?.id||'')+'|'+(MASTER.session?.user?.role||'');
const metric=key=>{if(!E.stats.has(key))E.stats.set(key,{endpoint:key,requests:0,cache_hits:0,estimated_json_bytes:0,errors:0});return E.stats.get(key)};
E.clear=function(resetStats=false){E.generation++;E.cache.clear();E.pending.clear();E.bytes=0;if(resetStats)E.stats.clear()};
function evict(){for(const [key,entry]of E.cache)if(entry.until<=E.now()){E.cache.delete(key);E.bytes-=entry.bytes}while(E.bytes>E.maxBytes||E.cache.size>E.maxEntries){const [key,entry]=E.cache.entries().next().value;E.cache.delete(key);E.bytes-=entry.bytes}}
async function read(key,label,loader,cacheable=true){
 const m=metric(label);cacheable=cacheable&&!E.force&&MASTER.verified&&!!MASTER.session?.access_token&&MASTER.session.project===S.url&&Number(MASTER.session.expires_at)*1000>Date.now();
 const identity=scope()+'|'+key,generation=E.generation;
 if(cacheable){evict();const entry=E.cache.get(identity);if(entry){m.cache_hits++;return clone(entry.value)}const pending=E.pending.get(identity);if(pending){m.cache_hits++;return clone(await pending)}}
 m.requests++;const job=(async()=>{try{const result=await loader(),bytes=byteSize(result);m.estimated_json_bytes+=bytes;
  if(cacheable&&generation===E.generation&&identity.startsWith(scope()+'|')&&bytes<=E.maxBytes){const old=E.cache.get(identity);if(old)E.bytes-=old.bytes;E.cache.set(identity,{value:clone(result),bytes,until:E.now()+E.ttl});E.bytes+=bytes;evict()}
  return result;
 }catch(e){m.errors++;throw e}})();
 if(cacheable)E.pending.set(identity,job);
 try{return await job}finally{if(E.pending.get(identity)===job)E.pending.delete(identity)}
}
const labelPath=path=>'GET '+String(path).split('?')[0];
for(const name of ['sel','selAll']){const original=DB[name];DB[name]=function(path,...args){const table=String(path).split('?')[0],smallControl=table==='app_settings'&&/key=/.test(path),eligible=!smallControl&&(!['stores','store_aliases'].includes(table)||name==='selAll');return read(name+'|'+path+'|'+JSON.stringify(args),labelPath(path),()=>original.call(this,path,...args),eligible)}}
const readRPC=/^(commercial_member_view_(profile_v40|agent_v41|v39|detail_v39|v38)|commercial_brand_monthly_v38|commercial_brand_stores_v1|commercial_trx_sales_v1|commercial_item_(detail_v16|rollup_v1)|commercial_heatmap_v1|item_categories)$/;
const mutation=/(?:^|_)(save|mutate|delete|replace|rebuild|stage|commit|begin|enqueue|upsert|update|login|logout)(?:_|$)/;
const originalMaster=masterPublicRpc;masterPublicRpc=function(name,args={},token=null){if(mutation.test(name))E.clear();return read('pin-rpc|'+name+'|'+JSON.stringify(args),'RPC '+name,()=>originalMaster.call(this,name,args,token),readRPC.test(name)&&token===MASTER.session?.access_token)};
const originalRpc=DB.rpc;DB.rpc=function(name,args={},options){if(mutation.test(name))E.clear();return read('rpc|'+name+'|'+JSON.stringify(args),'RPC '+name,()=>originalRpc.call(this,name,args,options),readRPC.test(name)&&!options?.signal)};
for(const name of ['write','patch','del']){const original=DB[name];if(typeof original!=='function')continue;DB[name]=async function(...args){E.clear();return await original.apply(this,args)}}
const reset=masterResetCaches;masterResetCaches=function(){E.clear();return reset.apply(this,arguments)};
const clear=masterClear;masterClear=function(){E.clear(true);return clear.apply(this,arguments)};
const originalPriceLoad=priceLoadV24;priceLoadV24=async function(force=false){if(!force)return originalPriceLoad.apply(this,arguments);E.clear();E.force=true;try{return await originalPriceLoad.apply(this,arguments)}finally{E.force=false}};
E.snapshot=()=>[...E.stats.values()].map(r=>({...r})).sort((a,b)=>b.estimated_json_bytes-a.estimated_json_bytes);
E.open=function(){const {box}=opsModal('Pemeriksaan transfer data · sesi browser');box.style.maxWidth='min(1100px,calc(100vw - 24px))';const body=el('div');
 function paint(){const rows=E.snapshot(),total=rows.reduce((s,r)=>s+r.estimated_json_bytes,0);body.replaceChildren(el('p',{class:'note'},'Angka berikut adalah estimasi ukuran JSON setelah dibaca browser, bukan angka egress tagihan Supabase. Hanya mencakup tab/sesi ini; tidak mencakup GitHub worker, tab/perangkat lain, atau project lain. Tidak mengirim telemetry.'),el('div',{class:'grid g3'},tile('JSON diterima',format(total),'perkiraan tanpa kompresi',null),tile('Permintaan baca',int(rows.reduce((s,r)=>s+r.requests,0)),'panggilan fungsi baca; pagination dapat membuat beberapa HTTP request',null),tile('Baca dari cache',int(rows.reduce((s,r)=>s+r.cache_hits,0)),'tanpa membaca ulang hasil yang sama dari server',null)),memberTableV27(['Endpoint','Permintaan','Dari cache','Estimasi JSON','Error'],rows.map(r=>[r.endpoint,int(r.requests),int(r.cache_hits),format(r.estimated_json_bytes),int(r.errors)]),[]));}
 function format(bytes){return (bytes/1024/1024).toLocaleString('id-ID',{maximumFractionDigits:2})+' MB'}
 box.append(el('p',{},'Cache maksimal 60 detik dan 8 MB, hanya dalam memori sesi PIN. Logout, perubahan data dan reset cache membuang cache. Data dengan filter berbeda tetap dibaca terpisah.'),el('div',{class:'rowline'},el('button',{class:'btn',onclick:paint},'Perbarui laporan'),el('button',{class:'btn',onclick:()=>{E.clear();toast('Cache sesi dibuang. Pembacaan berikutnya mengambil data baru.');paint()}},'Buang cache sesi')),body);paint();
};
document.addEventListener('click',event=>{const button=event.target.closest?.('button');if(button&&/Muat ulang/i.test(button.textContent))E.clear();},true);
const before=render;render=function(){const result=before.apply(this,arguments);requestAnimationFrame(()=>{const page=document.querySelector('.page.on');if(!page||!MASTER.verified||page.querySelector('[data-egress-v44]'))return;const head=page.querySelector('.phead');head?.append(el('button',{class:'btn sm','data-egress-v44':'','data-export-control':'',onclick:E.open},'Cek transfer sesi'))});return result};
})();
