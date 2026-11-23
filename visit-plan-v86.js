/* Visit Plan V86 — generator jadwal, agenda, timeline & itinerary visit Commercial.
   Fungsi murni (tanpa DOM) agar sama persis dipakai aplikasi dan pembuat Google Sheet.
   Sumber: whiteboard jadwal visit SPV (Area 1 Ilham, Area 2 Zultan) + Sheet "KERANGKA VISIT COMMERCIAL". */
(function(root){'use strict';
const KEGIATAN=[
 [1,'Opening & Team','Briefing Team','Brief target, agenda visit, issue utama, pembagian tugas dan prioritas hari itu','Offline','Awal visit','Notulen briefing + 3 prioritas utama','Foto briefing + catatan singkat','100% agenda & prioritas dipahami','Store Leader / SPV Area','Hari yang sama'],
 [2,'People','Check DAS Team Store','Cek Daily Activity Schedule, pembagian manpower, disiplin eksekusi dan aktivitas aktual vs rencana','Offline / Online','Setiap visit','DAS review + gap manpower/aktivitas','Screenshot/foto DAS','DAS terisi dan aktivitas sesuai plan','Store Leader','H+1'],
 [3,'Administration','Check Administrasi Team Store','Cek kelengkapan dokumen operasional, arsip, laporan, checklist, approval dan administrasi harian','Offline / Online','Setiap visit','Checklist administrasi + daftar dokumen kurang','Foto/screenshot dokumen','Kelengkapan 100% dokumen wajib','Admin / Store Leader','H+3'],
 [4,'Sales Floor','Check Kondisi Area Sales','Cek display, kerapihan produk, zoning, kapasitas display, kemudahan customer berbelanja','Offline','Setiap visit','Score area sales + daftar perbaikan','Foto before/after','Area sales sesuai standar visual','Store Leader','H+3'],
 [5,'Visual Merchandising','Check Layout Store / Planogram','Cek kesesuaian layout, planogram, flow customer, penempatan kategori dan hot zone','Offline','Bulanan / saat ada perubahan','Layout gap report + rekomendasi layout','Foto layout + sketsa bila perlu','Planogram compliance >= 95%','Store Leader / Commercial','H+7'],
 [6,'Warehouse Store','Check Gudang Store & Administrasi','Cek zoning gudang, lokasi barang, kerapihan, dokumen stok, receiving/transfer, barang pending','Offline','Setiap visit','Warehouse checklist + issue stok/gudang','Foto area gudang + dokumen','Tidak ada barang tanpa lokasi/status','Store Leader / Checker','H+3'],
 [7,'Checker','Check Proses Checker','Observasi proses checker, akurasi qty/SKU, double check, handling selisih dan dokumen serah terima','Offline','Setiap visit','Process observation + temuan error','Foto proses + sample check','Akurasi checker >= 99.5%','Checker / Store Leader','H+1'],
 [8,'Transaction','Check Proses Transaksi','Cek transaksi dari order sampai pembayaran, input POS, diskon, retur, void, bukti transaksi','Offline / Online','Setiap visit','Transaction compliance checklist','Sample transaksi/screenshot POS','100% transaksi sesuai SOP & approval','Cashier / Store Leader','H+1'],
 [9,'Customer Service','Check Flow Customer Service','Cek greeting, identifikasi kebutuhan, penawaran, follow up, complaint handling dan closing','Offline','Setiap visit','CS observation score + coaching point','Catatan mystery observation','Service score sesuai standar','CS / Store Leader','H+3'],
 [10,'Housekeeping','Check Kebersihan & Kerapihan Toko','Cek lantai, rak, kaca, fitting/area service, area kerja dan tampilan umum','Offline','Setiap visit','Housekeeping score + action list','Foto area','Score kebersihan >= 95%','Store Leader','Hari yang sama'],
 [11,'Promotion','Check Mapping Flayering & Promo Material','Cek posisi flyer, poster, price tag, promo material, kesesuaian periode dan keterbacaan','Offline','Setiap campaign / visit','Promo execution checklist','Foto materi promo','100% materi aktif sesuai campaign','Store Leader / Marketing','H+1'],
 [12,'Supporting Area','Check Area Istirahat & Area Lainnya','Cek area istirahat, toilet, pantry, back office, jalur akses dan area non-selling','Offline','Setiap visit','Supporting area checklist','Foto area','Layak, bersih dan aman','Store Leader / GA','H+3'],
 [13,'Team Development','Brainstorming Bersama Team','Diskusi hambatan, ide perbaikan, kebutuhan customer, kendala proses dan peluang penjualan','Offline','Akhir visit / minimal bulanan','Top 5 issue + ide improvement + owner','Notulen/foto diskusi','Setiap issue memiliki owner & due date','SPV Area / Store Leader','H+3'],
 [14,'Inventory','Stock Accuracy & Cycle Count','Sampling SKU fisik vs sistem, cek selisih, negative stock, stock tidak berlokasi dan penyebab variance','Offline','Setiap visit','Stock accuracy report + variance list','Foto count + export/screenshot stock','Stock accuracy >= 99%','Store Leader / Checker','H+1'],
 [15,'Inventory','Stock Aging, Slow Moving & OOS','Cek aging, slow moving, overstock, out of stock, kebutuhan transfer/replenishment dan action produk bermasalah','Offline / Online','Mingguan','Aging/OOS action list','Screenshot stock report','Tidak ada OOS kritikal tanpa action','Store Leader / Commercial','H+3'],
 [16,'Finance Control','Cash & Payment Reconciliation','Sampling cash/non-cash vs POS, settlement, selisih kas, bukti pembayaran dan transaksi pending','Offline / Online','Setiap visit','Cash reconciliation checklist + variance','Screenshot settlement / bukti sample','Selisih kas = 0 atau ada BA resmi','Store Leader / FAT','H+1'],
 [17,'Pricing & Promo','Price & Promo Execution','Cek price tag vs POS, diskon aktif, bundling, voucher, approval promo dan komunikasi ke customer','Offline / Online','Setiap visit/campaign','Price-promo compliance report','Foto price tag + screenshot POS','100% harga/promo sinkron','Store Leader / Commercial','H+1'],
 [18,'CRM & Sales','Customer Database & Follow Up','Cek pencatatan customer, lead, follow-up quotation, repeat order, broadcast dan pipeline customer potensial','Online / Offline','Mingguan','Pipeline follow-up + daftar customer prioritas','Screenshot CRM/rekap follow-up','100% lead prioritas memiliki next action','CS / Admin Sales / Store Leader','H+3'],
 [19,'People','Manpower, Attendance & Product Knowledge','Cek roster, kehadiran, coverage jam ramai, training kebutuhan produk dan kemampuan menjelaskan produk','Offline / Online','Setiap visit','Manpower gap + training/coaching plan','Roster + hasil mini quiz/coaching','Coverage sesuai kebutuhan & knowledge pass','Store Leader / HR','H+7'],
 [20,'Facility & Security','Maintenance, Safety & Security','Cek lampu, AC, listrik, APAR, CCTV, pintu/kunci, perangkat POS, risiko keselamatan dan kerusakan fasilitas','Offline','Bulanan / setiap visit','Maintenance & safety issue list','Foto temuan','Tidak ada temuan critical open','Store Leader / GA','H+3 critical; H+14 minor'],
 [21,'Market Intelligence','Competitor & Local Market Observation','Cek harga/promo kompetitor, traffic area, aktivitas lokal, peluang komunitas/B2B dan perubahan pasar sekitar','Offline','Bulanan','Market insight singkat + rekomendasi aksi','Foto/notes kompetitor','Minimal 1 insight/action per visit','SPV Area / Commercial','H+7'],
 [22,'Corrective Action','Review Follow Up Visit Sebelumnya','Verifikasi temuan sebelumnya, status action, efektivitas perbaikan dan overdue issue','Offline / Online','Setiap visit','Updated action tracker: Open/Closed/Overdue','Foto bukti closing + tracker','100% overdue memiliki escalation','SPV Area / Store Leader','Hari yang sama'],
 [23,'Documentation','Dokumentasi Before-After','Dokumentasikan kondisi awal dan hasil perbaikan untuk temuan visual/operasional yang dapat ditutup saat visit','Offline','Saat ada temuan','Before-after evidence pack','Foto before/after','Evidence lengkap untuk item closed','PIC Temuan','Hari yang sama'],
 [24,'Closing','Closing Meeting & Visit Report','Sampaikan score, temuan prioritas, corrective action, PIC, due date dan escalation; konfirmasi komitmen Store Leader','Offline / Online','Akhir visit','Visit report + action plan + score + due date','Notulen closing / approval Store Leader','Tidak ada temuan tanpa PIC & due date','SPV Area','Maks H+1'],
 [25,'Team Development','Refreshment Training Team Store','Refreshment training sesuai gap saat visit: product knowledge, SOP/service, promo dan proses operasional; tanya jawab, mini quiz dan coaching','Offline / Online','Setiap visit / sesuai kebutuhan','Training log + materi + coaching point/action','Foto training + daftar hadir + materi + hasil mini quiz','100% peserta ikut & paham materi','Supervisor Area / Store Leader','Hari yang sama']
].map(r=>({no:r[0],area:r[1],kegiatan:r[2],detail:r[3],metode:r[4],timing:r[5],output:r[6],evidence:r[7],kpi:r[8],pic:r[9],sla:r[10]}));
const K=Object.fromEntries(KEGIATAN.map(k=>[k.no,k]));

/* Toko: nama sesuai master toko/Moka. mode: kota (dalam kota), darat, pesawat. */
const STORES=[
 {key:'TK_MAKASSAR',name:'TIGALAPANKAOS MAKASSAR',label:'Tigalapan BTP',spv:'ILHAM',area:'Area 1',level:'A',mode:'kota',weekday:1,cost:0},
 {key:'MAMU_BTP',name:'MAMU BTP',label:'Mamu BTP',spv:'ILHAM',area:'Area 1',level:'A',mode:'kota',weekday:2,cost:0},
 {key:'DTF',name:'DTF',label:'Sepadan (DTF)',spv:'ILHAM',area:'Area 1',level:'A',mode:'kota',weekday:3,cost:0},
 {key:'POLMAN',name:'TIGALAPANKAOS POLMAN',label:'Polman',spv:'ILHAM',area:'Area 1',level:'B',mode:'darat',city:'Polman (Wonomulyo)',hours:5.5,cost:2940000},
 {key:'PALU',name:'TIGALAPANKAOS PALU',label:'Palu',spv:'ILHAM',area:'Area 1',level:'C',mode:'pesawat',city:'Palu',airport:'Bandara Mutiara SIS Al-Jufri Palu',flight:1.25,cost:5640000},
 {key:'SAMARINDA',name:'TIGALAPANKAOS SAMARINDA',label:'Samarinda',spv:'ILHAM',area:'Area 1',level:'C',mode:'pesawat',city:'Samarinda',airport:'Bandara APT Pranoto Samarinda',flight:1.5,cost:5040000,returnVia:'Balikpapan'},
 {key:'MANADO',name:'TIGALAPANKAOS MANADO',label:'Manado',spv:'ILHAM',area:'Area 1',level:'C',mode:'pesawat',city:'Manado',airport:'Bandara Sam Ratulangi Manado',flight:2,cost:6640000},
 {key:'MAMU_MAKASSAR',name:'MAMU MAKASSAR',label:'Tamalate (Mamu Makassar)',spv:'ZULTAN',area:'Area 2',level:'A',mode:'kota',weekday:1,cost:0},
 {key:'GOWA',name:'MAMU GOWA',label:'Gowa',spv:'ZULTAN',area:'Area 2',level:'A',mode:'kota',weekday:3,cost:0},
 {key:'KENDARI',name:'MAMU KENDARI',label:'Kendari',spv:'ZULTAN',area:'Area 2',level:'C',mode:'pesawat',city:'Kendari',airport:'Bandara Haluoleo Kendari',flight:1,cost:5040000},
 {key:'BONE',name:'TIGALAPANKAOS BONE',label:'Bone',spv:'ZULTAN',area:'Area 2',level:'B',mode:'darat',city:'Bone (Watampone)',hours:4,cost:2940000},
 {key:'PALOPO',name:'MAMU PALOPO',label:'Palopo',spv:'ZULTAN',area:'Area 2',level:'B',mode:'darat',city:'Palopo',hours:8,cost:3140000},
 {key:'TORAJA',name:'TIGALAPANKAOS TORAJA',label:'Toraja',spv:'ZULTAN',area:'Area 2',level:'B',mode:'darat',city:'Toraja (Rantepao)',hours:8,cost:3140000}
];
const SPV={ILHAM:'SPV Ilham',ZULTAN:'SPV Zultan'};
/* Jadwal visit luar kota (whiteboard) — 2027 (minggu ISO cocok dengan 2027). */
const TRIPS=[
 ['ILHAM',['SAMARINDA'],'2027-01-27','2027-01-29'],['ILHAM',['POLMAN'],'2027-04-15','2027-04-16'],['ILHAM',['PALU'],'2027-05-27','2027-05-29'],
 ['ILHAM',['MANADO'],'2027-06-17','2027-06-19'],['ILHAM',['PALU'],'2027-08-05','2027-08-07'],['ILHAM',['POLMAN'],'2027-09-10','2027-09-11'],
 ['ILHAM',['SAMARINDA'],'2027-10-28','2027-10-30'],['ILHAM',['MANADO'],'2027-11-25','2027-11-27'],
 ['ZULTAN',['KENDARI'],'2027-01-21','2027-01-23'],['ZULTAN',['PALOPO','TORAJA'],'2027-04-06','2027-04-10'],['ZULTAN',['BONE'],'2027-05-13','2027-05-14'],
 ['ZULTAN',['KENDARI'],'2027-09-02','2027-09-04'],['ZULTAN',['PALOPO','TORAJA'],'2027-10-19','2027-10-23'],['ZULTAN',['BONE'],'2027-11-12','2027-11-13']
];
const DAYS=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const MON=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const D=s=>new Date(s+'T12:00:00Z');
const iso=d=>d.toISOString().slice(0,10);
const add=(s,n)=>{const d=D(s);d.setUTCDate(d.getUTCDate()+n);return iso(d);};
function isoWeek(s){const d=D(s),day=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-day+3);const y=d.getUTCFullYear(),first=new Date(Date.UTC(y,0,4,12));return {year:y,week:1+Math.round(((d-first)/86400000-3+((first.getUTCDay()+6)%7))/7)};}
function mondayOfWeek(year,week){const j4=new Date(Date.UTC(year,0,4,12)),day=(j4.getUTCDay()+6)%7;j4.setUTCDate(j4.getUTCDate()-day+(week-1)*7);return iso(j4);}
const fmtDate=s=>{const d=D(s);return String(d.getUTCDate()).padStart(2,'0')+'-'+MON[d.getUTCMonth()]+'-'+d.getUTCFullYear();};
const dayName=s=>DAYS[D(s).getUTCDay()];
const monthLabel=s=>MON[D(s).getUTCMonth()]+'-'+D(s).getUTCFullYear();
const S=Object.fromEntries(STORES.map(s=>[s.key,s]));
const hhmm=h=>{const m=Math.round(h*60);return String(Math.floor(m/60)).padStart(2,'0')+'.'+String(m%60).padStart(2,'0');};

function tripList(cfg={}){
  return (cfg.trips||TRIPS).map((t,i)=>{const [spv,stores,start,end]=Array.isArray(t)?t:[t.spv,t.stores,t.start,t.end];
    const days=Math.round((D(end)-D(start))/86400000)+1,w=isoWeek(start),st=stores.map(k=>S[k]).filter(Boolean);
    const cost=st.length>1?Math.max(...st.map(x=>x.cost))+st.slice(1).reduce((a,x)=>a+Math.round(x.cost*0.3),0):(st[0]?.cost||0);
    const o=Array.isArray(t)?{}:t; /* V87: trip bisa diubah (kode, moda, biaya, status, catatan) */
    return {id:(o.code||'T'+String(i+1).padStart(2,'0'))+'-'+stores.join('-'),code:o.code||'T'+String(i+1).padStart(2,'0'),spv,stores,start,end,days,week:w.week,year:w.year,
      label:st.map(x=>x.label).join(' + '),names:st.map(x=>x.name).join(' + '),mode:o.mode||(st.some(x=>x.mode==='pesawat')?'Pesawat':'Darat'),
      cost:o.cost!=null&&o.cost!==''?Number(o.cost):cost,status:o.status||'Planned',notes:o.notes||''};});
}

/* ---------------- Itinerary per trip ----------------
   Templat harian mengikuti contoh sheet "Kegiatan" (Manado/Samarinda): blok 1 jam atau 2 × 30 menit,
   Ishoma 12.00–13.00, kerja s.d. 17.00 lalu Toko ke Hotel. */
const DAY_TPL={
  /* hari tiba (siang/sore setelah perjalanan) */
  arrive:[[2],[3],[4],[5]],
  /* hari tiba lalu langsung kunjungan penuh (trip 2 hari) */
  arrive2:[[1,2],[3,4],[5,6],[7,14]],
  /* hari penuh */
  full:[[1],[6],[7,14],[8,16],'ISHOMA',[9,19],[10,12],[11,17],[15,21]],
  /* hari penuh pertama di toko kedua (belum ada sesi tiba) */
  full_first:[[1],[2,3],[4,5],[6,7],'ISHOMA',[8,14],[9,10],[11,12],[16,17]],
  /* hari terakhir trip 2 hari */
  close2:[[1],[8,16],[9,10],[11,17],'ISHOMA',[22,25],[13,24]],
  /* hari penutup toko */
  close:[[1],[22,13],[25],[24,23],'ISHOMA']
};
function pushRow(rows,date,a,b,task,detail,no){rows.push({date,time:b==null?'Pukul '+hhmm(a):hhmm(a)+' - '+hhmm(b),task,detail,no:no||''});return b==null?a:b;}
function runTpl(rows,date,start,end,store,dayN,tpl){
  let t=start;
  for(const blk of tpl){
    if(t>=end-0.01)break;
    if(blk==='ISHOMA'){if(t<=12.01){t=pushRow(rows,date,12,13,'Ishoma','Ishoma');}continue;}
    if(blk[0]===1&&t>8.6&&t!==9.5){/* briefing hanya di awal hari */}
    if(t<12&&t+1>12.01){t=pushRow(rows,date,t,12,'Visit Store '+store.label+' Day '+dayN,K[blk[0]].kegiatan,blk[0]);t=pushRow(rows,date,12,13,'Ishoma','Ishoma');continue;}
    if(blk.length===1&&blk[0]===1){t=pushRow(rows,date,t,t+0.5,'Visit Store '+store.label+' Day '+dayN,K[1].kegiatan,1);continue;}
    let step=1/blk.length;
    if(t+1>end+0.01){step=(end-t)/blk.length;if(step<0.49)break;step=Math.floor(step*2)/2;}
    for(const no of blk)t=pushRow(rows,date,t,t+step,'Visit Store '+store.label+' Day '+dayN,K[no].kegiatan,no);
  }
  if(t<=12.01&&end>13&&!rows.some(r=>r.date===date&&r.task==='Ishoma'))t=pushRow(rows,date,12,13,'Ishoma','Ishoma');
  return t;
}
const roundUp=h=>Math.ceil(h*2)/2;
function itinerary(trip){
  const rows=[],st=trip.stores.map(k=>S[k]),dates=Array.from({length:trip.days},(_,i)=>add(trip.start,i)),first=st[0],last=st[st.length-1];
  /* rencana toko per hari */
  const plan=[];
  if(st.length===1)for(let i=0;i<trip.days;i++)plan.push({store:first,day:i+1,of:trip.days});
  else{const a=Math.ceil(trip.days/2);for(let i=0;i<trip.days;i++)plan.push(i<a?{store:st[0],day:i+1,of:a}:{store:st[1],day:i-a+1,of:trip.days-a});}
  for(let i=0;i<dates.length;i++){
    const date=dates[i],p=plan[i],store=p.store,lastDay=i===dates.length-1,nextStore=plan[i+1]&&plan[i+1].store!==store;
    let t,tpl;
    if(i===0){
      if(first.mode==='pesawat'){
        t=pushRow(rows,date,6.5,7.5,'Perjalanan Pergi','Rumah - Bandara Sultan Hasanuddin Makassar');
        t=pushRow(rows,date,8,8+first.flight,'Perjalanan Pergi','Penerbangan Makassar - '+first.airport+' (estimasi)');
        t=pushRow(rows,date,t,roundUp(t+0.75),'Perjalanan Ke Toko',first.airport+' - Toko '+first.label);
      }else t=pushRow(rows,date,6,roundUp(6+first.hours),'Perjalanan Pergi','Makassar - '+first.city+' (darat ± '+String(first.hours).replace('.',',')+' jam)');
      if(t<12)t=pushRow(rows,date,t,12,'Check-in','Check-in hotel / istirahat singkat');
      if(t<=12){t=pushRow(rows,date,Math.max(t,12),13,'Ishoma','Ishoma');}
      else t=pushRow(rows,date,t,t+0.5,'Check-in','Check-in hotel / istirahat singkat');
      tpl=p.of===2?DAY_TPL.arrive2:DAY_TPL.arrive;
    }else{
      t=pushRow(rows,date,8,8.25,'Perjalanan Pergi','Hotel ke Toko '+store.label);t=8.5;
      tpl=p.day===p.of?(p.of===2?DAY_TPL.close2:DAY_TPL.close):(p.day===1?DAY_TPL.full_first:DAY_TPL.full);
    }
    const leaveAfter=lastDay||nextStore;
    const endWork=lastDay?(last.mode==='pesawat'?(last.returnVia?13:14):15):nextStore?14:17;
    t=runTpl(rows,date,t,endWork,store,p.day,tpl);
    if(nextStore){const nx=plan[i+1].store;t=pushRow(rows,date,Math.max(t,13),Math.max(t,13)+2.5,'Perjalanan Antar Toko',store.city+' - '+nx.city+' (darat ± 2,5 jam) · check-in hotel');}
    else if(!lastDay)pushRow(rows,date,17,null,'Perjalanan Pulang','Toko ke Hotel');
    if(lastDay){
      t=Math.max(t,13);
      if(last.mode==='pesawat'){
        const via=last.returnVia;
        t=pushRow(rows,date,t,t+(via?2:1),'Perjalanan Pulang',via?'Toko ke Bandara '+via+' (darat ± 2 jam)':'Toko ke '+last.airport);
        t=pushRow(rows,date,t,t+(via?2:1.5),'Perjalanan Pulang',(via?'Bandara '+via:last.airport)+' (waiting flight)');
        t=pushRow(rows,date,t,roundUp(t+last.flight),'Perjalanan Pulang','Penerbangan '+(via||last.city)+' - Makassar (estimasi)');
        pushRow(rows,date,t,null,'Perjalanan Pulang','Bandara Makassar - Rumah');
      }else{t=pushRow(rows,date,t,roundUp(t+last.hours),'Perjalanan Pulang',last.city+' - Makassar (darat ± '+String(last.hours).replace('.',',')+' jam)');pushRow(rows,date,t,null,'Perjalanan Pulang','Tiba di Makassar / rumah');}
    }
  }
  return rows.map((r,i)=>({trip:trip.id,spv:SPV[trip.spv],toko:trip.label,seq:i+1,date:r.date,tanggal:fmtDate(r.date),day:dayName(r.date),time:r.time,task:r.task,detail:r.detail,no:r.no,
    output:r.no?K[r.no].output:'',evidence:r.no?K[r.no].evidence:'',pic:r.no?K[r.no].pic:'',sla:r.no?K[r.no].sla:''}));
}

/* ---------------- Agenda per jenis visit ---------------- */
const AGENDA={
  'Offline Mingguan (Level A)':[1,2,3,4,6,7,8,9,10,11,14,15,16,17,22,24],
  'Offline Mingguan · tambahan minggu pertama bulan':[5,12,19,20,21,25],
  'Online Mingguan (Level B/C)':[2,3,8,15,16,17,18,19,22,24],
  'Visit Semester (Luar Kota)':KEGIATAN.map(k=>k.no)
};
function agendaRows(){const out=[];for(const [jenis,nos] of Object.entries(AGENDA))nos.forEach((no,i)=>{const k=K[no];out.push({jenis,urut:i+1,no,area:k.area,kegiatan:k.kegiatan,detail:k.detail,metode:k.metode,timing:k.timing,output:k.output,evidence:k.evidence,kpi:k.kpi,pic:k.pic,sla:k.sla});});return out;}

/* ---------------- Jadwal (schedule) ---------------- */
function schedule(cfg={}){
  const year=cfg.year||2027,trips=tripList(cfg),rows=[],busy={};
  for(const t of trips)for(let i=0;i<t.days;i++)(busy[t.spv]=busy[t.spv]||new Set()).add(add(t.start,i));
  const tripWeek={};for(const t of trips)for(const k of t.stores)tripWeek[k+'_'+t.week]=t;
  const push=(date,store,metode,objective,catatan,extra={})=>rows.push({date,tanggal:fmtDate(date),hari:dayName(date),week:'W'+isoWeek(date).week,bulan:monthLabel(date),spv:SPV[store.spv],area:store.area,cabang:store.name,toko:store.label,level:store.level,metode,objective,
    kegiatan:(extra.agenda?AGENDA[extra.agenda]:[]).map(n=>n+'. '+K[n].kegiatan).join('; '),status:'Planned',score:'',finding:'',followup:'',pic:SPV[store.spv],due:extra.due||'',catatan,trip:extra.trip||''});
  for(let w=1;w<=52;w++){
    const mon=mondayOfWeek(year,w),firstWeekOfMonth=Number(D(mon).getUTCDate())<=7;
    for(const s of STORES){
      if(s.mode==='kota'){
        let date=add(mon,s.weekday-1),note='Visit mingguan Level A';
        if(busy[s.spv]?.has(date)){const alt=[0,1,2,3,4].map(n=>add(mon,n)).find(d=>!busy[s.spv].has(d));if(alt){note+=' · digeser dari '+dayName(date)+' karena SPV visit luar kota';date=alt;}else note+=' · bentrok visit luar kota, wakilkan Store Leader';}
        push(date,s,'Offline','Physical audit + checkpoint control',note+(firstWeekOfMonth?' · minggu pertama: + layout, area pendukung, manpower, maintenance, market, training':''),{agenda:'Offline Mingguan (Level A)'});
      }else if(!tripWeek[s.key+'_'+w]){
        const date=add(mon,3);
        push(date,s,'Online','Formal online checkpoint control','Kontrol online mingguan Level '+s.level+(busy[s.spv]?.has(date)?' · dilakukan dari lokasi visit':''),{agenda:'Online Mingguan (Level B/C)'});
      }
    }
  }
  for(const t of trips){const st=t.stores.map(k=>S[k]),a=Math.ceil(t.days/2);
    for(let i=0;i<t.days;i++){const store=st.length>1?(i<a?st[0]:st[1]):st[0],n=st.length>1?(i<a?i+1:i-a+1):i+1,of=st.length>1?(i<a?a:t.days-a):t.days;
      push(add(t.start,i),store,'Offline','Physical audit + checkpoint control','Visit semester Day '+n+'/'+of+' ('+t.mode.toLowerCase()+') · '+t.label+' · '+fmtDate(t.start)+' s.d. '+fmtDate(t.end),{agenda:'Visit Semester (Luar Kota)',trip:t.id,due:fmtDate(add(t.end,1))});}}
  rows.sort((a,b)=>a.date.localeCompare(b.date)||a.spv.localeCompare(b.spv)||a.metode.localeCompare(b.metode)||a.cabang.localeCompare(b.cabang));
  return rows;
}
/* ---------------- Timeline: grid toko × minggu ---------------- */
function timeline(cfg={}){
  const rows=schedule(cfg),grid={};
  for(const r of rows){const w=Number(r.week.slice(1)),key=r.cabang;grid[key]=grid[key]||{};const mark=r.trip?'V':r.metode==='Offline'?'O':'N';const cur=grid[key][w]||'';if(!cur.includes(mark))grid[key][w]=(cur+mark);}
  return STORES.map(s=>({spv:SPV[s.spv],area:s.area,cabang:s.name,toko:s.label,level:s.level,weeks:Array.from({length:52},(_,i)=>(grid[s.name]||{})[i+1]||'')}));
}
const api={KEGIATAN,STORES,TRIPS,SPV,AGENDA,tripList,itinerary,agendaRows,schedule,timeline,isoWeek,fmtDate,dayName,mondayOfWeek};
if(typeof module!=='undefined')module.exports=api;else root.VISIT86=api;
})(typeof window!=='undefined'?window:globalThis);
