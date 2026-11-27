/* V96 · Kantor Virtual — meja karyawan AI terjadwal (GitHub Actions → Supabase → dashboard & Telegram).
   Karyawan AI hanya membaca data & menyiapkan usulan; keputusan (mis. TF stok) menunggu ACC Manager (akun Master). */
(function(){'use strict';
if(window.OFFICE96)return;
const DESKS=[
 {id:'sales',name:'Analis Sales',role:'Briefing, target, MoM',icon:'M3 17l5-5 4 4 8-8M14 8h6v6',when:'Setiap hari 07.21 WITA'},
 {id:'stock',name:'Admin Stok',role:'Stok tipis, usulan TF',icon:'M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4 9-4V7',when:'Setiap hari 07.21 WITA'},
 {id:'sync',name:'Admin Sinkron',role:'Moka & snapshot stok',icon:'M4 12a8 8 0 0114-5l2 2M20 12a8 8 0 01-14 5l-2-2M20 4v5h-5M4 20v-5h5',when:'Setiap hari 07.21 WITA'},
 {id:'visit',name:'Sekretaris Visit',role:'Jadwal, itinerary, hasil visit',icon:'M7 3v4M17 3v4M4 9h16M5 5h14v15H5z',when:'Setiap hari 17.07 WITA'},
 {id:'loss',name:'Analis Loss',role:'Loss sales, item & alasan',icon:'M12 3l9 16H3zM12 10v4M12 17h.01',when:'Setiap hari 07.21 WITA'},
 {id:'complain',name:'Admin Komplain',role:'Komplain pelayanan & produk',icon:'M4 5h16v11H8l-4 4zM8 9h8M8 12h5',when:'Setiap hari 07.21 WITA'},
 {id:'csl',name:'Analis CSL',role:'Kepuasan pelanggan 1–5',icon:'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.6 6.7 19.4l1.2-6L3.4 9.3l6-.7z',when:'Setiap hari 07.21 WITA'},
 {id:'review',name:'Admin Google Review',role:'Review, rating, input harian',icon:'M12 21s-7-4.5-7-11a7 7 0 0114 0c0 6.5-7 11-7 11zM12 7v4M12 13.5h.01',when:'Setiap hari 07.21 WITA'}
];
const O=window.OFFICE96={data:null,busy:false,epoch:0};
const rp=v=>v==null||v===''||!Number.isFinite(Number(v))?'—':'Rp '+Math.round(Number(v)).toLocaleString('id-ID');
const n0=v=>v==null||v===''?'—':Number(v).toLocaleString('id-ID',{maximumFractionDigits:1});
const pc=v=>v==null?'—':(Number(v)*100).toLocaleString('id-ID',{maximumFractionDigits:0})+'%';
const wita=t=>{if(!t)return '—';const d=new Date(t);return d.toLocaleString('id-ID',{timeZone:'Asia/Makassar',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});};
const jam=t=>t?new Date(t).toLocaleTimeString('id-ID',{timeZone:'Asia/Makassar',hour:'2-digit',minute:'2-digit'}):'';
const isToday=t=>t&&new Date(t).toLocaleDateString('en-CA',{timeZone:'Asia/Makassar'})===opsToday();
const icon=d=>el('span',{class:'of-ic',html:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`});
async function call(fn,args={}){if(typeof MASTER!=='undefined'&&MASTER.verified&&typeof masterRpc==='function')return masterRpc(fn,args);return DB.rpc(fn,args);}
function explain(e){const t=String(e?.message||e);if(/PGRST202|42883|Could not find|does not exist/i.test(t))return 'Fungsi Kantor Virtual belum terpasang. Jalankan V96.sql di Supabase SQL Editor.';if(/42501|Manager|Master/i.test(t))return t.replace(/^\[\d+\]\s*/,'').replace(/^\{.*"message":"([^"]+)".*$/,'$1');return t;}
function csv(name,heads,rows){const cell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"',text='﻿'+[heads,...rows].map(r=>r.map(cell).join(',')).join('\r\n'),url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),a=el('a',{href:url,download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function pill(status,run){const map={ok:['of-ok','Selesai '+jam(run)],idle:['of-idle','Menunggu data'],warn:['of-warn','Perlu perhatian'],error:['of-bad','Gagal bekerja']};const [c,t]=run?map[status]||map.ok:['of-idle','Belum bekerja'];return el('span',{class:'of-pill '+c},t);}

/* ---------- rincian laporan per meja ---------- */
function tableBox(heads,rows,file){const wrap=el('div',{});wrap.append(el('div',{class:'rowline',style:'justify-content:flex-end;margin:0 0 8px'},el('button',{class:'btn sm',onclick:()=>csv(file,heads.map(h=>h.t),rows.map(r=>r.map(c=>c instanceof Node?c.textContent:c)))},'Unduh CSV')),mkTable(heads,rows));return wrap;}
function detail(rep){
 const b=rep.body||{},box=[];
 if(rep.desk==='ai'){box.push(el('p',{class:'sub'},(b.model?'Model '+b.model+' · ':'')+(b.catatan||'')),el('ul',{class:'of-ai'},...(b.briefing||[]).map(t=>el('li',{},t))));return box;}
 box.push(el('p',{class:'note'},rep.summary||''));
 if(b.ai&&(b.ai.analisa||(b.ai.tindakan||[]).length))box.push(el('div',{class:'of-aibox'},el('b',{},'Analisa AI'+(b.ai.model?' · '+b.ai.model:'')),b.ai.analisa?el('p',{},b.ai.analisa):'',(b.ai.tindakan||[]).length?el('ul',{},...b.ai.tindakan.map(t=>el('li',{},t))):''));
 if(rep.desk==='sales'&&b.rows){
  box.push(el('p',{class:'sub'},'Sumber: '+(b.source||'')+' · MTD '+(b.cur||[]).join(' s.d. ')+' · banding '+(b.prev||[]).join(' s.d. ')));
  box.push(tableBox([H('TOKO',{s:1}),H('KEMARIN',{r:1}),H('ACH HARIAN',{r:1}),H('MTD',{r:1}),H('TARGET MTD',{r:1}),H('ACH MTD',{r:1}),H('MoM',{r:1})],
   b.rows.map(r=>[r.store,rp(r.kemarin),pc(r.ach_kemarin),rp(r.mtd),rp(r.target_mtd),pc(r.ach_mtd),r.mom==null?'—':(r.mom>=0?'+':'')+pc(r.mom)]),'briefing-sales-'+rep.period+'.csv'));
 }
 if(rep.desk==='stock'){
  if(b.rule)box.push(el('p',{class:'sub'},'Aturan: stok < '+b.rule.cover_days+' hari jual (rata-rata 14 hari) dianggap tipis; usulan TF mengisi sampai '+b.rule.target_days+' hari, dibatasi stok DC ('+(b.dc||[]).join(', ')+'). Snapshot '+wita(b.snapshot_at)+'.'));
  if(b.thin)box.push(el('h3',{},'Item laris stok tipis'),tableBox([H('TOKO',{s:1}),H('ITEM'),H('STOK',{r:1}),H('LAKU/HARI',{r:1}),H('CUKUP (HARI)',{r:1}),H('STOK DC',{r:1})],b.thin.map(r=>[r.store,r.item,n0(r.stok),n0(r.laku_per_hari),n0(r.cukup_hari),n0(r.dc)]),'stok-tipis-'+rep.period+'.csv'));
 }
 if(rep.desk==='visit'){
  const s=(t,rows,f)=>rows&&rows.length?[el('h3',{},t),tableBox([H('TANGGAL'),H('SPV'),H('TOKO'),H('METODE'),H('STATUS')],rows.map(r=>[r.date,r.spv,r.cabang,r.metode,r.status||'Planned']),f)]:[];
  box.push(...s('Jadwal besok',b.tomorrow,'visit-besok.csv'));
  if(b.itinerary&&b.itinerary.length)box.push(el('h3',{},'Itinerary besok'),tableBox([H('JAM'),H('KEGIATAN'),H('DETAIL'),H('TRIP')],b.itinerary.map(r=>[r.time,r.task,r.detail,r.trip]),'itinerary-besok.csv'));
  box.push(...s('Jadwal berikutnya',b.upcoming,'visit-berikutnya.csv'));
  box.push(...s('Belum diisi hasilnya ('+(b.overdue_total||0)+')',b.overdue,'visit-belum-diisi.csv'));
 }
 if(rep.desk==='sync'&&b.coverage)box.push(tableBox([H('TOKO',{s:1}),H('DATA MOKA S.D.')],Object.entries(b.coverage).sort().map(([k,v])=>[k,v]),'cakupan-sinkron.csv'));
 if(rep.desk==='loss'&&b.total){box.push(el('p',{class:'sub'},'7 hari '+(b.week||[]).join(' s.d. ')+' vs '+(b.prev_week||[]).join(' s.d. ')+' · MTD '+rp(b.total.mtd_rp)+' ('+n0(b.total.mtd_qty)+' pcs) · bulan lalu hari yang sama '+rp(b.total.prev_mtd_rp)));
  if(b.top_items)box.push(el('h3',{},'Item loss terbesar (7 hari)'),tableBox([H('ITEM'),H('LOSS',{r:1})],b.top_items.map(r=>[r.item,rp(r.rp)]),'loss-item.csv'));
  if(b.reasons)box.push(el('h3',{},'Alasan'),tableBox([H('ALASAN'),H('LOSS',{r:1})],b.reasons.map(r=>[r.alasan,rp(r.rp)]),'loss-alasan.csv'));
  if(b.by_store)box.push(el('h3',{},'Per toko (7 hari)'),tableBox([H('TOKO',{s:1}),H('LOSS',{r:1}),H('PCS',{r:1}),H('7 HARI SEBELUMNYA',{r:1})],Object.values(b.by_store).sort((a,c)=>c.rp-a.rp).map(r=>[r.store,rp(r.rp),n0(r.qty),rp(r.prev_rp)]),'loss-toko.csv'));}
 if(rep.desk==='complain'){if(b.rule)box.push(el('p',{class:'sub'},'Aturan: '+b.rule+'.'));
  if(b.open&&b.open.length)box.push(el('h3',{},'Belum selesai ('+b.open_total+')'),tableBox([H('TANGGAL'),H('JENIS'),H('TOKO'),H('KATEGORI'),H('ALASAN'),H('STATUS'),H('SLA')],b.open.map(r=>[r.tanggal,r.jenis,r.toko,r.kategori,r.alasan,r.status,r.sla]),'komplain-terbuka.csv'));
  if(b.by_store)box.push(el('h3',{},'Per toko'),tableBox([H('TOKO',{s:1}),H('BULAN INI',{r:1}),H('TERBUKA',{r:1}),H('LEWAT SLA',{r:1})],Object.values(b.by_store).sort((a,c)=>c.open-a.open).map(r=>[r.store,n0(r.mtd),n0(r.open),n0(r.breach)]),'komplain-toko.csv'));}
 if(rep.desk==='csl'&&b.by_store){const f2=v=>v==null?'—':Number(v).toFixed(2).replace('.',',');box.push(el('p',{class:'sub'},'Batas perhatian: di bawah '+f2(b.min)+' (skala 1–5).'),tableBox([H('TOKO',{s:1}),H('RESPONDEN',{r:1}),H('OFFLINE',{r:1}),H('ONLINE',{r:1}),H('OFFLINE BLN LALU',{r:1})],Object.values(b.by_store).sort((a,c)=>(a.offline??9)-(c.offline??9)).map(r=>[r.store,n0(r.responden),f2(r.offline),f2(r.online),f2(r.offline_prev)]),'csl-toko.csv'));}
 if(rep.desk==='review'&&b.by_store){box.push(tableBox([H('TOKO',{s:1}),H('REVIEW BARU',{r:1}),H('TARGET',{r:1}),H('ACH PACE',{r:1}),H('RATING',{r:1}),H('INPUT TERAKHIR')],Object.values(b.by_store).sort((a,c)=>(a.ach_pace??9)-(c.ach_pace??9)).map(r=>[r.store,n0(r.actual),n0(r.target),pc(r.ach_pace),r.rating==null?'—':String(r.rating).replace('.',','),r.last_input||'—']),'google-review-toko.csv'));}
 if(String(rep.desk).startsWith('store-')&&b.issues)box.push(el('h3',{},'Perlu perhatian'),el('ul',{},...(b.issues.length?b.issues:['Tidak ada isu']).map(t=>el('li',{},t))));
 if(b.error)box.push(el('pre',{style:'white-space:pre-wrap;overflow-wrap:anywhere'},b.error));
 return box;
}
async function openReport(id,fallback){const {box}=opsModal(fallback?.title||'Laporan');box.classList.add('of-modal');box.append(el('div',{class:'empty'},'Memuat laporan…'));try{const rep=fallback?.body?fallback:await call('commercial_office_report_v96',{p_id:id});box.querySelector('.empty')?.remove();box.append(el('p',{class:'sub'},(rep.desk==='ai'?'Asisten AI (Gemini)':DESKS.find(d=>d.id===rep.desk)?.name||(String(rep.desk).startsWith('store-')?'Admin '+shortStore(rep.body?.store||''):rep.desk))+' · '+wita(rep.run_at)),...detail(rep));}catch(e){box.querySelector('.empty')?.remove();box.append(el('p',{class:'note warn'},explain(e)));}}

/* ---------- antrean persetujuan ---------- */
function taskRows(t){const rows=(t.detail&&t.detail.rows)||[];return rows;}
function openTask(t){
 const {box,modal}=opsModal(t.title);box.classList.add('of-modal');
 const d=t.detail||{},rows=taskRows(t);
 box.append(el('p',{class:'sub'},'Dibuat '+wita(t.created_at)+(d.rule?' · '+d.rule:'')+(t.value?' · nilai HPP '+rp(t.value):'')));
 if(d.per_store)box.append(mkTable([H('TOKO',{s:1}),H('ITEM',{r:1}),H('PCS',{r:1})],Object.entries(d.per_store).sort((a,b)=>b[1].pcs-a[1].pcs).map(([k,v])=>[k,n0(v.item),n0(v.pcs)])));
 if(rows.length)box.append(el('h3',{},'Rincian'),tableBox([H('TOKO',{s:1}),H('ITEM'),H('SKU'),H('STOK',{r:1}),H('LAKU/HARI',{r:1}),H('CUKUP',{r:1}),H('TF',{r:1}),H('NILAI',{r:1})],rows.map(r=>[r.store,r.item,r.sku,n0(r.stok),n0(r.laku_per_hari),n0(r.cukup_hari),n0(r.tf),rp(r.nilai)]),'usulan-tf-'+String(t.created_at).slice(0,10)+'.csv'));
 if(t.status==='pending')box.append(actions(t,()=>modal.remove()));
 else box.append(el('p',{class:'note'},statusText(t)));
}
function statusText(t){return ({approved:'Disetujui',rejected:'Ditolak',expired:'Kedaluwarsa'}[t.status]||'Menunggu')+(t.decided_by?' oleh '+t.decided_by:'')+(t.decided_at?' · '+wita(t.decided_at):'')+(t.note?' · '+t.note:'');}
function actions(t,done){
 if(!O.data?.is_manager)return el('p',{class:'sub of-wait'},'Menunggu persetujuan Manager.');
 const note=el('input',{type:'text',placeholder:'Catatan (opsional)',maxlength:500,class:'of-note'});
 const go=async status=>{if(O.busy)return;O.busy=true;try{await call('commercial_office_decide_v96',{p_id:t.id,p_status:status,p_note:note.value});toast(status==='approved'?'Usulan disetujui.':'Usulan ditolak.');done?.();await load(true);}catch(e){toast(explain(e));}finally{O.busy=false;}};
 return el('div',{class:'of-act'},note,el('button',{class:'btn sm',onclick:()=>go('rejected')},'Tolak'),el('button',{class:'btn sm pri',onclick:()=>go('approved')},'Setujui'));
}


/* ---------- V99: kantor isometrik yang lebih nyata — layar komputer menampilkan pekerjaan, Ruang Manager,
   Musholla, Ruang Istirahat; dua ruangan (Analis & Admin Toko) yang selalu muat di layar ---------- */
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LOOK={sales:['#5b5bd6','#2f2f6b'],stock:['#e07a3f','#5a2f14'],sync:['#2f9e8f','#123b35'],visit:['#d6467e','#4b1528'],loss:['#c0392b','#3b1a14'],complain:['#8e6bd6','#2b1f4b'],csl:['#1f8fbf','#0f2f44'],review:['#d9a400','#3b2c08']};
const SKIN=['#f1c7a3','#e0ac85','#c98d63','#f3d2b4'];
const rpS=v=>{v=Number(v||0);return Math.abs(v)>=1e9?'Rp'+(v/1e9).toLocaleString('id-ID',{maximumFractionDigits:2})+'M':Math.abs(v)>=1e6?'Rp'+(v/1e6).toLocaleString('id-ID',{maximumFractionDigits:0})+'jt':'Rp'+Math.round(v).toLocaleString('id-ID');};
const f2=v=>v==null?'—':Number(v).toFixed(2).replace('.',',');
const STORE_LOOK=n=>/MAMU/i.test(n)?['#e07a3f','#5a2f14']:/TIGALAPAN/i.test(n)?['#5b5bd6','#2f2f6b']:['#2f9e8f','#123b35'];
const shortStore=n=>String(n||'').toUpperCase().replace(/TIGALAPAN\s*KAOS|TIGALAPANKAOS/,'TK').replace(/\s+/g,' ').trim().replace(/\b([A-Z])([A-Z]+)\b/g,(m,a,b)=>m==='TK'||m==='BTP'||m==='MAMU'?m:a+b.toLowerCase());
function shortLine(d,r){if(d.soon)return 'Segera hadir';if(!r)return 'Belum bekerja';const b=r.body||{};
 if(r.status==='error')return 'Gagal, cek laporan';
 if(d.id==='sales'&&b.total)return 'MTD '+pc(b.total.ach_mtd)+' target'+(b.total.mom!=null?' · MoM '+(b.total.mom>=0?'+':'')+pc(b.total.mom):'');
 if(d.id==='stock')return b.tf_total!=null?'Usulan TF '+n0(b.tf_total)+' item':'Cek stok tipis';
 if(d.id==='visit')return (b.tomorrow||[]).length?'Besok '+b.tomorrow.length+' visit':(b.overdue_total?b.overdue_total+' visit belum diisi':'Besok tidak ada visit');
 if(d.id==='sync'){const v=Object.values(b.coverage||{});return v.length?'Data s.d. '+v.sort()[0]:'Cek sinkron';}
 if(d.id==='loss'&&b.total)return '7 hari '+rpS(b.total.week_rp)+(b.total.wow!=null?' · '+(b.total.wow>=0?'+':'')+pc(b.total.wow):'');
 if(d.id==='complain')return b.open_total!=null?b.open_total+' terbuka · '+(b.mtd_total||0)+' bln ini':'Cek komplain';
 if(d.id==='csl'&&b.avg)return 'Offline '+f2(b.avg.offline)+' · '+(b.responden||0)+' resp.';
 if(d.id==='review'&&b.total)return 'Review '+n0(b.total.actual)+(b.total.target?'/'+n0(b.total.target):'');
 if(String(d.id).startsWith('store-'))return (b.ach_mtd!=null?'MTD '+pc(b.ach_mtd):'MTD —')+((b.issues||[]).length?' · '+b.issues.length+' isu':' · aman');
 return r.title||'';}
/* angka besar yang tampil di layar komputer tiap meja */
function screenInfo(id,r){const b=r?.body||{};
 if(!r)return {big:'—',kind:'off'};
 if(id==='sales')return {big:b.total?.ach_mtd!=null?pc(b.total.ach_mtd):'—',kind:'bars',sub:'MTD'};
 if(id==='stock')return {big:b.tf_total!=null?n0(b.tf_total):'—',kind:'rows',sub:'TF'};
 if(id==='loss')return {big:b.total?rpS(b.total.week_rp):'—',kind:'hbars',sub:'LOSS'};
 if(id==='complain')return {big:b.open_total!=null?String(b.open_total):'—',kind:'chat',sub:'OPEN'};
 if(id==='csl')return {big:f2(b.avg?.offline),kind:'stars',sub:'CSL'};
 if(id==='review')return {big:b.total?n0(b.total.actual)+(b.total.target?'/'+n0(b.total.target):''):'—',kind:'review',sub:'REVIEW'};
 if(id==='visit')return {big:String((b.tomorrow||[]).length),kind:'cal',sub:'BESOK'};
 if(id==='sync')return {big:r.status==='ok'?'OK':'!',kind:'sync',sub:'MOKA'};
 if(String(id).startsWith('store-'))return {big:b.ach_mtd!=null?pc(b.ach_mtd):'—',kind:'line',sub:'MTD'};
 return {big:'',kind:'bars'};}
function pillOf(state,r){return {work:['#2f9e44','Selesai '+(r?jam(r.run_at):'')],warn:['#d98b00','Perhatian'],error:['#e5484d','Gagal'],idle:['#8b8d98',r?'Selesai '+jam(r.run_at):'Belum bekerja'],away:['#8b8d98','Segera']}[state];}
function stateOf(d,r){return d.soon?'away':!r?'idle':r.status==='error'?'error':r.status==='warn'?'warn':isToday(r.run_at)?'work':'idle';}

function isoKit(S0){
 const P=(x,y,z=0)=>[(x-y)*S0*0.866,(x+y)*S0*0.5-z*S0];
 const pts=a=>a.map(q=>P(...q).map(v=>v.toFixed(1)).join(',')).join(' ');
 const poly=(a,fill,extra='')=>`<polygon points="${pts(a)}" fill="${fill}" ${extra}/>`;
 const box=(x,y,z,w,d,h,top,left,right,extra='')=>poly([[x,y+d,z],[x+w,y+d,z],[x+w,y+d,z+h],[x,y+d,z+h]],left,extra)+poly([[x+w,y,z],[x+w,y+d,z],[x+w,y+d,z+h],[x+w,y,z+h]],right,extra)+poly([[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]],top,extra);
 const plant=(x,y,s=1)=>{const [cx,cy]=P(x+0.2,y+0.2,0.45);const r=S0/36*s;return box(x,y,0,0.4,0.4,0.45,'#e9e2d6','#cfc5b4','#bfb4a1')+`<g class="of3-leaf"><ellipse cx="${cx}" cy="${cy-14*r}" rx="${12*r}" ry="${16*r}" fill="#4f9d5d"/><ellipse cx="${cx-8*r}" cy="${cy-6*r}" rx="${8*r}" ry="${11*r}" fill="#3f8a4d"/><ellipse cx="${cx+8*r}" cy="${cy-7*r}" rx="${8*r}" ry="${11*r}" fill="#5fb36d"/></g>`;};
 const k=S0/36;
 /* orang duduk di belakang meja, menghadap penonton */
 const seated=(x,y,z,shirt,hair,skin,state,extra='')=>{const [cx,cy]=P(x,y,z);if(state==='away')return '';const sl=state==='idle';
  return `<g class="of3-p of3-${state}">
  <rect x="${cx-12*k}" y="${cy-4*k}" width="${24*k}" height="${26*k}" rx="${10*k}" fill="${shirt}"/>
  <g class="of3-head"><circle cx="${cx}" cy="${cy-14*k}" r="${10*k}" fill="${skin}"/><path d="M${cx-10*k} ${cy-15*k} a${10*k} ${10*k} 0 0 1 ${20*k} 0 q${-10*k} ${-6*k} ${-20*k} 0z" fill="${hair}"/>
  ${sl?`<path d="M${cx-5*k} ${cy-12*k} h${3.5*k} M${cx+1.5*k} ${cy-12*k} h${3.5*k}" stroke="#3b2b22" stroke-width="${1.2*k}"/>`:`<circle cx="${cx-3.6*k}" cy="${cy-12.5*k}" r="${1.2*k}" fill="#2b1d16" class="of3-eye"/><circle cx="${cx+3.6*k}" cy="${cy-12.5*k}" r="${1.2*k}" fill="#2b1d16" class="of3-eye"/><path d="M${cx-3*k} ${cy-8.5*k} q${3*k} ${2*k} ${6*k} 0" stroke="#9a5b3f" stroke-width="${1*k}" fill="none"/>`}</g>
  ${sl?`<text x="${cx+11*k}" y="${cy-26*k}" class="of3-z">z z</text>`:''}${state==='warn'||state==='error'?`<g class="of3-alert"><circle cx="${cx+15*k}" cy="${cy-30*k}" r="${8*k}" fill="${state==='error'?'#e5484d':'#f5a524'}"/><text x="${cx+15*k}" y="${cy-26.5*k}" text-anchor="middle" class="of3-bang">!</text></g>`:''}${extra}</g>`;};
 const walker=(shirt,hair,prop,skin='#f1c7a3',cap='')=>`<g class="of3-walk"><ellipse cx="0" cy="2" rx="${10*k}" ry="${3.5*k}" fill="rgba(0,0,0,.14)"/>
  <g class="of3-legs"><rect class="of3-leg l" x="${-5.5*k}" y="${-13*k}" width="${4.5*k}" height="${14*k}" rx="${2.2*k}" fill="#3a3f4b"/><rect class="of3-leg r" x="${1*k}" y="${-13*k}" width="${4.5*k}" height="${14*k}" rx="${2.2*k}" fill="#2f3440"/></g>
  <rect x="${-8.5*k}" y="${-32*k}" width="${17*k}" height="${21*k}" rx="${7.5*k}" fill="${shirt}"/>${prop||''}
  <circle cx="0" cy="${-40*k}" r="${7.5*k}" fill="${skin}"/><path d="M${-7.5*k} ${-41*k} a${7.5*k} ${7.5*k} 0 0 1 ${15*k} 0 q${-7.5*k} ${-4*k} ${-15*k} 0z" fill="${hair}"/>${cap}</g>`;
 const route=(pts2,dur,pause,begin,sit=false)=>{const there=pts2.map(q=>P(q[0],q[1],0)),back=[...there].reverse().slice(1),all=[...there,...back];
  const d='M'+all.map(q=>q.map(v=>v.toFixed(1)).join(' ')).join(' L'),walkEnd=sit?0.7:1,kk=v=>(v*walkEnd).toFixed(3);
  return `<animateMotion dur="${dur}s" begin="${begin}s" repeatCount="indefinite" path="${d}" keyPoints="0;0.5;0.5;1${sit?';1':''}" keyTimes="0;${kk(0.5-pause/2)};${kk(0.5+pause/2)};${kk(1)}${sit?';1':''}" calcMode="linear"/>`;};
 const room=(W,H,winX,winY)=>{let g=poly([[0,0,0],[W,0,0],[W,H,0],[0,H,0]],'var(--of3-floor)');
  for(let i=1;i<W;i++)g+=`<polyline points="${pts([[i,0,0],[i,H,0]])}" class="of3-grid"/>`;for(let j=1;j<H;j++)g+=`<polyline points="${pts([[0,j,0],[W,j,0]])}" class="of3-grid"/>`;
  g+=poly([[0,0,0],[W,0,0],[W,0,2.6],[0,0,2.6]],'var(--of3-wall1)')+poly([[0,0,0],[0,H,0],[0,H,2.6],[0,0,2.6]],'var(--of3-wall2)');
  g+=poly([[0,0,0],[W,0,0],[W,0,0.12],[0,0,0.12]],'var(--of3-base)')+poly([[0,0,0],[0,H,0],[0,H,0.12],[0,0,0.12]],'var(--of3-base)');
  for(const wx of winX)g+=poly([[wx,0,0.95],[wx+2.4,0,0.95],[wx+2.4,0,2.15],[wx,0,2.15]],'var(--of3-win)','class="of3-winf"')+`<polyline points="${pts([[wx+1.2,0,0.95],[wx+1.2,0,2.15]])}" class="of3-mull"/>`;
  for(const wy of winY)g+=poly([[0,wy,0.95],[0,wy+2.4,0.95],[0,wy+2.4,2.15],[0,wy,2.15]],'var(--of3-win)','class="of3-winf"')+`<polyline points="${pts([[0,wy+1.2,0.95],[0,wy+1.2,2.15]])}" class="of3-mull"/>`;
  return g;};
 /* tempelan di dinding kiri (bidang x=0): teks/gambar dengan transform miring */
 const wallX=(y0,z0,w,h,inner)=>{const [ex,ey]=P(0,y0+w,z0+h),a=0.866*S0*w/100,b=-0.5*S0*w/100,d=S0*h/60;return `<g transform="matrix(${a.toFixed(3)} ${b.toFixed(3)} 0 ${d.toFixed(3)} ${ex.toFixed(1)} ${ey.toFixed(1)})">${inner}</g>`;};
 const wallY=(x0,z0,w,h,inner)=>{const [ex,ey]=P(x0,0,z0+h),a=0.866*S0*w/100,b=0.5*S0*w/100,d=S0*h/60;return `<g transform="matrix(${a.toFixed(3)} ${b.toFixed(3)} 0 ${d.toFixed(3)} ${ex.toFixed(1)} ${ey.toFixed(1)})">${inner}</g>`;};
 const callout=(x,y,z,name,pillC,pillT,line,pulse,w,extra='')=>{const [lx,ly]=P(x,y,z),roomC=Math.max(8,Math.floor(w/6.4)-pillT.length);
  return `<g class="of3-call${extra}" transform="translate(${(lx-w/2).toFixed(1)} ${(ly-50).toFixed(1)})"><line x1="${w/2}" y1="42" x2="${w/2}" y2="52" class="of3-stem"/><rect width="${w}" height="42" rx="10" class="of3-card"/><circle cx="13" cy="14" r="4.5" fill="${pillC}" class="${pulse?'of3-pulse':''}"/><text x="23" y="18" class="of3-t">${esc(name)}</text><text x="10" y="33" class="of3-l"><tspan class="of3-s" fill="${pillC}">${esc(pillT)}</tspan> · ${esc(line.length>roomC?line.slice(0,roomC-1)+'…':line)}</text></g>`;};
 const label=(x,y,z,t,icon='')=>{const [lx,ly]=P(x,y,z),w=Math.round(t.length*6.6+(icon?26:16));return `<g class="of3-tag" transform="translate(${(lx-w/2).toFixed(1)} ${(ly-22).toFixed(1)})"><rect width="${w}" height="20" rx="10" class="of3-tagbg"/>${icon?`<text x="10" y="14.5" class="of3-tagi">${icon}</text>`:''}<text x="${icon?22:8}" y="14" class="of3-tagt">${esc(t)}</text></g>`;};
 return {P,pts,poly,box,plant,seated,walker,route,room,callout,label,wallX,wallY,S0,k};
}
/* isi layar komputer (koordinat 100×60, dipetakan ke bidang monitor) */
function screenSvg(info,state,color){
 const on=state!=='idle'&&state!=='away'&&info.kind!=='off',bg=on?'#0f1729':'#151922';
 let g=`<rect width="100" height="60" rx="3" fill="${bg}"/>`;
 if(!on)return g+`<circle cx="50" cy="30" r="6" fill="none" stroke="#2a3140" stroke-width="2"/><path d="M50 26v5" stroke="#2a3140" stroke-width="2"/>`;
 g+=`<rect width="100" height="9" rx="3" fill="#1d2840"/><circle cx="6" cy="4.5" r="1.6" fill="#ef4444"/><circle cx="11" cy="4.5" r="1.6" fill="#f59e0b"/><circle cx="16" cy="4.5" r="1.6" fill="#22c55e"/><text x="96" y="6.6" text-anchor="end" class="of3-scrt">${esc(info.sub||'')}</text>`;
 g+=`<text x="5" y="34" class="of3-scrbig" style="font-size:${String(info.big||'').length>5?14:22}px" fill="${state==='warn'?'#fbbf24':state==='error'?'#f87171':'#e2e8f0'}">${esc(info.big||'')}</text>`;
 const acc=color||'#60a5fa',K=info.kind;
 if(K==='bars'){[18,30,24,38,44].forEach((h,i)=>g+=`<rect class="of3-grow" style="animation-delay:${i*.15}s" x="${58+i*8}" y="${54-h}" width="5" height="${h}" rx="1" fill="${i===4?acc:'#3b82f6'}"/>`);}
 else if(K==='rows'){for(let i=0;i<5;i++)g+=`<rect x="56" y="${15+i*8.5}" width="4" height="4" rx="1" fill="${['#22c55e','#f59e0b','#ef4444','#22c55e','#f59e0b'][i]}"/><rect x="63" y="${15.5+i*8.5}" width="${20+(i*7)%14}" height="3" rx="1.5" fill="#475569"/>`;g+=`<rect class="of3-scan" x="54" y="14" width="42" height="6" fill="rgba(96,165,250,.18)"/>`;}
 else if(K==='hbars'){[34,26,19,12,8].forEach((w,i)=>g+=`<rect class="of3-growx" style="animation-delay:${i*.15}s" x="56" y="${14+i*8.5}" width="${w}" height="5" rx="1" fill="${i<2?'#f87171':'#fb923c'}"/>`);}
 else if(K==='chat'){g+=`<rect x="54" y="13" width="30" height="9" rx="4" fill="#334155"/><rect x="64" y="26" width="30" height="9" rx="4" fill="${acc}"/><rect x="54" y="39" width="24" height="9" rx="4" fill="#334155"/><g class="of3-typing"><circle cx="86" cy="45" r="1.6" fill="#94a3b8"/><circle cx="91" cy="45" r="1.6" fill="#94a3b8"/><circle cx="96" cy="45" r="1.6" fill="#94a3b8"/></g>`;}
 else if(K==='stars'){for(let i=0;i<5;i++){const cx=58+i*8.5,cy=24;g+=`<path d="M${cx} ${cy-4}l1.2 2.6 2.8.3-2.1 1.9.6 2.8-2.5-1.4-2.5 1.4.6-2.8-2.1-1.9 2.8-.3z" fill="${i<4?'#fbbf24':'#475569'}"/>`;}g+=`<rect x="56" y="36" width="40" height="4" rx="2" fill="#334155"/><rect class="of3-growx" x="56" y="36" width="32" height="4" rx="2" fill="#22c55e"/>`;}
 else if(K==='review'){g+=`<path d="M76 14l3.6 7.4 8.1.9-6 5.5 1.7 8-7.4-4.2-7.4 4.2 1.7-8-6-5.5 8.1-.9z" fill="#fbbf24" class="of3-pulse2"/><rect x="56" y="44" width="40" height="4" rx="2" fill="#334155"/><rect class="of3-growx" x="56" y="44" width="16" height="4" rx="2" fill="#60a5fa"/>`;}
 else if(K==='cal'){for(let r=0;r<4;r++)for(let c=0;c<6;c++)g+=`<rect x="${55+c*7}" y="${14+r*9}" width="5.5" height="7" rx="1" fill="${r===1&&c===3?acc:'#334155'}"/>`;}
 else if(K==='sync'){for(let i=0;i<3;i++)g+=`<rect x="56" y="${16+i*10}" width="38" height="4" rx="2" fill="#334155"/><rect class="of3-growx" style="animation-delay:${i*.3}s" x="56" y="${16+i*10}" width="${38-i*6}" height="4" rx="2" fill="#22c55e"/>`;g+=`<path class="of3-spin" d="M75 50a5 5 0 1 1-3.5-4.8" fill="none" stroke="#60a5fa" stroke-width="1.6"/>`;}
 else if(K==='line'){g+=`<polyline points="56,48 64,40 71,43 79,30 86,34 95,20" fill="none" stroke="${acc}" stroke-width="2.2" class="of3-draw"/><rect x="56" y="50" width="38" height="1" fill="#334155"/>`;}
 else if(K==='acc'){for(let i=0;i<3;i++)g+=`<rect x="54" y="${13+i*13}" width="42" height="10" rx="2" fill="#1e293b"/><rect x="57" y="${16+i*13}" width="20" height="3" rx="1.5" fill="#64748b"/><rect x="83" y="${15+i*13}" width="10" height="6" rx="2" fill="${i===0?'#f59e0b':'#22c55e'}"/>`;}
 const bl=String(info.big||'').length;return g+`<rect class="of3-cursor" x="${Math.min(50,6+bl*(bl>5?6.5:10))}" y="22" width="1.6" height="10" fill="#e2e8f0"/>`;
}
/* satu meja kerja: kursi, orang (menghadap penonton), meja, keyboard, monitor dengan layar terbaca */
function workstation(K,o){const {P,box,poly,seated}=K,{x,y,state,shirt,hair,skin,info,accent}=o,S0=K.S0;
 let g=box(x-1.05,y+1.45,0,0.75,0.75,0.42,'#3d4250','#2c303a','#353a46')+box(x-1.0,y+1.5,0.42,0.12,0.65,0.75,'#3d4250','#2c303a','#353a46');
 g+=seated(x-0.55,y+1.85,1.12,shirt,hair,skin,state,o.seatAnim||'');
 g+=box(x,y,0,1.25,2.6,0.74,'#f3e6cf','#d9c7a8','#c8b391');
 g+=box(x+0.35,y+1.55,0.74,0.42,0.8,0.03,'#e5e7ee','#c9cbd4','#b9bcc6')+box(x+0.45,y+2.45,0.74,0.22,0.15,0.03,'#e5e7ee','#c9cbd4','#b9bcc6');
 if(state!=='away'&&state!=='idle'){const [hx,hy]=P(x+0.55,y+1.95,0.79);g+=`<g class="of3-hands"><ellipse cx="${(hx-5*K.k).toFixed(1)}" cy="${hy.toFixed(1)}" rx="${3.2*K.k}" ry="${2.2*K.k}" fill="${skin}"/><ellipse cx="${(hx+6*K.k).toFixed(1)}" cy="${(hy-2*K.k).toFixed(1)}" rx="${3.2*K.k}" ry="${2.2*K.k}" fill="${skin}"/></g>`;}
 g+=box(x+0.55,y+0.95,0.74,0.3,0.3,0.03,'#2b2f3a','#1f232c','#2b2f3a')+box(x+0.62,y+1.05,0.77,0.08,0.1,0.22,'#2b2f3a','#1f232c','#2b2f3a');
 const sx=x+0.72,sy0=y+0.12,sy1=y+2.02,z0=0.98,z1=2.12;
 g+=box(x+0.6,sy0,z0-0.04,0.12,sy1-sy0,z1-z0+0.08,'#23262e','#1a1d24','#2b2f38');
 const a=0.866*S0*(sy1-sy0)/100,b=-0.5*S0*(sy1-sy0)/100,d=S0*(z1-z0)/60,[ex,ey]=P(sx,sy1,z1);
 g+=`<g class="of3-scr" transform="matrix(${a.toFixed(3)} ${b.toFixed(3)} 0 ${d.toFixed(3)} ${ex.toFixed(1)} ${ey.toFixed(1)})">${screenSvg(info,state,accent)}</g>`;
 return g;}
function deskStation(K,d,x,y,r,shirt,hair,skin,o={}){
 const state=stateOf(d,r),info=d.soon?{kind:'off'}:screenInfo(d.id,r);
 let g=workstation(K,{x,y,state,shirt,hair,skin,info,accent:shirt,seatAnim:o.seatAnim});
 const [pc_,pt]=pillOf(state,r),line=shortLine(d,r);
 g+=K.callout(x+0.4,y+1.2,2.35,d.name,pc_,pt,line,state==='work',o.w||196);
 return `<g class="of3-st${d.soon?' soon':''}" data-desk="${d.id}" tabindex="${d.soon?-1:0}" role="button" aria-label="${esc(d.name+': '+line)}">${g}</g>`;}
/* waktu WITA untuk suasana: shalat & istirahat */
function witaNow(){const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Makassar',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date()).split(':').map(Number);return p[0]*60+p[1];}
function moments(){const m=witaNow(),inR=(a,b)=>m>=a&&m<b;return {pray:inR(12*60,12*60+40)||inR(15*60+15,15*60+45)||inR(18*60,18*60+25),rest:inR(12*60,13*60),hm:m};}
function musholla(K,x0,y0,w,h,mo){const {box,poly,P,label}=K;let g='';
 g+=poly([[x0,y0,0.01],[x0+w,y0,0.01],[x0+w,y0+h,0.01],[x0,y0+h,0.01]],'#2f7d5b');
 g+=poly([[x0+0.12,y0+0.12,0.015],[x0+w-0.12,y0+0.12,0.015],[x0+w-0.12,y0+h-0.12,0.015],[x0+0.12,y0+h-0.12,0.015]],'#3a9168');
 for(let i=0;i<3;i++){const sx=x0+0.45+i*((w-0.9)/3),sw=(w-0.9)/3-0.25;g+=poly([[sx,y0+0.4,0.02],[sx+sw,y0+0.4,0.02],[sx+sw,y0+0.4+1.7,0.02],[sx,y0+0.4+1.7,0.02]],'#b8323b')+poly([[sx+0.08,y0+0.48,0.025],[sx+sw-0.08,y0+0.48,0.025],[sx+sw-0.08,y0+2.02,0.025],[sx+0.08,y0+2.02,0.025]],'none','stroke="#f0c75e" stroke-width="1"')+poly([[sx+sw*0.3,y0+0.48,0.026],[sx+sw*0.7,y0+0.48,0.026],[sx+sw*0.5,y0+0.8,0.026]],'#f0c75e');}
 g+=box(x0+w,y0-0.05,0,0.12,h+0.1,1.25,'#e7e2d8','#d6d0c3','#c9c2b3')+box(x0-0.05,y0+h,0,w*0.55,0.12,1.25,'#e7e2d8','#d6d0c3','#c9c2b3');
 g+=box(x0+w*0.62,y0+h+0.25,0,1.1,0.4,0.55,'#a47b55','#8a6443','#7b583a');
 for(let i=0;i<3;i++)g+=box(x0+w*0.62+0.1+i*0.33,y0+h+0.3,0.55,0.22,0.3,0.08,'#333','#222','#2a2a2a');
 g+=box(x0+0.2,y0+0.05,0,0.6,0.35,1.05,'#8b6a4a','#735638','#664c31')+box(x0+0.28,y0+0.1,1.05,0.12,0.25,0.18,'#3b6e4f','#2e5a40','#2a5039');
 if(mo.pray){for(let i=0;i<2;i++){const sx=x0+0.45+i*((w-0.9)/3)+((w-0.9)/3-0.25)/2,[cx,cy]=P(sx,y0+1.3,0.2);g+=`<g class="of3-prayer"><ellipse cx="${cx}" cy="${cy+6*K.k}" rx="${12*K.k}" ry="${5*K.k}" fill="${i?'#f8fafc':'#e2e8f0'}"/><rect x="${cx-9*K.k}" y="${cy-12*K.k}" width="${18*K.k}" height="${18*K.k}" rx="${8*K.k}" fill="${i?'#f8fafc':'#dbeafe'}"/><circle cx="${cx}" cy="${cy-18*K.k}" r="${7*K.k}" fill="${SKIN[i+1]}"/><path d="M${cx-7*K.k} ${cy-20*K.k}h${14*K.k}v${-4*K.k}h${-14*K.k}z" fill="#111"/></g>`;}}
 g+=label(x0+1.4,y0+h*0.75,1.5,mo.pray?'Musholla · waktu shalat':'Musholla','☪');
 return g;}
function pantry(K,x0,y0,w,h,mo){const {box,poly,P,label}=K;let g='';
 g+=poly([[x0,y0,0.01],[x0+w,y0,0.01],[x0+w,y0+h,0.01],[x0,y0+h,0.01]],'var(--of3-pantry)');
 g+=box(x0,y0,0,w,0.55,0.9,'#f1ece3','#ddd5c8','#cfc6b7')+box(x0,y0,0.9,w,0.55,0.05,'#4b5563','#374151','#3f4856');
 g+=box(x0+0.3,y0+0.08,0.95,0.42,0.35,0.5,'#1f2937','#111827','#1a2230')+box(x0+0.38,y0+0.4,0.95,0.12,0.06,0.12,'#ef4444','#dc2626','#b91c1c');
 g+=box(x0+1.1,y0+0.1,0.95,0.3,0.3,0.55,'#e5e7eb','#d1d5db','#c3c7ce')+box(x0+1.15,y0+0.15,1.5,0.2,0.2,0.3,'#93c5fd','#60a5fa','#3b82f6');
 g+=box(x0+w-0.8,y0+0.05,0,0.75,0.7,1.9,'#f8fafc','#e2e8f0','#cbd5e1')+`<polyline points="${K.pts([[x0+w-0.05,y0+0.75,1.2],[x0+w-0.05,y0+0.75,0.8]])}" stroke="#94a3b8" stroke-width="2"/>`;
 const tx=x0+w*0.45,ty=y0+h*0.62,[tcx,tcy]=P(tx,ty,0.72);
 g+=box(tx-0.06,ty-0.06,0,0.12,0.12,0.7,'#9ca3af','#6b7280','#4b5563')+`<ellipse cx="${tcx}" cy="${tcy}" rx="${0.75*K.S0}" ry="${0.4*K.S0}" fill="#f5f0e6" stroke="#d6cdbd"/>`;
 g+=`<rect x="${tcx-6*K.k}" y="${tcy-8*K.k}" width="${6*K.k}" height="${7*K.k}" rx="1.5" fill="#fff" stroke="#c9ccd6"/><g class="of3-steam"><path d="M${tcx-3*K.k} ${tcy-10*K.k} q${2*K.k} ${-3*K.k} 0 ${-6*K.k}" stroke="#cbd5e1" fill="none"/></g>`;
 for(const [dx,dy] of [[-0.9,0.2],[0.6,0.9]])g+=box(tx+dx,ty+dy,0,0.4,0.4,0.42,'#d97706','#b45309','#92400e');
 if(mo.rest){const [cx,cy]=P(tx-0.7,ty+0.4,0.42);g+=`<g class="of3-rester"><rect x="${cx-9*K.k}" y="${cy-20*K.k}" width="${18*K.k}" height="${20*K.k}" rx="${8*K.k}" fill="#0ea5e9"/><circle cx="${cx}" cy="${cy-27*K.k}" r="${7.5*K.k}" fill="${SKIN[2]}"/><path d="M${cx-7.5*K.k} ${cy-28*K.k} a${7.5*K.k} ${7.5*K.k} 0 0 1 ${15*K.k} 0z" fill="#1f1a17"/></g>`;}
 g+=box(x0+0.3,y0+h-0.9,0,1.9,0.8,0.4,'#7fae8a','#5f8f6a','#6e9f79')+box(x0+0.3,y0+h-0.25,0.4,1.9,0.2,0.4,'#7fae8a','#5f8f6a','#6e9f79');
 g+=label(x0+w/2,y0+h/2,1.75,mo.rest?'Ruang Istirahat · jam istirahat':'Ruang Istirahat','☕');
 return g;}
function wallClock(K,x0,z0){const {P}=K,[cx,cy]=P(x0,0,z0),r=0.32*K.S0,m=witaNow(),ha=((m/60)%12)*30,ma=(m%60)*6;
 return `<g class="of3-clock"><ellipse cx="${cx}" cy="${cy}" rx="${r*0.866}" ry="${r}" fill="#fff" stroke="#334155" stroke-width="2"/><line x1="${cx}" y1="${cy}" x2="${cx+Math.sin(ha*Math.PI/180)*r*0.45}" y2="${cy-Math.cos(ha*Math.PI/180)*r*0.5}" stroke="#111" stroke-width="2"/><line x1="${cx}" y1="${cy}" x2="${cx+Math.sin(ma*Math.PI/180)*r*0.7}" y2="${cy-Math.cos(ma*Math.PI/180)*r*0.75}" stroke="#334155" stroke-width="1.4"/></g>`;}
const CD=20;
/* ===== Ruang Analis ===== */
const MAIN_SEATS={sales:[5.6,3.9],stock:[9.6,0.2],sync:[13.6,-3.5],visit:[17.6,-7.2],loss:[9.4,8.1],complain:[13.4,4.4],csl:[17.4,0.7],review:[21.4,-3.0]};
function officeScene(D){
 const latest=Object.fromEntries((D.desks||[]).map(r=>[r.desk,r])),K=isoKit(30),{P,box,plant,walker,route,room,callout,poly,label,wallX,wallY}=K,mo=moments();
 const W=23,H=20,shift=[-2.2,6.6];
 const seats=Object.fromEntries(Object.entries(MAIN_SEATS).map(([id,[x,y]])=>[id,[x+shift[0],y+shift[1]]]));
 const pendDesks=[...new Set((D.tasks||[]).filter(t=>t.status==='pending').map(t=>t.desk))].filter(id=>seats[id]);
 const seatAnim=i=>`<animate attributeName="opacity" values="0;1" keyTimes="0;0.7" calcMode="discrete" dur="${CD}s" begin="${i*4}s" repeatCount="indefinite"/>`;
 let g=room(W,H,[11,14.5,18],[4.5,8]);
 g+=wallClock(K,20.9,1.95);
 /* papan Analisa AI di dinding belakang */
 const ai=latest.ai,aiTxt=ai?(ai.body?.briefing||[])[0]||ai.summary||'':'Isi GEMINI_API_KEY untuk analisa AI';
 g+=`<g class="of3-aiboard" data-desk="ai" role="button" tabindex="0" aria-label="Papan Analisa AI">`+wallY(4.7,0.75,4.8,1.65,`<rect width="100" height="60" rx="3" fill="#ffffff" stroke="#94a3b8" stroke-width="1.5"/><rect width="100" height="12" rx="3" fill="#4f46e5"/><text x="5" y="8.6" class="of3-aih">Analisa AI${ai?' · '+esc(jam(ai.run_at)):''}</text>`+String(aiTxt).match(/.{1,30}(\s|$)/g)?.slice(0,5).map((t,i)=>`<text x="5" y="${21+i*8.5}" class="of3-ait">${esc(t.trim())}</text>`).join('')+`</g>`)+`</g>`;
 /* Ruang Manager (kaca) */
 const pend=Number(D.pending||0);
 g+=poly([[0,0,0.01],[4.2,0,0.01],[4.2,4.2,0.01],[0,4.2,0.01]],'var(--of3-mgrfloor)');
 g+=workstation(K,{x:1.7,y:0.4,state:pend?'work':'idle',shirt:'#2d3a5a',hair:'#1f1a17',skin:SKIN[1],info:{big:pend?String(pend):'0',kind:'acc',sub:'ACC'},accent:'#f59e0b'});
 g+=plant(0.2,3.6);
 g+=poly([[4.2,0,0],[4.2,4.2,0],[4.2,4.2,2.3],[4.2,0,2.3]],'var(--of3-glass)','class="of3-glassw"')+poly([[0,4.2,0],[2.4,4.2,0],[2.4,4.2,2.3],[0,4.2,2.3]],'var(--of3-glass)','class="of3-glassw"');
 g+=`<g class="of3-mgr" data-desk="mgr" role="button" tabindex="0" aria-label="Ruang Manager: ${pend} menunggu persetujuan">${callout(2.1,1.6,2.45,'Ruang Manager',pend?'#d98b00':'#2f9e44',pend?pend+' usulan':'Kosong',pend?'menunggu ACC':'tidak ada antrean',!!pend,196)}</g>`;
 /* Musholla (kiri depan) & Ruang Istirahat (kanan depan) */
 g+=musholla(K,0.35,14.2,4.6,4.4,mo);
 g+=pantry(K,18.2,9.6,4.5,4.6,mo);
 g+=plant(0.2,0.2)+plant(22.4,0.2)+plant(0.2,19.4)+plant(22.4,19.4)+plant(10.4,19.4);
 const order=DESKS.filter(d=>seats[d.id]).sort((a,b)=>(seats[a.id][0]+seats[a.id][1])-(seats[b.id][0]+seats[b.id][1]));
 for(const d of order){const [x,y]=seats[d.id],[sh,ha]=LOOK[d.id]||['#888','#333'],pi=pendDesks.indexOf(d.id);g+=deskStation(K,d,x,y,latest[d.id],sh,ha,SKIN[(d.id.length)%SKIN.length],{seatAnim:pi>=0?seatAnim(pi):''});}
 const doc=b=>`<g class="of3-doc"><animate attributeName="opacity" values="1;0" keyTimes="0;0.35" calcMode="discrete" dur="${CD}s" begin="${b}s" repeatCount="indefinite"/><rect x="${5*K.k}" y="${-28*K.k}" width="${10*K.k}" height="${13*K.k}" rx="1.5" fill="#fff" stroke="#c9ccd6"/><line x1="${7*K.k}" y1="${-24*K.k}" x2="${13*K.k}" y2="${-24*K.k}" stroke="#9aa0ad"/><line x1="${7*K.k}" y1="${-21*K.k}" x2="${13*K.k}" y2="${-21*K.k}" stroke="#9aa0ad"/></g>`;
 pendDesks.forEach((id,i)=>{const [x,y]=seats[id],[sh,ha]=LOOK[id]||['#888','#333'];
  const m=route([[x-0.55,y+1.85],[x-0.55,y+3.1],[x-2,y+3.1],[x-2,5.3],[5.2,5.3],[5.2,2.6],[3.4,2.6]],CD,0.14,i*4,true);
  g+=`<g class="of3-courier" opacity="0" aria-hidden="true">${m}<animate attributeName="opacity" values="1;0" keyTimes="0;0.7" calcMode="discrete" dur="${CD}s" begin="${i*4}s" repeatCount="indefinite"/>${walker(sh,ha,doc(i*4),SKIN[i%SKIN.length])}</g>`;});
 const cup=`<g><rect x="${6*K.k}" y="${-26*K.k}" width="${6*K.k}" height="${7*K.k}" rx="1.5" fill="#fff" stroke="#c9ccd6"/></g>`;
 g+=`<g class="of3-ob" aria-hidden="true">${route([[18.2,15.2],[15.2,15.2],[15.2,5.6],[6.8,5.6]],30,0.1,0)}${walker('#7a8899','#2b2622',cup,SKIN[2])}</g>`;
 const [x0]=P(0,H,0),[x1]=P(W,0,0),[,yTop]=P(0,0,2.6),[,yBot]=P(W,H,0);
 return `<svg viewBox="${(x0-14).toFixed(0)} ${(yTop-64).toFixed(0)} ${(x1-x0+28).toFixed(0)} ${(yBot-yTop+76).toFixed(0)}" class="of3-svg" role="img" aria-label="Ruang Analis: meja karyawan AI, Ruang Manager, Musholla dan Ruang Istirahat">${g}</svg>`;
}
/* ===== Ruang Admin Toko ===== */
function storeScene(D){
 const rows=(D.desks||[]).filter(r=>String(r.desk).startsWith('store-')).sort((a,b)=>String(a.body?.store||'').localeCompare(String(b.body?.store||''),'id'));
 if(!rows.length)return '';
 const K=isoKit(30),{P,box,plant,walker,route,room,label}=K,cols=rows.length>9?4:3,nr=Math.ceil(rows.length/cols);
 /* grid sejajar layar (label tidak menutupi meja lain); ruangan dibuat sekecil mungkin yang masih memuat semua meja */
 const dS=6.7,sS=8.4,raw0=rows.map((r,i)=>{const d=-dS*(cols-1)/2+dS*(i%cols),sm=sS*Math.floor(i/cols);return {r,x:(sm+d)/2,y:(sm-d)/2};});
 const mx=Math.min(...raw0.map(o=>o.x)),my=Math.min(...raw0.map(o=>o.y)),raw=raw0.map(o=>({...o,x:o.x-mx+2.8,y:o.y-my+1.1}));
 const W=Math.max(...raw.map(o=>o.x))+2.6,H=Math.max(...raw.map(o=>o.y))+4.0;
 let g=room(W,H,[W*0.35,W*0.62],[H*0.3,H*0.58])+wallClock(K,W*0.2,1.95)+plant(0.2,0.2)+plant(W-0.6,0.2)+plant(0.2,H-0.6)+plant(W-0.6,H-0.6);
 /* pojok minum & camilan */
 g+=box(W-2.8,H-1.0,0,1.8,0.6,0.9,'#f1ece3','#ddd5c8','#cfc6b7')+box(W-2.6,H-0.9,0.9,0.3,0.3,0.55,'#e5e7eb','#d1d5db','#c3c7ce')+box(W-2.55,H-0.85,1.45,0.2,0.2,0.3,'#93c5fd','#60a5fa','#3b82f6')+box(W-1.9,H-0.9,0.9,0.6,0.35,0.3,'#f59e0b','#d97706','#b45309');
 g+=box(W-5.6,H-1.3,0,2.2,0.8,0.4,'#7fae8a','#5f8f6a','#6e9f79')+box(W-5.6,H-0.55,0.4,2.2,0.22,0.4,'#7fae8a','#5f8f6a','#6e9f79')+label(W-3.4,H-1.2,1.9,'Pojok istirahat','☕');
 g+=box(0.25,1.2,0,0.6,1.6,1.6,'#9aa3b2','#7d8696','#6f7888')+box(1.2,0.25,0,1.4,0.6,1.6,'#9aa3b2','#7d8696','#6f7888')+box(W-1.2,0.3,0,0.8,0.7,0.85,'#e5e7eb','#cbd5e1','#94a3b8')+box(W-1.1,0.35,0.85,0.6,0.55,0.12,'#334155','#1e293b','#0f172a');
 const seats=raw.sort((a,b)=>(a.x+a.y)-(b.x+b.y));
 for(const {r,x,y} of seats){const name=r.body?.store||r.title,d={id:r.desk,name:'Admin '+shortStore(name)},[sh,ha]=STORE_LOOK(name);g+=deskStation(K,d,x,y,r,sh,ha,SKIN[(name.length)%SKIN.length],{w:178});}
 g+=`<g class="of3-ob" aria-hidden="true">${route([[W-3.4,H-2.2],[W*0.5,H-2.2],[W*0.5,H*0.55]],26,0.1,0)}${walker('#7a8899','#2b2622','',SKIN[2])}</g>`;
 const [x0]=P(0,H,0),[x1]=P(W,0,0),[,yTop]=P(0,0,2.6),[,yBot]=P(W,H,0);
 return `<svg viewBox="${(x0-14).toFixed(0)} ${(yTop-64).toFixed(0)} ${(x1-x0+28).toFixed(0)} ${(yBot-yTop+76).toFixed(0)}" class="of3-svg" role="img" aria-label="Ruang Admin Toko: meja admin per toko dan statusnya">${g}</svg>`;
}
function sceneEl(D){
 const storeN=(D.desks||[]).filter(r=>String(r.desk).startsWith('store-')).length;
 if(!O.room||(O.room==='stores'&&!storeN))O.room='main';
 const wrap=el('div',{class:'of3-wrap'}),inner=el('div',{class:'of3-inner'});
 const tab=(id,t,sub)=>el('button',{type:'button',role:'tab','aria-selected':O.room===id?'true':'false',class:'of3-tab'+(O.room===id?' on':''),onclick:()=>{O.room=id;draw();}},el('b',{},t),el('span',{},sub));
 const tabs=el('div',{class:'of3-tabs',role:'tablist','aria-label':'Pilih ruangan'});
 const zb=el('button',{type:'button',class:'btn sm of3-zoom',onclick:()=>{wrap.classList.toggle('zoom');zb.textContent=wrap.classList.contains('zoom')?'Perkecil':'Perbesar';if(wrap.classList.contains('zoom'))requestAnimationFrame(()=>{inner.scrollLeft=(inner.scrollWidth-inner.clientWidth)*0.4;});}},'Perbesar');
 const draw=()=>{tabs.replaceChildren(tab('main','Ruang Analis','8 analis · Manager · Musholla · Istirahat'),...(storeN?[tab('stores','Ruang Admin Toko',storeN+' admin toko')]:[]),zb);inner.innerHTML=O.room==='stores'?storeScene(D):officeScene(D);};
 draw();
 const latest=Object.fromEntries((D.desks||[]).map(r=>[r.desk,r]));
 inner.addEventListener('click',e=>{const st=e.target.closest('[data-desk]');if(!st)return;const id=st.dataset.desk;
  if(id==='mgr'){document.querySelector('.of-queue')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
  const r=latest[id];if(r)openReport(r.id,r);else if(id==='ai')toast('Analisa AI muncul setelah secret GEMINI_API_KEY diisi dan workflow berjalan.');else if(!DESKS.find(d=>d.id===id)?.soon)toast('Meja ini belum pernah bekerja. Jalankan workflow Kantor Virtual.');});
 inner.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.closest('[data-desk]')){e.preventDefault();e.target.closest('[data-desk]').dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
 wrap.append(tabs,inner,el('p',{class:'of3-legend'},el('span',{},el('i',{style:'background:#2f9e44'}),'Selesai hari ini'),el('span',{},el('i',{style:'background:#d98b00'}),'Perlu perhatian'),el('span',{},el('i',{style:'background:#e5484d'}),'Gagal'),el('span',{},el('i',{style:'background:#8b8d98'}),'Belum bekerja'),el('span',{class:'of3-hint'},'Klik meja atau papan AI untuk membuka laporan')));
 return wrap;
}

/* ---------- halaman ---------- */
function paint(p){
 const D=O.data||{desks:[],tasks:[],history:[]},latest=Object.fromEntries((D.desks||[]).map(r=>[r.desk,r]));
 const alerts=(D.desks||[]).filter(r=>r.status==='warn'||r.status==='error').length,storeRows=(D.desks||[]).filter(r=>String(r.desk).startsWith('store-'));
 const metric=(k,v,cls)=>el('div',{class:'of-metric'},el('span',{},k),el('b',{class:cls||null},v));
 p.append(el('div',{class:'of-metrics'},metric('Pekerjaan selesai hari ini',n0(D.today_done||0)),metric('Menunggu persetujuan',n0(D.pending||0),D.pending?'of-tw':''),metric('Meja perlu perhatian',n0(alerts),alerts?'of-tb':'')));
 p.append(sceneEl(D));
 const grid=el('div',{class:'of-grid'});
 for(const d of DESKS){
  const r=latest[d.id];
  const head=el('div',{class:'of-head'},icon(d.icon),el('div',{class:'of-name'},el('b',{},d.name),el('span',{},d.role)),d.soon?el('span',{class:'of-pill of-idle'},'Segera'):pill(r?.status,r?.run_at));
  const c=el('div',{class:'of-desk'+(d.soon?' of-soon':'')+(r&&!isToday(r.run_at)&&!d.soon?' of-stale':'')},head);
  if(d.soon)c.append(el('p',{},'Meja ini disiapkan setelah tiga meja utama berjalan stabil.'));
  else if(r){c.append(el('p',{class:'of-sum'},r.summary||r.title),el('div',{class:'of-foot'},el('span',{},(isToday(r.run_at)?'':'Terakhir '+wita(r.run_at)+' · ')+d.when),el('button',{class:'btn sm',onclick:()=>openReport(r.id,r)},'Lihat laporan')));}
  else c.append(el('p',{class:'of-sum'},'Belum pernah bekerja. Jalankan workflow "Kantor Virtual" di GitHub Actions atau tunggu jadwal.'),el('div',{class:'of-foot'},el('span',{},d.when)));
  grid.append(c);
 }
 p.append(grid);
 if(storeRows.length){const sr=[...storeRows].sort((a,b)=>(b.body?.issues||[]).length-(a.body?.issues||[]).length||String(a.body?.store).localeCompare(String(b.body?.store),'id'));
  p.append(card('Admin Toko',storeRows.filter(r=>r.status==='warn').length+' dari '+storeRows.length+' toko perlu perhatian · diperbarui '+wita(sr[0].run_at),mkTable([H('TOKO',{s:1}),H('MTD',{r:1}),H('PERLU PERHATIAN'),H('')],sr.map(r=>[r.body?.store||r.title,pc(r.body?.ach_mtd),(r.body?.issues||[]).join('; ')||'Aman',el('button',{class:'btn sm',onclick:()=>openReport(r.id)},'Laporan')]))));}
 const tasks=D.tasks||[],pending=tasks.filter(t=>t.status==='pending'),done=tasks.filter(t=>t.status!=='pending').slice(0,10);
 const q=card('Antrean persetujuan',pending.length?pending.length+' menunggu · hanya Manager yang dapat menyetujui':'Tidak ada yang menunggu');
 if(!pending.length)q.append(el('p',{class:'sub'},'Usulan dari karyawan AI (mis. TF stok dari DC) akan muncul di sini.'));
 for(const t of pending)q.append(el('div',{class:'of-task'},el('div',{class:'of-tt'},el('b',{},t.title),el('span',{},(DESKS.find(d=>d.id===t.desk)?.name||t.desk)+' · '+wita(t.created_at)+(t.value?' · '+rp(t.value):''))),el('button',{class:'btn sm',onclick:()=>openTask(t)},'Lihat rincian'),actions(t)));
 if(done.length){q.append(el('h3',{class:'of-h3'},'Keputusan terakhir'));for(const t of done)q.append(el('div',{class:'of-task of-done'},el('div',{class:'of-tt'},el('b',{},t.title),el('span',{},statusText(t))),el('button',{class:'btn sm',onclick:()=>openTask(t)},'Rincian')));}
 q.classList.add('of-queue');p.append(q);
 const h=(D.history||[]);
 p.append(card('Riwayat pekerjaan',h.length+' laporan terakhir',mkTable([H('WAKTU'),H('MEJA'),H('STATUS'),H('RINGKASAN',{s:0})],h.slice(0,25).map(r=>({cells:[wita(r.run_at),DESKS.find(d=>d.id===r.desk)?.name||r.desk,({ok:'Selesai',warn:'Perhatian',error:'Gagal',idle:'Menunggu'})[r.status]||r.status,el('a',{href:'#',onclick:e=>{e.preventDefault();openReport(r.id);}},r.title)]})))));
}
async function load(force){
 const p=$('#p-office');if(!p)return;const epoch=++O.epoch;
 p.replaceChildren(el('div',{class:'phead'},el('div',{},el('h1',{},'Kantor Virtual'),el('p',{},'Karyawan AI bekerja terjadwal dan gratis: pagi 07.21 WITA (analis sales, stok, sinkron, loss, komplain, CSL, Google Review dan admin tiap toko), sore 17.07 WITA (Sekretaris Visit). Mereka hanya membaca data dan menyiapkan usulan; keputusan tetap di Manager.')),el('span',{class:'spacer'}),el('button',{class:'btn sm',onclick:()=>load(true)},'Muat ulang')));
 if(S.demo){p.append(el('div',{class:'note'},'Kantor Virtual memakai data Supabase asli; tidak tersedia di mode contoh.'));return;}
 if(!O.data||force){p.append(el('div',{class:'empty'},'Memanggil staf virtual…'));try{O.data=await call('commercial_office_v96',{p_history:60});}catch(e){if(epoch!==O.epoch)return;p.querySelector('.empty')?.remove();p.append(el('div',{class:'note warn'},explain(e)));return;}if(epoch!==O.epoch||S.page!=='office')return;p.querySelector('.empty')?.remove();}
 paint(p);
}
O.show=()=>load(false);
const css=`.of-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:0 0 14px}
.of-metric{background:var(--surface);border:1px solid var(--ring);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:2px}.of-metric span{font-size:12px;color:var(--ink-2)}.of-metric b{font-size:22px}.of-metric b.of-tw{color:var(--warn,#b7791f)}.of-metric b.of-tb{color:var(--bad,#c0392b)}
.of-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px;margin:0 0 16px}
.of-desk{background:var(--surface);border:1px solid var(--ring);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:8px;min-width:0}
.of-desk.of-soon{border-style:dashed;opacity:.75}.of-desk.of-stale{border-color:var(--warn,#d69e2e)}
.of-head{display:flex;align-items:center;gap:10px}.of-ic{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--accent-soft,rgba(91,91,214,.12));color:var(--accent,#5b5bd6);flex:0 0 34px}.of-ic svg{width:18px;height:18px}
.of-name{display:flex;flex-direction:column;min-width:0;flex:1}.of-name b{font-size:14px}.of-name span{font-size:12px;color:var(--ink-2)}
.of-pill{font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;white-space:nowrap}.of-ok{background:rgba(46,160,67,.14);color:#2f855a}.of-warn{background:rgba(214,158,46,.18);color:#975a16}.of-bad{background:rgba(229,62,62,.14);color:#c53030}.of-idle{background:var(--ring);color:var(--ink-2)}
.of-desk p{margin:0;font-size:13px;line-height:1.5}.of-sum{display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.of-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:auto;font-size:12px;color:var(--ink-2)}
.of-task{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 12px;align-items:center;padding:10px 0;border-top:1px solid var(--ring)}.of-task .of-act,.of-task .of-wait{grid-column:1/-1}
.of-tt{display:flex;flex-direction:column;min-width:0}.of-tt b{font-size:13px}.of-tt span{font-size:12px;color:var(--ink-2)}.of-done{opacity:.8}.of-h3{margin:14px 0 0;font-size:13px}
.of-act{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.of-note{flex:1 1 200px;min-width:0}
.of-modal{max-width:min(1000px,96vw)}
.of3-wrap{background:var(--surface);border:1px solid var(--ring);border-radius:16px;padding:8px 8px 10px;margin:0 0 14px;--of3-base:#d9d2c4;--of3-pantry:#efe4d2;--of3-mgrfloor:#e8e4f3;--of3-floor:#f4efe6;--of3-wall1:#ebe7f6;--of3-wall2:#e2ddf1;--of3-win:#cfe6f7;--of3-glass:rgba(150,200,235,.28)}
[data-theme="dark"] .of3-wrap{--of3-floor:#2a2c33;--of3-wall1:#30323b;--of3-wall2:#2b2d35;--of3-win:#3b5568;--of3-glass:rgba(120,170,210,.18);--of3-base:#24262c;--of3-pantry:#33302b;--of3-mgrfloor:#2f3139}
.of3-inner{display:flex;justify-content:center}.of3-svg{display:block;width:100%;height:auto;max-height:min(calc(100vh - 210px),820px)}
.of3-tabs{display:flex;gap:8px;margin:2px 4px 6px;flex-wrap:wrap;align-items:stretch}.of3-tab{flex:0 1 auto}.of3-zoom{display:none;margin-left:auto;align-self:center}@media(max-width:760px){.of3-tab{flex:1 1 0;min-width:0}.of3-tab span{display:none}.of3-zoom{display:inline-flex}.of3-wrap.zoom .of3-inner{overflow-x:auto;justify-content:flex-start}.of3-wrap.zoom .of3-svg{min-width:880px;max-height:none}}.of3-tab{display:flex;flex-direction:column;align-items:flex-start;gap:1px;padding:7px 12px;border-radius:10px;border:1px solid var(--ring);background:transparent;color:var(--ink);cursor:pointer;font:inherit;text-align:left}.of3-tab b{font-size:13px}.of3-tab span{font-size:11px;color:var(--ink-2)}.of3-tab.on{border-color:var(--accent,#5b5bd6);background:var(--accent-soft,rgba(91,91,214,.10))}
.of3-scrbig{font:700 22px var(--font,system-ui)}.of3-scrt{font:600 6px var(--font,system-ui);fill:#94a3b8}.of3-aih{font:700 7.5px var(--font,system-ui);fill:#fff}.of3-ait{font:500 6.6px var(--font,system-ui);fill:#1e293b}
.of3-tag{pointer-events:none}.of3-tagbg{fill:var(--surface);stroke:var(--ring);filter:drop-shadow(0 2px 4px rgba(20,20,40,.10))}.of3-tagt{font:600 11px var(--font,system-ui);fill:var(--ink)}.of3-tagi{font:11px system-ui}
.of3-aiboard{cursor:pointer;outline:none}.of3-aiboard:hover rect:first-child,.of3-aiboard:focus-visible rect:first-child{stroke:var(--accent,#5b5bd6);stroke-width:3}
.of3-winf{stroke:rgba(255,255,255,.6);stroke-width:1}.of3-mull{stroke:rgba(255,255,255,.7);stroke-width:1.2;fill:none}
.of3-grow{transform-box:fill-box;transform-origin:50% 100%;animation:of3grow 2.6s ease-in-out infinite}.of3-growx{transform-box:fill-box;transform-origin:0 50%;animation:of3growx 3s ease-in-out infinite}
.of3-scan{animation:of3scan 2.4s linear infinite}.of3-cursor{animation:of3blink 1s steps(2) infinite}.of3-typing circle{animation:of3blink 1.2s infinite}.of3-typing circle:nth-child(2){animation-delay:.2s}.of3-typing circle:nth-child(3){animation-delay:.4s}
.of3-spin{transform-box:fill-box;transform-origin:center;animation:of3rot 1.4s linear infinite}.of3-pulse2{transform-box:fill-box;transform-origin:center;animation:of3pulse 2s ease-in-out infinite}.of3-draw{stroke-dasharray:80;animation:of3draw 3s ease-in-out infinite}
.of3-idle .of3-scr,.of3-st .of3-scr{opacity:1}.of3-hands{animation:of3type .35s ease-in-out infinite alternate}.of3-work .of3-head,.of3-warn .of3-head{animation:of3nod 3.2s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 100%}
.of3-steam path{animation:of3steam 2s ease-in-out infinite}.of3-prayer{animation:of3bow 6s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 100%}
@keyframes of3grow{0%,100%{transform:scaleY(.55)}50%{transform:scaleY(1)}}@keyframes of3growx{0%,100%{transform:scaleX(.6)}50%{transform:scaleX(1)}}@keyframes of3scan{from{transform:translateY(0)}to{transform:translateY(36px)}}@keyframes of3blink{50%{opacity:0}}@keyframes of3rot{to{transform:rotate(360deg)}}@keyframes of3draw{from{stroke-dashoffset:80}to{stroke-dashoffset:0}}@keyframes of3nod{0%,100%{transform:rotate(0)}50%{transform:rotate(-4deg)}}@keyframes of3steam{0%{opacity:0;transform:translateY(0)}50%{opacity:.9}100%{opacity:0;transform:translateY(-6px)}}@keyframes of3bow{0%,35%,100%{transform:scaleY(1)}50%,70%{transform:scaleY(.72)}}
.of-aibox{background:var(--accent-soft,rgba(91,91,214,.08));border:1px solid var(--ring);border-radius:10px;padding:10px 12px;margin:6px 0 10px}.of-aibox p{margin:4px 0}.of-aibox ul,.of-ai{margin:4px 0 0 18px;padding:0}
.of3-grid{fill:none;stroke:rgba(120,110,90,.10);stroke-width:1}.of3-glassw{stroke:rgba(110,160,200,.55);stroke-width:1.2}
.of3-st{cursor:pointer;outline:none}.of3-st.soon{cursor:default;opacity:.62}.of3-st:not(.soon):hover .of3-card,.of3-st:focus-visible .of3-card,.of3-mgr:hover .of3-card,.of3-mgr:focus-visible .of3-card{stroke:var(--accent,#5b5bd6);stroke-width:2}
.of3-mgr{cursor:pointer;outline:none}
.of3-card{fill:var(--surface);stroke:var(--ring);stroke-width:1;filter:drop-shadow(0 3px 6px rgba(20,20,40,.10))}.of3-stem{stroke:var(--ink-2);stroke-width:1;stroke-dasharray:2 3;opacity:.6}
.of3-t{font:600 12.5px var(--font,system-ui);fill:var(--ink)}.of3-s{font:600 10.5px var(--font,system-ui)}.of3-l{font:400 11.5px var(--font,system-ui);fill:var(--ink-2)}
.of3-z{font:600 11px system-ui;fill:#8b8d98;animation:of3z 2.4s ease-in-out infinite}.of3-bang{font:700 12px system-ui;fill:#fff}
.of3-work .of3-arms{animation:of3type .5s ease-in-out infinite alternate;transform-box:fill-box;transform-origin:center}
.of3-walk .of3-leg{transform-box:fill-box;transform-origin:50% 0;animation:of3step .5s ease-in-out infinite alternate}.of3-walk .of3-leg.r{animation-direction:alternate-reverse}.of3-walk{animation:of3bounce .25s ease-in-out infinite alternate}.of3-courier,.of3-ob{pointer-events:none}
@keyframes of3step{from{transform:rotate(-22deg)}to{transform:rotate(22deg)}}@keyframes of3bounce{to{transform:translateY(-1.5px)}}
.of3-alert{animation:of3bob 1.2s ease-in-out infinite}.of3-screen.on{animation:of3glow 2.2s ease-in-out infinite}.of3-pulse{animation:of3pulse 1.6s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes of3type{from{transform:translateY(0)}to{transform:translateY(1.6px)}}@keyframes of3bob{50%{transform:translateY(-3px)}}@keyframes of3glow{50%{opacity:.72}}@keyframes of3pulse{50%{transform:scale(1.5);opacity:.55}}@keyframes of3z{0%,100%{opacity:.25;transform:translateY(0)}50%{opacity:1;transform:translateY(-4px)}}
@media(prefers-reduced-motion:reduce){.of3-wrap *{animation:none!important}.of3-courier,.of3-ob{display:none}}
.of3-title{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline;margin:4px 8px 2px}.of3-title b{font-size:14px}.of3-title span{font-size:12px;color:var(--ink-2)}
.of3-legend{display:flex;flex-wrap:wrap;gap:6px 14px;margin:6px 8px 0;font-size:12px;color:var(--ink-2)}.of3-legend span{display:inline-flex;align-items:center;gap:6px}.of3-legend i{width:9px;height:9px;border-radius:50%;display:inline-block}.of3-hint{margin-left:auto}.of3-legend .of3-swipe{display:none}@media(max-width:760px){.of3-legend .of3-swipe{display:inline;width:100%}.of3-hint{margin-left:0}}
@media(max-width:620px){.of-task{grid-template-columns:1fr}.of-grid{grid-template-columns:1fr}}
[data-theme="dark"] .of-ok{color:#68d391}[data-theme="dark"] .of-warn{color:#f6e05e}[data-theme="dark"] .of-bad{color:#fc8181}`;
document.head.append(el('style',{id:'office-v96'},css));
})();
