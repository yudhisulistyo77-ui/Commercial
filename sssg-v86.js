/* V86 — SSSG & Program Sales: target per segmen s.d. cut-off dan perbandingan vs bulan sebelumnya.
   • Tabel "Komersial & User vs Target": sales tahun berjalan pada jendela SSSG (tanggal cut-off yang dipilih)
     dibandingkan target komersial/user yang diprorata ke hari yang sama.
   • Tabel "Perbandingan vs bulan sebelumnya": data HARIAN Moka (moka_sales_type_daily) tanggal 1 s.d. cut-off
     dibanding bulan sebelumnya tanggal 1 s.d. hari yang sama — apel-ke-apel, tanpa estimasi proporsional.
   Semua tabel mengikuti filter Brand/SPV/Toko dan bisa diekspor CSV lewat tombol tabel standar. */
(function(){'use strict';
if(window.SSSG86)return;
const pad=n=>String(n).padStart(2,'0');
const fmtD=d=>{if(!d)return '—';const [y,m,dd]=String(d).split('-').map(Number);return dd+' '+MON3[m-1]+' '+y;};
const yesterday=()=>bazarDateShift(opsToday(),-1);
const ach=(a,t)=>t>0?a/t:null;
const prorate=(v,days,dim)=>N(v)*Math.max(0,Math.min(days,dim))/dim;

/* Tanggal cut-off: akhir jendela SSSG pada tahun berjalan, dibatasi kemarin dan tanggal data Moka bulan berjalan. */
function cutoff(st,w){
 const y=st.y[2];let d;
 if(w.mode==='range')d=y+'-'+pad(w.m2)+'-'+pad(Math.min(w.d2,daysInMonth(y,w.m2)));
 else d=y+'-'+pad(w.m2)+'-'+pad(daysInMonth(y,w.m2));
 const yd=yesterday();if(d>yd)d=yd;
 const [cy,cm]=opsToday().split('-').map(Number);
 if(Number(d.slice(0,4))===cy&&Number(d.slice(5,7))===cm){const through=window.SSSG_CURRENT_V52?.dataThrough?.(cy,cm)||(typeof comparisonSalesThrough==='function'?comparisonSalesThrough(cy,cm):null);if(through&&through<d)d=through;}
 return d;
}
function monthTargets(y,m,ids){
 const rows=S.dashAll.filter(r=>r.year===y&&r.month===m&&ids.has(Number(r.store_id)));
 const by=new Map();rows.forEach(r=>{const b=brandSalesRow(r);by.set(Number(r.store_id),{kom:N(b.target_komersial??r.target_komersial),usr:N(b.target_user??r.target_user),tot:N(b.target_total??r.target_total)});});
 return by;
}

function targetTable(p,ctx){
 const {st,window:w,D,ids,names,G,T}=ctx,y3=st.y[2];
 if(activeProductBrands().length)return; // target segmen tidak tersedia per brand produk
 const rows=ids.filter(id=>G(y3,id,'sales')>0||G(y3,id,'tgt')>0).map(id=>{
  const k=G(y3,id,'kom'),tk=G(y3,id,'tk'),u=G(y3,id,'usr'),tu=G(y3,id,'tu'),s=G(y3,id,'sales'),t=G(y3,id,'tgt');
  return [names.get(id),compact(k),compact(tk),pillCell(ach(k,tk)),gapTxt(k,tk),compact(u),compact(tu),pillCell(ach(u,tu)),gapTxt(u,tu),compact(s),compact(t),pillCell(ach(s,t)),gapTxt(s,t)];
 });
 const K=T(y3,'kom'),TK=T(y3,'tk'),U=T(y3,'usr'),TU=T(y3,'tu'),S3=T(y3,'sales'),TT=T(y3,'tgt');
 const heads=[H('TOKO',{s:1}),H('SALES KOMERSIAL',{r:1}),H('TARGET KOMERSIAL',{r:1}),H('ACH KOM',{r:1}),H('GAP KOM',{r:1}),H('SALES USER',{r:1}),H('TARGET USER',{r:1}),H('ACH USER',{r:1}),H('GAP USER',{r:1}),H('TOTAL SALES',{r:1}),H('TOTAL TARGET',{r:1}),H('ACH TOTAL',{r:1}),H('GAP TOTAL',{r:1})];
 const label=comparisonLabel(w)+' '+y3+' · s.d. '+fmtD(cutoff(st,w));
 const seg=mkTable([H('SEGMEN',{s:1}),H('SALES',{r:1}),H('TARGET',{r:1}),H('ACHIEVEMENT',{r:1}),H('GAP',{r:1}),H('PORSI SALES',{r:1})],[
   ['KOMERSIAL',compact(K),compact(TK),pillCell(ach(K,TK)),gapTxt(K,TK),pct(S3?K/S3:null)],
   ['USER',compact(U),compact(TU),pillCell(ach(U,TU)),gapTxt(U,TU),pct(S3?U/S3:null)]],
   ['TOTAL',compact(S3),compact(TT),pillCell(ach(S3,TT)),gapTxt(S3,TT),pct(S3?1:null)]);
 p.append(card('Komersial & User vs Target (s.d. cut-off)',label+' · target bulanan diprorata ke hari yang sama dengan data sales',
  el('p',{class:'sub'},'Sales = upload/sinkron Moka per segmen (sales_type_map.segmen). Target = Target Komersial & Target User di menu Sales & Target. Ubah tanggal cut-off pada kartu Filter & Atur Perbandingan (mode rentang tanggal).'),
  seg,mkTable(heads,rows,['TOTAL',compact(K),compact(TK),pillCell(ach(K,TK)),gapTxt(K,TK),compact(U),compact(TU),pillCell(ach(U,TU)),gapTxt(U,TU),compact(S3),compact(TT),pillCell(ach(S3,TT)),gapTxt(S3,TT)])));
}

async function loadMom(to,stores,menu){
 return DB.rpc('commercial_sales_mom_v86',{p_to:to,p_stores:stores,p_menu:menu});
}
function momTable(host,d,{title='Perbandingan vs bulan sebelumnya',menu='h2h'}={}){
 const y=Number(d.cur_to.slice(0,4)),m=Number(d.cur_to.slice(5,7)),py=Number(d.prev_from.slice(0,4)),pm=Number(d.prev_from.slice(5,7));
 const curDays=Number(d.cur_to.slice(8)),prevDays=Number(d.prev_to.slice(8)),dimC=daysInMonth(y,m),dimP=daysInMonth(py,pm);
 const rows=(d.rows||[]).filter(r=>storeOk(r.store_id));
 const ids=new Set(rows.map(r=>Number(r.store_id)));
 const tC=monthTargets(y,m,ids),tP=monthTargets(py,pm,ids);
 const nm=id=>(S.stores.find(s=>Number(s.id)===Number(id))||{}).name||String(id);
 const aov=(v,t)=>N(t)>0?N(v)/N(t):null;
 const sum=k=>rows.reduce((n,r)=>n+N(r[k]),0);
 const tsum=(map,k,days,dim)=>[...map.values()].reduce((n,t)=>n+prorate(t[k],days,dim),0);
 const curL=`1–${curDays} ${MON3[m-1]} ${y}`,prevL=`1–${prevDays} ${MON3[pm-1]} ${py}`;
 /* ringkasan segmen */
 const segRows=[['KOMERSIAL','cur_kom','prev_kom','kom'],['USER','cur_usr','prev_usr','usr'],['TOTAL','cur_total','prev_total','tot']].map(([n,c,pv,k])=>{
  const a=sum(c),b=sum(pv),ta=tsum(tC,k,curDays,dimC),tb=tsum(tP,k,prevDays,dimP);
  return [n,compact(a),compact(b),growthPill(a,b),gapTxt(a,b),compact(ta),pillCell(ach(a,ta)),compact(tb),pillCell(ach(b,tb)),compact(n==='TOTAL'?sum('prevfull_total'):sum(c==='cur_kom'?'prevfull_kom':'prevfull_usr'))];
 });
 const segHeads=[H('SEGMEN',{s:1}),H('SALES '+curL,{r:1}),H('SALES '+prevL,{r:1}),H('Δ',{r:1}),H('GAP',{r:1}),H('TARGET '+MON3[m-1]+' (prorata)',{r:1}),H('ACH '+MON3[m-1],{r:1}),H('TARGET '+MON3[pm-1]+' (prorata)',{r:1}),H('ACH '+MON3[pm-1],{r:1}),H('SALES '+MON3[pm-1]+' PENUH',{r:1})];
 const heads=[H('TOKO',{s:1}),H('SALES INI',{r:1}),H('SALES LALU',{r:1}),H('Δ',{r:1}),H('GAP',{r:1}),H('KOM INI',{r:1}),H('KOM LALU',{r:1}),H('Δ KOM',{r:1}),H('USER INI',{r:1}),H('USER LALU',{r:1}),H('Δ USER',{r:1}),H('TRX INI',{r:1}),H('TRX LALU',{r:1}),H('Δ TRX',{r:1}),H('AOV INI',{r:1}),H('AOV LALU',{r:1}),H('Δ AOV',{r:1}),H('ACH INI',{r:1}),H('ACH LALU',{r:1}),H('DATA S.D.',{})];
 const body=rows.sort((a,b)=>N(b.cur_total)-N(a.cur_total)).map(r=>{const id=Number(r.store_id),tc=prorate(tC.get(id)?.tot,curDays,dimC),tp=prorate(tP.get(id)?.tot,prevDays,dimP),ac=aov(r.cur_total,r.cur_trx),ap=aov(r.prev_total,r.prev_trx);
  return [nm(id),compact(r.cur_total),compact(r.prev_total),growthPill(N(r.cur_total),N(r.prev_total)),gapTxt(N(r.cur_total),N(r.prev_total)),compact(r.cur_kom),compact(r.prev_kom),growthPill(N(r.cur_kom),N(r.prev_kom)),compact(r.cur_usr),compact(r.prev_usr),growthPill(N(r.cur_usr),N(r.prev_usr)),int(r.cur_trx),int(r.prev_trx),growthPill(N(r.cur_trx),N(r.prev_trx)),rp(ac),rp(ap),growthPill(ac||0,ap||0),pillCell(ach(N(r.cur_total),tc)),pillCell(ach(N(r.prev_total),tp)),r.cur_last?fmtD(r.cur_last):'—'];});
 const TC=sum('cur_total'),TP=sum('prev_total'),AC=aov(TC,sum('cur_trx')),AP=aov(TP,sum('prev_trx')),tgC=tsum(tC,'tot',curDays,dimC),tgP=tsum(tP,'tot',prevDays,dimP);
 const short=rows.filter(r=>r.cur_last&&r.cur_last<d.cur_to).map(r=>nm(r.store_id));
 host.append(card(title,curL+' vs '+prevL+' · data harian Moka (hari yang sama, tanpa estimasi)',
  el('p',{class:'sub'},'Sumber: '+d.source+'. Target bulanan diprorata ke jumlah hari yang sama. Transaksi = jumlah nota Moka.'),
  short.length?el('p',{class:'note warn'},'Data '+short.join(', ')+' belum lengkap sampai '+fmtD(d.cur_to)+' (lihat kolom DATA S.D.). Jalankan Sinkron Moka untuk melengkapi.'):null,
  mkTable(segHeads,segRows),
  mkTable(heads,body,['TOTAL',compact(TC),compact(TP),growthPill(TC,TP),gapTxt(TC,TP),compact(sum('cur_kom')),compact(sum('prev_kom')),growthPill(sum('cur_kom'),sum('prev_kom')),compact(sum('cur_usr')),compact(sum('prev_usr')),growthPill(sum('cur_usr'),sum('prev_usr')),int(sum('cur_trx')),int(sum('prev_trx')),growthPill(sum('cur_trx'),sum('prev_trx')),rp(AC),rp(AP),growthPill(AC||0,AP||0),pillCell(ach(TC,tgC)),pillCell(ach(TP,tgP)),''])));
}
function momHost(p,to,menu,title){
 const host=el('div',{class:'v86-mom'});p.append(host);
 host.append(el('div',{class:'empty'},'Memuat perbandingan vs bulan sebelumnya…'));
 const page=S.page;
 loadMom(to,scopeStoreIds(),menu).then(d=>{if(!host.isConnected||S.page!==page)return;host.replaceChildren();momTable(host,d,{title,menu});})
  .catch(e=>{if(!host.isConnected)return;host.replaceChildren(el('p',{class:'note warn'},/commercial_sales_mom_v86|PGRST202|Could not find/i.test(e.message||'')?'Perbandingan bulan sebelumnya butuh V86.sql. Jalankan V86.sql di Supabase SQL Editor.':'Perbandingan bulan sebelumnya gagal dimuat: '+e.message));});
}

window.SSSG86={
 cutoff,
 append(p,ctx){
  targetTable(p,ctx);
  if(activeProductBrands().length){p.append(el('p',{class:'note'},'Perbandingan bulan sebelumnya per segmen tidak tersedia saat filter brand produk aktif.'));return;}
  momHost(p,cutoff(ctx.st,ctx.window),'h2h','Perbandingan vs bulan sebelumnya (s.d. cut-off)');
 },
 /* Program Sales: realisasi program per bulan vs bulan sebelumnya. */
 async program(host,prog,y,m1,m2,byYear,tgtOf){
  const months=[];for(let m=m1;m<=m2;m++)months.push(m);
  const cur=byYear[y]||[];
  const prevKey=m1>1?[y,m1-1]:[y-1,12];
  let before=null;try{before=(await programCategorySales(prog,prevKey[0],prevKey[1],prevKey[1]))[0];}catch{before=null;}
  if(!host.isConnected)return;
  const [cy,cm,cd]=opsToday().split('-').map(Number);
  const rows=months.map((m,i)=>{const a=N(cur[i]),b=i>0?N(cur[i-1]):before,t=tgtOf(y,m),tb=i>0?tgtOf(y,m-1):tgtOf(prevKey[0],prevKey[1]);
   const [py,pm]=i>0?[y,m-1]:prevKey,dimP=daysInMonth(py,pm),running=y===cy&&m===cm,days=Math.max(cd-1,1),bSame=running&&b!=null?b*Math.min(days,dimP)/dimP:null;
   return [MONTHS[m-1]+(running?' (berjalan s.d. '+days+')':''),compact(a),b==null?'—':compact(b),b==null?'—':growthPill(a,b),b==null?'—':gapTxt(a,b),bSame==null?'—':compact(bSame),bSame==null?'—':growthPill(a,bSame),compact(t),pillCell(ach(a,t)),tb==null?'—':pillCell(ach(b,tb))];});
  host.append(card('Program vs bulan sebelumnya',prog.name+' · '+ymLabel(y,m1,m2)+' · setiap bulan dibanding bulan tepat sebelumnya',
   el('p',{class:'sub'},'Bulan berjalan dibanding bulan lalu penuh dan bulan lalu yang dipotong ke jumlah hari yang sama (proporsional hari kalender).'),
   mkTable([H('BULAN',{s:1}),H('SALES PROGRAM',{r:1}),H('BULAN SEBELUMNYA',{r:1}),H('Δ',{r:1}),H('GAP',{r:1}),H('BLN LALU HARI SAMA',{r:1}),H('Δ HARI SAMA',{r:1}),H('TARGET',{r:1}),H('ACH',{r:1}),H('ACH BLN LALU',{r:1})],rows)));
 },
 momHost
};
})();
