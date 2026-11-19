/* Visit plan uses the workbook snapshot locally; navigating does not refetch 702 records. */
(function(){'use strict';
if(window.VISIT82||!window.VISIT_PLAN_V82||typeof renderOps!=='function')return;
const D=window.VISIT_PLAN_V82,T=D.tables,V=window.VISIT82={tab:'calendar',spv:[],store:[],from:'2027-01-01',to:'2027-12-31',page:1,size:50,busy:false};
const base=renderOps,number=n=>Number(n||0).toLocaleString('id-ID'),rupiah=n=>'Rp'+number(n);
const opts=a=>[...new Set(a.filter(Boolean))].sort(),match=(a,x)=>!a.length||a.includes(String(x));
const slug=s=>String(s).toUpperCase().replace(/[^A-Z0-9]/g,'');
const headers=table=>T[table][0],rows=table=>T[table].slice(1).filter(r=>r[0]&&r[0]!=='TOTAL');
const trip=id=>rows('timeline').find(r=>r[1]===id);
const storeByName=name=>{const id=findStore(name);return S.stores.find(s=>String(s.id)===String(id));};
function allowed(name){
 const names=String(name||'').split(' + ');
 // Restrict scoped records using the existing access-aware store predicate.
 return names.every(n=>{const s=storeByName(n);return s?storeOk(s.id):false;});
}
function editable(){return S.demo||!!(typeof MASTER!=='undefined'&&MASTER.verified&&typeof V28!=='undefined'&&V28.canEditVisit());}
function dimensions(table,r){
 if(table==='timeline')return {spv:r[2],store:r[5],from:r[6],to:r[7]};
 if(table==='schedule')return {spv:r[4],store:r[5],from:r[0],to:r[0]};
 if(table==='itinerary'){const t=trip(r[0]);return {spv:r[1],store:t?.[5]||r[2],from:r[3],to:r[3]};}
 if(table==='budget')return {spv:r[1],store:r[2],from:r[3],to:r[4]};
 return null;
}
function filtered(table){return rows(table).filter(r=>{const d=dimensions(table,r);return !d||(allowed(d.store)&&match(V.spv,d.spv)&&(!V.store.length||String(d.store).split(' + ').some(s=>V.store.includes(s)))&&(!V.from||d.to>=V.from)&&(!V.to||d.from<=V.to));});}
function safeCell(v){const s=String(v??'');return /^[\s]*[=+@-]/.test(s)?"'"+s:s;}
function csvData(data){return '\ufeff'+data.map(r=>r.map(v=>'"'+safeCell(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');}
function download(name,data){const url=URL.createObjectURL(new Blob([csvData(data)],{type:'text/csv;charset=utf-8;'})),a=document.createElement('a');a.href=url;a.download=name+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportTable(table,data=filtered(table)){download('visit-'+table+'-'+D.year,[headers(table),...data]);}
function nav(){const host=el('div',{class:'visit82-tabs',role:'navigation','aria-label':'Tampilan Schedule Management'});for(const[k,label]of[['calendar','Kalender kegiatan'],['schedule','Agenda visit'],['timeline','Timeline trip'],['itinerary','Itinerary'],['agenda','Kerangka kegiatan'],['budget','Budget manager']])host.append(el('button',{class:'btn'+(V.tab===k?' pri':''),type:'button','aria-pressed':String(V.tab===k),onclick:()=>{V.tab=k;V.page=1;renderOps('schedule');}},label));return host;}
function controls(){const host=el('div',{class:'visit82-filters'}),timeline=rows('timeline').filter(r=>allowed(r[5]));
 function multi(label,key,values){host.append(opsField(label,multiFilterV76(values,V[key],v=>{V[key]=v;V.page=1;renderOps('schedule');})));}
 multi('SPV','spv',opts([...timeline.map(r=>r[2]),...rows('schedule').filter(r=>allowed(r[5])).map(r=>r[4])]));
 multi('Toko','store',opts([...timeline.flatMap(r=>r[5].split(' + ')),...rows('schedule').filter(r=>allowed(r[5])).map(r=>r[5])]));
 for(const[k,label]of[['from','Dari'],['to','Sampai']])host.append(opsField(label,opsInput(V[k],'date',{onchange:e=>{V[k]=e.target.value;V.page=1;renderOps('schedule');}})));
 host.append(opsField('Baris',opsSelect([10,20,50,100],V.size,{onchange:e=>{V.size=Number(e.target.value);V.page=1;renderOps('schedule');}})),el('button',{class:'btn',onclick:()=>{Object.assign(V,{spv:[],store:[],from:'2027-01-01',to:'2027-12-31',page:1});renderOps('schedule');}},'Reset'));
 return host;
}
function grid(head,data,onRow){const wrap=el('div',{class:'visit82-scroll'}),table=el('table',{class:'visit82-table'}),body=el('tbody');table.append(el('thead',{},el('tr',{},...head.map(x=>el('th',{scope:'col'},x)))),body);for(const r of data){const tr=el('tr');r.forEach((x,i)=>tr.append(el('td',{},i===0&&onRow?el('button',{class:'btn sm',onclick:()=>onRow(r)},String(x??'')):String(x??''))));body.append(tr);}wrap.append(table);return wrap;}
function paged(host,head,data,onRow){const pages=Math.max(1,Math.ceil(data.length/V.size));V.page=Math.min(V.page,pages);const offset=(V.page-1)*V.size;host.append(grid(head,data.slice(offset,offset+V.size),onRow),el('div',{class:'visit82-pager'},el('span',{role:'status'},data.length+' baris · halaman '+V.page+'/'+pages),el('button',{class:'btn sm',disabled:V.page===1?'':null,onclick:()=>{V.page--;renderOps('schedule');}},'Sebelumnya'),el('button',{class:'btn sm',disabled:V.page===pages?'':null,onclick:()=>{V.page++;renderOps('schedule');}},'Berikutnya')));if(!data.length)host.append(el('p',{class:'note'},'Tidak ada rencana dalam rentang dan akses toko yang dipilih.'));
}
function gantt(data){const outer=el('div',{class:'visit82-scroll'}),g=el('div',{class:'visit82-gantt'}),axis=el('div',{class:'visit82-gantt-axis'});axis.append(el('span',{},'Trip / bulan'));for(const m of['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'])axis.append(el('span',{},m));g.append(axis);const start=Date.parse(D.year+'-01-01T00:00:00Z'),days=(Date.parse((D.year+1)+'-01-01T00:00:00Z')-start)/86400000;
 for(const r of data){const line=el('div',{class:'visit82-gantt-line'}),track=el('div',{class:'visit82-gantt-track'}),left=(Date.parse(r[6]+'T00:00:00Z')-start)/86400000/days*100,width=(Number(r[8])/days*100),button=el('button',{class:'visit82-gantt-bar',style:'left:'+left+'%;width:'+width+'%;',title:r[4]+' · '+r[6]+' – '+r[7],'aria-label':r[1]+' '+r[4]+' '+r[6]+' sampai '+r[7],onclick:()=>detail(r[1])});track.append(button);line.append(el('span',{},r[1]+' · '+r[4]),track);g.append(line);}outer.append(g);return outer;}
function recordId(r){return 'visit82_'+[r[0],r[4],r[5],r[8],r[11]||'weekly'].map(slug).join('_');}
function record(r){const detail=rows('itinerary').filter(x=>x[0]===r[11]&&x[3]===r[0]);const store=storeByName(r[5]);const agenda=detail.length?detail.map(x=>x[5]+' · '+x[6]+' · '+x[9]).join('\n'):rows('agenda').filter(x=>String(r[9]).includes('Online')?String(x[0]).includes('Online'):String(x[0]).includes('Mingguan')).map(x=>x[4]+' · '+x[8]).join('\n');return {id:recordId(r),type:'schedule',title:r[9]+' · '+r[6],date:r[0],end_date:r[0],start_time:'09:00',end_time:'17:00',all_day:true,timezone:'Asia/Makassar',category:'Visit',status:'OPEN',progress:0,priority:'MEDIUM',pic:r[4],store_id:store?String(store.id):'',location:r[5],description:[r[10],r[12],agenda].filter(Boolean).join('\n'),checklist:[],assignees:[],sync_enabled:false,sync_status:'off',visit:{version:82,trip_id:r[11],method:r[8],source:D.source,source_date:D.snapshot},created_at:new Date().toISOString()};}
async function savePlan(button){
 if(V.busy)return;if(!editable()){toast('Akses edit Schedule diperlukan.');return;}
 const data=filtered('schedule'),existing=new Set(opsRecords('schedule').map(r=>r.id)),newRows=data.map(record).filter(r=>!existing.has(r.id));
 if(!newRows.length){toast('Rencana terpilih sudah tersimpan; status dan hasil yang ada dipertahankan.');return;}
 V.busy=true;button.disabled=true;
 try{for(let i=0;i<newRows.length;i+=40){await opsPersistMany(newRows.slice(i,i+40));button.textContent='Menyimpan '+Math.min(i+40,newRows.length)+'/'+newRows.length;}toast(newRows.length+' agenda visit tersimpan. Kalender mengikuti tanggal rencana.');}
 catch(e){toast('Belum seluruhnya tersimpan: '+e.message+'. Ulangi untuk melanjutkan tanpa duplikasi.');}
 finally{V.busy=false;renderOps('schedule');}
}
function detail(id){const t=trip(id);if(!t||!allowed(t[5]))return;const {box}=opsModal(id+' · '+t[4]);box.classList.add('visit82-modal');box.append(el('p',{},t[2]+' · '+t[6]+' – '+t[7]+' · '+t[10]),el('p',{class:'note'},'Rencana itinerary, belum merupakan reservasi. Output dan SLA mengikuti Master Kegiatan Visit.'));
 const data=rows('itinerary').filter(x=>x[0]===id);box.append(el('button',{class:'btn',onclick:()=>exportTable('itinerary',data)},'Ekspor itinerary trip CSV'),grid(['Tanggal','Jam','Agenda','Pemeriksaan','Output','Evidence','PIC','SLA'],data.map(r=>[r[3],r[5],r[6],r[9],r[10],r[11],r[12],r[13]])));
}
function managerRecord(id){return opsGet('schedule','visit82_manager_'+id);}
function budgetData(){return filtered('budget').map(r=>{const a=[...r],saved=managerRecord(r[0]);a[7]=!!saved?.visit_budget?.join;a[14]=Number(saved?.visit_budget?.other||0);a[19]=saved?.visit_budget?.manager||'';a[15]=Number(r[15]||0)+a[14];a[16]=a[7]?a[15]:0;a[17]=Number(a[8])+a[16];return a;});}
async function saveBudget(row,join,other,manager,button){if(!editable())return;const cost=Number(other.value);if(!Number.isFinite(cost)||cost<0){toast('Biaya tambahan harus angka nonnegatif.');return;}button.disabled=true;try{const old=managerRecord(row[0]);await opsPut('schedule','visit82_manager_'+row[0],{...old,id:'visit82_manager_'+row[0],type:'schedule',title:'Pendampingan manager · '+row[0]+' · '+row[2],date:row[3],end_date:row[4],category:'Budget visit',pic:row[1],location:row[2],all_day:true,timezone:'Asia/Makassar',status:old?.status||'OPEN',progress:old?.progress||0,priority:'MEDIUM',sync_enabled:false,sync_status:'off',visit_budget:{join:join.checked,other:cost,manager:manager.value.trim()}});toast('Pilihan budget disimpan di aplikasi. Google Sheet memiliki pilihan terpisah.');renderOps('schedule');}catch(e){toast(e.message);button.disabled=false;}}
function budget(host){const data=budgetData(),extra=data.reduce((s,r)=>s+r[16],0),baseSum=data.reduce((s,r)=>s+Number(r[8]),0);host.append(el('p',{class:'note'},'Estimasi dari kerangka visit, bukan harga tiket aktual. Hotel manager terpisah; kendaraan darat/lokal bersama SPV. Malam = hari − 1. Ubah asumsi global di Google Sheet lalu perbarui snapshot aplikasi bila diperlukan.'),el('div',{class:'visit82-metrics'},tile('Biaya SPV',rupiah(baseSum),'Sesuai filter trip',null),tile('Tambahan dipilih',rupiah(extra),'Centang trip manager',null),tile('Total rencana',rupiah(baseSum+extra),'SPV + manager terpilih',null)),el('button',{class:'btn',onclick:()=>exportTable('budget',data)},'Ekspor budget CSV'));
 const wrap=el('div',{class:'visit82-scroll'}),table=el('table',{class:'visit82-table'}),body=el('tbody');table.append(el('thead',{},el('tr',{},...['Trip','Periode','Biaya SPV','Simulasi manager','Ikut','Lain-lain Rp','Manager','Total','Simpan'].map(t=>el('th',{},t)))),body);for(const r of data){const cb=el('input',{type:'checkbox','aria-label':'Manager ikut '+r[0]}),other=opsInput(r[14],'number',{min:'0',step:'1000','aria-label':'Biaya lain '+r[0]}),manager=opsInput(r[19],'text',{'aria-label':'Nama manager '+r[0]});cb.checked=r[7];for(const n of[cb,other,manager])n.disabled=!editable();const btn=el('button',{class:'btn sm',disabled:editable()?null:'',onclick:()=>saveBudget(r,cb,other,manager,btn)},'Simpan');body.append(el('tr',{},el('td',{},el('button',{class:'btn sm',onclick:()=>detail(r[0])},r[0]),el('div',{},r[2])),el('td',{},r[3]+' – '+r[4]),el('td',{},rupiah(r[8])),el('td',{},rupiah(r[15])),el('td',{},cb),el('td',{},other),el('td',{},manager),el('td',{},rupiah(r[17])),el('td',{},btn)));}wrap.append(table);host.append(wrap,el('p',{class:'sub'},'Pilihan aplikasi tersimpan di database aplikasi. Centang pada Google Sheet berlaku untuk simulasi Sheet, tidak tersinkron dua arah otomatis.'));
}
renderOps=function(type){if(type!=='schedule')return base(type);if(V.tab==='calendar'){base(type);const p=$('#p-schedule');p.prepend(nav());p.append(el('button',{class:'btn',onclick:()=>{const f=OPS_VIEW.schedule,r=opsFilter(opsRecords('schedule'),f),range=opsRange(f);download('schedule-kegiatan',[['Tanggal','Sampai','Judul','PIC','Lokasi','Status','Progress','Jam mulai','Jam akhir','Keterangan'],...r.filter(x=>x.date<=range.end&&(x.end_date||x.date)>=range.start).map(x=>[x.date,x.end_date,x.title,x.pic,x.location,x.status,x.progress,x.start_time,x.end_time,x.description])]);}},'Ekspor kegiatan sesuai filter CSV'));return;}
 parkFilters();const host=$('#p-schedule');host.replaceChildren(el('div',{class:'phead'},el('div',{},el('h1',{},'Schedule Management'),el('p',{},'Rencana visit 2027 · agenda, timeline, itinerary dan biaya pendampingan'))),nav(),el('div',{class:'visit82-source'},el('span',{},'Sumber kerangka visit · snapshot '+D.snapshot+' · rencana, bukan hasil pelaksanaan'),el('a',{class:'btn sm',href:D.source,target:'_blank',rel:'noopener noreferrer'},'Buka Google Sheet')));
 if(V.tab!=='agenda')host.append(controls());if(V.from&&V.to&&V.from>V.to){host.append(el('p',{class:'note warn'},'Tanggal mulai melebihi tanggal akhir.'));return;}
 const content=el('section',{class:'card visit82-content'});host.append(content);if(V.tab==='budget'){budget(content);return;}
 const table=V.tab,data=filtered(table);content.append(el('div',{class:'visit82-toolbar'},el('strong',{},({schedule:'Agenda visit',timeline:'Timeline trip luar kota',itinerary:'Itinerary per hari',agenda:'Kerangka kegiatan & output'})[table]+' · '+data.length+' baris'),el('button',{class:'btn',onclick:()=>exportTable(table,data)},'Ekspor semua hasil filter CSV')));
 if(table==='schedule'){const save=el('button',{class:'btn pri',disabled:editable()&&!V.busy?null:'',onclick:()=>savePlan(save)},'Simpan rencana terpilih ke kalender');content.append(el('p',{class:'sub'},'Rencana dari kerangka visit tersedia di bawah. Simpan untuk memasukkannya ke kalender aplikasi; data yang sudah ada tidak ditimpa.'),save);paged(content,['Tanggal','SPV','Cabang','Metode','Jenis','Tujuan','Trip','Status sumber'],data.map(r=>[r[0],r[4],r[5],r[8],r[9],r[10],r[11],r[13]]));}
 else if(table==='timeline'){content.append(gantt(data));paged(content,['Trip','SPV','Toko','Mulai','Selesai','Hari','Minggu','Moda','Estimasi SPV','Status'],data.map(r=>[r[1],r[2],r[4],r[6],r[7],r[8],r[9],r[10],rupiah(r[11]),r[12]]),r=>detail(r[0]));}
 else if(table==='itinerary')paged(content,['Trip','SPV','Toko','Tanggal','Jam','Agenda','Kegiatan','Output','Evidence','PIC','SLA','Status'],data.map(r=>[r[0],r[1],r[2],r[3],r[5],r[6],r[9],r[10],r[11],r[12],r[13],r[14]]),r=>detail(r[0]));
 else paged(content,headers('agenda'),data);
};
Object.assign(V,{filtered,record,recordId,csvData,budgetData});
})();
