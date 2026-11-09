/* Additional MTD achievement table; existing SSSG comparison calculations stay unchanged. */
(function(){'use strict';
const X=window.SSSG_MTD_V49={};
const number=v=>v==null||v===''||!Number.isFinite(Number(v))?null:Number(v);
const sum=values=>values.length&&values.every(v=>v!=null)?values.reduce((s,v)=>s+v,0):null;
X.calculate=function({rows,stores,year,month,day,today}){
 const dim=new Date(Date.UTC(year,month,0)).getUTCDate(),[cy,cm,cd]=today.split('-').map(Number),current=year===cy&&month===cm,future=year>cy||(year===cy&&month>cm),cutoff=future?0:Math.max(0,Math.min(day,dim,current?cd:dim));
 const records=stores.map(store=>{const source=rows.filter(r=>Number(r.store_id)===Number(store.id)&&Number(r.year)===year&&Number(r.month)===month),target=sum(source.map(r=>number(r.target_total))),rawSales=sum(source.map(r=>number(r.total_sales))),targetMtd=target==null?null:Math.round(target/dim*cutoff),sales=future||cutoff===0?null:current||cutoff===dim?rawSales:null;
  return {id:store.id,name:store.name,target,sales,targetMtd,achievement:sales!=null&&targetMtd>0?sales/targetMtd:null,gap:sales!=null&&targetMtd!=null?sales-targetMtd:null};});
 const total=X.total(records);return {year,month,days:dim,cutoff,current,future,records,total,historicalPartial:!current&&!future&&cutoff<dim};
};
X.total=records=>{const target=sum(records.map(r=>r.target)),sales=sum(records.map(r=>r.sales)),targetMtd=sum(records.map(r=>r.targetMtd));return {target,sales,targetMtd,achievement:sales!=null&&targetMtd>0?sales/targetMtd:null,gap:sales!=null&&targetMtd!=null?sales-targetMtd:null};};
const values=r=>[compact(r.target),compact(r.sales),compact(r.targetMtd),pillCell(r.achievement),el('span',{style:r.gap==null?'':`color:${r.gap<0?'#b42336':'#087751'}`},compact(r.gap))];
function footer(table){if(!table._mtdV49)return;const visible=[...table.tBodies[0].rows].filter(r=>!r.hidden&&r.style.display!=='none').map(r=>r._mtdV49).filter(Boolean),tot=X.total(visible);table.tFoot.replaceChildren(el('tr',{class:'tot'},['TOTAL',...values(tot)].map((v,i)=>el('td',{class:i?'r':'sticky1'},v))));}
const originalFooter=tableFooterRefresh;tableFooterRefresh=function(table){const result=originalFooter.apply(this,arguments);footer(table);return result;};
X.append=function(page){
 const st=h2hInit(),w=comparisonWindow(st),year=st.y.at(-1),month=w.m2,dim=daysInMonth(year,month),today=opsToday(),current=comparisonCurrentMonth(year,month),through=current?comparisonSalesThrough(year,month):null;
 const day=w.mode==='range'?w.d2:current?(through?Number(through.slice(8)):Math.max(0,Number(today.slice(8))-1)):dim;
 const brands=activeProductBrands(),stores=S.stores.filter(s=>storeOk(s.id)),rows=dashAllRows().filter(r=>Number(r.year)===year&&Number(r.month)===month&&stores.some(s=>Number(s.id)===Number(r.store_id))).map(brandSalesRow).map(r=>brands.some(b=>!['TIGALAPAN','MAMU'].includes(b))&&!V38.brandFacts?{...r,total_sales:null}:r),model=X.calculate({rows,stores,year,month,day,today});
 const records=[...model.records].sort((a,b)=>(b.sales??-Infinity)-(a.sales??-Infinity)||a.name.localeCompare(b.name,'id'));
 const wrap=mkTable([H('TOKO',{s:1}),H('TARGET BULANAN',{r:1}),H('SALES MTD',{r:1}),H('TARGET MTD',{r:1}),H('ACHIEVEMENT',{r:1}),H('GAP DARI TARGET MTD',{r:1})],records.map(r=>[r.name,...values(r)]),['TOTAL',...values(model.total)]),table=wrap.querySelector('table');table.dataset.mtdV49='true';table._mtdV49=true;[...table.tBodies[0].rows].forEach((r,i)=>r._mtdV49=records[i]);
 const subtitle=`${MONTHS[month-1]} ${year} · target cutoff ${model.cutoff}/${model.days} hari · MTD selalu dimulai tanggal 1`,c=card('Achievement MTD per toko',subtitle,wrap);c.dataset.sssgMtdV49='';c.dataset.pngContext=subtitle+' · '+scopeLabel();
 const note=el('p',{class:'note'},'Target MTD = target bulanan ÷ hari kalender bulan × hari cutoff, dibulatkan ke rupiah per toko. Achievement = sales ÷ target MTD; GAP = sales − target MTD. Bulan berjalan memakai total sales bulan yang sudah tertarik, tanpa dibagi/dikalikan hari lagi. '+(through?'Cakupan sales diatur s.d. '+through+'. ':'Tanggal cakupan sales belum terverifikasi; cek informasi sinkron. ')+(w.m1!==month?'Tabel MTD ini hanya bulan akhir filter, bukan penjumlahan seluruh rentang. ':'')+'Total achievement dihitung dari total sales ÷ total target MTD, bukan rata-rata persentase toko.');c.append(note);
 if(model.historicalPartial)c.append(el('p',{class:'note warn'},'Cutoff sebagian bulan lampau memerlukan sales harian. Sumber bulanan tidak dapat membuktikan sales sampai tanggal tersebut; Sales MTD, achievement dan gap ditampilkan —, tanpa membuat estimasi transaksi.'));
 if(model.records.some(r=>r.target==null||r.sales==null))c.append(el('p',{class:'note warn'},'Sebagian sales/target belum tersedia pada filter ini. Nilai kosong tidak dianggap nol; total dan rasio yang memerlukan nilai lengkap ditampilkan —. Target per brand tidak diambil dari target seluruh brand.'));
 const monthly=[...page.querySelectorAll(':scope>.card')].find(n=>/^Bulan demi bulan/i.test((n.querySelector('header h2')?.textContent||'').trim()));const anchor=monthly||[...page.children].filter(n=>n.matches('.grid')&&n.querySelector('.tile')).at(-1);if(anchor)anchor.after(c);else page.append(c);return c;
};
const originalRender=renderH2H;renderH2H=function(){const result=originalRender.apply(this,arguments);const page=document.querySelector('#p-h2h');if(page&&!page.querySelector('[role=alert]'))X.append(page);return result;};
})();
