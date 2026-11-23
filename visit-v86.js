/* V86 — Schedule Management: Rencana Visit 2027 (Agenda Visit, Timeline Visit, Itinerary, Jadwal, Kegiatan).
   Sumber: visit-plan-v86.js (whiteboard SPV + KERANGKA VISIT COMMERCIAL di Google Sheet). Semua tab bisa diekspor CSV.
   Tidak menulis ke database; tombol "Masukkan ke kalender" membuka form kegiatan biasa (disimpan manual oleh pengguna). */
(function(){'use strict';
if(window.VISIT86_UI||typeof renderOps!=='function')return;
const V=window.VISIT86;if(!V)return;
const SHEET='https://docs.google.com/spreadsheets/d/1jqV1Ucw0gIqRpSGKlgNp0eKP-PUxL_b1aK4wLSZVqFk/edit';
const U=window.VISIT86_UI={tab:'agenda',spv:'',store:'',month:'',trip:'',open:true};
const rp0=v=>v==null||v===''?'—':'Rp'+Number(v).toLocaleString('id-ID');
const csvCell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
function csv(name,heads,rows){const text='﻿'+[heads,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n'),url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),a=el('a',{href:url,download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
let cache=null;
function data(){if(!cache){const trips=V.tripList({}).map(t=>({...t,spv:V.SPV[t.spv]||t.spv}));cache={trips,schedule:V.schedule({}),timeline:V.timeline({}),itinerary:trips.flatMap(t=>V.itinerary(t)),agenda:V.agendaRows()};}return cache;}
const monthOf=d=>String(d||'').slice(0,7);
const keep=r=>(!U.spv||r.spv===U.spv)&&(!U.store||[r.cabang,r.toko,r.names,r.stores&&r.stores.join(',')].some(x=>String(x||'').includes(U.store)))&&(!U.month||monthOf(r.date||r.start)===U.month);
function table(heads,rows,foot){return mkTable(heads.map(h=>typeof h==='string'?H(h):h),rows,foot);}
function toolbar(onCsv,count,label){return el('div',{class:'rowline',style:'justify-content:space-between;flex-wrap:wrap;gap:8px;margin:6px 0'},el('span',{class:'sub'},count+' '+label),el('button',{class:'btn sm',type:'button',onclick:onCsv},'⬇ Export CSV'));}

function tabAgenda(box){
 const rows=data().agenda;
 box.append(el('p',{class:'sub'},'Urutan kegiatan per jenis visit, mengikuti Master Kegiatan Visit (KERANGKA VISIT COMMERCIAL).'),
  toolbar(()=>csv('agenda-visit-2027.csv',['Jenis Visit','Urutan','No Kegiatan','Area Kontrol','Kegiatan','Detail Pemeriksaan','Metode','Timing','Output Wajib','Evidence Wajib','KPI / Standar','PIC Follow Up','SLA'],rows.map(r=>[r.jenis,r.urut,r.no,r.area,r.kegiatan,r.detail,r.metode,r.timing,r.output,r.evidence,r.kpi,r.pic,r.sla])),rows.length,'baris agenda'),
  table(['JENIS VISIT','#','NO','AREA','KEGIATAN','OUTPUT WAJIB','EVIDENCE','PIC','SLA'],rows.map(r=>[r.jenis,String(r.urut),String(r.no),r.area,el('span',{title:r.detail},r.kegiatan),r.output,r.evidence,r.pic,r.sla])));
}
function tabTimeline(box){
 const {trips,timeline}=data(),t=trips.filter(keep),grid=timeline.filter(r=>(!U.spv||r.spv===U.spv)&&(!U.store||(r.cabang+' '+r.toko).includes(U.store)));
 const total=t.reduce((n,r)=>n+Number(r.cost||0),0);
 box.append(el('p',{class:'sub'},'Trip luar kota per semester dan estimasi biaya (Master Visit). Biaya trip gabungan = biaya terbesar + 30% toko kedua.'),
  toolbar(()=>csv('timeline-visit-2027.csv',['Trip ID','SPV','Toko','Mulai','Selesai','Hari','Week','Moda','Estimasi Biaya'],t.map(r=>[r.id,r.spv,r.names,r.start,r.end,r.days,'W'+r.week,r.mode,r.cost])),t.length,'trip · total '+rp0(total)),
  table(['TRIP','SPV','TOKO','MULAI','SELESAI','HARI','WEEK','MODA',H('ESTIMASI BIAYA',{r:1}),''],t.map(r=>[r.id,r.spv,r.names,V.fmtDate(r.start),V.fmtDate(r.end),String(r.days),'W'+r.week,r.mode,rp0(r.cost),
   el('button',{class:'btn sm',type:'button',title:'Buka form kegiatan dengan data trip ini',onclick:()=>opsForm('schedule',{title:'Visit '+r.names+' ('+r.id+')',date:r.start,end_date:r.end,all_day:true,category:'Visit Toko',location:r.names,description:'Trip '+r.id+' · '+r.spv+' · '+r.mode+' · estimasi '+rp0(r.cost)+'\nAgenda: Visit Semester (Luar Kota) — lihat tab Itinerary.'})},'Masukkan ke kalender')]),
   ['TOTAL','','','','','','','',rp0(total),'']));
 const weeks=Array.from({length:52},(_,i)=>i+1),cls=v=>v.includes('V')?'background:#fde2ef;color:#9d174d;font-weight:600':v.includes('O')?'background:#e0f2fe':v.includes('N')?'background:#f1f5f9;color:#475569':'';
 box.append(el('h3',{style:'margin:14px 0 4px'},'Grid toko × minggu'),el('p',{class:'sub'},'V = visit luar kota · O = visit offline mingguan · N = kontrol online mingguan'),
  toolbar(()=>csv('grid-visit-2027.csv',['SPV','Area','Cabang','Toko','Level',...weeks.map(w=>'W'+w)],grid.map(r=>[r.spv,r.area,r.cabang,r.toko,r.level,...r.weeks])),grid.length,'toko'),
  el('div',{class:'tw'},el('table',{class:'v86-grid'},el('thead',{},el('tr',{},el('th',{class:'sticky1'},'TOKO'),el('th',{},'LV'),...weeks.map(w=>el('th',{style:'min-width:26px;text-align:center'},String(w))))),
   el('tbody',{},grid.map(r=>el('tr',{},el('td',{class:'sticky1'},r.toko+' · '+r.spv.replace('SPV ','')),el('td',{},r.level),...r.weeks.map(v=>el('td',{style:'text-align:center;font-size:11px;'+cls(v)},v))))))));
}
function tabItinerary(box){
 const {trips,itinerary}=data(),sel=opsSelect([['','Semua trip'],...trips.filter(keep).map(t=>[t.id,t.id+' · '+t.names+' · '+V.fmtDate(t.start)])],U.trip,{'aria-label':'Pilih trip'});
 sel.onchange=()=>{U.trip=sel.value;paint();};
 const rows=itinerary.filter(r=>(!U.trip||r.trip.startsWith(U.trip+'-')||r.trip===U.trip)&&(!U.spv||r.spv===U.spv)&&(!U.store||r.toko.includes(U.store)||r.trip.includes(U.store.toUpperCase()))&&(!U.month||monthOf(r.date)===U.month));
 box.append(el('div',{class:'fld',style:'max-width:420px'},el('label',{},'Trip'),sel),
  el('p',{class:'sub'},'Jam kegiatan, perjalanan dan istirahat per hari. Waktu tempuh & penerbangan adalah estimasi; sesuaikan dengan tiket.'),
  toolbar(()=>csv('itinerary-visit-2027.csv',['Trip','SPV','Toko','Tanggal','Hari','Waktu','Aktivitas','Keterangan','No Kegiatan','Output Wajib','Evidence Wajib','PIC','SLA','Status','Catatan Hasil'],rows.map(r=>[r.trip,r.spv,r.toko,r.date,r.day,r.time,r.task,r.detail,r.no||'',r.output||'',r.evidence||'',r.pic||'',r.sla||'','Planned',''])),rows.length,'baris itinerary'),
  table(['TRIP','TANGGAL','HARI','WAKTU','AKTIVITAS','KETERANGAN / KEGIATAN','OUTPUT','PIC'],rows.map(r=>[r.trip.split('-')[0],r.tanggal,r.day,r.time,r.task,r.detail||'',r.output||'',r.pic||''])));
}
function tabSchedule(box){
 const rows=data().schedule.filter(keep);
 box.append(el('p',{class:'sub'},'Jadwal visit 2027: offline mingguan Level A, kontrol online mingguan Level B/C, dan visit semester luar kota. Kunjungan yang bentrok dengan trip luar kota digeser otomatis.'),
  toolbar(()=>csv('schedule-visit-2027.csv',['Tanggal','Hari','Week','Bulan','SPV','Area','Cabang','Toko','Level','Metode','Objective','Kegiatan','Trip ID','Catatan','Status','Score','Finding Utama','Follow Up','PIC','Due Date'],rows.map(r=>[r.date,r.hari,r.week,r.bulan,r.spv,r.area,r.cabang,r.toko,r.level,r.metode,r.objective,r.kegiatan,r.trip,r.catatan,r.status,r.score,r.finding,r.followup,r.pic,r.due])),rows.length,'kunjungan'),
  table(['TANGGAL','HARI','WEEK','SPV','TOKO','LV','METODE','OBJECTIVE','TRIP','CATATAN'],rows.slice(0,400).map(r=>[r.tanggal,r.hari,r.week,r.spv,r.toko,r.level,r.metode,r.objective,r.trip||'',r.catatan])),
  rows.length>400?el('p',{class:'note'},'Ditampilkan 400 baris pertama; persempit filter atau gunakan Export CSV untuk seluruh '+rows.length+' baris.'):null);
}
function tabKegiatan(box){
 const rows=V.KEGIATAN;
 box.append(toolbar(()=>csv('master-kegiatan-visit.csv',['No','Area Kontrol','Kegiatan','Detail Pemeriksaan','Metode','Timing','Output Wajib','Evidence Wajib','KPI / Standar','PIC Follow Up','SLA'],rows.map(r=>[r.no,r.area,r.kegiatan,r.detail,r.metode,r.timing,r.output,r.evidence,r.kpi,r.pic,r.sla])),rows.length,'kegiatan'),
  table(['NO','AREA','KEGIATAN','DETAIL PEMERIKSAAN','METODE','TIMING','OUTPUT','EVIDENCE','KPI','PIC','SLA'],rows.map(r=>[String(r.no),r.area,r.kegiatan,r.detail,r.metode,r.timing,r.output,r.evidence,r.kpi,r.pic,r.sla])));
}
const TABS=[['agenda','Agenda Visit',tabAgenda],['timeline','Timeline Visit',tabTimeline],['itinerary','Itinerary',tabItinerary],['schedule','Jadwal Visit',tabSchedule],['kegiatan','Kegiatan',tabKegiatan]];
let host=null;
function paint(){
 if(!host||!host.isConnected)return;host.replaceChildren();
 const d=data(),spvs=[...new Set(d.trips.map(t=>t.spv))],stores=[...new Set(V.STORES.map(s=>s.label))],months=[...new Set(d.schedule.map(r=>monthOf(r.date)))].sort();
 const f=(label,opts,key)=>{const s=opsSelect([['','Semua'],...opts],U[key],{'aria-label':label});s.onchange=()=>{U[key]=s.value;if(key!=='trip')U.trip='';paint();};return opsField(label,s);};
 const tabs=el('div',{class:'rowline',role:'tablist',style:'flex-wrap:wrap;gap:6px;margin-bottom:8px'},TABS.map(([k,t])=>el('button',{class:'btn '+(U.tab===k?'pri':''),role:'tab','aria-selected':String(U.tab===k),type:'button',onclick:()=>{U.tab=k;paint();}},t)));
 const all=el('button',{class:'btn sm',type:'button',onclick:()=>{const s=d.schedule,i=d.itinerary;csv('schedule-visit-2027.csv',['Tanggal','Hari','Week','SPV','Cabang','Toko','Level','Metode','Objective','Trip ID','Catatan'],s.map(r=>[r.date,r.hari,r.week,r.spv,r.cabang,r.toko,r.level,r.metode,r.objective,r.trip,r.catatan]));setTimeout(()=>csv('itinerary-visit-2027.csv',['Trip','SPV','Toko','Tanggal','Hari','Waktu','Aktivitas','Keterangan','No Kegiatan'],i.map(r=>[r.trip,r.spv,r.toko,r.date,r.day,r.time,r.task,r.detail,r.no||''])),400);setTimeout(()=>csv('timeline-visit-2027.csv',['Trip ID','SPV','Toko','Mulai','Selesai','Hari','Week','Moda','Estimasi Biaya'],d.trips.map(r=>[r.id,r.spv,r.names,r.start,r.end,r.days,'W'+r.week,r.mode,r.cost])),800);}},'⬇ Export semua (3 CSV)');
 const body=el('div',{});
 host.append(el('header',{},el('h2',{},'Rencana Visit 2027'),el('span',{class:'sub'},d.trips.length+' trip luar kota · '+d.schedule.length+' kunjungan · ',el('a',{href:SHEET,target:'_blank',rel:'noopener'},'Google Sheet KERANGKA VISIT'))),
  el('div',{class:'v28-tools'},f('SPV',spvs.map(s=>[s,s]),'spv'),f('Toko',stores.map(s=>[s,s]),'store'),f('Bulan',months.map(m=>[m,MON3[Number(m.slice(5))-1]+' '+m.slice(0,4)]),'month'),el('div',{class:'fld'},el('label',{},' '),all)),
  tabs,body);
 (TABS.find(t=>t[0]===U.tab)||TABS[0])[2](body);
}
const orig=renderOps;
renderOps=function(type){
 const out=orig.apply(this,arguments);
 if(type==='schedule'){const p=$('#p-schedule');if(p){host=el('div',{class:'card v86-visit',id:'v86-visit'});const head=p.querySelector('.phead');if(head&&head.nextSibling)p.insertBefore(host,head.nextSibling);else p.append(host);paint();}}
 return out;
};
})();
