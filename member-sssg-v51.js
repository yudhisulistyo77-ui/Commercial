/* MEMBER V51 — Member menjadi 3 tab tanpa analisa ganda:
   • Ringkasan  : profil & segmentasi (V40) tanpa Top/Low (Top/Low pindah ke SSSG).
   • SSSG       : perbandingan 2/3 tahun dengan cut-off yang sama seperti menu SSSG sales,
                  Top/Low 10/20 dengan acuan kolom tahun, sales per toko, seluruh member + pencarian.
   • Pergerakan bulanan & detail : tren bulanan, retensi, frekuensi, refund + pergerakan bulanan setiap member.
   Filter "Pilih member" berlaku di ketiga tab. Data SSSG diambil per halaman dari server
   (commercial_member_sssg_v51) sehingga tidak menarik seluruh nota/customer ke browser. */
(function(){'use strict';
if(window.MEMBER_SSSG_V51)return;
const PICK=window.MEMBER_PICK_V51={keys:new Set(),names:new Map(),listeners:new Set()};
PICK.list=()=>[...PICK.keys];
PICK.has=k=>!PICK.keys.size||PICK.keys.has(k);
PICK.set=(keys,names)=>{PICK.keys=new Set(keys);for(const [k,n]of names||[])PICK.names.set(k,n);PICK.listeners.forEach(f=>{try{f()}catch(e){console.error(e)}})};
const stores=()=>storeList().length?storeList().map(Number):null;
const money=v=>v==null?'—':compact(v);
const ST=window.MEMBER_SSSG_V51={compare:3,rankYear:0,rank:10,kind:'all',query:'',sort:'top',page:0,limit:50,epoch:0,data:null};

/* ---------- Pilih member (dipakai semua tab) ---------- */
PICK.picker=function(onChange){
 const box=el('div',{class:'mpick-v51'}),input=opsInput('','search',{placeholder:'Ketik min. 2 huruf: nama, kode MK, 4 digit HP…','aria-label':'Cari member untuk dipilih',autocomplete:'off'}),results=el('div',{class:'mpick-results-v51',role:'listbox'}),chips=el('div',{class:'mpick-chips-v51'});
 let timer=null,seq=0;
 const paintChips=()=>{chips.replaceChildren();if(!PICK.keys.size){chips.append(el('span',{class:'sub'},'Semua member (belum ada yang dipilih)'));return}
  for(const k of PICK.keys)chips.append(el('span',{class:'mpick-chip-v51'},PICK.names.get(k)||k,el('button',{type:'button','aria-label':'Hapus '+(PICK.names.get(k)||k),onclick:()=>{const next=new Set(PICK.keys);next.delete(k);PICK.set(next);paintChips();onChange()}},'×')));
  chips.append(el('button',{type:'button',class:'btn sm',onclick:()=>{PICK.set([]);paintChips();onChange()}},'Hapus semua pilihan'));};
 const search=async()=>{const q=input.value.trim(),my=++seq;if(q.length<2){results.replaceChildren();results.hidden=true;return}
  results.hidden=false;results.replaceChildren(el('div',{class:'sub'},'Mencari…'));
  let list=[];try{list=await masterRpc('commercial_member_search_v51',{p_query:q,p_stores:stores(),p_limit:20})}catch(e){if(my===seq)results.replaceChildren(el('div',{class:'note warn'},'Pencarian belum tersedia: '+e.message));return}
  if(my!==seq)return;results.replaceChildren();if(!list?.length){results.append(el('div',{class:'sub'},'Tidak ada member yang cocok.'));return}
  for(const r of list){const on=PICK.keys.has(r.key);results.append(el('button',{type:'button',class:'mpick-opt-v51'+(on?' on':''),role:'option','aria-selected':on?'true':'false',onclick:()=>{const next=new Set(PICK.keys);if(next.has(r.key))next.delete(r.key);else{if(next.size>=200){toast('Maksimal 200 member dipilih.');return}next.add(r.key)}PICK.set(next,[[r.key,r.name||r.key]]);paintChips();search();onChange()}},el('b',{},(on?'✓ ':'')+(r.name||r.key)),el('small',{},[r.last_visit?'Terakhir '+r.last_visit:null,r.net!=null?'Sales '+String(compact(r.net)):null].filter(Boolean).join(' · '))));}
 };
 input.oninput=()=>{clearTimeout(timer);timer=setTimeout(search,350)};
 input.onkeydown=e=>{if(e.key==='Escape'){input.value='';results.hidden=true}};
 results.hidden=true;paintChips();
 box.append(el('div',{class:'fld'},el('label',{},'Pilih member (bisa lebih dari satu) · berlaku di semua tab Member'),input),results,chips);
 return box;
};

/* ---------- Tab SSSG ---------- */
/* GAP/Growth: tahun tanpa transaksi dihitung 0 bila tahun lain punya nilai (mis. tidak belanja 2026 → -100%). */
const z=(a,b)=>a==null&&b==null?[null,null]:[a??0,b??0];
const gapZ=(a,b)=>memberGapV29(...z(a,b)),growZ=(a,b)=>memberGrowthV30(...z(a,b));
function windowArgs(){const st=h2hInit();let w;try{w=comparisonWindow(st)}catch(e){w={mode:'month',m1:st.m1||1,m2:st.m2||12,d1:1,d2:31,alignToCurrent:st.alignToCurrent!==false}}
 return {st,w,y3:h2hCurrentYear()};}
function storeNames(d){return new Map((d.stores||[]).map(s=>[Number(s.id),s.name]))}
function perStore(r,y,id){const v=r.per_store?.[id+':'+y];return v==null?null:Number(v)}
function yearCols(d){return (d.years||[]).map(Number)}
function memberCell(r,rank=null){return el('div',{},el('b',{},(rank?rank+'. ':'')+(r.name||r.key)),el('small',{style:'display:block;opacity:.75'},[r.b2b?'B2B · MK':'Retail / selain MK',r.key&&r.key!==r.name?r.key:null].filter(Boolean).join(' · ')))}

function memberRows(d,list,storeIds,withRank){
 const years=yearCols(d),[yb,ya]=[years.at(-1),years.at(-2)],names=storeNames(d),ry=Number(d.rank_year);
 const heads=['Member','Member sejak','Kota',...(d.pii_allowed?['Telepon']:[]),'Last Visit',...years.map(y=>'Sales '+y+(y===ry?' ★':'')),'GAP '+yb+'–'+ya,'Growth '+yb+' vs '+ya,...storeIds.map(id=>(names.get(id)||'Toko '+id)+' · '+ry)];
 const val=(r,y)=>{const k=y===years.at(-1)?'n3':y===years.at(-1)-1?'n2':'n1';return r[k]==null?null:Number(r[k])};
 const rows=list.map((r,i)=>[memberCell(r,withRank?i+1:null),r.since||'—',r.city||'—',...(d.pii_allowed?[r.phone||'—']:[]),r.last_visit||'—',...years.map(y=>money(val(r,y))),gapZ(val(r,yb),val(r,ya)),growZ(val(r,yb),val(r,ya)),...storeIds.map(id=>money(perStore(r,ry,id)))]);
 const total=(k)=>list.some(r=>r[k]!=null)?list.reduce((s,r)=>s+Number(r[k]||0),0):null;
 const keyOf=y=>y===years.at(-1)?'n3':y===years.at(-1)-1?'n2':'n1';
 const foot=['TOTAL DAFTAR','','',...(d.pii_allowed?['']:[]),'',...years.map(y=>money(total(keyOf(y)))),gapZ(total(keyOf(yb)),total(keyOf(ya))),growZ(total(keyOf(yb)),total(keyOf(ya))),...storeIds.map(id=>{const vals=list.map(r=>perStore(r,ry,id)).filter(v=>v!=null);return money(vals.length?vals.reduce((a,b)=>a+b,0):null)})];
 return {heads,rows,foot};
}
function usedStores(d,lists){const ry=Number(d.rank_year),ids=new Set();for(const list of lists)for(const r of list)for(const k of Object.keys(r.per_store||{})){const [id,y]=k.split(':');if(Number(y)===ry)ids.add(Number(id))}
 const order=(d.stores||[]).map(s=>Number(s.id));return order.filter(id=>ids.has(id));}

async function show(host,opts={}){
 const epoch=++ST.epoch;host.replaceChildren();
 const {st,w,y3}=windowArgs();const rerender=()=>{ST.page=0;show(host,opts)};
 const controls=comparisonControls(st,'msssg',rerender);
 controls.querySelector('#msssg-sales-through')?.closest('.fld')?.remove();
 controls.querySelector('.comparison-method')?.replaceWith(el('p',{class:'note'},'Cut-off sama dengan menu SSSG sales: tahun berjalan dihitung sampai kemarin (WITA). Centang "Samakan batas tanggal" agar tahun pembanding dipotong pada tanggal yang sama. Sales member = net sales nota customer terdaftar Moka (refund mengurangi).'));
 const years3=[y3-2,y3-1,y3],years=ST.compare===2?years3.slice(1):years3;if(!years.includes(ST.rankYear))ST.rankYear=y3;
 const compare=opsSelect([[3,'3 tahun · '+years3.join(' / ')],[2,'2 tahun · '+years3.slice(1).join(' / ')]],ST.compare,{'aria-label':'Perbandingan tahun'});compare.onchange=()=>{ST.compare=+compare.value;rerender()};
 const rankYear=opsSelect(years.map(y=>[y,'Top/Low '+y+' (kolom '+y+' jadi acuan)']),ST.rankYear,{'aria-label':'Acuan Top Low'});rankYear.onchange=()=>{ST.rankYear=+rankYear.value;rerender()};
 const rank=opsSelect([[10,'10 member'],[20,'20 member']],ST.rank,{'aria-label':'Jumlah Top Low'});rank.onchange=()=>{ST.rank=+rank.value;rerender()};
 const kind=opsSelect([['all','Semua member'],['b2b','B2B · kode MK'],['retail','Selain kode MK']],ST.kind,{'aria-label':'Kelompok member'});kind.onchange=()=>{ST.kind=kind.value;rerender()};
 host.append(controls,el('div',{class:'member-filters-v27'},opsField('Perbandingan',compare),opsField('Acuan Top / Low',rankYear),opsField('Top / Low',rank),opsField('Kelompok',kind)));
 const status=el('p',{class:'note',role:'status'},'Memuat SSSG Member…'),result=el('div',{class:'v40-profile-result'});host.append(status,result);
 const base={p_years:[y3],p_m1:w.m1,p_d1:w.d1||1,p_m2:w.m2,p_d2:w.d2||31,p_stores:stores(),p_kind:ST.kind,p_rank:ST.rank,p_align:w.alignToCurrent!==false,p_rank_year:ST.rankYear,p_compare:ST.compare,p_customers:PICK.keys.size?PICK.list():null};
 let d;try{d=await masterRpc('commercial_member_sssg_v51',{...base,p_query:ST.query||null,p_sort:ST.sort,p_limit:ST.limit,p_offset:ST.page*ST.limit})}catch(e){status.classList.add('warn');status.textContent='SSSG Member belum dapat dimuat: '+e.message+'. Jalankan MEMBER-SSSG-V51.sql di Supabase.';return}
 if(epoch!==ST.epoch||!host.isConnected)return;ST.data=d;
 const ys=yearCols(d),ry=Number(d.rank_year),[yb,ya]=[ys.at(-1),ys.at(-2)],periods=d.periods||{},tot=y=>d.totals?.[y]||{};
 const label=y=>{const p=periods[y];return p?p.from.slice(5).split('-').reverse().join('/')+' – '+p.to.slice(5).split('-').reverse().join('/')+'/'+y:''};
 status.textContent='Periode: '+ys.map(label).join(' · ')+(PICK.keys.size?' · '+PICK.keys.size+' member dipilih':'')+(d.pii_allowed?'':' · telepon disembunyikan sesuai izin');
 result.dataset.pngContext=['Member SSSG',ys.map(label).join(' · '),'Acuan Top/Low '+ry,PICK.keys.size?PICK.keys.size+' member dipilih':''].filter(Boolean).join(' · ');
 const partial=ys.filter(y=>!periods[y]?.complete);if(partial.length)result.append(el('p',{class:'note warn'},'Cakupan sinkron Member belum lengkap untuk '+partial.join(', ')+'. Angka = data tersedia; GAP/Growth dibaca sebagai indikasi sampai sinkron lengkap.'));
 // Ringkas per tahun
 result.append(el('div',{class:'grid g4'},...ys.map(y=>tile('Sales member '+y,money(tot(y).net),label(y)+' · '+String(int(tot(y).customers))+' customer · '+String(int(tot(y).trx))+' nota',null)),tile('Growth '+yb+' vs '+ya,growZ(tot(yb).net==null?null:Number(tot(yb).net),tot(ya).net==null?null:Number(tot(ya).net)),'GAP '+(String(money(tot(yb).net==null||tot(ya).net==null?null:Number(tot(yb).net)-Number(tot(ya).net)))),null)));
 // Sales member per toko
 const names=storeNames(d),sy=new Map();for(const r of d.store_year||[]){const k=Number(r.store_id);if(!sy.has(k))sy.set(k,{});sy.get(k)[r.y]=r}
 const storeRows=(d.stores||[]).map(s=>{const m=sy.get(Number(s.id))||{},v=y=>m[y]?Number(m[y].net):null;return {name:s.name,v,c:m[yb]?.customers}}).filter(r=>ys.some(y=>r.v(y)!=null));
 const allNet=y=>tot(y).net==null?null:Number(tot(y).net);
 result.append(card('Sales member per toko · '+ys.join(' vs '),'Cut-off sama untuk setiap tahun · customer lintas toko dihitung di tiap toko tempat belanja',memberTableV27(['Toko',...ys.map(y=>'Sales '+y),'Customer '+yb,'GAP '+yb+'–'+ya,'Growth '+yb+' vs '+ya,...(ys.length===3?['Growth '+yb+' vs '+ys[0]]:[]),'Share '+yb],storeRows.map(r=>[r.name,...ys.map(y=>money(r.v(y))),int(r.c),gapZ(r.v(yb),r.v(ya)),growZ(r.v(yb),r.v(ya)),...(ys.length===3?[growZ(r.v(yb),r.v(ys[0]))]:[]),allNet(yb)?(100*(r.v(yb)||0)/allNet(yb)).toLocaleString('id-ID',{maximumFractionDigits:2})+'%':'—']),['TOTAL',...ys.map(y=>money(allNet(y))),int(tot(yb).customers),gapZ(allNet(yb),allNet(ya)),growZ(allNet(yb),allNet(ya)),...(ys.length===3?[growZ(allNet(yb),allNet(ys[0]))]:[]),allNet(yb)?'100%':'—'],{id:'v51-store'})));
 // Top & Low berdasar kolom acuan
 const sIds=usedStores(d,[d.top||[],d.low||[]]);
 for(const [title,list,sub] of [['Top '+ST.rank+' member · acuan '+ry,d.top||[],'Diurutkan dari sales '+ry+' terbesar (kolom ★). Kolom toko = sales '+ry+' di toko tersebut.'],['Low '+ST.rank+' member · acuan '+ry,d.low||[],'Sales '+ry+' positif terendah (kolom ★); refund/negatif tidak dimasukkan.']]){
  const t=memberRows(d,list,sIds,true);result.append(card(title,sub,list.length?memberTableV27(t.heads,t.rows,t.foot,{id:'v51-'+title.slice(0,3)}):el('p',{class:'note'},'Belum ada member dengan sales '+ry+' pada filter ini.')));
 }
 const itemHost=el('div');result.append(itemHost);items(itemHost,base,d,epoch);
 // Seluruh member (server-side pagination + pencarian)
 const q=opsInput(ST.query,'search',{placeholder:'Cari nama, kode MK, key'+(d.pii_allowed?', telepon':'')+'…','aria-label':'Cari seluruh member'});let qt;q.oninput=()=>{clearTimeout(qt);qt=setTimeout(()=>{ST.query=q.value.trim();ST.page=0;show(host,opts).then(()=>host.querySelector('input[aria-label="Cari seluruh member"]')?.focus())},450)};
 const sort=opsSelect([['top','Sales '+ry+' terbesar'],['low','Sales '+ry+' terkecil'],['growth','GAP '+yb+' naik terbesar'],['decline','GAP '+yb+' turun terbesar'],['last','Last visit terbaru'],['name','Nama A–Z']],ST.sort,{'aria-label':'Urutan seluruh member'});sort.onchange=()=>{ST.sort=sort.value;ST.page=0;show(host,opts)};
 const per=opsSelect([[50,'50 / halaman'],[100,'100 / halaman'],[200,'200 / halaman']],ST.limit,{'aria-label':'Baris per halaman'});per.onchange=()=>{ST.limit=+per.value;ST.page=0;show(host,opts)};
 const pages=Math.max(1,Math.ceil(Number(d.total_rows||0)/ST.limit)),list=d.rows||[],t=memberRows(d,list,usedStores(d,[list]),false);
 const nav=el('div',{class:'rowline'},el('button',{class:'btn',disabled:ST.page===0?'':null,onclick:()=>{ST.page--;show(host,opts)}},'‹ Sebelumnya'),el('span',{class:'sub'},'Halaman '+(ST.page+1)+' / '+pages+' · '+String(int(d.total_rows))+' member'),el('button',{class:'btn',disabled:ST.page+1>=pages?'':null,onclick:()=>{ST.page++;show(host,opts)}},'Berikutnya ›'));
 result.append(card('Seluruh data member · '+String(int(d.total_rows))+' member','Semua member yang bertransaksi pada periode & filter; kolom toko menunjukkan di toko mana member belanja ('+ry+'). Data dimuat per halaman agar ringan.',el('div',{class:'member-filters-v27'},opsField('Cari member',q),opsField('Urutkan',sort),opsField('Baris',per)),list.length?memberTableV27(t.heads,t.rows,t.foot,{id:'v51-all'}):el('p',{class:'note'},'Tidak ada member yang cocok.'),nav));
}
/* ---------- Item yang dibeli member (grup warna, mis. "HITAM 24S") ---------- */
const IT={query:'',limit:50};
async function items(host,base,d,epoch){
 const years=yearCols(d),ry=Number(d.rank_year),[yb,ya]=[years.at(-1),years.at(-2)];
 host.replaceChildren(el('p',{class:'note'},'Memuat item yang dibeli member…'));
 let r;try{r=await masterRpc('commercial_member_items_v51',{p_year:base.p_years[0],p_m1:base.p_m1,p_d1:base.p_d1,p_m2:base.p_m2,p_d2:base.p_d2,p_stores:base.p_stores,p_align:base.p_align,p_compare:base.p_compare,p_customers:base.p_customers,p_kind:base.p_kind,p_query:IT.query||null,p_rank_year:ry,p_limit:IT.limit})}
 catch(e){if(epoch===ST.epoch)host.replaceChildren(el('p',{class:'note warn'},'Analisa item member belum tersedia: '+e.message+'. Jalankan MEMBER-SSSG-V51.sql lalu sinkron Member.'));return}
 if(epoch!==ST.epoch||!host.isConnected)return;host.replaceChildren();
 const cov=r.coverage||{},empty=years.filter(y=>!Number(cov[y]?.lines));
 const v=(g,y,k)=>{const x=g.years?.[y];return x&&x[k]!=null?Number(x[k]):null};
 const q=opsInput(IT.query,'search',{placeholder:'Cari item / warna / kategori…','aria-label':'Cari item member'});let qt;q.oninput=()=>{clearTimeout(qt);qt=setTimeout(()=>{IT.query=q.value.trim();items(host,base,d,epoch).then(()=>host.querySelector('input[aria-label="Cari item member"]')?.focus())},450)};
 const lim=opsSelect([[20,'20 item'],[50,'50 item'],[100,'100 item'],[200,'200 item']],IT.limit,{'aria-label':'Jumlah item'});lim.onchange=()=>{IT.limit=+lim.value;items(host,base,d,epoch)};
 const heads=['Item · grup warna','Kategori',...years.map(y=>'Qty '+y),...years.map(y=>'Sales '+y+(y===ry?' ★':'')),'Member pembeli '+ry,'GAP sales '+yb+'–'+ya,'Growth '+yb+' vs '+ya];
 const groups=r.groups||[];
 const rows=groups.map((g,i)=>[el('b',{},(i+1)+'. '+g.grp),g.category||'—',...years.map(y=>int(v(g,y,'qty'))),...years.map(y=>money(v(g,y,'net'))),int(v(g,ry,'buyers')),gapZ(v(g,yb,'net'),v(g,ya,'net')),growZ(v(g,yb,'net'),v(g,ya,'net'))]);
 const tot=(y,k)=>groups.some(g=>v(g,y,k)!=null)?groups.reduce((s,g)=>s+(v(g,y,k)||0),0):null;
 const foot=['TOTAL DAFTAR','',...years.map(y=>int(tot(y,'qty'))),...years.map(y=>money(tot(y,'net'))),'',gapZ(tot(yb,'net'),tot(ya,'net')),growZ(tot(yb,'net'),tot(ya,'net'))];
 const note=empty.length?el('p',{class:'note warn'},'Data item untuk '+empty.join(', ')+' belum ada. Item per member mulai tercatat sejak sinkron Member V51; jalankan sinkron Member untuk bulan/tahun tersebut agar perbandingan 3 tahun lengkap.'):null;
 host.append(card('Item yang dibeli member · per warna · acuan '+ry,'Ukuran (S–5XL) dan lengan (PDK/PJG) digabung per warna, mis. "HITAM 24S". Qty & sales item = nilai baris item Moka (refund mengurangi). '+String(int(r.total_groups))+' grup item.',note,el('div',{class:'member-filters-v27'},opsField('Cari item',q),opsField('Tampilkan',lim)),groups.length?memberTableV27(heads,rows,foot,{id:'v51-items'}):el('p',{class:'note'},'Belum ada item pada filter ini.')));
 if(PICK.keys.size){
  const ms=r.members||[],mh=['Member','Item · grup warna','Kategori',...years.map(y=>'Qty '+y),...years.map(y=>'Sales '+y+(y===ry?' ★':'')),'Growth '+yb+' vs '+ya];
  const mr=ms.map(m=>[el('b',{},m.name),m.grp,m.category||'—',...years.map(y=>int(v(m,y,'qty'))),...years.map(y=>money(v(m,y,'net'))),growZ(v(m,yb,'net'),v(m,ya,'net'))]);
  host.append(card('Item per member terpilih · '+PICK.keys.size+' member','Maksimal 30 grup item teratas per member (acuan sales '+ry+'). Pergerakan tahunan per item untuk melihat yang sering dibeli.',ms.length?memberTableV27(mh,mr,[],{id:'v51-member-items'}):el('p',{class:'note'},'Member terpilih belum memiliki data item pada periode ini.')));
 } else host.append(el('p',{class:'note'},'Tip: pilih satu atau beberapa member di kotak "Pilih member" untuk melihat item apa saja yang mereka beli per tahun.'));
}

ST.show=show;

/* ---------- CSS ---------- */
const css=document.createElement('style');css.textContent=`
.mpick-v51{display:grid;gap:8px;margin:10px 0 4px;padding:12px;border:1px solid var(--line,#d9e1ec);border-radius:12px;background:var(--panel,#fff);position:relative}
.mpick-v51 input[type=search]{width:100%;max-width:520px}
.mpick-results-v51{display:grid;gap:4px;max-height:260px;overflow:auto;max-width:620px;border:1px solid var(--line,#d9e1ec);border-radius:10px;padding:6px;background:var(--panel,#fff)}
.mpick-opt-v51{display:flex;justify-content:space-between;gap:12px;text-align:left;border:0;background:transparent;padding:7px 9px;border-radius:8px;cursor:pointer;color:inherit}
.mpick-opt-v51:hover,.mpick-opt-v51.on{background:color-mix(in srgb,var(--accent,#2f6fed) 12%,transparent)}
.mpick-opt-v51 small{opacity:.7;white-space:nowrap}
.mpick-chips-v51{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.mpick-chip-v51{display:inline-flex;align-items:center;gap:6px;padding:3px 4px 3px 10px;border-radius:999px;background:color-mix(in srgb,var(--accent,#2f6fed) 14%,transparent);font-size:12px;font-weight:600}
.v40-profile-result td{white-space:nowrap}
.v40-profile-result td:first-child b,.v40-profile-result td b{white-space:normal}
.v40-profile-result td:has(> div > b){min-width:220px;white-space:normal}
.mpick-chip-v51 button{border:0;background:transparent;cursor:pointer;font-size:15px;line-height:1;color:inherit;padding:0 4px}
#p-members .v40-profile-result td:has(> div > b){min-width:220px;white-space:normal}
#p-members .v40-profile-result td{white-space:nowrap}
#p-members .v40-profile-result table{table-layout:auto!important;width:max-content!important;min-width:100%!important}
#p-members .v40-profile-result th,#p-members .v40-profile-result td{width:auto!important;max-width:none!important}
#p-members .v40-profile-result th{white-space:normal!important;min-width:84px}
#p-members .v40-profile-result td .member-trend-v30{white-space:nowrap}
`;document.head.append(css);
})();
