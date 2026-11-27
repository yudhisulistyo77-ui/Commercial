/* V96 · Kantor Virtual — meja karyawan AI terjadwal (GitHub Actions → Supabase → dashboard & Telegram).
   Karyawan AI hanya membaca data & menyiapkan usulan; keputusan (mis. TF stok) menunggu ACC Manager (akun Master). */
(function(){'use strict';
if(window.OFFICE96)return;
const DESKS=[
 {id:'sales',name:'Analis Sales',role:'Briefing, target, MoM',icon:'M3 17l5-5 4 4 8-8M14 8h6v6',when:'Setiap hari 07.21 WITA'},
 {id:'stock',name:'Admin Stok',role:'Stok tipis, usulan TF',icon:'M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4 9-4V7',when:'Setiap hari 07.21 WITA'},
 {id:'visit',name:'Sekretaris Visit',role:'Jadwal, itinerary, hasil visit',icon:'M7 3v4M17 3v4M4 9h16M5 5h14v15H5z',when:'Setiap hari 17.07 WITA'},
 {id:'sync',name:'Admin Sinkron',role:'Moka & snapshot stok',icon:'M4 12a8 8 0 0114-5l2 2M20 12a8 8 0 01-14 5l-2-2M20 4v5h-5M4 20v-5h5',when:'Setiap hari 07.21 WITA'},
 {id:'loss',name:'Analis Loss',role:'Loss sales & alasan',icon:'M12 3l9 16H3zM12 10v4M12 17h.01',soon:true},
 {id:'kpi',name:'Pengawas KPI',role:'KPI SPV & CSL',icon:'M12 3a9 9 0 100 18 9 9 0 000-18zm0 4a5 5 0 100 10 5 5 0 000-10zm0 4a1 1 0 100 2 1 1 0 000-2z',soon:true}
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
 box.push(el('p',{class:'note'},rep.summary||''));
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
 if(b.error)box.push(el('pre',{style:'white-space:pre-wrap;overflow-wrap:anywhere'},b.error));
 return box;
}
async function openReport(id,fallback){const {box}=opsModal(fallback?.title||'Laporan');box.classList.add('of-modal');box.append(el('div',{class:'empty'},'Memuat laporan…'));try{const rep=fallback?.body?fallback:await call('commercial_office_report_v96',{p_id:id});box.querySelector('.empty')?.remove();box.append(el('p',{class:'sub'},(DESKS.find(d=>d.id===rep.desk)?.name||rep.desk)+' · '+wita(rep.run_at)),...detail(rep));}catch(e){box.querySelector('.empty')?.remove();box.append(el('p',{class:'note warn'},explain(e)));}}

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


/* ---------- V97: ruang kantor isometrik (tiap meja = karyawan AI; klik meja untuk laporan) ---------- */
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SEAT={visit:[0.6,7.2,'#d6467e','#4b1528'],sales:[4,3.8,'#5b5bd6','#2f2f6b'],stock:[7.4,0.4,'#e07a3f','#5a2f14'],loss:[5.2,11.6,'#8a8a8a','#333'],sync:[8.6,8.2,'#2f9e8f','#123b35'],kpi:[12,4.8,'#8a8a8a','#333']};
function shortLine(d,r){if(d.soon)return 'Segera hadir';if(!r)return 'Belum bekerja';const b=r.body||{};
 if(r.status==='error')return 'Gagal, cek laporan';
 if(d.id==='sales'&&b.total)return 'MTD '+pc(b.total.ach_mtd)+' target'+(b.total.mom!=null?' · MoM '+(b.total.mom>=0?'+':'')+pc(b.total.mom):'');
 if(d.id==='stock')return b.tf_total!=null?'Usulan TF '+n0(b.tf_total)+' item':'Cek stok tipis';
 if(d.id==='visit')return (b.tomorrow||[]).length?'Besok '+b.tomorrow.length+' visit':(b.overdue_total?b.overdue_total+' visit belum diisi':'Besok tidak ada visit');
 if(d.id==='sync'){const v=Object.values(b.coverage||{});return v.length?'Data s.d. '+v.sort()[0]:'Cek sinkron';}
 return r.title||'';}
function officeScene(D){
 const latest=Object.fromEntries((D.desks||[]).map(r=>[r.desk,r])),S0=36,ox=470,oy=70;
 const pendDesks=[...new Set((D.tasks||[]).filter(t=>t.status==='pending').map(t=>t.desk))].filter(id=>SEAT[id]),CD=20;
 const seatAnim=i=>`<animate attributeName="opacity" values="0;1" keyTimes="0;0.7" calcMode="discrete" dur="${CD}s" begin="${i*4}s" repeatCount="indefinite"/>`;
 const P=(x,y,z=0)=>[(x-y)*S0*0.866+ox,(x+y)*S0*0.5-z*S0+oy];
 const pts=a=>a.map(q=>P(...q).map(v=>v.toFixed(1)).join(',')).join(' ');
 const poly=(a,fill,extra='')=>`<polygon points="${pts(a)}" fill="${fill}" ${extra}/>`;
 const box=(x,y,z,w,d,h,top,left,right,extra='')=>poly([[x,y+d,z],[x+w,y+d,z],[x+w,y+d,z+h],[x,y+d,z+h]],left,extra)+poly([[x+w,y,z],[x+w,y+d,z],[x+w,y+d,z+h],[x+w,y,z+h]],right,extra)+poly([[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]],top,extra);
 const plant=(x,y)=>{const [cx,cy]=P(x+0.2,y+0.2,0.45);return box(x,y,0,0.4,0.4,0.45,'#e9e2d6','#cfc5b4','#bfb4a1')+`<g class="of3-leaf"><ellipse cx="${cx}" cy="${cy-14}" rx="13" ry="17" fill="#4f9d5d"/><ellipse cx="${cx-9}" cy="${cy-6}" rx="9" ry="12" fill="#3f8a4d"/><ellipse cx="${cx+9}" cy="${cy-7}" rx="9" ry="12" fill="#5fb36d"/></g>`;};
 const person=(x,y,shirt,hair,state)=>{const [cx,cy]=P(x,y,0.55);const away=state==='away';if(away)return '';
  return `<g class="of3-p of3-${state}"><ellipse cx="${cx}" cy="${cy+30}" rx="16" ry="6" fill="rgba(0,0,0,.12)"/>
  <rect x="${cx-13}" y="${cy-6}" width="26" height="30" rx="11" fill="${shirt}"/>
  <g class="of3-arms"><rect x="${cx-19}" y="${cy-2}" width="8" height="18" rx="4" fill="${shirt}" transform="rotate(-30 ${cx-15} ${cy})"/><rect x="${cx+11}" y="${cy-2}" width="8" height="18" rx="4" fill="${shirt}" transform="rotate(30 ${cx+15} ${cy})"/></g>
  <circle cx="${cx}" cy="${cy-16}" r="11" fill="#f1c7a3"/><path d="M${cx-11} ${cy-17} a11 11 0 0 1 22 0 q-11 -5 -22 0z" fill="${hair}"/>
  ${state==='idle'?`<text x="${cx+12}" y="${cy-30}" class="of3-z">z z</text>`:''}${state==='warn'||state==='error'?`<g class="of3-alert"><circle cx="${cx+16}" cy="${cy-34}" r="9" fill="${state==='error'?'#e5484d':'#f5a524'}"/><text x="${cx+16}" y="${cy-30}" text-anchor="middle" class="of3-bang">!</text></g>`:''}</g>`;};
 const station=(d)=>{const [x,y,shirt,hair]=SEAT[d.id],r=latest[d.id];
  const state=d.soon?'away':!r?'idle':r.status==='error'?'error':r.status==='warn'?'warn':isToday(r.run_at)?'work':'idle';
  const glow=state==='work'||state==='warn'?'#7fd3ff':state==='error'?'#ff9b9b':'#3b4252';
  let g=box(x,y,0,2.2,1.1,0.72,'#f3e6cf','#d9c7a8','#c8b391');
  g+=box(x+0.75,y+0.12,0.72,0.75,0.08,0.5,'#2b2f3a','#1f232c','#2b2f3a');
  g+=poly([[x+0.8,y+0.2,0.78],[x+1.45,y+0.2,0.78],[x+1.45,y+0.2,1.17],[x+0.8,y+0.2,1.17]],glow,`class="of3-screen${state==='work'||state==='warn'?' on':''}"`);
  g+=box(x+0.55,y+0.55,0.72,0.6,0.25,0.03,'#e8e8ee','#c9c9d2','#b9b9c4');
  g+=box(x+0.75,y+1.55,0,0.7,0.6,0.42,'#3d4250','#2c303a','#353a46');
  {const pi=pendDesks.indexOf(d.id),pp=person(x+1.1,y+1.75,d.soon?'#999':shirt,hair,state);g+=pi>=0&&pp?`<g>${seatAnim(pi)}${pp}</g>`:pp;}
  const pill={work:['#2f9e44','Bekerja'],warn:['#d98b00','Perlu perhatian'],error:['#e5484d','Gagal'],idle:['#8b8d98',r?'Selesai '+jam(r.run_at):'Belum bekerja'],away:['#8b8d98','Segera']}[state];
  if(state==='work')pill[1]='Selesai '+jam(r.run_at);
  const [lx,ly]=P(x+1.1,y+0.4,1.95),w=212,line=shortLine(d,r),room=Math.max(10,33-pill[1].length);
  g+=`<g class="of3-call" transform="translate(${(lx-w/2).toFixed(1)} ${(ly-58).toFixed(1)})"><line x1="${w/2}" y1="46" x2="${w/2}" y2="62" class="of3-stem"/><rect width="${w}" height="46" rx="11" class="of3-card"/><circle cx="16" cy="16" r="5" fill="${pill[0]}" class="${state==='work'?'of3-pulse':''}"/><text x="28" y="20" class="of3-t">${esc(d.name)}</text><text x="12" y="37" class="of3-l"><tspan class="of3-s" fill="${pill[0]}">${esc(pill[1])}</tspan> · ${esc(line.length>room?line.slice(0,room-1)+'…':line)}</text></g>`;
  return `<g class="of3-st${d.soon?' soon':''}" data-desk="${d.id}" tabindex="${d.soon?-1:0}" role="button" aria-label="${esc(d.name+': '+line)}">${g}</g>`;};
 let g='';
 g+=poly([[0,0,0],[16,0,0],[16,14,0],[0,14,0]],'var(--of3-floor)');
 for(let i=1;i<16;i++)g+=`<polyline points="${pts([[i,0,0],[i,14,0]])}" class="of3-grid"/>`;
 for(let j=1;j<14;j++)g+=`<polyline points="${pts([[0,j,0],[16,j,0]])}" class="of3-grid"/>`;
 g+=poly([[0,0,0],[16,0,0],[16,0,2.4],[0,0,2.4]],'var(--of3-wall1)')+poly([[0,0,0],[0,14,0],[0,14,2.4],[0,0,2.4]],'var(--of3-wall2)');
 for(const wx of [1.5,4.5,10.5])g+=poly([[wx,0,0.9],[wx+2.2,0,0.9],[wx+2.2,0,2.0],[wx,0,2.0]],'var(--of3-win)');for(const wy of [2,5.5,9])g+=poly([[0,wy,0.9],[0,wy+2.2,0.9],[0,wy+2.2,2.0],[0,wy,2.0]],'var(--of3-win)');
 g+=plant(0.2,0.2)+plant(3.9,0.2)+plant(0.2,4.6)+plant(0.2,13.3)+plant(9.6,0.2);
 // ruang Manager (kaca)
 const pend=Number(D.pending||0),mx=13.2,my=0.3;
 g+=poly([[12.6,0,0],[12.6,3.6,0],[12.6,3.6,2.2],[12.6,0,2.2]],'var(--of3-glass)','class="of3-glassw"');
 let mgr=box(mx-0.2,my+0.6,0,1.9,1,0.72,'#e9dfcf','#cfc0a5','#bfae8f')+box(mx+0.4,my+0.72,0.72,0.7,0.08,0.45,'#2b2f3a','#1f232c','#2b2f3a')+box(mx+0.4,my+2.0,0,0.7,0.6,0.42,'#2c2f38','#22252d','#2a2d36');
 mgr+=person(mx+0.75,my+2.2,'#2d3a5a','#1f1a17',pend?'work':'idle');
 g+=mgr+poly([[12.6,3.6,0],[16,3.6,0],[16,3.6,2.2],[12.6,3.6,2.2]],'var(--of3-glass)','class="of3-glassw"');
 const [mlx,mly]=P(mx+0.75,my+1.0,1.95),mw=196;
 g+=`<g class="of3-call of3-mgr" data-desk="mgr" role="button" tabindex="0" aria-label="Ruang Manager: ${pend} menunggu persetujuan" transform="translate(${(mlx-mw/2).toFixed(1)} ${(mly-58).toFixed(1)})"><line x1="${mw/2}" y1="46" x2="${mw/2}" y2="62" class="of3-stem"/><rect width="${mw}" height="46" rx="11" class="of3-card"/><circle cx="16" cy="16" r="5" fill="${pend?'#d98b00':'#2f9e44'}"/><text x="28" y="20" class="of3-t">Ruang Manager</text><text x="12" y="37" class="of3-l">${pend?pend+' usulan menunggu ACC':'Tidak ada antrean ACC'}</text></g>`;
 // lounge
 g+=box(12.6,10.2,0,2.4,0.9,0.42,'#7fae8a','#5f8f6a','#6e9f79')+box(12.6,10.0,0.42,2.4,0.25,0.4,'#7fae8a','#5f8f6a','#6e9f79')+box(13.1,11.6,0,1.2,0.7,0.3,'#e9dfcf','#cfc0a5','#bfae8f')+plant(15.4,13.3)+plant(15.4,8.8);
 const order=[...DESKS].sort((a,b)=>(SEAT[a.id][0]+SEAT[a.id][1])-(SEAT[b.id][0]+SEAT[b.id][1]));
 for(const d of order)g+=station(d);
 // V98: orang berjalan — kurir dokumen ke Ruang Manager (tiap meja yang punya usulan menunggu ACC) + office boy keliling
 const walker=(shirt,hair,prop)=>`<g class="of3-walk"><ellipse cx="0" cy="2" rx="11" ry="4" fill="rgba(0,0,0,.14)"/>
  <g class="of3-legs"><rect class="of3-leg l" x="-6" y="-14" width="5" height="15" rx="2.5" fill="#3a3f4b"/><rect class="of3-leg r" x="1" y="-14" width="5" height="15" rx="2.5" fill="#2f3440"/></g>
  <rect x="-9" y="-34" width="18" height="22" rx="8" fill="${shirt}"/>${prop}
  <circle cx="0" cy="-42" r="8" fill="#f1c7a3"/><path d="M-8 -43 a8 8 0 0 1 16 0 q-8 -4 -16 0z" fill="${hair}"/></g>`;
 const route=(pts2,dur,pause,begin,sit=false)=>{const there=pts2.map(q=>P(q[0],q[1],0)),back=[...there].reverse().slice(1),all=[...there,...back];
  const d='M'+all.map(q=>q.map(v=>v.toFixed(1)).join(' ')).join(' L');
  const walkEnd=sit?0.7:1,k=v=>(v*walkEnd).toFixed(3);
  return {d,motion:`<animateMotion dur="${dur}s" begin="${begin}s" repeatCount="indefinite" path="${d}" keyPoints="0;0.5;0.5;1${sit?';1':''}" keyTimes="0;${k(0.5-pause/2)};${k(0.5+pause/2)};${k(1)}${sit?';1':''}" calcMode="linear"/>`};};
 const doc=b=>`<g class="of3-doc"><animate attributeName="opacity" values="1;0" keyTimes="0;0.35" calcMode="discrete" dur="${CD}s" begin="${b}s" repeatCount="indefinite"/><rect x="6" y="-30" width="11" height="14" rx="1.5" fill="#fff" stroke="#c9ccd6"/><line x1="8.5" y1="-26" x2="14.5" y2="-26" stroke="#9aa0ad"/><line x1="8.5" y1="-22.5" x2="14.5" y2="-22.5" stroke="#9aa0ad"/><line x1="8.5" y1="-19" x2="12.5" y2="-19" stroke="#9aa0ad"/></g>`;
 pendDesks.forEach((id,i)=>{const [x,y,shirt,hair]=SEAT[id];const r=route([[x+1.1,y+1.9],[x+1.9,y+2.5],[x+1.9,4.4],[13.6,4.4],[13.6,2.9]],CD,0.14,i*4,true);
  g+=`<g class="of3-courier" opacity="0" aria-hidden="true">${r.motion}<animate attributeName="opacity" values="1;0" keyTimes="0;0.7" calcMode="discrete" dur="${CD}s" begin="${i*4}s" repeatCount="indefinite"/>${walker(shirt,hair,doc(i*4))}</g>`;});
 {const cup=`<g><rect x="7" y="-27" width="7" height="8" rx="1.5" fill="#fff" stroke="#c9ccd6"/><path d="M14 -25 q3 1 0 4" fill="none" stroke="#c9ccd6"/></g>`;
  const r=route([[12.1,12.6],[12.1,10.9],[4.3,10.9],[4.3,6.3],[3.3,6.3]],22,0.12,1.5);
  g+=`<g class="of3-ob" aria-hidden="true">${r.motion}${walker('#7a8899','#2b2622',cup)}</g>`;}
 return `<svg viewBox="-40 -20 1040 640" class="of3-svg" role="img" aria-label="Ruang Kantor Virtual: meja karyawan AI dan statusnya">${g}</svg>`;
}
function sceneEl(D){
 const wrap=el('div',{class:'of3-wrap'}),inner=el('div',{class:'of3-inner',html:officeScene(D)});
 const latest=Object.fromEntries((D.desks||[]).map(r=>[r.desk,r]));
 inner.addEventListener('click',e=>{const st=e.target.closest('[data-desk]');if(!st)return;const id=st.dataset.desk;
  if(id==='mgr'){document.querySelector('.of-queue')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
  const r=latest[id];if(r)openReport(r.id,r);else if(!DESKS.find(d=>d.id===id)?.soon)toast('Meja ini belum pernah bekerja. Jalankan workflow Kantor Virtual.');});
 inner.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.closest('[data-desk]')){e.preventDefault();e.target.closest('[data-desk]').dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
 wrap.append(inner,el('p',{class:'of3-legend'},el('span',{},el('i',{style:'background:#2f9e44'}),'Selesai hari ini'),el('span',{},el('i',{style:'background:#d98b00'}),'Perlu perhatian'),el('span',{},el('i',{style:'background:#e5484d'}),'Gagal'),el('span',{},el('i',{style:'background:#8b8d98'}),'Belum bekerja / segera'),el('span',{class:'of3-hint'},'Klik meja untuk membuka laporan'),el('span',{class:'of3-swipe'},'Geser ruangan ke kiri/kanan')));
 requestAnimationFrame(()=>{if(inner.scrollWidth>inner.clientWidth)inner.scrollLeft=(inner.scrollWidth-inner.clientWidth)*0.35;});
 return wrap;
}

/* ---------- halaman ---------- */
function paint(p){
 const D=O.data||{desks:[],tasks:[],history:[]},latest=Object.fromEntries((D.desks||[]).map(r=>[r.desk,r]));
 const alerts=(D.desks||[]).filter(r=>r.status==='warn'||r.status==='error').length;
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
 p.replaceChildren(el('div',{class:'phead'},el('div',{},el('h1',{},'Kantor Virtual'),el('p',{},'Karyawan AI bekerja terjadwal dan gratis: pagi 07.21 WITA (Analis Sales, Admin Stok, Admin Sinkron), sore 17.07 WITA (Sekretaris Visit). Mereka hanya membaca data dan menyiapkan usulan; keputusan tetap di Manager.')),el('span',{class:'spacer'}),el('button',{class:'btn sm',onclick:()=>load(true)},'Muat ulang')));
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
.of3-wrap{background:var(--surface);border:1px solid var(--ring);border-radius:16px;padding:8px 8px 10px;margin:0 0 14px;--of3-floor:#f4efe6;--of3-wall1:#ebe7f6;--of3-wall2:#e2ddf1;--of3-win:#cfe6f7;--of3-glass:rgba(150,200,235,.28)}
[data-theme="dark"] .of3-wrap{--of3-floor:#2a2c33;--of3-wall1:#30323b;--of3-wall2:#2b2d35;--of3-win:#3b5568;--of3-glass:rgba(120,170,210,.18)}
.of3-inner{overflow-x:auto;-webkit-overflow-scrolling:touch}.of3-svg{display:block;width:100%;min-width:720px;height:auto}
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
.of3-legend{display:flex;flex-wrap:wrap;gap:6px 14px;margin:6px 8px 0;font-size:12px;color:var(--ink-2)}.of3-legend span{display:inline-flex;align-items:center;gap:6px}.of3-legend i{width:9px;height:9px;border-radius:50%;display:inline-block}.of3-hint{margin-left:auto}.of3-legend .of3-swipe{display:none}@media(max-width:760px){.of3-legend .of3-swipe{display:inline;width:100%}.of3-hint{margin-left:0}}
@media(max-width:620px){.of-task{grid-template-columns:1fr}.of-grid{grid-template-columns:1fr}}
[data-theme="dark"] .of-ok{color:#68d391}[data-theme="dark"] .of-warn{color:#f6e05e}[data-theme="dark"] .of-bad{color:#fc8181}`;
document.head.append(el('style',{id:'office-v96'},css));
})();
