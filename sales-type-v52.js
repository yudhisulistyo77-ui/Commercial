/* V52 — Menu Sales Type: tabel & grafik analisa per Sales Type Moka.
   Sumber: sales_type_raw (bulanan per toko per sales type, diisi sinkron Moka) + Pemetaan Sales Type (S.map).
   Periode & cut-off memakai filter yang sama dengan SSSG (termasuk aturan bulan berjalan V52), sehingga angkanya
   dapat dibandingkan langsung. Data dimuat sekali per sesi lalu dihitung di browser (hemat egress). */
(function(){'use strict';
if(window.SALES_TYPE_V52)return;
const X=window.SALES_TYPE_V52={segment:'all',picked:[],top:20,sort:'net',storeYear:0,monthYear:0,cache:null,loading:null};
const UNMAPPED='Belum dipetakan';
const money=v=>v==null?'—':compact(v),pctTxt=v=>v==null||!isFinite(v)?'—':(v*100).toLocaleString('id-ID',{maximumFractionDigits:2})+'%';
const z=(a,b)=>a==null&&b==null?[null,null]:[a??0,b??0];
const gap=(a,b)=>memberGapV29(...z(a,b)),grow=(a,b)=>memberGrowthV30(...z(a,b));
const COLORS=['var(--s1)','var(--s2)','var(--s3)','var(--s4)','var(--s5)','var(--s6)','var(--s7)','var(--s8)'];

function logSig(){const l=(S.logs||[]).find(r=>r.kind==='SALES_TYPE');return l?String(l.created_at):''}
async function load(y1){
 const key=y1+'|'+logSig()+'|'+S.url;
 if(X.cache?.key===key)return X.cache.rows;
 if(X.loading?.key===key)return X.loading.p;
 const p=DB.selAll('sales_type_raw?select=year,month,store_id,sales_type,trx_count,amount&year=gte.'+y1).then(rows=>{X.cache={key,rows};X.loading=null;return rows}).catch(e=>{X.loading=null;throw e});
 X.loading={key,p};return p;
}
function mapOf(){const m=new Map();for(const r of S.map||[])m.set(String(r.sales_type).trim().toUpperCase(),r);return m}
function segOf(map,t){const r=map.get(String(t).trim().toUpperCase());return r?.segmen||UNMAPPED}

function aggregate(rows,w,years){
 const map=mapOf(),types=new Map(),byMonth=new Map(),bySeg=new Map(),byStore=new Map(),totals={};
 const ok=new Set((S.stores||[]).filter(s=>storeOk(s.id)).map(s=>Number(s.id)));
 for(const r of rows){
  const y=Number(r.year),m=Number(r.month),sid=Number(r.store_id);
  if(!years.includes(y)||!ok.has(sid)||m<w.m1||m>w.m2)continue;
  const f=comparisonFraction(w,y,m);if(!(f>0))continue;
  const net=comparisonSalesValue(r.amount,w,y,m),trx=Number(r.trx_count||0)*f;
  const name=String(r.sales_type||'(kosong)').trim(),seg=segOf(map,name);
  if(X.segment!=='all'&&seg!==X.segment)continue;
  if(X.picked.length&&!X.picked.includes(name))continue;
  const t=types.get(name)||{name,seg,info:map.get(name.toUpperCase())||null,y:{}};types.set(name,t);
  const ty=t.y[y]||(t.y[y]={net:0,trx:0,months:{},stores:{}});ty.net+=net;ty.trx+=trx;ty.months[m]=(ty.months[m]||0)+net;ty.stores[sid]=(ty.stores[sid]||0)+net;
  const mk=y+'-'+m;byMonth.set(mk,(byMonth.get(mk)||0)+net);
  const s=bySeg.get(seg)||{};s[y]=(s[y]||0)+net;bySeg.set(seg,s);
  const st=byStore.get(sid)||{};st[y]=(st[y]||0)+net;byStore.set(sid,st);
  const tt=totals[y]||(totals[y]={net:0,trx:0});tt.net+=net;tt.trx+=trx;
 }
 return {types:[...types.values()],byMonth,bySeg,byStore,totals};
}

let EPOCH=0;
async function renderSalesType(){
 const real=$('#p-salestype');if(!real)return;const epoch=++EPOCH;
 /* Dibangun di wadah sementara lalu ditukar sekaligus: render ganda tidak menumpuk kartu. */
 const page=el('div');real.replaceChildren(page);
 const st=h2hInit(),years=st.y.map(Number),[y1,y2,y3]=years,rerender=()=>renderSalesType();
 let w;try{w=comparisonWindow(st)}catch(e){page.append(el('p',{class:'note warn'},e.message));return}
 page.append(el('div',{class:'phead'},el('div',{},el('h1',{},'Sales Type'),el('p',{},years.join(' / ')+' · periode & cut-off sama dengan menu SSSG'))));
 const controls=comparisonControls(st,'stype',rerender);page.append(controls);
 const segs=[...new Set((S.map||[]).map(r=>r.segmen).filter(Boolean))].sort();
 const seg=opsSelect([['all','Semua segmen'],...segs.map(s=>[s,s]),[UNMAPPED,UNMAPPED]],X.segment,{'aria-label':'Segmen sales type'});seg.onchange=()=>{X.segment=seg.value;rerender()};
 const typeBox=el('div',{style:'min-width:260px'});
 const paintTypes=list=>multiSelectDropdown(typeBox,list.map(n=>({value:n,label:n})),X.picked.filter(n=>list.includes(n)),arr=>{X.picked=arr;rerender()},{allLabel:'Semua sales type'});
 paintTypes(X.picked.slice());
 const top=opsSelect([[10,'Top 10'],[20,'Top 20'],[50,'Top 50'],[0,'Semua']],X.top,{'aria-label':'Jumlah sales type'});top.onchange=()=>{X.top=+top.value;rerender()};
 page.append(el('div',{class:'member-filters-v27'},opsField('Segmen',seg),el('div',{class:'fld'},el('label',{},'Sales type (pilih beberapa / cari)'),typeBox),opsField('Tampilkan',top)));
 const status=el('p',{class:'note'},'Memuat data sales type…');page.append(status);
 let rows;try{rows=await load(y1)}catch(e){status.classList.add('warn');status.textContent='Data sales type belum dapat dimuat: '+e.message;return}
 if(epoch!==EPOCH||S.page!=='salestype'||!page.isConnected)return;
 /* Daftar pilihan = semua sales type pada 3 tahun & toko yang diizinkan (sebelum filter segmen/pilihan). */
 {const ok=new Set((S.stores||[]).filter(s=>storeOk(s.id)).map(s=>Number(s.id))),map=mapOf(),names=new Set();for(const r of rows)if(years.includes(Number(r.year))&&ok.has(Number(r.store_id))){const n=String(r.sales_type||'(kosong)').trim();if(X.segment==='all'||segOf(map,n)===X.segment)names.add(n)}paintTypes([...names].sort((a,b)=>a.localeCompare(b,'id')));}
 const A=aggregate(rows,w,years),tot=y=>A.totals[y]?.net??null,trxT=y=>A.totals[y]?.trx??null;
 const label=y=>{const parts=[];for(let m=w.m1;m<=w.m2;m++){const d=comparisonMonthDays(w,y,m);if(d>0)parts.push(m)}return parts.length?MON3[parts[0]-1]+(parts.length>1?'–'+MON3[parts.at(-1)-1]:'')+' '+y:'—'};
 const [cy,cm]=opsToday().split('-').map(Number);
 status.textContent='Periode: '+years.map(label).join(' · ')+(w.m1<=cm&&cm<=w.m2&&window.SSSG_CURRENT_V52?' · '+SSSG_CURRENT_V52.explain():'')+(X.picked.length?' · '+X.picked.length+' sales type dipilih':'')+' · filter brand/SPV/toko mengikuti filter atas.';
 if(!A.types.length){page.append(el('p',{class:'note'},'Belum ada data sales type pada filter ini.'));return}
 const unm=A.types.filter(t=>t.seg===UNMAPPED&&(t.y[y3]?.net||0)!==0);
 // Ringkasan
 page.append(el('div',{class:'grid g4'},
  tile('Sales type '+y3,money(tot(y3)),label(y3),null),
  tile('Growth '+y3+' vs '+y2,grow(tot(y3),tot(y2)),'GAP '+String(money(tot(y3)==null&&tot(y2)==null?null:(tot(y3)||0)-(tot(y2)||0))),null),
  tile('Growth '+y3+' vs '+y1,grow(tot(y3),tot(y1)),'GAP '+String(money(tot(y3)==null&&tot(y1)==null?null:(tot(y3)||0)-(tot(y1)||0))),null),
  tile('Transaksi '+y3,int(Math.round(trxT(y3)||0)),'AOV '+String(money(trxT(y3)?tot(y3)/trxT(y3):null)),null),
  tile('Sales type aktif '+y3,int(A.types.filter(t=>(t.y[y3]?.net||0)!==0).length),int(A.types.length)+' sales type dalam 3 tahun',null),
  tile('Belum dipetakan',int(unm.length),unm.length?money(unm.reduce((s,t)=>s+(t.y[y3]?.net||0),0))+' pada '+y3+' · atur di Upload Data → Pemetaan':'Semua sales type sudah dipetakan',null)));
 // Grafik
 const months=[];for(let m=w.m1;m<=w.m2;m++)if(years.some(y=>comparisonMonthDays(w,y,m)>0))months.push(m);
 const segNames=[...A.bySeg.keys()].sort((a,b)=>(A.bySeg.get(b)[y3]||0)-(A.bySeg.get(a)[y3]||0));
 const ranked=[...A.types].sort((a,b)=>(b.y[y3]?.net||0)-(a.y[y3]?.net||0));
 page.append(el('div',{class:'grid g2'},
  chartCard('Sales type per bulan · '+years.join(' vs '),'Total seluruh sales type terpilih',groupedBars(months.map(m=>MON3[m-1]),years.map((y,i)=>({name:String(y),color:COLORS[i],vals:months.map(m=>A.byMonth.get(y+'-'+m)||0)})),{h:280})),
  chartCard('Komposisi segmen · '+y3,'Porsi sales berdasarkan Pemetaan Sales Type',donutChart(segNames.map((s,i)=>({name:s,v:Math.max(0,A.bySeg.get(s)[y3]||0),color:s===UNMAPPED?'var(--muted)':COLORS[i%COLORS.length]})),segNames.reduce((s,n)=>s+Math.max(0,A.bySeg.get(n)[y3]||0),0),{centerLabel:'TOTAL'}))));
 page.append(el('div',{class:'grid g2'},
  chartCard('Top 10 sales type · '+y3,'Sales '+label(y3),hBars(ranked.slice(0,10).filter(t=>t.y[y3]).map((t,i)=>({label:t.name,v:t.y[y3].net,color:COLORS[i%COLORS.length]})),{name:'Sales',fmt:v=>String(money(v)),lw:170})),
  chartCard('Growth sales type terbesar · '+y3+' vs '+y2,'10 sales type dengan perubahan terbesar (naik/turun)',hBars([...A.types].map(t=>({t,d:(t.y[y3]?.net||0)-(t.y[y2]?.net||0)})).filter(x=>x.d!==0).sort((a,b)=>Math.abs(b.d)-Math.abs(a.d)).slice(0,10).map(x=>({label:x.t.name,v:x.d,color:x.d<0?'var(--s8)':'var(--s3)'})),{name:'GAP',mode:'div',fmt:v=>String(money(v)),lw:170}))));
 // Tabel per segmen
 const cmp=[y2,y1];
 page.append(card('Sales per segmen · '+years.join(' vs '),'Segmen dari Pemetaan Sales Type · total mengikuti filter',memberTableV27(['Segmen',...years.map(y=>'Sales '+y),...cmp.flatMap(y=>['GAP '+y3+'–'+y,'Growth '+y3+' vs '+y]),'Share '+y3],segNames.map(s=>{const v=A.bySeg.get(s);return [s,...years.map(y=>money(v[y]??null)),...cmp.flatMap(y=>[gap(v[y3]??null,v[y]??null),grow(v[y3]??null,v[y]??null)]),tot(y3)?pctTxt((v[y3]||0)/tot(y3)):'—']}),['TOTAL',...years.map(y=>money(tot(y))),...cmp.flatMap(y=>[gap(tot(y3),tot(y)),grow(tot(y3),tot(y))]),tot(y3)?'100%':'—'],{id:'v52-st-seg'})));
 // Tabel per sales type
 const shown=X.top?ranked.slice(0,X.top):ranked;
 const tyv=(t,y,k='net')=>t.y[y]?t.y[y][k]:null;
 page.append(card('Sales per sales type · '+(X.top?'Top '+X.top+' dari ':'')+ranked.length+' sales type','Urut sales '+y3+'. TOTAL = seluruh sales type hasil filter (bukan hanya yang tampil). AOV = sales ÷ transaksi.',memberTableV27(['Sales type','Segmen','Keterangan',...years.map(y=>'Sales '+y),...cmp.flatMap(y=>['GAP '+y3+'–'+y,'Growth '+y3+' vs '+y]),'Trx '+y3,'AOV '+y3,'Share '+y3],shown.map(t=>[el('b',{},t.name),t.seg,t.info?.keterangan||'—',...years.map(y=>money(tyv(t,y))),...cmp.flatMap(y=>[gap(tyv(t,y3),tyv(t,y)),grow(tyv(t,y3),tyv(t,y))]),int(Math.round(tyv(t,y3,'trx')||0)),money(tyv(t,y3,'trx')?tyv(t,y3)/tyv(t,y3,'trx'):null),tot(y3)?pctTxt((tyv(t,y3)||0)/tot(y3)):'—']),['TOTAL SEMUA (sesuai filter)','','',...years.map(y=>money(tot(y))),...cmp.flatMap(y=>[gap(tot(y3),tot(y)),grow(tot(y3),tot(y))]),int(Math.round(trxT(y3)||0)),money(trxT(y3)?tot(y3)/trxT(y3):null),tot(y3)?'100%':'—'],{id:'v52-st-type'})));
 // Per toko
 if(!years.includes(X.storeYear))X.storeYear=y3;
 const sy=X.storeYear,sSel=opsSelect(years.map(y=>[y,'Tahun '+y]),sy,{'aria-label':'Tahun sales type per toko'});sSel.onchange=()=>{X.storeYear=+sSel.value;rerender()};
 const storeIds=(S.stores||[]).map(s=>Number(s.id)).filter(id=>(A.byStore.get(id)||{})[sy]);
 const sname=new Map((S.stores||[]).map(s=>[Number(s.id),s.name]));
 const rankedSy=[...A.types].sort((a,b)=>(b.y[sy]?.net||0)-(a.y[sy]?.net||0)).filter(t=>t.y[sy]),shownSy=X.top?rankedSy.slice(0,X.top):rankedSy;
 page.append(card('Sales type per toko · '+sy,'Di toko mana setiap sales type terjual. TOTAL = seluruh sales type hasil filter.',el('div',{class:'member-filters-v27'},opsField('Tahun',sSel)),storeIds.length?memberTableV27(['Sales type',...storeIds.map(id=>sname.get(id)||'Toko '+id),'Total '+sy],shownSy.map(t=>[el('b',{},t.name),...storeIds.map(id=>money(t.y[sy].stores[id]??null)),money(t.y[sy].net)]),['TOTAL',...storeIds.map(id=>money(A.byStore.get(id)[sy])),money(tot(sy))],{id:'v52-st-store'}):el('p',{class:'note'},'Belum ada data pada '+sy+'.')));
 // Per bulan
 if(!years.includes(X.monthYear))X.monthYear=y3;
 const my=X.monthYear,mSel=opsSelect(years.map(y=>[y,'Tahun '+y]),my,{'aria-label':'Tahun sales type per bulan'});mSel.onchange=()=>{X.monthYear=+mSel.value;rerender()};
 const mm=months.filter(m=>comparisonMonthDays(w,my,m)>0),rankedMy=[...A.types].sort((a,b)=>(b.y[my]?.net||0)-(a.y[my]?.net||0)).filter(t=>t.y[my]),shownMy=X.top?rankedMy.slice(0,X.top):rankedMy;
 const cell=(t,m,i)=>{const v=t.y[my].months[m]??null,box=el('span',{style:'white-space:nowrap'},money(v));if(i>0){const p=t.y[my].months[mm[i-1]];if(v!=null&&p>0){const g=memberTrendV30((v-p)/p,'percent');g.style.marginLeft='6px';g.style.fontSize='10px';box.append(g)}}return box};
 if(mm.length>1)page.append(card('Pergerakan bulanan sales type · '+my,'Panah = perubahan dari bulan sebelumnya. TOTAL = seluruh sales type hasil filter.',el('div',{class:'member-filters-v27'},opsField('Tahun',mSel)),memberTableV27(['Sales type',...mm.map(m=>MON3[m-1]+' '+my),'Total '+my],shownMy.map(t=>[el('b',{},t.name),...mm.map((m,i)=>cell(t,m,i)),money(t.y[my].net)]),['TOTAL',...mm.map(m=>money(A.byMonth.get(my+'-'+m)??null)),money(tot(my))],{id:'v52-st-month'})));
}
X.render=renderSalesType;

/* Daftarkan menu (setelah SSSG) */
const id='salestype';
if(!PAGES.some(p=>p.id===id)){const i=PAGES.findIndex(p=>p.id==='h2h');PAGES.splice(i<0?PAGES.length:i+1,0,{id,t:'Sales Type',ic:'program'});}
if(!document.querySelector('#p-'+id))document.querySelector('#p-dash').parentElement.append(el('section',{class:'page',id:'p-'+id}));
FILTER_VISIBILITY[id]=['brand','spv','store'];
const before=render;render=function(){if(S.page===id){renderSalesType();return}return before.apply(this,arguments)};
const css=document.createElement('style');css.textContent='#p-salestype .tw table{table-layout:auto!important;width:max-content!important;min-width:100%!important}#p-salestype .tw td{white-space:nowrap}#p-salestype .tw th{white-space:normal!important;min-width:84px}#p-salestype .grid.g2>.card{min-width:0}';document.head.append(css);
buildNav();
})();
