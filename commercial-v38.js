(function(){
 'use strict';
 const X=window.V38={brandFacts:null,stock:{q:'',brand:'',category:'',only:'all',page:0},stockEpoch:0};
 const oldClear=masterClear;masterClear=function(){oldClear.apply(this,arguments);if(window.COMMERCIAL_LOGIN_REQUIRED_V38){S.dash=[];S.dashAll=[];S.trx=[];S.trxAll=[];S.logs=[];S.settings={};S.rollCache.clear();for(const k of ['pdca','pica','entries','mkt','kpiWeekly','people'])S[k]=[];X.brandFacts=null;if(typeof PL24!=='undefined')PL24.docs=null;document.querySelectorAll('.page').forEach(p=>p.replaceChildren());requestAnimationFrame(()=>login())}};
 priceSeedV24=async function(){if(!PL24.seed){const response=await fetch('price-colors-v24.json?v=26');if(response.ok)PRICE_ENGINE.setColors(await response.json());PL24.seed={schema:24,docs:[]}}return PL24.seed};
 const oldHeaders=DB.h;DB.h=function(extra={}){const h=oldHeaders.call(this,extra);if(MASTER.session?.access_token)h['x-commercial-pin-session']=MASTER.session.access_token;return h};
 const oldBrands=canonicalProductBrand;canonicalProductBrand=function(value){const k=String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');return k==='MYNO'?'MYNO':k==='DEFECT'?'DEFECT':oldBrands(value)};
 // Compact axes avoid extremely wide SVGs; source values in tables are unchanged.
 for(const name of ['groupedBars','comboBarsLine','lineChart']){
  const original=window[name];if(typeof original!=='function')continue;
  window[name]=function(...args){const mode=NUMBER_MODE;NUMBER_MODE='compact';
    try{const index=name==='comboBarsLine'?3:2,opts=args[index]||{};args[index]={...opts,w:Math.max(300,Math.min(900,(document.documentElement.clientWidth||1024)-((document.documentElement.clientWidth||1024)>900?320:60)))};return original.apply(this,args)}finally{NUMBER_MODE=mode}
  };
 }
 let width=window.innerWidth,resizeTimer;window.addEventListener('resize',()=>{if(window.innerWidth===width)return;width=window.innerWidth;clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(S.ready||S.demo)render()},220)});
 const oldStoreBrand=storeHasProductBrand;storeHasProductBrand=function(sid,brands){return (X.brandFacts||[]).some(r=>Number(r.store_id)===Number(sid)&&brands.includes(r.brand))||oldStoreBrand(sid,brands)};
 const oldRow=brandSalesRow;brandSalesRow=function(input){
  const brands=activeProductBrands();if(!brands.length||!X.brandFacts)return oldRow(input);
  const r=input._source||input,rows=X.brandFacts.filter(x=>Number(x.store_id)===Number(r.store_id)&&Number(x.year)===Number(r.year)&&Number(x.month)===Number(r.month));
  if(!rows.length)return {...oldRow(input),total_sales:null,sales_komersial:null,sales_user:null};
  const selected=rows.filter(x=>brands.includes(x.brand)),sales=selected.reduce((s,x)=>s+Number(x.sales||0),0),targets=scopedRowTargets(r,brands);
  return {...r,_source:r,total_sales:sales,sales_komersial:null,sales_user:null,sales_komersial_tigalapan:null,sales_user_tigalapan:null,sales_user_mamu:null,target_komersial:targets.kom,target_user:targets.user,target_total:targets.total,gap_sales:targets.total==null?null:sales-targets.total,achiev_total:targets.total>0?sales/targets.total:null};
 };
 const oldAgg=agg;agg=function(rows,...args){const result=oldAgg(rows,...args);if(activeProductBrands().length&&X.brandFacts){for(const key of ['sales_komersial','sales_user','sales_komersial_tigalapan','sales_user_tigalapan','sales_user_mamu','achiev_komersial','achiev_user'])result[key]=null;if(rows.some(r=>brandSalesRow(r).total_sales==null)){result.total_sales=null;result.gap_sales=null;result.achiev_total=null}}return result};
 brandMetricNote=function(){return 'Filter brand memakai Item Sales × brand Item Library terverifikasi. Target harus tersedia pada scope brand. Rincian Komersial/User tidak diestimasi dari Item Sales.'};
 const brandPages=['dash','sales','h2h','brand','top','item','program','mkt','pdca'];
 async function readBrandFacts(){X.brandFacts=await masterRpc('commercial_brand_monthly_v38',{p_menu:S.page,p_stores:null});for(const row of X.brandFacts)if(row.brand&&!S.brandStores.some(r=>Number(r.store_id)===Number(row.store_id)&&canonicalProductBrand(r.brand)===row.brand))S.brandStores.push({store_id:row.store_id,brand:row.brand});fillFilters()}
 const oldLoad=loadAll;loadAll=async function(){X.brandLoading=true;X.brandError=null;try{const result=await oldLoad.apply(this,arguments);X.brandFacts=null;if(S.key&&!S.demo&&MASTER.verified&&brandPages.includes(S.page)){try{await readBrandFacts()}catch(e){X.brandError=e.message}}return result}finally{X.brandLoading=false;render()}};
 const oldRender=render;render=function(){if(S.ready&&S.key&&!S.demo&&MASTER.verified&&brandPages.includes(S.page)&&X.brandFacts===null&&!X.brandLoading&&!X.brandError){X.brandLoading=true;readBrandFacts().catch(e=>X.brandError=e.message).finally(()=>{X.brandLoading=false;render()})}if(window.COMMERCIAL_LOGIN_REQUIRED_V38&&!MASTER.verified){login();return}const result=oldRender.apply(this,arguments);requestAnimationFrame(()=>{
  const page=document.querySelector('.page.on');if(!page)return;responsiveLabels(page);
  if(activeProductBrands().length&&['dash','sales','h2h','brand','top','item'].includes(S.page)&&!page.querySelector('[data-brand-source-v38]')){
   const unknown=(X.brandFacts||[]).filter(r=>!r.brand&&Number(r.year)===Number(S.year)).reduce((s,r)=>s+Number(r.rows_count||0),0);
   page.querySelector('.phead')?.after(el('p',{class:'note'+(unknown||!X.brandFacts?' warn':''),'data-brand-source-v38':''},X.brandFacts?'Filter brand produk memakai Item Sales yang dicocokkan ke brand Item Library per SKU/nama unik. Total tanpa filter tetap sumber Sales Type.'+(unknown?' '+int(unknown)+' baris item belum memiliki brand terverifikasi; hasil filter belum lengkap.':''):'Data brand belum tersedia: '+(X.brandError||'muat ulang setelah sinkron library')));
  }
 });return result};
 function responsiveLabels(root){for(const table of root.querySelectorAll('table')){const heads=[...(table.tHead?.rows[0]?.cells||[])].map(h=>h.textContent.trim());table.dataset.mobileCards='true';for(const body of [...table.tBodies,...(table.tFoot?[table.tFoot]:[])])for(const row of body.rows)for(const [i,cell]of [...row.cells].entries())if(cell.colSpan===1)cell.dataset.label=heads[i]||'';
 const wrap=table.closest('.tw');if(wrap&&!wrap.querySelector('[data-mobile-sort-v38]')){const select=opsSelect(heads.map((h,i)=>[i,h]),0,{'aria-label':'Kolom urutan tabel'}),button=el('button',{type:'button',class:'btn sm',onclick:()=>{const th=table.tHead?.rows[0]?.cells[+select.value];const control=th?.querySelector('button');if(control)control.click();else th?.click()}},'Urutkan ↕');wrap.prepend(el('div',{'data-mobile-sort-v38':'','data-export-control':'',class:'mobile-sort-v38'},select,button));}
 }}
 let labelFrame=null;const labelObserver=new MutationObserver(()=>{if(labelFrame)return;labelFrame=requestAnimationFrame(()=>{labelFrame=null;const page=document.querySelector('.page.on');if(page)responsiveLabels(page);document.querySelectorAll('.modal .box').forEach(box=>responsiveLabels(box))})});labelObserver.observe(document.body,{subtree:true,childList:true});
 const oldEnhance=enhanceAll;enhanceAll=function(){oldEnhance.apply(this,arguments);const page=document.querySelector('.page.on');if(page)responsiveLabels(page)};
 // Keep monthly transactions as the main member dataset, and retain historical
 // profiling only as an explicit reference; no name-based customer joins.
 renderMembersV27=async function(){
  parkFilters();MEM27.view='monthly';const p=$('#p-members');p.replaceChildren(el('div',{class:'phead'},el('div',{},el('h1',{},'Member'),el('p',{},'Transaksi aktual per bulan · profil customer · perbandingan dan Top/Low'))));
  const actions=el('div',{class:'rowline',style:'margin-bottom:12px'}),host=el('div');p.append(actions,host);
  actions.append(el('button',{class:'btn',onclick:()=>renderMembersV27()},'Muat ulang'));
  if(MASTER.session?.user?.role==='master')actions.append(el('button',{class:'btn',onclick:async()=>{await memberLoadV27();memberUploadV27()}},'Upload profil / riwayat lama'),el('button',{class:'btn',onclick:async()=>{await memberLoadV27();MEM27.view='summary';const {box,modal}=opsModal('Referensi profil upload lama');box.style.maxWidth='min(1400px,calc(100vw - 24px))';memberPaintV27(box);responsiveLabels(box);const observer=new MutationObserver(()=>{if(!modal.isConnected){observer.disconnect();MEM27.view='monthly';if(S.page==='members')renderMembersV27()}});observer.observe(document.body,{childList:true})}},'Lihat referensi upload lama'));
  if(!MASTER.verified){host.append(masterLoginForm(async()=>renderMembersV27()).node);return}await V28.renderMemberTransactions(host);
 };
 const beforeRender=render;render=function(){if(S.page==='stok'){parkFilters();stockView();return}return beforeRender.apply(this,arguments)};
 async function stockView(){
  const epoch=++X.stockEpoch,p=$('#p-stok');p.replaceChildren(el('div',{class:'phead'},el('div',{},el('h1',{},'Analisis Stok Toko'),el('p',{},'Satu baris per SKU · kolom per toko · snapshot library terakhir'))));
  const body=el('div');p.append(body);let data;
  try{data=await masterRpc('commercial_stock_analysis_v38',{p_stores:scopeStoreIds()})}catch(e){body.append(el('p',{class:'note warn'},e.message));return}if(epoch!==X.stockEpoch||S.page!=='stok')return;
  const all=data.items||[],q=opsInput(X.stock.q,'search',{placeholder:'Cari SKU, item, kategori…','aria-label':'Pencarian stok'}),br=opsSelect([['','Semua brand'],...['MAMU','MYNO','TIGALAPAN','DEFECT'].map(b=>[b,b])],X.stock.brand),status=opsSelect([['all','Semua stok'],['alert','≤ batas alert'],['negative','Stok minus'],['zero','Stok kosong']],X.stock.only);
  const result=el('div');body.append(el('div',{class:'product-filter-grid'},opsField('Cari',q),opsField('Brand produk',br),opsField('Status',status)),result);
  const stockNumber=v=>v==null?'—':Number(v).toLocaleString('id-ID',{maximumFractionDigits:3});
  const stockCell=v=>el('span',{style:v!=null&&Number(v)<0?'color:var(--bad,#dc3545);font-weight:700':''},stockNumber(v));
  function paint(){const rows=all.filter(r=>(!X.stock.q||[r.sku,r.item_name,r.category,r.brand].join(' ').toLowerCase().includes(X.stock.q.toLowerCase()))&&(!X.stock.brand||canonicalProductBrand(r.brand)===X.stock.brand)&&(X.stock.only==='all'||X.stock.only==='alert'&&r.alert||X.stock.only==='negative'&&r.negative||X.stock.only==='zero'&&r.total_stock!=null&&Number(r.total_stock)===0));
   const shown=rows.slice(X.stock.page*100,X.stock.page*100+100);
   const storeIds=[...new Set(rows.flatMap(r=>Object.keys(r.per_store||{})))].sort((a,b)=>Number(a)-Number(b)),name=id=>S.stores.find(s=>String(s.id)===String(id))?.name||id;
   result.replaceChildren(el('div',{class:'grid g4'},tile('SKU',int(rows.length),'gabungan seluruh toko pada filter',null),tile('Total stok',stockNumber(rows.reduce((s,r)=>s+Number(r.total_stock||0),0)),'satuan stok sumber',null),tile('Nilai stok (HPP)',compact(rows.reduce((s,r)=>s+Number(r.stock_value||0),0)),'stok positif × cost yang tersedia',null),tile('Perlu perhatian',int(rows.filter(r=>r.alert||r.negative).length),int(rows.filter(r=>r.negative).length)+' SKU minus',null)));
   if(Number(data.missing_cost_rows||0)||Number(data.untracked_rows||0)||Number(data.summary?.missing_stock||0))result.append(el('p',{class:'note warn'},'Kualitas data: '+int(data.missing_cost_rows||0)+' baris stok positif tanpa HPP; '+int(data.untracked_rows||0)+' baris tidak dilacak stoknya; '+int(data.summary?.missing_stock||0)+' SKU tanpa nilai stok. Nilai HPP hanya menghitung cost yang tersedia.'));
   result.append(card('Stok gabungan per SKU','Snapshot '+(data.updated_at||'belum tersedia')+' · tanda — = tidak tercatat pada toko tersebut',mkTable([H('SKU'),H('Item',{s:1}),H('Kategori'),H('Brand'),H('Total',{r:1}),...storeIds.map(id=>H(name(id),{r:1}))],shown.map(r=>[r.sku||'—',r.item_name,r.category||'—',r.brand||'—',stockCell(r.total_stock),...storeIds.map(id=>stockCell(r.per_store[id]))]),['TOTAL FILTER','','','',stockNumber(rows.reduce((s,r)=>s+Number(r.total_stock||0),0)),...storeIds.map(id=>stockNumber(rows.reduce((s,r)=>s+Number(r.per_store[id]||0),0)))])));
   result.append(el('div',{class:'rowline',style:'margin:12px 0'},el('span',{class:'sub'},'Baris '+(rows.length?X.stock.page*100+1:0)+'–'+Math.min(rows.length,(X.stock.page+1)*100)+' dari '+rows.length+' SKU · total mengikuti seluruh filter'),el('button',{class:'btn sm',disabled:X.stock.page===0?'':null,onclick:()=>{X.stock.page--;paint()}},'Sebelumnya'),el('button',{class:'btn sm',disabled:(X.stock.page+1)*100>=rows.length?'':null,onclick:()=>{X.stock.page++;paint()}},'Berikutnya'),el('button',{class:'btn sm',onclick:()=>bazarCsv([['SKU','Item','Kategori','Brand','Total',...storeIds.map(name)],...rows.map(r=>[r.sku||'',r.item_name,r.category,r.brand,r.total_stock,...storeIds.map(id=>r.per_store[id]??'')])],'Stok-Seluruh-Hasil-Filter')},'Unduh seluruh hasil CSV')));
   const summary=rows.reduce((m,r)=>{const key=r.category||'(Tanpa kategori)',v=m.get(key)||{sku:0,stock:0,value:0};v.sku++;v.stock+=Number(r.total_stock||0);v.value+=Number(r.stock_value||0);m.set(key,v);return m},new Map());
   result.append(card('Komposisi stok per kategori','Bukan analisis umur stok atau sell-through: sumber saat ini belum menyediakan umur dan transaksi per SKU yang sebanding.',mkTable([H('Kategori',{s:1}),H('SKU',{r:1}),H('Stok',{r:1}),H('Nilai HPP',{r:1})],[...summary].sort((a,b)=>b[1].value-a[1].value).map(([k,v])=>[k,int(v.sku),stockNumber(v.stock),compact(v.value)]))));enhanceAll();responsiveLabels(result);
  }q.oninput=()=>{X.stock.q=q.value;X.stock.page=0;paint()};br.onchange=()=>{X.stock.brand=br.value;X.stock.page=0;paint()};status.onchange=()=>{X.stock.only=status.value;X.stock.page=0;paint()};paint();
 }
 async function login(){
  if(!window.COMMERCIAL_LOGIN_REQUIRED_V38||document.querySelector('#login-v38'))return;
  try{await masterResume()}catch{}
  async function boot(){document.querySelector('#login-v38')?.remove();await loadAll();googleResume()}
  if(MASTER.verified){await boot();return}
  const form=masterLoginForm(boot),gate=el('div',{id:'login-v38',class:'v28-gate'},el('div',{class:'card'},el('h1',{},'Masuk Commercial'),el('p',{},'Gunakan PIN pribadi dari master.'),form.node));document.body.append(gate);
 }
 document.head.append(el('style',{id:'responsive-v38'},`
 .mobile-sort-v38{display:none;gap:10px;align-items:center;margin:8px 0}.mobile-sort-v38 select{min-width:0;max-width:70%}
 .pagefilters,.product-filter-grid,.member-filters-v27{gap:12px!important;align-items:end}.pagefilters>.fld{flex:1 1 150px;max-width:280px}
 .page .card{min-width:0;box-sizing:border-box}.page .phead{flex-wrap:wrap;gap:12px}.page .grid{gap:14px}
 .page .chart{max-width:100%;min-width:0}.page .chart svg{max-width:100%;height:auto}.page .tile{min-width:0;overflow-wrap:anywhere}
 .page .tile .v{font-size:clamp(20px,1.8vw,30px)}.page .tw{max-width:100%}
 @media(max-width:1100px){.grid.g4{grid-template-columns:repeat(2,minmax(0,1fr))!important}.v28-two-col{grid-template-columns:1fr!important}.pagefilters>.fld{max-width:none;flex-basis:180px}}
 @media(max-width:600px){.mobile-sort-v38{display:flex}.grid.g4,.grid.g3,.grid.g2{grid-template-columns:1fr!important}.page .card{padding:14px}.pagefilters{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px!important}.pagefilters>.fld{max-width:100%;width:100%}.page .tw{max-height:none!important;overflow:visible!important}
 }
 @media(max-width:1100px){.mobile-sort-v38{display:flex}.page .tw{max-height:none!important;overflow:visible!important}
 :root table[data-mobile-cards=true],:root table[data-mobile-cards=true] tbody,:root table[data-mobile-cards=true] tfoot,:root table[data-mobile-cards=true] tr{display:block!important;width:100%!important;min-width:0!important;max-width:100%!important}
 :root table[data-mobile-cards=true] colgroup,:root table[data-mobile-cards=true] thead{display:none!important}:root table[data-mobile-cards=true] tr{margin:10px 0;border:1px solid var(--line);border-radius:10px;padding:8px}
 :root table[data-mobile-cards=true] td{display:grid!important;grid-template-columns:minmax(85px,.8fr) minmax(0,1.2fr);gap:10px;font-size:12px!important;line-height:1.45;width:auto!important;min-width:0!important;max-width:none!important;text-align:right!important;white-space:normal!important;overflow-wrap:anywhere!important;position:static!important;box-sizing:border-box}
 :root table[data-mobile-cards=true] td:before{content:attr(data-label);font-weight:600;text-align:left;color:var(--muted);font-size:11px}:root table[data-mobile-cards=true] td[colspan]{display:block!important}:root table[data-mobile-cards=true] td *{max-width:100%;white-space:normal!important;overflow-wrap:anywhere!important;word-break:break-word}.v28-access-row{grid-template-columns:1fr!important}
 }
 `));
 login();
})();
