/* V62: bounded navigation reuse, layout and removal of the retired AI module. */
(function(){'use strict';if(window.UI62)return;const U=window.UI62={version:62};
const pages=new Set(['h2h','salestype','program','review','bazar','mkt','brand','top','jam']),stamps=new Map();let previous=null,frame=null;
function key(){return JSON.stringify([S.url,MASTER.session?.user?.id,MASTER.session?.user?.role,MASTER.session?.user?.rule,S.year,S.years,S.month,S.range,S.brand,S.spv,S.store,S.storesSel,S.customFrom,S.customTo,S.topBrand,S.topCat,S.topN,S.bpBrand,S.bpCat,S.h2h,S.settings?.commercial_moka_revision,typeof NUMBER_MODE==='undefined'?'':NUMBER_MODE]);}
function ready(p){return p&&p.querySelector('.phead')&&!/Memuat|Sedang memuat|Gagal memuat|Waktu koneksi habis/.test(p.textContent);}
const beforeRender=render;render=function(...args){const page=S.page,p=document.getElementById('p-'+page),identity=key();const menus=MASTER.session?.user?.rule?.menus;if(Array.isArray(menus)&&menus.length===1&&menus[0]==='__retired_aiagent__'){parkFilters();p.replaceChildren(el('div',{class:'note warn'},'Menu AI Agent telah dihentikan. Hubungi Master untuk menentukan menu yang boleh Anda akses.'));return;}if(previous!==page&&pages.has(page)&&stamps.get(page)?.key===identity&&Date.now()-stamps.get(page).at<90000&&ready(p)){
 parkFilters();const old=p.querySelector('.comparison-scope-v62')||p.querySelector('.pagefilters');if(old){const fields=pageFilterBar(page);if(fields){if(old.matches('.comparison-scope-v62'))old.replaceChildren(...fields.childNodes);else old.replaceWith(fields);}}renderConsistencyNoticeV23();renderMappingNotice();previous=page;window.MOTION60?.finish();return;}
 previous=page;const result=beforeRender.apply(this,args);if(pages.has(page)){if(frame!==null)cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{frame=null;if(S.page===page)stamps.set(page,{key:key(),at:Date.now()});});}return result;};
const oldGo=go;go=function(id,...args){if(id!==S.page){for(const [controller,page]of READ_V22.controllers)if(page!==id)controller.abort();const obsolete=READ_V22.queue.filter(j=>j.page!==id);READ_V22.queue=READ_V22.queue.filter(j=>j.page===id);for(const job of obsolete)job.reject(readAbortV22());window.MOTION60?.finish();}return oldGo.call(this,id,...args)};
const reset=masterResetCaches;masterResetCaches=function(...args){stamps.clear();previous=null;return reset.apply(this,args)};
const clear=masterClear;masterClear=function(...args){stamps.clear();previous=null;return clear.apply(this,args)};
const oldLoad=loadAll;loadAll=function(...args){stamps.clear();previous=null;return oldLoad.apply(this,args)};
// Remove only caches belonging to the retired optional model, never app/customer data.
(async()=>{try{if('caches'in window)for(const k of await caches.keys())if(/^(webllm|mlc-chat|mlcjs|mlc-llm)/i.test(k))await caches.delete(k);if(indexedDB.databases)for(const d of await indexedDB.databases())if(d.name&&/^(webllm|mlc-chat|mlcjs|mlc-llm)/i.test(d.name))indexedDB.deleteDatabase(d.name);}catch{}})();
U.invalidate=()=>{stamps.clear();previous=null};
})();
