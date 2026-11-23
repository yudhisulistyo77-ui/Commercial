/* V87 — Schedule Management: Rencana Visit 2027 yang BISA DIUBAH.
   Rencana dasar berasal dari visit-plan-v86.js (whiteboard SPV + KERANGKA VISIT). Setiap perubahan pengguna
   (trip, jadwal, itinerary, agenda, kegiatan) disimpan sebagai satu catatan di app_settings
   (kunci visit_plan_v87) lalu ditimpakan ke rencana dasar. Semua tab tetap bisa diekspor CSV. */
(function(){'use strict';
if(window.VISIT87_UI||typeof renderOps!=='function')return;
const V=window.VISIT86;if(!V)return;
const KEY='visit_plan_v87',SHEET='https://docs.google.com/spreadsheets/d/1jqV1Ucw0gIqRpSGKlgNp0eKP-PUxL_b1aK4wLSZVqFk/edit';
const U=window.VISIT87_UI={tab:'timeline',spv:'',store:'',month:'',trip:'',busy:false};
const STATUS=['Planned','Done','Reschedule','Cancelled'];
const rp0=v=>v==null||v===''?'—':'Rp'+Number(v).toLocaleString('id-ID');
const csvCell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
function csv(name,heads,rows){const text='﻿'+[heads,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n'),url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),a=el('a',{href:url,download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
const uid=()=>(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)).slice(0,12);
const fmt=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')?V.fmtDate(s):(s||'');
const monthOf=d=>String(d||'').slice(0,7);
const spvName=s=>V.SPV[s]||s;

/* ---------- penyimpanan perubahan ---------- */
function blank(){return {trips:null,sched:{},schedAdd:[],schedDel:[],itin:{},itinAdd:[],itinDel:[],keg:{},agenda:null,updated_at:null};}
function edits(){try{const raw=(S.demo?JSON.parse(localStorage.getItem('sc_'+KEY)||'null'):JSON.parse(S.settings?.[KEY]||'null'));return {...blank(),...(raw||{})};}catch{return blank();}}
async function persist(e){
  e.updated_at=new Date().toISOString();const value=JSON.stringify(e);
  if(S.demo){localStorage.setItem('sc_'+KEY,value);}
  else{if(!S.ready||!S.key)throw Error('Hubungkan database di Pengaturan terlebih dahulu.');await DB.write('app_settings',[{key:KEY,value}],'key');S.settings[KEY]=value;}
  cache=null;
}
async function change(fn,msg){if(U.busy)return;U.busy=true;try{const e=edits();fn(e);await persist(e);toast(msg||'Perubahan rencana visit tersimpan.');}catch(err){toast('Belum tersimpan: '+err.message);}finally{U.busy=false;paint();}}

/* ---------- rencana = dasar + perubahan ---------- */
const baseTrips=()=>V.TRIPS.map((t,i)=>({code:'T'+String(i+1).padStart(2,'0'),spv:t[0],stores:t[1],start:t[2],end:t[3]}));
const keg=e=>V.KEGIATAN.map(k=>({...k,...(e.keg[k.no]||{})}));
const agendaOf=e=>e.agenda||Object.fromEntries(Object.entries(V.AGENDA).map(([k,v])=>[k,[...v]]));
const sKey=r=>r._key||[r.date,r.cabang,r.metode,r.trip||''].join('|');
const iKey=r=>r._key||[String(r.trip).split('-')[0],r.date,r.time].join('|');
let cache=null;
function data(){
  if(cache)return cache;
  const e=edits(),tripCfg=(e.trips||baseTrips()).filter(t=>!t.deleted),cfg={trips:tripCfg};
  const K=Object.fromEntries(keg(e).map(k=>[k.no,k])),ag=agendaOf(e);
  const trips=V.tripList(cfg).map(t=>({...t,spvLabel:spvName(t.spv)}));
  const agendaKey=r=>r.trip?'Visit Semester (Luar Kota)':r.metode==='Online'?'Online Mingguan (Level B/C)':'Offline Mingguan (Level A)';
  const sched=V.schedule(cfg).map(r=>({...r,kegiatan:(ag[agendaKey(r)]||[]).map(n=>n+'. '+(K[n]?.kegiatan||'')).join('; ')}))
    .map(r=>({...r,_key:sKey(r)})).filter(r=>!e.schedDel.includes(r._key)).map(r=>({...r,...(e.sched[r._key]||{}),_edited:!!e.sched[r._key]}))
    .concat(e.schedAdd.map(r=>({...r,_added:true,tanggal:fmt(r.date),hari:r.date?V.dayName(r.date):'',week:r.date?'W'+V.isoWeek(r.date).week:'',bulan:r.date?r.date.slice(0,7):''})))
    .map(r=>r._edited&&r.date?{...r,tanggal:fmt(r.date),hari:V.dayName(r.date),week:'W'+V.isoWeek(r.date).week}:r)
    .sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.spv).localeCompare(String(b.spv))||String(a.cabang).localeCompare(String(b.cabang)));
  const itinerary=trips.flatMap(t=>V.itinerary(t)).map(r=>{const k=r.no?K[r.no]:null;return k?{...r,detail:k.kegiatan,output:k.output,evidence:k.evidence,pic:k.pic,sla:k.sla}:r;})
    .map(r=>({...r,status:'Planned',hasil:'',_key:iKey(r)})).filter(r=>!e.itinDel.includes(r._key)).map(r=>({...r,...(e.itin[r._key]||{}),_edited:!!e.itin[r._key]}))
    .concat(e.itinAdd.map(r=>({...r,_added:true})))
    .map(r=>({...r,tanggal:fmt(r.date),day:r.date?V.dayName(r.date):''}))
    .sort((a,b)=>String(a.trip).localeCompare(String(b.trip))||String(a.date).localeCompare(String(b.date))||String(a.time).replace(/^Pukul /,'').localeCompare(String(b.time).replace(/^Pukul /,'')));
  const agenda=[];for(const [jenis,nos] of Object.entries(ag))nos.forEach((no,i)=>{const k=K[no];if(k)agenda.push({jenis,urut:i+1,...k});});
  const grid={};for(const r of sched){if(!r.date||!r.cabang)continue;const w=Number(String(r.week).slice(1)),mark=r.trip?'V':r.metode==='Offline'?'O':'N';grid[r.cabang]=grid[r.cabang]||{};const cur=grid[r.cabang][w]||'';if(!cur.includes(mark))grid[r.cabang][w]=cur+mark;}
  const timeline=V.STORES.map(s=>({spv:spvName(s.spv),area:s.area,cabang:s.name,toko:s.label,level:s.level,weeks:Array.from({length:52},(_,i)=>(grid[s.name]||{})[i+1]||'')}));
  cache={e,tripCfg,trips,sched,itinerary,agenda,ag,kegiatan:Object.values(K),timeline,edited:!!e.updated_at};
  return cache;
}

/* ---------- form edit umum ---------- */
function editForm(title,fields,values,{onSave,onDelete,onReset}={}){
  const {box,modal}=opsModal(title),inputs={};
  for(const f of fields){let input;
    if(f.type==='select')input=opsSelect(f.options.map(o=>Array.isArray(o)?o:[o,o]),values[f.k]??'',{'aria-label':f.label});
    else if(f.type==='textarea'){input=el('textarea',{rows:f.rows||3,'aria-label':f.label});input.value=values[f.k]??'';}
    else if(f.type==='multi'){input=el('select',{multiple:true,size:Math.min(6,f.options.length),'aria-label':f.label},...f.options.map(([v,l])=>{const o=el('option',{value:v},l);o.selected=(values[f.k]||[]).includes(v);return o;}));}
    else input=opsInput(values[f.k]??'',f.type||'text',{'aria-label':f.label,...(f.attrs||{})});
    inputs[f.k]=input;box.append(opsField(f.label+(f.req?' *':''),input));}
  const err=el('p',{class:'note warn',role:'alert',style:'display:none'});
  const read=()=>{const out={};for(const f of fields){const i=inputs[f.k];out[f.k]=f.type==='multi'?[...i.selectedOptions].map(o=>o.value):f.type==='number'?(i.value===''?'':Number(i.value)):i.value.trim();if(f.req&&(out[f.k]===''||(Array.isArray(out[f.k])&&!out[f.k].length)))throw Error(f.label+' wajib diisi.');}return out;};
  const run=async(fn,btn)=>{err.style.display='none';btn.disabled=true;try{await fn();modal.remove();}catch(x){err.textContent=x.message;err.style.display='block';btn.disabled=false;}};
  const save=el('button',{class:'btn pri',type:'button'},'Simpan');save.onclick=()=>run(()=>onSave(read()),save);
  const row=el('div',{class:'rowline',style:'flex-wrap:wrap;gap:8px'},save);
  if(onReset){const b=el('button',{class:'btn',type:'button'},'Kembalikan ke rencana awal');b.onclick=()=>run(onReset,b);row.append(b);}
  if(onDelete){const b=el('button',{class:'btn',type:'button'},'Hapus');b.onclick=()=>{if(confirm('Hapus baris ini dari rencana visit?'))run(onDelete,b);};row.append(b);}
  box.append(err,row);
}
const editBtn=(fn,label='Ubah')=>el('button',{class:'btn sm',type:'button',title:label,onclick:fn},'✎ '+label);
const tag=r=>r._added?el('span',{class:'pill neu',style:'margin-left:4px'},'baru'):r._edited?el('span',{class:'pill warn',style:'margin-left:4px'},'diubah'):null;

/* ---------- Trip ---------- */
const outStores=()=>V.STORES.filter(s=>s.mode!=='kota').map(s=>[s.key,s.label+' · '+spvName(s.spv)]);
function tripForm(t){
  const d=data(),list=d.e.trips?JSON.parse(JSON.stringify(d.e.trips)):baseTrips(),i=t?list.findIndex(x=>x.code===t.code&&!x.deleted):-1,cur=i>=0?list[i]:{};
  const nextCode='T'+String(list.length+1).padStart(2,'0');
  editForm(t?'Ubah trip '+t.code:'Tambah trip',[
    {k:'spv',label:'SPV',type:'select',options:Object.entries(V.SPV).map(([k,v])=>[k,v]),req:true},
    {k:'stores',label:'Toko (bisa pilih 2 — tahan Ctrl)',type:'multi',options:outStores(),req:true},
    {k:'start',label:'Tanggal mulai',type:'date',req:true},{k:'end',label:'Tanggal selesai',type:'date',req:true},
    {k:'mode',label:'Moda',type:'select',options:['','Pesawat','Darat'].map(v=>[v,v||'(otomatis)'])},
    {k:'cost',label:'Estimasi biaya (Rp) — kosong = dari Master Visit',type:'number',attrs:{min:0,step:1000}},
    {k:'status',label:'Status',type:'select',options:STATUS},{k:'notes',label:'Catatan',type:'textarea'}],
    {spv:cur.spv||'ILHAM',stores:cur.stores||[],start:cur.start||'',end:cur.end||'',mode:cur.mode||'',cost:cur.cost??'',status:cur.status||'Planned',notes:cur.notes||''},
    {onSave:async v=>{if(v.end<v.start)throw Error('Tanggal selesai harus setelah tanggal mulai.');if(v.stores.length>2)throw Error('Maksimal 2 toko per trip.');
       await change(e=>{const l=e.trips||baseTrips();const rec={...(i>=0?l[i]:{code:nextCode}),...v,cost:v.cost===''?null:v.cost};if(i>=0)l[i]=rec;else l.push(rec);e.trips=l;},t?'Trip '+t.code+' diperbarui. Jadwal & itinerary ikut menyesuaikan.':'Trip baru ditambahkan.');},
     onDelete:t?async()=>{await change(e=>{const l=e.trips||baseTrips();const k=l.findIndex(x=>x.code===t.code&&!x.deleted);if(k>=0)l[k]={...l[k],deleted:true};e.trips=l;},'Trip '+t.code+' dihapus.');}:null});
}

/* ---------- Tab ---------- */
const keep=r=>(!U.spv||r.spv===U.spv||r.spvLabel===U.spv)&&(!U.store||[r.cabang,r.toko,r.names,r.label].some(x=>String(x||'').includes(U.store)))&&(!U.month||monthOf(r.date||r.start)===U.month);
const toolbar=(count,label,...btns)=>el('div',{class:'rowline',style:'justify-content:space-between;flex-wrap:wrap;gap:8px;margin:6px 0'},el('span',{class:'sub'},count+' '+label),el('div',{class:'rowline',style:'gap:6px;flex-wrap:wrap'},...btns));
const btn=(t,fn,pri)=>el('button',{class:'btn sm'+(pri?' pri':''),type:'button',onclick:fn},t);

function tabTimeline(box){
  const d=data(),t=d.trips.filter(keep),total=t.reduce((n,r)=>n+Number(r.cost||0),0);
  const exp=()=>csv('timeline-visit-2027.csv',['Trip ID','SPV','Toko','Mulai','Selesai','Hari','Week','Moda','Estimasi Biaya','Status','Catatan'],t.map(r=>[r.code,r.spvLabel,r.names,r.start,r.end,r.days,'W'+r.week,r.mode,r.cost,r.status,r.notes]));
  box.append(el('p',{class:'sub'},'Ubah tanggal trip → jadwal, itinerary dan grid minggu ikut menyesuaikan. Biaya trip gabungan = biaya terbesar + 30% toko kedua (bisa ditimpa).'),
    toolbar(t.length,'trip · total '+rp0(total),btn('+ Tambah trip',()=>tripForm(null),true),btn('⬇ Export CSV',exp)),
    mkTable([H('TRIP',{s:1}),'SPV','TOKO','MULAI','SELESAI','HARI','WEEK','MODA',H('ESTIMASI BIAYA',{r:1}),'STATUS','CATATAN',''],t.map(r=>[r.code,r.spvLabel,r.names,fmt(r.start),fmt(r.end),String(r.days),'W'+r.week,r.mode,rp0(r.cost),r.status,r.notes||'—',
      el('div',{class:'rowline',style:'gap:4px'},editBtn(()=>tripForm(r)),el('button',{class:'btn sm',type:'button',title:'Buka form kegiatan kalender',onclick:()=>opsForm('schedule',{title:'Visit '+r.names+' ('+r.code+')',date:r.start,end_date:r.end,all_day:true,category:'Visit Toko',location:r.names,description:'Trip '+r.code+' · '+r.spvLabel+' · '+r.mode+' · estimasi '+rp0(r.cost)+(r.notes?'\n'+r.notes:'')})},'Ke kalender'))]),
      ['TOTAL','','','','','','','',rp0(total),'','','']));
  const weeks=Array.from({length:52},(_,i)=>i+1),grid=d.timeline.filter(r=>(!U.spv||r.spv===U.spv)&&(!U.store||(r.cabang+' '+r.toko).includes(U.store))),cls=v=>v.includes('V')?'background:#fde2ef;color:#9d174d;font-weight:600':v.includes('O')?'background:#e0f2fe':v.includes('N')?'background:#f1f5f9;color:#475569':'';
  box.append(el('h3',{style:'margin:14px 0 4px'},'Grid toko × minggu'),el('p',{class:'sub'},'V = visit luar kota · O = offline mingguan · N = kontrol online · dihitung dari tab Jadwal (termasuk perubahan).'),
    toolbar(grid.length,'toko',btn('⬇ Export CSV',()=>csv('grid-visit-2027.csv',['SPV','Area','Cabang','Toko','Level',...weeks.map(w=>'W'+w)],grid.map(r=>[r.spv,r.area,r.cabang,r.toko,r.level,...r.weeks])))),
    el('div',{class:'tw'},el('table',{class:'v86-grid'},el('thead',{},el('tr',{},el('th',{class:'sticky1'},'TOKO'),el('th',{},'LV'),...weeks.map(w=>el('th',{style:'min-width:26px;text-align:center'},String(w))))),
      el('tbody',{},grid.map(r=>el('tr',{},el('td',{class:'sticky1'},r.toko+' · '+r.spv.replace('SPV ','')),el('td',{},r.level),...r.weeks.map(v=>el('td',{style:'text-align:center;font-size:11px;'+cls(v)},v))))))));
}

const SCHED_FIELDS=()=>[{k:'date',label:'Tanggal',type:'date',req:true},{k:'cabang',label:'Toko',type:'select',options:V.STORES.map(s=>[s.name,s.name]),req:true},
  {k:'metode',label:'Metode',type:'select',options:['Offline','Online']},{k:'objective',label:'Objective'},{k:'kegiatan',label:'Kegiatan',type:'textarea'},
  {k:'status',label:'Status',type:'select',options:STATUS},{k:'score',label:'Score'},{k:'finding',label:'Finding utama',type:'textarea'},{k:'followup',label:'Follow up',type:'textarea'},
  {k:'pic',label:'PIC'},{k:'due',label:'Due date',type:'date'},{k:'catatan',label:'Catatan',type:'textarea'}];
const storeMeta=name=>{const s=V.STORES.find(x=>x.name===name)||{};return {toko:s.label||name,spv:spvName(s.spv)||'',area:s.area||'',level:s.level||''};};
const dueIso=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v:'';
function schedForm(r){
  const vals=r?{...r,due:dueIso(r.due)}:{date:'',cabang:'',metode:'Offline',objective:'Physical audit + checkpoint control',status:'Planned',pic:''};
  editForm(r?'Ubah jadwal '+(r.tanggal||'')+' · '+(r.toko||''):'Tambah jadwal visit',SCHED_FIELDS(),vals,{
    onSave:async v=>{const m=storeMeta(v.cabang),row={...v,...m,pic:v.pic||m.spv,due:v.due?fmt(v.due):''};
      await change(e=>{if(!r){e.schedAdd.push({...row,_key:'add-'+uid()});return;}
        if(r._added){const k=e.schedAdd.findIndex(x=>x._key===r._key);if(k>=0)e.schedAdd[k]={...e.schedAdd[k],...row};}else e.sched[r._key]={...row};});},
    onDelete:r?async()=>{await change(e=>{if(r._added)e.schedAdd=e.schedAdd.filter(x=>x._key!==r._key);else{e.schedDel.push(r._key);delete e.sched[r._key];}},'Jadwal dihapus.');}:null,
    onReset:r&&r._edited?async()=>{await change(e=>{delete e.sched[r._key];},'Jadwal dikembalikan ke rencana awal.');}:null});
}
function tabSchedule(box){
  const rows=data().sched.filter(keep),lim=U.limit||300;
  const exp=()=>csv('schedule-visit-2027.csv',['Tanggal','Hari','Week','Bulan','SPV','Area','Cabang','Toko','Level','Metode','Objective','Kegiatan','Trip ID','Catatan','Status','Score','Finding Utama','Follow Up','PIC','Due Date'],rows.map(r=>[r.date,r.hari,r.week,r.bulan,r.spv,r.area,r.cabang,r.toko,r.level,r.metode,r.objective,r.kegiatan,String(r.trip||'').split('-')[0],r.catatan,r.status,r.score,r.finding,r.followup,r.pic,r.due]));
  box.append(el('p',{class:'sub'},'Semua kolom bisa diubah (✎). Status, score, finding & follow up dipakai untuk mencatat hasil visit.'),
    toolbar(rows.length,'kunjungan',btn('+ Tambah jadwal',()=>schedForm(null),true),btn('⬇ Export CSV',exp)),
    mkTable(['TANGGAL','HARI','WEEK','SPV','TOKO','LV','METODE','OBJECTIVE','STATUS','SCORE','FINDING','TRIP','CATATAN',''],rows.slice(0,lim).map(r=>[r.tanggal,r.hari,r.week,r.spv,el('span',{},r.toko,tag(r)),r.level,r.metode,r.objective,r.status,r.score||'',r.finding||'',String(r.trip||'').split('-')[0],r.catatan||'',editBtn(()=>schedForm(r))])),
    rows.length>lim?el('div',{class:'rowline'},el('span',{class:'sub'},'Ditampilkan '+lim+' dari '+rows.length+' baris (persempit dengan filter Bulan/Toko).'),btn('Tampilkan 300 lagi',()=>{U.limit=lim+300;paint();})):null);
}

const ITIN_FIELDS=d=>[{k:'trip',label:'Trip',type:'select',options:d.trips.map(t=>[t.id,t.code+' · '+t.names]),req:true},{k:'date',label:'Tanggal',type:'date',req:true},
  {k:'time',label:'Waktu (mis. 08.30 - 09.00)',req:true},{k:'task',label:'Aktivitas',req:true},{k:'detail',label:'Keterangan / kegiatan',type:'textarea'},
  {k:'no',label:'No kegiatan',type:'select',options:[['','—'],...d.kegiatan.map(k=>[String(k.no),k.no+'. '+k.kegiatan])]},{k:'pic',label:'PIC'},
  {k:'status',label:'Status',type:'select',options:STATUS},{k:'hasil',label:'Catatan hasil',type:'textarea'}];
function itinForm(r){
  const d=data(),vals=r?{...r,no:r.no?String(r.no):''}:{trip:U.trip||d.trips[0]?.id,date:'',time:'',task:'',status:'Planned'};
  editForm(r?'Ubah itinerary '+r.tanggal+' '+r.time:'Tambah baris itinerary',ITIN_FIELDS(d),vals,{
    onSave:async v=>{const t=d.trips.find(x=>x.id===v.trip)||{},k=d.kegiatan.find(x=>String(x.no)===v.no);
      const row={...v,no:v.no?Number(v.no):'',spv:t.spvLabel||'',toko:t.label||'',output:k?k.output:(r?.output||''),evidence:k?k.evidence:(r?.evidence||''),sla:k?k.sla:(r?.sla||''),pic:v.pic||(k?k.pic:'')};
      await change(e=>{if(!r){e.itinAdd.push({...row,_key:'add-'+uid()});return;}
        if(r._added){const i=e.itinAdd.findIndex(x=>x._key===r._key);if(i>=0)e.itinAdd[i]={...e.itinAdd[i],...row};}else e.itin[r._key]={...row};});},
    onDelete:r?async()=>{await change(e=>{if(r._added)e.itinAdd=e.itinAdd.filter(x=>x._key!==r._key);else{e.itinDel.push(r._key);delete e.itin[r._key];}},'Baris itinerary dihapus.');}:null,
    onReset:r&&r._edited?async()=>{await change(e=>{delete e.itin[r._key];},'Baris dikembalikan ke rencana awal.');}:null});
}
function tabItinerary(box){
  const d=data(),sel=opsSelect([['','Semua trip'],...d.trips.filter(keep).map(t=>[t.id,t.code+' · '+t.names+' · '+fmt(t.start)])],U.trip,{'aria-label':'Pilih trip'});
  sel.onchange=()=>{U.trip=sel.value;paint();};
  const rows=d.itinerary.filter(r=>(!U.trip||r.trip===U.trip)&&(!U.spv||r.spv===U.spv)&&(!U.store||String(r.toko).includes(U.store)||String(r.trip).includes(String(U.store).toUpperCase()))&&(!U.month||monthOf(r.date)===U.month));
  const exp=()=>csv('itinerary-visit-2027.csv',['Trip','SPV','Toko','Tanggal','Hari','Waktu','Aktivitas','Keterangan','No Kegiatan','Output Wajib','Evidence Wajib','PIC','SLA','Status','Catatan Hasil'],rows.map(r=>[String(r.trip).split('-')[0],r.spv,r.toko,r.date,r.day,r.time,r.task,r.detail,r.no||'',r.output||'',r.evidence||'',r.pic||'',r.sla||'',r.status||'Planned',r.hasil||'']));
  box.append(el('div',{class:'fld',style:'max-width:420px'},el('label',{},'Trip'),sel),
    el('p',{class:'sub'},'Semua baris bisa diubah, dihapus atau ditambah. Waktu tempuh & penerbangan adalah estimasi — sesuaikan dengan tiket.'),
    toolbar(rows.length,'baris itinerary',btn('+ Tambah baris',()=>itinForm(null),true),btn('⬇ Export CSV',exp)),
    mkTable(['TRIP','TANGGAL','HARI','WAKTU','AKTIVITAS','KETERANGAN / KEGIATAN','OUTPUT','PIC','STATUS','CATATAN HASIL',''],rows.map(r=>[String(r.trip).split('-')[0],r.tanggal,r.day,r.time,el('span',{},r.task,tag(r)),r.detail||'',r.output||'',r.pic||'',r.status||'Planned',r.hasil||'',editBtn(()=>itinForm(r))])));
}

function tabAgenda(box){
  const d=data(),rows=d.agenda;
  const exp=()=>csv('agenda-visit-2027.csv',['Jenis Visit','Urutan','No Kegiatan','Area Kontrol','Kegiatan','Detail Pemeriksaan','Metode','Timing','Output Wajib','Evidence Wajib','KPI / Standar','PIC Follow Up','SLA'],rows.map(r=>[r.jenis,r.urut,r.no,r.area,r.kegiatan,r.detail,r.metode,r.timing,r.output,r.evidence,r.kpi,r.pic,r.sla]));
  const editAgenda=jenis=>editForm('Ubah agenda · '+jenis,[{k:'nos',label:'Nomor kegiatan berurutan, pisahkan koma (lihat tab Kegiatan)',req:true}],{nos:(d.ag[jenis]||[]).join(', ')},{
    onSave:async v=>{const nos=v.nos.split(/[,\s]+/).filter(Boolean).map(Number);const valid=new Set(d.kegiatan.map(k=>k.no));const bad=nos.filter(n=>!valid.has(n));if(bad.length)throw Error('Nomor kegiatan tidak dikenal: '+bad.join(', '));
      await change(e=>{e.agenda={...agendaOf(e),[jenis]:nos};},'Agenda '+jenis+' diperbarui.');},
    onReset:async()=>{await change(e=>{const a=agendaOf(e);a[jenis]=[...(V.AGENDA[jenis]||[])];e.agenda=a;},'Agenda dikembalikan.');}});
  box.append(el('p',{class:'sub'},'Urutan kegiatan per jenis visit. Ubah daftar nomor kegiatan per jenis; isi kegiatannya diubah di tab Kegiatan.'),
    toolbar(rows.length,'baris agenda',...Object.keys(d.ag).map(j=>btn('✎ '+j,()=>editAgenda(j))),btn('⬇ Export CSV',exp)),
    mkTable(['JENIS VISIT','#','NO','AREA','KEGIATAN','OUTPUT WAJIB','EVIDENCE','PIC','SLA'],rows.map(r=>[r.jenis,String(r.urut),String(r.no),r.area,el('span',{title:r.detail},r.kegiatan),r.output,r.evidence,r.pic,r.sla])));
}
const KEG_FIELDS=[['area','Area kontrol'],['kegiatan','Kegiatan'],['detail','Detail pemeriksaan','textarea'],['metode','Metode'],['timing','Timing'],['output','Output wajib','textarea'],['evidence','Evidence wajib'],['kpi','KPI / standar'],['pic','PIC follow up'],['sla','SLA']].map(([k,label,type])=>({k,label,type,req:k==='kegiatan'}));
function tabKegiatan(box){
  const d=data(),rows=d.kegiatan;
  box.append(el('p',{class:'sub'},'Master kegiatan visit. Perubahan langsung dipakai di Agenda, Jadwal dan Itinerary.'),
    toolbar(rows.length,'kegiatan',btn('⬇ Export CSV',()=>csv('master-kegiatan-visit.csv',['No','Area Kontrol','Kegiatan','Detail Pemeriksaan','Metode','Timing','Output Wajib','Evidence Wajib','KPI / Standar','PIC Follow Up','SLA'],rows.map(r=>[r.no,r.area,r.kegiatan,r.detail,r.metode,r.timing,r.output,r.evidence,r.kpi,r.pic,r.sla])))),
    mkTable(['NO','AREA','KEGIATAN','DETAIL PEMERIKSAAN','METODE','TIMING','OUTPUT','EVIDENCE','KPI','PIC','SLA',''],rows.map(r=>[String(r.no),r.area,el('span',{},r.kegiatan,d.e.keg[r.no]?tag({_edited:true}):null),r.detail,r.metode,r.timing,r.output,r.evidence,r.kpi,r.pic,r.sla,
      editBtn(()=>editForm('Ubah kegiatan '+r.no,KEG_FIELDS,r,{onSave:async v=>{await change(e=>{e.keg[r.no]=v;},'Kegiatan '+r.no+' diperbarui.');},onReset:d.e.keg[r.no]?async()=>{await change(e=>{delete e.keg[r.no];},'Kegiatan '+r.no+' dikembalikan.');}:null}))])));
}

const TABS=[['timeline','Timeline / Trip',tabTimeline],['schedule','Jadwal Visit',tabSchedule],['itinerary','Itinerary',tabItinerary],['agenda','Agenda Visit',tabAgenda],['kegiatan','Kegiatan',tabKegiatan]];
let host=null;
function paint(){
  if(!host||!host.isConnected)return;host.replaceChildren();
  let d;try{d=data();}catch(e){host.append(el('p',{class:'note warn'},'Rencana visit gagal disusun: '+e.message));return;}
  const spvs=[...new Set(V.STORES.map(s=>spvName(s.spv)))],stores=[...new Set(V.STORES.map(s=>s.label))],months=[...new Set(d.sched.map(r=>monthOf(r.date)).filter(Boolean))].sort();
  const f=(label,opts,key)=>{const s=opsSelect([['','Semua'],...opts],U[key],{'aria-label':label});s.onchange=()=>{U[key]=s.value;U.trip='';U.limit=0;paint();};return opsField(label,s);};
  const tabs=el('div',{class:'rowline',role:'tablist',style:'flex-wrap:wrap;gap:6px;margin-bottom:8px'},TABS.map(([k,t])=>el('button',{class:'btn '+(U.tab===k?'pri':''),role:'tab','aria-selected':String(U.tab===k),type:'button',onclick:()=>{U.tab=k;paint();}},t)));
  const resetAll=d.edited?btn('Kembalikan semua ke rencana awal',async()=>{if(!confirm('Hapus SEMUA perubahan rencana visit dan kembali ke rencana awal?'))return;await change(e=>{Object.assign(e,blank());},'Rencana visit dikembalikan ke awal.');}):null;
  const body=el('div',{});
  host.append(el('header',{},el('h2',{},'Rencana Visit 2027'),el('span',{class:'sub'},d.trips.length+' trip · '+d.sched.length+' kunjungan'+(d.e.updated_at?' · terakhir diubah '+new Date(d.e.updated_at).toLocaleString('id-ID',{timeZone:'Asia/Makassar',dateStyle:'medium',timeStyle:'short'}):' · rencana awal')+' · ',el('a',{href:SHEET,target:'_blank',rel:'noopener'},'Google Sheet KERANGKA VISIT'))),
    el('div',{class:'v28-tools'},f('SPV',spvs.map(s=>[s,s]),'spv'),f('Toko',stores.map(s=>[s,s]),'store'),f('Bulan',months.map(m=>[m,MON3[Number(m.slice(5))-1]+' '+m.slice(0,4)]),'month')),
    el('div',{class:'rowline',style:'justify-content:space-between;flex-wrap:wrap;gap:6px'},tabs,resetAll),body);
  (TABS.find(t=>t[0]===U.tab)||TABS[0])[2](body);
}
const orig=renderOps;
renderOps=function(type){
  const out=orig.apply(this,arguments);
  if(type==='schedule'){const p=$('#p-schedule');if(p){cache=null;host=el('div',{class:'card v86-visit',id:'v86-visit'});const head=p.querySelector('.phead');if(head&&head.nextSibling)p.insertBefore(host,head.nextSibling);else p.append(host);paint();}}
  return out;
};
})();
