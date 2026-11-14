/* V52 — Sales bulan berjalan ikut di SSSG.
   • "Data sales s.d." otomatis terisi dari sinkron Moka terakhir (pesan ingest_log "Moka YYYY-MM-01 s.d. YYYY-MM-DD").
   • Aturan (per permintaan):
       - tanggal filter = tanggal data terakhir  → sales bulan berjalan dipakai penuh;
       - data lebih baru dari tanggal filter     → total sales ÷ jumlah hari data × jumlah hari filter.
   • Bulan yang sama di tahun pembanding dipotong ke tanggal filter yang sama (total bulan ÷ hari bulan × hari filter),
     sehingga bulan berjalan dibandingkan apel-ke-apel. Bulan lain tidak berubah. */
(function(){'use strict';
if(window.SSSG_CURRENT_V52)return;
const X=window.SSSG_CURRENT_V52={};
const pad=n=>String(n).padStart(2,'0');
/* Tanggal data terakhir per toko untuk bulan berjalan, dari log sinkron yang sudah dimuat (tanpa query tambahan). */
X.dataThrough=function(y,m){
 if(!comparisonCurrentMonth(y,m))return null;
 const prefix=y+'-'+pad(m)+'-',today=opsToday(),latest=new Map();
 for(const r of S.logs||[]){
  if(r.kind!=='SALES_TYPE'||r.status!=='OK'||Number(r.year)!==y||Number(r.month)!==m||!/^MOKA API/.test(r.file_name||''))continue;
  const hit=String(r.message||'').match(/s\.d\.\s*(\d{4}-\d{2}-\d{2})/);if(!hit||!hit[1].startsWith(prefix)||hit[1]>today)continue;
  const id=Number(r.store_id),prev=latest.get(id);if(!prev||String(r.created_at)>prev.at)latest.set(id,{at:String(r.created_at),end:hit[1]});
 }
 const ids=(S.stores||[]).filter(st=>storeOk(st.id)&&(S.dashAll||[]).some(r=>r.year===y&&r.month===m&&r.store_id===st.id)).map(st=>Number(st.id));
 const ends=ids.map(id=>latest.get(id)?.end).filter(Boolean);
 if(!ends.length)return null;
 return ends.sort()[0]; // tanggal yang sudah tersedia di semua toko terpilih
};
const savedKey=(y,m)=>comparisonCutoffKey(y,m);
const origThrough=comparisonSalesThrough;
comparisonSalesThrough=function(y,m){
 if(!comparisonCurrentMonth(y,m))return null;
 const data=X.dataThrough(y,m);
 if(!data)return origThrough(y,m);
 const yesterday=bazarDateShift(opsToday(),-1);let saved=null;try{saved=localStorage.getItem(savedKey(y,m))}catch{}
 if(saved&&saved.startsWith(y+'-'+pad(m)+'-')&&saved<=data)return saved; // filter manual (≤ data terakhir)
 const auto=data<=yesterday?data:yesterday;return auto.startsWith(y+'-'+pad(m)+'-')?auto:data;
};
/* Pembagi hari = jumlah hari data yang benar-benar sudah masuk (bukan tanggal filter). */
const origSourceDays=comparisonSourceDays;
comparisonSourceDays=function(w,y,m){
 if(comparisonUsesCalendar(w)&&comparisonCurrentMonth(y,m)){const data=X.dataThrough(y,m);if(data)return Number(data.slice(8));}
 return origSourceDays(w,y,m);
};
/* Bulan berjalan pada tahun pembanding ikut dipotong ke tanggal filter. */
const origMonthDays=comparisonMonthDays;
comparisonMonthDays=function(w,y,m){
 let days=origMonthDays(w,y,m);
 const [cy,cm]=opsToday().split('-').map(Number);
 if(days>0&&m===cm&&y<cy&&comparisonUsesCalendar(w)){
  const t=comparisonSalesThrough(cy,cm);
  if(t){const dim=daysInMonth(y,m),a=m===w.m1?Math.min(w.d1,dim):1,b=Math.min(Number(t.slice(8)),dim);days=Math.min(days,Math.max(0,b-a+1));}
 }
 return days;
};
/* Data sinkron dimuat setelah halaman: hitung ulang SSSG sekali saat log baru tersedia. */
let lastSig='';
const sig=()=>{const [cy,cm]=opsToday().split('-').map(Number);return String(X.dataThrough(cy,cm)||'')};
const tick=()=>{const s=sig();if(s===lastSig)return;lastSig=s;try{comparisonCoverageCache=null;S.rollCache?.clear?.()}catch{}if(S.page==='h2h'&&typeof renderH2H==='function')try{renderH2H()}catch(e){console.error(e)}};
const origRender=render;render=function(){lastSig=sig();const out=origRender.apply(this,arguments);setTimeout(()=>badge(),0);return out};
/* Badge "Moka: data s.d." ikut tanggal sinkron terbaru dari log (sinkron terjadwal tidak selalu mencatat moka_sync_runs). */
function badge(){try{const b=document.querySelector('.v28-badge');if(!b||!/^Moka: (data s\.d\.|cakupan belum tercatat)/.test(b.textContent))return;const [cy,cm]=opsToday().split('-').map(Number),d=X.dataThrough(cy,cm);if(!d)return;const run=String(window.V28?.run?.data_until||'').slice(0,10);if(run&&run>=d)return;b.textContent='Moka: data s.d. '+new Date(d+'T12:00:00Z').toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});}catch{}}
setInterval(()=>{tick();badge()},4000);
/* Keterangan aturan di samping isian "Data sales s.d." */
const origH2H=renderH2H;renderH2H=function(){const out=origH2H.apply(this,arguments);try{const inp=document.querySelector('#p-h2h input[id$="-sales-through"]');const fld=inp?.closest('.fld');if(fld&&!fld.querySelector('.v52-through-note')){const [cy,cm]=opsToday().split('-').map(Number),data=X.dataThrough(cy,cm);(document.querySelector('#p-h2h .comparison-method')||fld).append(el('small',{class:'v52-through-note',style:'display:block;margin-top:4px;color:var(--ink-2);max-width:340px;line-height:1.35'},X.explain()));if(data)inp.max=data<bazarDateShift(opsToday(),-1)?data:bazarDateShift(opsToday(),-1);}}catch(e){console.error(e)}return out};
X.explain=function(){const [cy,cm]=opsToday().split('-').map(Number),data=X.dataThrough(cy,cm),f=comparisonSalesThrough(cy,cm);
 if(!data)return 'Tanggal data bulan berjalan belum terbaca dari log sinkron.';
 return f===data?'Data Moka s.d. '+data+' = tanggal filter → sales bulan berjalan dipakai penuh.':'Data Moka s.d. '+data+', filter s.d. '+f+' → sales bulan berjalan = total ÷ '+Number(data.slice(8))+' hari × '+Number(f.slice(8))+' hari.';};
})();
