/* Stock & Distribusi V84 — sumber Moka API (Item Library + Item Sales).
   Menggabungkan mekanisme menu lama "Stok Toko" (ringkasan per toko, rincian SKU, posisi SKU lintas toko)
   dengan Distribusi/TF. window.STOCK78 tetap disediakan agar tombol Sinkron & menu lama tetap terhubung. */
(function(){'use strict';
const U=window.STOCK84={epoch:0,timer:null,requested:0,beforeRun:null,
  state:{tab:'summary',stores:[],store:'',categories:[],brands:[],status:'all',query:'',sort:'qty_desc',page:0,cross:'',target:14,reserve:28,dc:10,toStores:[],tfPage:0,tfExclude:null,lossFrom:'',lossTo:'',lossAction:'',lossQuery:'',lossPage:0}};
window.STOCK78=U;
const PAGE=100;
const N=v=>v==null||v===''?null:Number(v);
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Makassar'}).format(new Date());
const num=v=>N(v)==null?'—':Number(v).toLocaleString('id-ID',{maximumFractionDigits:1});
const money=v=>N(v)==null?'—':rp(Number(v));
const clock=v=>v?new Date(v).toLocaleString('id-ID',{timeZone:'Asia/Makassar',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})+' WITA':'Belum ada';
const dateLabel=v=>v?new Date(v+'T12:00:00Z').toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}):'—';
const isMaster=()=>MASTER.verified&&MASTER.session?.user?.role==='master';
const syncAllowed=()=>isMaster()||(MASTER.verified&&MASTER.session?.user?.access_role!=='viewer'&&!MASTER.session?.user?.rule?.view_only&&MASTER.session?.user?.rule?.can_sync);
const STATUS={in:'Ada stok',low:'Menipis (≤ alert)',stockout:'Kosong tetapi laku',empty:'Kosong',negative:'Minus (audit)',nonmoving:'Tidak terjual 90 hari',untracked:'Tidak dilacak Moka'};
const STATUS_CLS={in:'',low:'v84-lo',stockout:'v84-neg',empty:'v84-neg',negative:'v84-neg',nonmoving:'v84-mute',untracked:'v84-mute'};
const table=(heads,rows,foot)=>mkTable(heads.map(h=>typeof h==='string'?H(h):h),rows,foot);
const storeName=id=>(S.stores||[]).find(s=>Number(s.id)===Number(id))?.name||('Toko '+id);
const allowedStores=()=>(S.stores||[]).filter(s=>storeOk(s.id));
function storesArg(){const s=U.state;return s.stores.length?s.stores.map(Number):null;}
function download(name,heads,rows){const csv=[heads,...rows].map(r=>r.map(v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"').join(',')).join('\r\n'),url=URL.createObjectURL(new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'})),a=el('a',{href:url,download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
/* V86: item tanpa SKU di Moka memakai kunci nama/varian yang sama di semua toko (NM:/ID:) — ditampilkan sebagai 'tanpa SKU'. */
function skuText(k){return /^(NM|ID):/.test(String(k||''))?el('span',{class:'v84-mute',title:'Item ini belum punya SKU di Moka; dicocokkan lintas toko berdasarkan nama item'},'tanpa SKU'):k;}
function skuCsv(k){return /^(NM|ID):/.test(String(k||''))?'':k;}
function missing(e){return /commercial_stock_v84|PGRST202|does not exist|Could not find the function/i.test(e?.message||'');}
function errBox(e){return el('p',{class:'note warn'},missing(e)?'Fungsi Stock V84 belum terpasang. Jalankan STOCK-V84.sql di Supabase SQL Editor.':'Gagal memuat: '+(e?.message||e));}
function pager(page,total,go){const pages=Math.max(1,Math.ceil(total/PAGE));return el('div',{class:'rowline v84-pager'},el('button',{class:'btn sm',type:'button',disabled:page<=0,onclick:()=>go(page-1)},'‹ Sebelumnya'),el('span',{class:'sub'},'Halaman '+(page+1)+' / '+pages+' · '+int(total)+' baris'),el('button',{class:'btn sm',type:'button',disabled:(page+1)>=pages,onclick:()=>go(page+1)},'Berikutnya ›'));}

/* ---------------- Status & tombol tarik ---------------- */
function runText(run){
  if(!run)return 'Belum ada penarikan Stock V84.';
  const stale=run.status==='running'&&Date.now()-new Date(run.started_at).getTime()>2*3600000;
  const label={running:'Berjalan',done:'Selesai',warn:'Selesai dengan catatan',error:'Gagal'}[run.status]||run.status;
  return (stale?'Proses belum selesai > 2 jam — periksa log GitHub':label)+' · '+run.done+'/'+run.total+' lokasi · '+(run.message||'')+' · mulai '+clock(run.started_at)+(run.requested_by==='jadwal'?' (jadwal otomatis)':'');
}
async function watch(note){
  clearTimeout(U.timer);if(!note.isConnected)return;
  try{const d=await masterRpc('commercial_stock_v84_overview',{p_stores:null});const run=d?.run;note.replaceChildren(runText(run));if(run?.github_run_url)note.append(' · ',el('a',{href:run.github_run_url,target:'_blank',rel:'noopener'},'log GitHub'));
    if(run&&run.id!==U.beforeRun&&run.status!=='running'){U.requested=0;if(S.page==='stock')U.show();return;}
    if(run&&run.id!==U.beforeRun)U.requested=Date.now();
  }catch(e){note.textContent='Progres belum terbaca: '+e.message;}
  if(Date.now()-U.requested<25*60000)U.timer=setTimeout(()=>watch(note),15000);
  else{U.requested=0;note.append(' · Belum ada kabar dari worker. Buka GitHub → Actions → "Sinkron Stock & Distribusi" untuk melihat penyebabnya.');}
}
async function trigger(note,button){
  if(button)button.disabled=true;
  try{
    const before=await masterRpc('commercial_stock_v84_overview',{p_stores:null}).catch(()=>null);U.beforeRun=before?.run?.id??null;
    const headers=window.AUTH58?DB.h():{apikey:S.key,Authorization:'Bearer '+await masterToken(),'Content-Type':'application/json'};
    const r=await fetch(S.url.replace(/\/$/,'')+'/functions/v1/stock-sync',{method:'POST',headers,body:'{}',signal:AbortSignal.timeout(30000)}),d=await r.json().catch(()=>({}));
    if(!r.ok||!d.ok)throw Error(d.error||('Permintaan Stock gagal ('+r.status+'). Pastikan Edge Function stock-sync terpasang.'));
    U.requested=Date.now();note.textContent='Penarikan Stock diminta; menunggu worker GitHub (±3–8 menit untuk semua toko)…';watch(note);
  }catch(e){note.textContent=/Failed to fetch|NetworkError|Load failed/i.test(e.message||'')?'Browser tidak dapat menghubungi Edge Function stock-sync.':e.message;}
  finally{if(button)button.disabled=false;}
}
U.requestSync=trigger;

/* ---------------- Pengaturan DC ---------------- */
function dcSettings(stores,dcIds){
  const {box,modal}=opsModal('Lokasi DC / Gudang');let ids=(dcIds||[]).map(String);const choose=el('div'),error=el('p',{class:'note'});
  multiSelectDropdown(choose,stores.map(s=>({value:String(s.store_id),label:s.name})),ids,a=>{ids=a;},{allLabel:'Tidak ada DC'});
  box.append(el('p',{},'DC menjadi sumber utama usulan TF dan tidak menerima TF. Hanya klasifikasi analisis; master toko tidak berubah.'),choose,error,
    el('div',{class:'rowline'},el('button',{type:'button',class:'btn pri',onclick:async()=>{try{await masterRpc('commercial_stock_v84_settings',{p_dc:ids.map(Number)});modal.remove();U.show();}catch(e){error.textContent=e.message;}}},'Simpan'),
      el('button',{type:'button',class:'btn',onclick:async()=>{try{await masterRpc('commercial_stock_v84_settings',{p_dc:null});modal.remove();U.show();}catch(e){error.textContent=e.message;}}},'Deteksi otomatis (nama DC/Gudang)')));
}

/* ---------------- Tab 1: Ringkasan per toko ---------------- */
async function summaryTab(d,body,epoch){
  const list=d.stores.filter(s=>s.skus!=null);
  if(!list.length){body.append(el('div',{class:'empty'},el('b',{},'Belum ada snapshot Stock V84'),'Tekan "Tarik Stock sekarang" atau tunggu jadwal otomatis harian.'));return;}
  const sum=k=>list.reduce((n,r)=>n+(N(r[k])||0),0),shops=list.filter(r=>!r.is_dc);
  body.append(el('div',{class:'grid g4'},
    tile('Qty on hand',int(sum('qty')),list.length+' lokasi ('+shops.length+' toko)',null),
    tile('Nilai stok (HPP)',compact(sum('value')),'qty × HPP (COGS) Moka',null),
    tile('SKU kosong',int(sum('empty')),int(sum('stockout_selling'))+' di antaranya masih laku 30 hari',null),
    tile('SKU menipis',int(sum('low')),'≤ batas stock alert Moka',null)));
  const open=(sid,status)=>{U.state.tab='detail';U.state.stores=[String(sid)];U.state.status=status||'all';U.state.page=0;U.show();};
  const link=(sid,v,status)=>el('a',{href:'#',onclick:e=>{e.preventDefault();open(sid,status);}},int(v));
  let loss=null;try{const end=today();loss=await masterRpc('commercial_stock_v85_loss',{p_stores:storesArg(),p_from:monthStart(end),p_to:end,p_filters:{},p_limit:1,p_offset:0});}catch{loss=null;}
  if(epoch!==U.epoch)return;
  const lossBy=new Map((loss?.stores||[]).map(x=>[Number(x.store_id),x])),lossOf=id=>lossBy.get(Number(id));
  const rows=list.slice().sort((a,b)=>(a.is_dc-b.is_dc)||(N(b.qty)||0)-(N(a.qty)||0)).map(r=>({cls:r.status==='error'?'v84-err':'',cells:[
    el('a',{href:'#',onclick:e=>{e.preventDefault();open(r.store_id);}},r.name+(r.is_dc?' · DC':'')),
    int(r.skus),link(r.store_id,r.in,'in'),link(r.store_id,r.empty,'empty_all'),link(r.store_id,r.stockout_selling,'stockout'),link(r.store_id,r.low,'low'),link(r.store_id,r.nonmoving,'nonmoving'),
    int(r.qty),money(r.value),...(loss?[lossOf(r.store_id)?el('a',{href:'#',onclick:e=>{e.preventDefault();U.state.tab='loss';U.state.lossTo=today();U.state.lossFrom=monthStart(U.state.lossTo);U.state.stores=[String(r.store_id)];U.show();}},money(lossOf(r.store_id).amount)):'—']:[]),el('span',{title:r.message||''},clock(r.snapshot_at)+(r.status==='error'?' · gagal terakhir':r.status==='warn'?' · catatan':''))]}));
  body.append(card('Ringkasan stok per toko','klik nama toko / angka untuk rincian SKU · kolom Loss Sales = bulan berjalan s.d. hari ini',table([H('TOKO / DC',{s:1}),H('SKU DILACAK',{r:1}),H('ADA STOK',{r:1}),H('KOSONG',{r:1}),H('KOSONG TAPI LAKU',{r:1}),H('MENIPIS',{r:1}),H('TIDAK TERJUAL 90H',{r:1}),H('QTY ON HAND',{r:1}),H('NILAI STOK (HPP)',{r:1}),...(loss?[H('LOSS SALES BULAN INI',{r:1})]:[]),H('UPDATE')],rows,
    ['TOTAL',int(sum('skus')),int(sum('in')),int(sum('empty')),int(sum('stockout_selling')),int(sum('low')),int(sum('nonmoving')),int(sum('qty')),money(sum('value')),...(loss?[money(loss.totals?.amount||0)]:[]),''])));
  const notes=list.filter(r=>r.message);
  if(notes.length)body.append(card('Catatan penarikan terakhir','per lokasi',table(['Lokasi','Status','Catatan'],notes.map(r=>[r.name,r.status,r.message]))));
  const failed=d.stores.filter(s=>s.status==='error'&&s.skus==null);
  if(failed.length)body.append(el('p',{class:'note warn'},'Belum pernah berhasil: '+failed.map(s=>s.name+' ('+(s.message||'error')+')').join('; ')));
}

/* ---------------- Tab 2: Rincian SKU per toko ---------------- */
async function detailTab(d,body,epoch){
  const s=U.state,out=el('div',{},el('p',{class:'sub'},'Memuat SKU…'));
  const status=opsSelect([['all','Semua SKU tersimpan'],['in','Ada stok'],['empty_all','Kosong / minus'],['stockout','Kosong tetapi laku 30 hari'],['low','Menipis (≤ alert)'],['nonmoving','Tidak terjual 90 hari'],['negative','Minus (audit)'],['untracked','Tidak dilacak Moka']],s.status,{'aria-label':'Status stok'});
  const sort=opsSelect([['qty_desc','Stok terbanyak'],['qty_asc','Stok tersedikit'],['value_desc','Nilai terbesar'],['sold_desc','Terjual 30 hari terbanyak'],['cover_asc','Cukup hari tersingkat'],['name','Nama item']],s.sort,{'aria-label':'Urutkan'});
  const q=opsInput(s.query,'search',{placeholder:'Cari SKU / nama item','aria-label':'Cari item'});
  const catBox=el('div'),brandBox=el('div'),csv=el('button',{class:'btn sm',type:'button'},'⇩ CSV hasil filter');
  const filters=el('div',{class:'v84-filters'},opsField('Status',status),opsField('Kategori',catBox),opsField('Brand',brandBox),opsField('Urutkan',sort),opsField('Cari',q));
  body.append(card('Rincian stok per SKU',(s.stores.length?s.stores.map(storeName).join(', '):'semua toko yang diizinkan')+' · SKU kosong tanpa penjualan 90 hari tidak disimpan',filters,csv,out));
  const args=(offset,limit)=>({p_stores:storesArg(),p_filters:{status:s.status,query:s.query,sort:s.sort,categories:s.categories,brands:s.brands},p_limit:limit,p_offset:offset});
  const fmt=r=>[r.store_name,r.item_name,skuText(r.sku),r.category||'—',r.brand||'—',el('span',{class:STATUS_CLS[r.status]||''},num(r.qty)),num(r.alert),money(r.cogs),money(r.value),num(r.sold14),num(r.prior14),num(r.sold30),num(r.sold90),r.cover==null?'—':num(r.cover),el('span',{class:STATUS_CLS[r.status]||''},STATUS[r.status]||r.status)];
  const reload=()=>{s.page=0;U.show();};
  status.onchange=()=>{s.status=status.value;reload();};sort.onchange=()=>{s.sort=sort.value;reload();};
  let t;q.oninput=()=>{clearTimeout(t);t=setTimeout(()=>{s.query=q.value.trim();reload();},500);};
  try{
    const r=await masterRpc('commercial_stock_v84_list',args(s.page*PAGE,PAGE));if(epoch!==U.epoch)return;
    multiSelectDropdown(catBox,r.categories.map(c=>({value:c,label:c})),s.categories,()=>reload(),{allLabel:'Semua kategori'});
    multiSelectDropdown(brandBox,r.brands.map(c=>({value:c,label:c})),s.brands,()=>reload(),{allLabel:'Semua brand'});
    const c=r.status_counts||{},tot=r.totals||{};
    out.replaceChildren(
      el('p',{class:'sub'},int(r.total)+' SKU · '+int(tot.qty)+' pcs · nilai '+String(compact(tot.value||0))+' · terjual 30 hari '+int(tot.sold30)+' · '+Object.entries(STATUS).filter(([k])=>c[k]).map(([k,v])=>v+' '+Number(c[k]).toLocaleString('id-ID')).join(' · ')),
      table([H('TOKO',{s:1}),'ITEM','SKU','KATEGORI','BRAND',H('STOK',{r:1}),H('ALERT',{r:1}),H('HPP',{r:1}),H('NILAI',{r:1}),H('TERJUAL 14H',{r:1}),H('14H SEBELUMNYA',{r:1}),H('TERJUAL 30H',{r:1}),H('TERJUAL 90H',{r:1}),H('CUKUP HARI',{r:1}),'STATUS'],r.rows.map(fmt)),
      pager(s.page,r.total,p=>{s.page=p;U.show();}));
    csv.onclick=async()=>{csv.disabled=true;try{const all=await masterRpc('commercial_stock_v84_list',args(0,5000));download('stock-sku-'+today()+'.csv',['Toko','Item','SKU','Kategori','Brand','Stok','Alert','HPP','Nilai','Terjual 14h','14h sebelumnya','Terjual 30h','Terjual 90h','Cukup hari','Status'],all.rows.map(x=>[x.store_name,x.item_name,skuCsv(x.sku),x.category,x.brand,x.qty,x.alert,x.cogs,x.value,x.sold14,x.prior14,x.sold30,x.sold90,x.cover,STATUS[x.status]||x.status]));if(all.total>5000)toast('CSV dibatasi 5.000 baris pertama; persempit filter.');}catch(e){toast(e.message);}finally{csv.disabled=false;}};
  }catch(e){if(epoch===U.epoch)out.replaceChildren(errBox(e));}
}

/* ---------------- Tab 3: Posisi SKU di semua toko ---------------- */
function crossTab(d,body){
  const s=U.state,out=el('div'),q=opsInput(s.cross,'search',{placeholder:'Cari SKU / nama item, mis. HITAM 24S PDK L','aria-label':'Cari SKU di semua toko',style:'min-width:min(360px,100%)'});
  body.append(card('Posisi stok item di semua toko','SKU sama persis · angka = stok saat ini (terjual 30 hari)',el('div',{class:'rowline'},q),out));
  let seq=0;
  const run=async()=>{
    s.cross=q.value.trim();const my=++seq;
    if(s.cross.length<3){out.replaceChildren(el('p',{class:'sub'},'Ketik minimal 3 huruf untuk melihat posisi stok item yang sama di setiap toko.'));return;}
    out.replaceChildren(el('p',{class:'sub'},'Mencari…'));
    try{
      const r=await masterRpc('commercial_stock_v84_position',{p_query:s.cross,p_stores:storesArg(),p_limit:60});if(my!==seq)return;
      if(!r.items.length){out.replaceChildren(el('p',{class:'sub'},'Tidak ada item yang cocok.'));return;}
      const stores=r.stores,dc=new Set((d.dc_ids||[]).map(Number));
      out.replaceChildren(el('p',{class:'sub'},r.items.length+' SKU'+(r.items.length>=60?' (60 pertama — perjelas kata kunci)':'')),
        table([H('ITEM',{s:1}),'SKU',...stores.map(x=>H(x.name+(dc.has(Number(x.store_id))?' · DC':''),{r:1})),H('TOTAL',{r:1})],
          r.items.map(it=>[it.item_name,skuText(it.sku),...stores.map(x=>{const v=it.by_store?.[x.store_id];if(!v)return el('span',{class:'v84-mute'},'0');const qv=N(v.qty)||0;return el('span',{class:qv<=0?'v84-neg':(N(v.alert)>0&&qv<=N(v.alert)?'v84-lo':''),title:'Terjual 30 hari: '+num(v.sold30)},int(qv),N(v.sold30)>0?el('small',{class:'v84-sold'},' ('+num(v.sold30)+')'):null);}),int(it.total)])));
    }catch(e){if(my===seq)out.replaceChildren(errBox(e));}
  };
  let t;q.oninput=()=>{clearTimeout(t);t=setTimeout(run,450);};run();
}

/* ---------------- Tab 4: Distribusi / TF ---------------- */
async function transferTab(d,body,epoch){
  const s=U.state,out=el('div',{},el('p',{class:'sub'},'Menghitung usulan…'));
  const target=opsInput(s.target,'number',{min:1,max:120,'aria-label':'Target hari stok toko'}),reserve=opsInput(s.reserve,'number',{min:1,max:180,'aria-label':'Cadangan hari toko pengirim'}),dcRes=opsInput(s.dc,'number',{min:0,max:180,'aria-label':'Cadangan hari DC'});
  const q=opsInput(s.query,'search',{placeholder:'Cari SKU / nama item','aria-label':'Cari item'}),toBox=el('div'),catBox=el('div'),brandBox=el('div'),excBox=el('div'),apply=el('button',{class:'btn pri',type:'button'},'Hitung ulang'),csv=el('button',{class:'btn sm',type:'button'},'⇩ CSV usulan TF');
  const shops=d.stores.filter(x=>!x.is_dc&&x.skus!=null);
  multiSelectDropdown(toBox,shops.map(x=>({value:String(x.store_id),label:x.name})),s.toStores,()=>{},{allLabel:'Semua toko'});
  body.append(card('Usulan distribusi / TF','SKU sama persis · laju jual 30 hari · DC diprioritaskan sebagai pengirim · usulan untuk ditinjau, bukan perintah transfer',
    el('div',{class:'v84-filters'},opsField('Target stok toko (hari)',target),opsField('Cadangan toko pengirim (hari)',reserve),opsField('Cadangan DC (hari jaringan)',dcRes),opsField('Toko penerima',toBox),opsField('Kategori',catBox),opsField('Kecualikan kategori',excBox),opsField('Brand',brandBox),opsField('Cari',q),el('div',{class:'fld'},apply)),
    el('p',{class:'sub'},'Kebutuhan penerima = target hari × rata-rata jual/hari − stok. Kelebihan pengirim = stok − cadangan hari × rata-rata jual/hari (toko tanpa penjualan menyisakan 1 pcs). DC menyisakan cadangan × total rata-rata jual jaringan. Kategori non-produk (plastik, reject, dll.) dikecualikan secara bawaan.'),csv,out));
  const args=(offset,limit)=>({p_stores:storesArg(),p_filters:{query:s.query,categories:s.categories,brands:s.brands,to_stores:s.toStores,exclude_categories:s.tfExclude||[]},p_target:Number(s.target),p_reserve:Number(s.reserve),p_dc_reserve:Number(s.dc),p_limit:limit,p_offset:offset});
  apply.onclick=()=>{s.target=Math.max(1,Math.min(120,Number(target.value)||14));s.reserve=Math.max(1,Math.min(180,Number(reserve.value)||28));s.dc=Math.max(0,Math.min(180,Number(dcRes.value)||0));s.query=q.value.trim();s.tfPage=0;U.show();};
  try{
    if(s.tfExclude===null){const c=await masterRpc('commercial_stock_v84_list',{p_stores:null,p_filters:{status:'all'},p_limit:1,p_offset:0});if(epoch!==U.epoch)return;s.tfExclude=(c.categories||[]).filter(x=>/PLASTIK|PAPER|BAG|KANTONG|KRESEK|PERLENGKAPAN|ATK|HANGER|REJECT|DEFECT|PACKAGING|KEMASAN|BIAYA|JASA/i.test(x));}
    const r=await masterRpc('commercial_stock_v84_transfer',args(s.tfPage*PAGE,PAGE));if(epoch!==U.epoch)return;
    multiSelectDropdown(catBox,r.categories.map(c=>({value:c,label:c})),s.categories,()=>{},{allLabel:'Semua kategori'});
    multiSelectDropdown(brandBox,r.brands.map(c=>({value:c,label:c})),s.brands,()=>{},{allLabel:'Semua brand'});
    multiSelectDropdown(excBox,r.categories.map(c=>({value:c,label:c})),s.tfExclude,()=>{},{allLabel:'Tidak ada'});
    const fmt=x=>[x.item_name,skuText(x.sku),x.from_name+(x.from_dc?' · DC':''),num(x.from_qty),x.to_name,num(x.to_qty),num(x.to_daily),x.to_cover==null?'—':num(x.to_cover),el('b',{},num(x.qty))];
    out.replaceChildren(el('div',{class:'grid g4'},tile('Baris usulan',int(r.total),'pasangan SKU pengirim → penerima',null),tile('Total pcs',int(r.units),'jumlah yang diusulkan pindah',null),tile('Penerima belum tercukupi',int(r.short),'stok jaringan tidak cukup',null),tile('Lokasi DC',String((r.dc_ids||[]).length),(r.dc_ids||[]).map(storeName).join(', ')||'tidak ada',null)),
      table([H('ITEM',{s:1}),'SKU','DARI',H('STOK PENGIRIM',{r:1}),'KE',H('STOK PENERIMA',{r:1}),H('JUAL/HARI',{r:1}),H('CUKUP HARI',{r:1}),H('USULAN TF',{r:1})],r.rows.map(fmt)),
      pager(s.tfPage,r.total,p=>{s.tfPage=p;U.show();}));
    csv.onclick=async()=>{csv.disabled=true;try{const all=await masterRpc('commercial_stock_v84_transfer',args(0,5000));download('usulan-tf-'+today()+'.csv',['Item','SKU','Kategori','Brand','Dari','Stok pengirim','Ke','Stok penerima','Jual/hari penerima','Cukup hari','Usulan TF'],all.rows.map(x=>[x.item_name,skuCsv(x.sku),x.category,x.brand,x.from_name,x.from_qty,x.to_name,x.to_qty,x.to_daily,x.to_cover,x.qty]));}catch(e){toast(e.message);}finally{csv.disabled=false;}};
  }catch(e){if(epoch===U.epoch)out.replaceChildren(errBox(e));}
}


/* ---------------- Tab 5: Loss Sales × Stock (V85) ---------------- */
const ACTION={DISPLAY:'Stok ada di toko · cek display/penataan',TF:'TF dari DC/toko lain',PRODUKSI:'Kosong di semua lokasi · produksi/pengadaan',CEK_NAMA:'Belum cocok SKU · cek nama produk'};
const ACTION_SHORT={DISPLAY:'Cek display',TF:'TF',PRODUKSI:'Produksi',CEK_NAMA:'Cek nama'};
const ACTION_CLS={DISPLAY:'v84-lo',TF:'',PRODUKSI:'v84-neg',CEK_NAMA:'v84-mute'};
function monthStart(iso){return iso.slice(0,8)+'01';}
function monthEnd(ym){const [y,m]=ym.split('-').map(Number);const e=new Date(Date.UTC(y,m,0)).toISOString().slice(0,10),t=today();return e>t?t:e;}
function shiftDate(iso,days){const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
async function lossTab(d,body,epoch){
  const s=U.state;if(!s.lossTo)s.lossTo=today();if(!s.lossFrom)s.lossFrom=monthStart(s.lossTo);
  const month=opsInput(s.lossFrom.slice(0,7),'month',{'aria-label':'Bulan Loss Sales'});month.onchange=()=>{if(!/^\d{4}-\d{2}$/.test(month.value))return;s.lossFrom=month.value+'-01';s.lossTo=monthEnd(month.value);s.lossPage=0;U.show();};
  const from=opsInput(s.lossFrom,'date',{'aria-label':'Dari tanggal'}),to=opsInput(s.lossTo,'date',{'aria-label':'Sampai tanggal'});
  const action=opsSelect([['','Semua tindakan'],...Object.entries(ACTION)],s.lossAction,{'aria-label':'Tindakan'});
  /* V87: filter alasan; pilihan diisi dari data periode (lihat reason_options) */
  const reason=opsSelect([['','Semua alasan'],...(U.lossReasons||[]).map(x=>[x.reason,x.reason+' · '+Number(x.qty||0).toLocaleString('id-ID')+' pcs']),...(s.lossReason&&!(U.lossReasons||[]).some(x=>x.reason===s.lossReason)?[[s.lossReason,s.lossReason]]:[])],s.lossReason||'',{'aria-label':'Alasan loss'});
  reason.onchange=()=>{s.lossReason=reason.value;s.lossPage=0;U.show();};
  const q=opsInput(s.lossQuery,'search',{placeholder:'Cari produk / warna / alasan','aria-label':'Cari loss'}),apply=el('button',{class:'btn pri',type:'button'},'Terapkan'),csv=el('button',{class:'btn sm',type:'button'},'⇩ CSV analisa loss'),csvColor=el('button',{class:'btn sm',type:'button'},'⇩ CSV akumulasi warna');
  const out=el('div',{},el('p',{class:'sub'},'Menghitung Loss Sales × Stock…'));
  body.append(card('Loss Sales × Stock','Loss Sales (Google Sheet) dicocokkan ke SKU Moka lalu dibandingkan dengan stok saat ini di toko, DC dan toko lain',
    el('div',{class:'v84-filters'},opsField('Bulan',month),opsField('Dari',from),opsField('Sampai',to),opsField('Alasan',reason),opsField('Tindakan',action),opsField('Cari',q),el('div',{class:'fld'},apply)),
    el('p',{class:'sub'},'Cocok bila ≥ 75% kata produk + warna + ukuran ada di nama SKU (PENDEK=PDK, PANJANG=PJG, ANAK=KID, XXL=2XL). Stok yang dibandingkan adalah stok saat ini, bukan stok pada tanggal loss.'),el('div',{class:'rowline',style:'gap:6px'},csv,csvColor),out));
  apply.onclick=()=>{s.lossFrom=from.value||s.lossFrom;s.lossTo=to.value||s.lossTo;s.lossAction=action.value;s.lossReason=reason.value;s.lossQuery=q.value.trim();s.lossPage=0;U.show();};
  const args=(offset,limit)=>({p_stores:storesArg(),p_from:s.lossFrom,p_to:s.lossTo,p_filters:{action:s.lossAction,query:s.lossQuery,reason:s.lossReason||''},p_limit:limit,p_offset:offset});
  try{
    const r=await masterRpc('commercial_stock_v85_loss',args(s.lossPage*PAGE,PAGE));if(epoch!==U.epoch)return;
    const a=r.actions||{},g=k=>a[k]||{qty:0,amount:0,groups:0},t=r.totals||{};
    const opts=r.reason_options||[];if(JSON.stringify(opts)!==JSON.stringify(U.lossReasons||[])){U.lossReasons=opts;const cur=reason.value;reason.replaceChildren(...[['','Semua alasan'],...opts.map(x=>[x.reason,x.reason+' · '+Number(x.qty||0).toLocaleString('id-ID')+' pcs'])].map(([v,l])=>{const o=el('option',{value:v},l);o.selected=v===cur;return o;}));}
    const tq=Number(t.qty)||0,share=v=>tq>0?(Number(v||0)/tq*100).toLocaleString('id-ID',{maximumFractionDigits:1})+'%':'—';
    const actCells=x=>[int(x.display||0),int(x.tf||0),int(x.produksi||0),int(x.cek||0)];
    const byCombed=r.by_combed?card('Akumulasi per Combed × Lengan × Warna','jenis bahan & lengan dibaca dari nama produk Loss Sales (24S/30S, PENDEK/PDK, PANJANG/PJG)'+(s.lossReason?' · alasan '+s.lossReason:''),
      table([H('COMBED',{s:1}),'LENGAN','WARNA',H('PCS',{r:1}),H('% PCS',{r:1}),H('NILAI (Rp)',{r:1}),H('TOKO',{r:1}),H('CEK DISPLAY',{r:1}),H('TF',{r:1}),H('PRODUKSI',{r:1}),H('CEK NAMA',{r:1})],
        r.by_combed.map(x=>[x.combed,x.lengan,x.warna,int(x.qty),share(x.qty),money(x.amount),int(x.stores),...actCells(x)]))):null;
    const byColor=r.by_color?card('Akumulasi per Warna','semua produk digabung per warna'+(s.lossReason?' · alasan '+s.lossReason:''),
      table([H('WARNA',{s:1}),H('PCS',{r:1}),H('% PCS',{r:1}),H('NILAI (Rp)',{r:1}),H('PRODUK',{r:1}),H('TOKO',{r:1}),H('CEK DISPLAY',{r:1}),H('TF',{r:1}),H('PRODUKSI',{r:1}),H('CEK NAMA',{r:1})],
        r.by_color.map(x=>[x.warna,int(x.qty),share(x.qty),money(x.amount),int(x.products),int(x.stores),...actCells(x)]))):
      el('p',{class:'note warn'},'Tabel akumulasi warna & filter alasan butuh V87.sql. Jalankan V87.sql di Supabase SQL Editor.');
    const tiles=el('div',{class:'grid g4'},
      tile('Loss Sales',money(t.amount),int(t.qty)+' pcs · '+int(t.rows)+' catatan · '+dateLabel(r.from)+' – '+dateLabel(r.to),null),
      tile('Bisa ditutup dengan TF',money(g('TF').amount),int(g('TF').qty)+' pcs · stok ada di DC/toko lain',null),
      tile('Stok ada di toko',money(g('DISPLAY').amount),int(g('DISPLAY').qty)+' pcs · cek display, size run, penataan',null),
      tile('Perlu produksi / pengadaan',money(g('PRODUKSI').amount),int(g('PRODUKSI').qty)+' pcs · kosong di semua lokasi · '+int(g('CEK_NAMA').qty)+' pcs belum cocok SKU',null));
    const stores=table([H('TOKO',{s:1}),H('LOSS (Rp)',{r:1}),H('LOSS (pcs)',{r:1}),H('CEK DISPLAY',{r:1}),H('TF',{r:1}),H('PRODUKSI',{r:1}),H('CEK NAMA',{r:1})],
      (r.stores||[]).map(x=>[x.name,money(x.amount),int(x.qty),int(x.display||0),int(x.tf||0),int(x.produksi||0),int(x.cek||0)]));
    const reasons=table([H('ALASAN LOSS',{s:1}),H('PCS',{r:1}),H('NILAI (Rp)',{r:1})],(r.reasons||[]).map(x=>[x.reason,int(x.qty),money(x.amount)]));
    const fmt=x=>[x.store_name,el('span',{},x.item+(x.color?' · '+x.color:'')+(x.size?' · '+x.size:''),el('div',{class:'sub'},x.reasons||'')),int(x.qty),money(x.amount),
      x.skus?el('span',{title:'skor kecocokan '+x.score},x.sample+(x.skus>1?' (+'+(x.skus-1)+' SKU)':'')):el('span',{class:'v84-mute'},'—'),
      int(x.here),int(x.at_dc),int(x.at_other),(x.donors||[]).map(o=>o.name+(o.is_dc?' (DC)':'')+' '+Number(o.qty).toLocaleString('id-ID')).join(', ')||'—',
      el('span',{class:ACTION_CLS[x.action]||''},ACTION_SHORT[x.action]||x.action)];
    out.replaceChildren(tiles,
      r.unmapped_store_rows?el('p',{class:'note warn'},int(r.unmapped_store_rows)+' catatan Loss Sales belum terpetakan ke toko (nama toko di sheet tidak cocok dengan master toko/alias).'):'',
      el('div',{class:'grid g2'},card('Loss per toko','tindakan dalam pcs',stores),card('Alasan loss teratas','sesuai kolom ALASAN LOSE SALE',reasons)),
      byColor,byCombed,
      card('Rincian Loss × Stock',int(r.total)+' kelompok produk · urut nilai loss terbesar',
        table([H('TOKO',{s:1}),'PRODUK LOSS · ALASAN',H('PCS',{r:1}),H('NILAI',{r:1}),'SKU MOKA COCOK',H('STOK TOKO',{r:1}),H('STOK DC',{r:1}),H('STOK TOKO LAIN',{r:1}),'SUMBER TF TERBAIK','TINDAKAN'],r.rows.map(fmt)),
        pager(s.lossPage,r.total,p=>{s.lossPage=p;U.show();})));
    csvColor.onclick=()=>{download('loss-per-warna-'+today()+'.csv',['Warna','Pcs','Nilai','Produk','Toko','Cek display','TF','Produksi','Cek nama'],(r.by_color||[]).map(x=>[x.warna,x.qty,x.amount,x.products,x.stores,x.display||0,x.tf||0,x.produksi||0,x.cek||0]));setTimeout(()=>download('loss-per-combed-lengan-warna-'+today()+'.csv',['Combed','Lengan','Warna','Pcs','Nilai','Toko','Cek display','TF','Produksi','Cek nama'],(r.by_combed||[]).map(x=>[x.combed,x.lengan,x.warna,x.qty,x.amount,x.stores,x.display||0,x.tf||0,x.produksi||0,x.cek||0])),400);};
    csv.onclick=async()=>{csv.disabled=true;try{const all=await masterRpc('commercial_stock_v85_loss',args(0,5000));download('loss-x-stock-'+today()+'.csv',['Toko','Produk','Warna','Ukuran','Alasan','Pcs','Nilai','SKU cocok','Jumlah SKU','Stok toko','Stok DC','Stok toko lain','Sumber TF','Tindakan'],all.rows.map(x=>[x.store_name,x.item,x.color,x.size,x.reasons,x.qty,x.amount,x.sample,x.skus,x.here,x.at_dc,x.at_other,(x.donors||[]).map(o=>o.name+' '+o.qty).join('; '),ACTION[x.action]||x.action]));}catch(e){toast(e.message);}finally{csv.disabled=false;}};
  }catch(e){if(epoch!==U.epoch)return;out.replaceChildren(/commercial_stock_v85_loss|PGRST202/i.test(e.message||'')?el('p',{class:'note warn'},'Fungsi Loss × Stock belum terpasang. Jalankan V85.sql di Supabase SQL Editor.'):/Sheets|belum tersedia/i.test(e.message||'')?el('p',{class:'note warn'},'Data Loss Sales belum tersedia. Tarik data di menu Loss Sales terlebih dahulu.'):errBox(e));}
}

/* ---------------- Halaman ---------------- */
U.show=async function(){
  clearTimeout(U.timer);if(typeof parkFilters==='function')parkFilters();
  const host=document.querySelector('#p-stock');if(!host)return;const epoch=++U.epoch,s=U.state;
  host.replaceChildren(el('div',{class:'phead'},el('div',{},el('h1',{},'Stock & Distribusi'),el('p',{},'Stok saat ini dari Item Library Moka · penjualan 14/30/90 hari dari Item Sales (s.d. kemarin) · ringkasan toko, rincian SKU, posisi lintas toko, usulan TF dan analisa Loss Sales'))));
  if(S.demo){host.append(el('p',{class:'note'},'Stock memakai data aktual; mode contoh tidak menampilkan stok.'));return;}
  const note=el('p',{class:'note',role:'status'},'Memuat snapshot Stock…'),pull=el('button',{class:'btn pri',type:'button',disabled:!syncAllowed(),onclick:()=>trigger(note,pull)},'Tarik Stock sekarang');
  const actions=el('div',{class:'rowline'},pull,el('button',{class:'btn',type:'button',onclick:()=>U.show()},'Muat ulang'));
  const storeBox=el('div'),tabs=el('div',{class:'rowline v84-tabs'}),body=el('div',{class:'v84-body'});
  host.append(actions,note,el('div',{class:'v84-filters'},opsField('Toko / DC',storeBox)),tabs,body);
  let d;
  try{d=await masterRpc('commercial_stock_v84_overview',{p_stores:storesArg()});}catch(e){if(epoch===U.epoch){note.replaceChildren();body.append(errBox(e));}return;}
  if(epoch!==U.epoch)return;
  note.replaceChildren(runText(d.run));if(d.run?.github_run_url)note.append(' · ',el('a',{href:d.run.github_run_url,target:'_blank',rel:'noopener'},'log GitHub'));
  if(U.requested)watch(note);
  const list=d.stores.filter(x=>x.skus!=null||x.status);
  const opts=(s.stores.length?d.stores:list).map(x=>({value:String(x.store_id),label:x.name+(x.is_dc?' · DC':'')}));
  multiSelectDropdown(storeBox,opts.length?opts:allowedStores().map(x=>({value:String(x.id),label:x.name})),s.stores,()=>{s.page=0;s.tfPage=0;U.show();},{allLabel:'Semua toko & DC'});
  if(isMaster())actions.append(el('button',{class:'btn',type:'button',onclick:()=>dcSettings(d.stores,d.dc_ids)},'Atur lokasi DC'));
  for(const [id,label] of [['summary','Ringkasan per toko'],['detail','Rincian SKU'],['cross','Posisi SKU semua toko'],['transfer','Distribusi / TF'],['loss','Loss Sales × Stock']])
    tabs.append(el('button',{class:'btn'+(s.tab===id?' pri':''),type:'button','aria-pressed':String(s.tab===id),onclick:()=>{s.tab=id;U.show();}},label));
  if(s.tab==='summary')await summaryTab(d,body,epoch);
  else if(s.tab==='detail')await detailTab(d,body,epoch);
  else if(s.tab==='cross')crossTab(d,body);
  else if(s.tab==='transfer')await transferTab(d,body,epoch);
  else await lossTab(d,body,epoch);
};
const css=document.createElement('style');
css.textContent='.v84-filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;align-items:end;margin:12px 0}.v84-filters .fld{min-width:0}.v84-tabs{flex-wrap:wrap;gap:8px;margin:8px 0 12px}.v84-body{display:grid;gap:18px;min-width:0}.v84-body .card{min-width:0}.v84-body .tw{max-width:100%;overflow:auto}.v84-pager{gap:10px;margin-top:10px;flex-wrap:wrap}.v84-neg{color:var(--bad,#c0392b);font-weight:600}.v84-lo{color:var(--warn,#b9770e);font-weight:600}.v84-mute{color:var(--muted)}.v84-sold{color:var(--muted);font-weight:400}tr.v84-err td{background:color-mix(in srgb,var(--bad,#c0392b) 8%,transparent)}@media(max-width:600px){.v84-filters{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}}';
document.head.append(css);
})();
