(function(){'use strict';
const U=window.STOCK78,A=window.STOCK80={epoch:0,state:null};
const labels={stockout30:'Habis tetapi laku · 30 hari',nonmoving30:'Tidak terjual · 30 hari',overstock30:'Stok >90 hari pada laju 30 hari',negative:'Stok minus · audit',unknown:'Belum terverifikasi'};
const num=v=>v==null?'—':Number(v).toLocaleString('id-ID',{maximumFractionDigits:2});
const table=(heads,rows)=>mkTable(heads.map(h=>H(h)),rows),button=(text,fn)=>el('button',{class:'btn sm',type:'button',onclick:fn},text);
const storeHeads=['Toko / DC','Jenis','Awal','Masuk bersih','Terjual 30 hari','Retur/adj.','Akhir','Cukup hari','Sell-through %','Habis/laku','Tidak terjual','Belum diketahui qty/demand','Sales s.d.'];
const copy=x=>JSON.parse(JSON.stringify(x));
function request(s,offset=0){return{p_stores:s.stores.length?s.stores.map(Number):null,p_filters:{brands:s.brands,categories:s.categories,conditions:s.conditions,query:s.query,include_nonproduct:s.include_nonproduct,history_from:s.history_from||null,history_to:s.history_to||null,...s.exact},p_offset:offset};}
const read=(s,offset=0)=>masterRpc('commercial_stock_analysis_v80',request(s,offset));
function narrowed(s,kind,value){const next=copy(s);next.page=0;if(kind==='store')next.stores=[String(value)];else if(kind==='condition')next.conditions=[value];else if(kind==='brand')next.brands=[value];else if(kind==='category')next.categories=[value];return next;}
function groupRows(d,s){return d.groups.filter(g=>g.kind==='store').map(g=>[
 button(g.store_name,()=>drill(narrowed(s,'store',g.store_id),g.store_name)),g.is_dc?'DC':'Toko',num(g.opening),num(g.incoming),num(g.sold30),num(g.adjustment),num(g.qty),
 num(!g.unknown_qty&&!g.unknown_demand&&g.sold30>0?Math.max(0,g.qty)*30/g.sold30:null),
 num(!g.unknown_qty&&!g.unknown_demand&&!g.negative&&g.eligible_sales+g.eligible_qty>0?g.eligible_sales*100/(g.eligible_sales+g.eligible_qty):null),
 button(num(g.stockout30),()=>drill(narrowed(narrowed(s,'store',g.store_id),'condition','stockout30'),g.store_name+' · habis/laku')),
 button(num(g.nonmoving30),()=>drill(narrowed(narrowed(s,'store',g.store_id),'condition','nonmoving30'),g.store_name+' · tidak terjual')),
 num(g.unknown_qty)+' / '+num(g.unknown_demand),g.cutoff_from===g.cutoff_to?g.cutoff_to:g.cutoff_from+' – '+g.cutoff_to]);}
function history(d,s){
 const node=el('div',{class:'stock80-history'});
 if(!d.history.length){node.append(el('p',{class:'note'},s.query||s.exact?.sku||s.conditions.length?'Histori agregat tidak tersedia untuk pencarian, kondisi atau SKU tertentu. Kosongkan filter tersebut untuk melihat tren toko/brand/kategori.':'Histori Inventory Summary akan terbentuk setelah V81 terpasang. Data masa lalu tidak direkonstruksi.'));return node;}
 const recorded=[...new Set(d.history.map(x=>x.snapshot_day))].sort(),days=[];
 for(let day=new Date(recorded[0]+'T12:00:00Z');day.toISOString().slice(0,10)<=recorded.at(-1);day.setUTCDate(day.getUTCDate()+1))days.push(day.toISOString().slice(0,10));
 const stores=s.stores.length?s.stores.map(Number):d.groups.filter(x=>x.kind==='store').map(x=>x.store_id);
 // Never sum different dates or treat a missing store/day as zero.
 const complete=days.map(day=>{const rows=d.history.filter(x=>x.snapshot_day===day);return rows.length===stores.length&&rows.every(x=>!x.unknown_qty)?rows.reduce((a,x)=>a+Number(x.qty),0):null;});
 const chart=el('div'),grain=el('select',{'aria-label':'Tampilan tren snapshot'},el('option',{value:'daily'},'Harian'),el('option',{value:'monthly'},'Bulanan · snapshot terakhir tersedia'));
 grain.value='daily';const draw=()=>{let labels=days,values=complete;if(grain.value==='monthly'){const selected=new Map();days.forEach((day,i)=>{if(complete[i]!=null)selected.set(day.slice(0,7),i)});labels=[...selected.keys()];values=[...selected.values()].map(i=>complete[i]);}else labels=days.map(x=>days[0].slice(0,7)===days.at(-1).slice(0,7)?x.slice(8):x);chart.replaceChildren(lineChart(labels,values,{fmt:num,h:220}));};grain.onchange=draw;draw();node.append(grain,chart);
 node.append(el('p',{class:'sub'},'Posisi stok pada waktu snapshot, bukan mutasi barang masuk/transfer/retur. Tanggal tanpa snapshot tidak dianggap nol.'),table(['Tanggal snapshot','Toko','Stok tercatat','Qty belum diketahui','Waktu WITA'],d.history.map(x=>[x.snapshot_day,button(x.store_name,()=>drill(narrowed(s,'store',x.store_id),x.store_name)),num(x.qty),num(x.unknown_qty),new Date(x.snapshot_at).toLocaleString('id-ID',{timeZone:'Asia/Makassar'})])));return node;
}
function sourceColumns(r){const{box}=opsModal('Kolom Inventory Summary · '+r.item_name);box.append(table(['Kolom sumber','Nilai'],Object.entries(r.source_columns||{}).map(([k,v])=>[k,String(v??'—')])));}
function items(d,s,page,reload){return el('div',{},table(['Item / SKU','Toko','Stok','Terjual 30 hari','Rata-rata/hari','Cukup hari','Sell-through %','14 hari','14 hari sebelumnya','Kondisi',''],d.rows.map(r=>[
 button(r.item_name,()=>item(r,s)),r.store_name,num(r.qty),r.demand30_known?num(r.sold30):'—',r.demand30_known?num(r.sold30/30):'—',num(r.cover30),num(r.sellthrough30),r.demand_known?num(r.sold14):'—',r.demand_known?num(r.prior14):'—',r.conditions30.map(x=>labels[x]).join(' · ')||'Tersedia',el('div',{class:'rowline'},button('Lintas toko',()=>item(r,s)),button('Kolom Summary',()=>sourceColumns(r)))
 ])),el('div',{class:'rowline'},el('button',{class:'btn',disabled:page===0,onclick:()=>reload(page-1)},'Sebelumnya'),el('span',{},num(d.total)+' baris · '+(page+1)+' / '+Math.max(1,Math.ceil(d.total/100))),el('button',{class:'btn',disabled:(page+1)*100>=d.total,onclick:()=>reload(page+1)},'Berikutnya')));}
function item(r,s){if(!r.sku){const{box}=opsModal(r.item_name);box.append(el('p',{class:'note warn'},'SKU kosong: pencocokan lintas toko tidak dilakukan.'));return;}
 const scope=copy(s);scope.stores=[];scope.conditions=[];scope.query='';scope.exact={sku:r.sku,fingerprint:r.fingerprint};
 drill(scope,r.item_name+' · lintas toko yang diizinkan');
}
function dcPanel(initial,s){const host=el('div');let serial=0;
 async function paint(d,page=0){host.replaceChildren();if(!d.dc_total){host.append(el('p',{class:'note'},'Tidak ada kecocokan SKU/variant di DC yang diizinkan untuk hasil filter ini. Tidak diasumsikan stok DC nol.'));return;}
 host.append(el('p',{class:'note'},'Ketersediaan item yang sama di DC yang diizinkan, termasuk DC di luar pilihan lokasi. Ini konteks pasokan; tidak ditambahkan lagi ke total kondisi toko. Periksa tanggal sebelum TF.'),table(['DC','Item / SKU','Awal','Masuk bersih','Terjual','Retur/adj.','Akhir','Cakupan'],(d.dc_rows||[]).map(r=>[r.store_name,button(r.item_name+' · '+r.sku,()=>item(r,s)),num(r.opening),num(r.incoming),num(r.sold30),num(r.adjustment),num(r.qty),r.cutoff])),el('div',{class:'rowline'},el('button',{class:'btn',disabled:page===0,onclick:()=>load(page-1)},'DC sebelumnya'),el('span',{},num(d.dc_total)+' baris DC · '+(page+1)+' / '+Math.ceil(d.dc_total/100)),el('button',{class:'btn',disabled:(page+1)*100>=d.dc_total,onclick:()=>load(page+1)},'DC berikutnya')));
 }
 async function load(page){const ticket=++serial;try{const query=copy(s);query.exact={...query.exact,dc_offset:page*100};const d=await read(query);if(ticket===serial&&host.isConnected)paint(d,page);}catch(e){if(ticket===serial)host.replaceChildren(el('p',{class:'note warn'},e.message));}}
 paint(initial);return host;
}
async function drill(s,title){const{box}=opsModal(title),body=el('div',{class:'stock80-detail'});box.append(body);let serial=0;
 async function load(page=0){const ticket=++serial;body.replaceChildren(el('p',{class:'note'},'Memuat rincian…'));try{const d=await read(s,page*100);if(ticket!==serial||!body.isConnected)return;
 body.replaceChildren(el('p',{class:'note'},'Rentang penjualan = 30 hari sampai tanggal cakupan masing-masing toko. Klik toko untuk mempersempit; lintas toko mengikuti izin akun.'),table(storeHeads,groupRows(d,s)),items(d,s,page,load),card('DC · item terkait kondisi toko','Pencocokan SKU dan fingerprint persis · mengikuti izin akun',dcPanel(d,s)));
 if(!s.exact?.sku&&!s.conditions.length&&!s.query)body.append(card('Pergerakan posisi stok','Snapshot tersimpan sejak V80 · toko/brand/kategori yang dipilih',history(d,s)));
 if(s.exact?.sku)body.append(card('Perbandingan penjualan item','Dua periode berurutan; bukan mutasi inventory.',table(['Toko','14 hari sebelumnya','14 hari terakhir','Selisih qty'],d.rows.map(x=>[x.store_name,x.demand_known?num(x.prior14):'—',x.demand_known?num(x.sold14):'—',x.demand_known?num(x.sold14-x.prior14):'—']))));
 }catch(e){if(ticket===serial&&body.isConnected)body.replaceChildren(el('p',{class:'note warn'},e.message));}}
 await load();
}
A.show=async function(host){const epoch=++A.epoch;if(!A.state)A.state={stores:U.state.stores.slice(),brands:U.state.brands.slice(),categories:U.state.categories.slice(),conditions:[],query:U.state.query,include_nonproduct:false,history_from:'',history_to:'',exact:{}};
 const s=A.state;host.append(button('← Stock & Distribusi',()=>{U.state.tab='overview';U.show();}));const body=el('div',{class:'stock80-body'});host.append(body);body.append(el('p',{class:'note'},'Memuat analisis Stock 30 hari…'));
 let d;try{d=await read(s);}catch(e){body.replaceChildren(el('p',{class:'note warn'},'Analisis Stock belum tersedia: '+e.message+' · Pasang SQL V80 setelah V79, lalu jalankan sinkron Stock.'));return;}
 if(epoch!==A.epoch||!host.isConnected||S.page!=='stock'||U.state.tab!=='analysis30')return;body.replaceChildren();
 const form=el('form',{class:'card stock78-filters'}),draft=copy(s);
 function pick(key,label,opts){const box=el('div');multiSelectDropdown(box,opts.map(x=>({value:String(x[0]),label:String(x[1])})),draft[key],v=>{draft[key]=v;},{allLabel:'Semua'});form.append(opsField(label,box));}
 pick('stores','Toko / DC',d.locations.map(x=>[x.store_id,x.name]));pick('brands','Brand',d.facets.brands.map(x=>[x.brand,x.brand]));pick('categories','Kategori',d.facets.categories.map(x=>[x.category,x.category]));pick('conditions','Kondisi 30 hari',Object.entries(labels));
 const query=opsInput(s.query,'search',{placeholder:'SKU, item atau toko'}),from=opsInput(s.history_from,'date',{}),to=opsInput(s.history_to,'date',{}),other=el('input',{type:'checkbox'});other.checked=s.include_nonproduct;
 form.append(opsField('Cari',query),opsField('Histori snapshot dari',from),opsField('Sampai',to),el('label',{},other,' Sertakan kemasan/jasa'),el('button',{class:'btn pri',type:'submit'},'Terapkan'),button('Reset',()=>{A.state=null;U.state.stores=[];U.state.brands=[];U.state.categories=[];U.state.query='';U.show();}));
 form.onsubmit=e=>{e.preventDefault();if(from.value&&to.value&&from.value>to.value){toast('Rentang histori tidak valid');return;}Object.assign(s,draft,{query:query.value.trim(),history_from:from.value,history_to:to.value,include_nonproduct:other.checked});U.show();};body.append(form);
 const a=d.summary;body.append(el('p',{class:'note'},'Sumber analisis: '+(a.source||'Moka Inventory Summary')+'. Posisi stok akhir dan pergerakan = periode 30 hari s.d. '+(a.cutoff_from===a.cutoff_to?(a.cutoff_to||'belum tersedia'):a.cutoff_from+' – '+a.cutoff_to+' (cakupan antar toko berbeda)')+'. Histori tanggal hanya memfilter snapshot, bukan mengubah rentang penjualan 30 hari.'));
 const complete=!a.unknown_qty&&!a.unknown_demand&&a.cutoff_from===a.cutoff_to;const cover=complete&&a.sold30>0?Math.max(0,a.qty)*30/a.sold30:null,sell=complete&&!a.negative&&a.qty>=0&&a.qty+a.sold30>0?a.sold30*100/(a.qty+a.sold30):null;
 if(d.summary_ready===false)body.append(el('p',{class:'note warn'},'Summary belum berhasil ditarik; data V80 sebelumnya tetap tersedia. Kolom pergerakan yang belum tersedia ditampilkan —. Jalankan worker terbaru dan periksa artifact stock-summary-schema bila diperlukan.'));
 const tiles=el('div',{class:'grid g4'});for(const [title,value,condition]of[['Total stok · toko + DC',a.qty,null],['Terjual 30 hari · toko',a.sold30,null],['Stok cukup · hari',cover,null],['Sell-through · %',sell,null],['Masuk bersih · seluruh lokasi',a.incoming,null],['Retur & penyesuaian',a.adjustment,null],['Habis tetapi masih laku',a.stockout30,'stockout30'],['Tidak terjual 30 hari',a.nonmoving30,'nonmoving30'],['Stok berlebih >90 hari',a.overstock30,'overstock30'],['Stok minus · audit',a.negative,'negative']]){
 const t=tile(title,num(value),'Klik untuk melihat toko dan item',null);t.append(button('Lihat rincian',()=>drill(condition?narrowed(s,'condition',condition):copy(s),title)));tiles.append(t);}body.append(tiles,el('p',{class:'sub'},'Awal + masuk bersih − terjual ± retur/penyesuaian = akhir. Masuk bersih bukan otomatis PO; komponen transfer mengikuti kolom asli Summary. Total kondisi habis/laku dan tidak terjual dihitung pada toko; klik untuk melihat item terkait di toko dan DC.'));
 if(a.unknown_qty||a.unknown_demand)body.append(el('p',{class:'note warn'},num(a.unknown_qty)+' qty belum diketahui · '+num(a.unknown_demand)+' demand 30 hari belum terverifikasi. Total yang tersedia bersifat parsial; data kosong tidak dianggap nol.'));
 body.append(card('Pergerakan stok per outlet · 30 hari','Klik toko atau jumlah kondisi untuk rincian. Kecukupan dan sell-through hanya dihitung jika data grup lengkap.',table(storeHeads,groupRows(d,s))));
 for(const[k,title]of[['brand','Stok per brand · toko + DC'],['category','Stock per kategori']])body.append(card(title,'Klik untuk melihat kontribusi toko dan rincian item',table([k==='brand'?'Brand':'Kategori','Stok','Terjual 30 hari','Habis/laku','Tidak terjual'],d.groups.filter(x=>x.kind===k).map(g=>[button(g[k]||'(Kosong)',()=>drill(narrowed(s,k,g[k]),g[k]||'(Kosong)')),num(g.qty),num(g.sold30),num(g.stockout30),num(g.nonmoving30)]))));
 body.append(card('Pergerakan posisi stok','Riwayat snapshot harian · tidak mencampurkan stok dari dua aplikasi',history(d,s)),el('p',{class:'note'},'Analisis Inventory Summary memakai posisi akhir periode, sedangkan Potensi TF V79 memakai snapshot katalog terbaru. Periksa tanggal dan kolom Summary sebelum menjalankan distribusi. Tidak ada transfer otomatis.'));
};
const css=document.createElement('style');css.textContent='.stock80-body,.stock80-detail{display:grid;gap:18px;margin-top:16px;min-width:0}.stock80-body .card,.stock80-detail .card{min-width:0;margin:0}.stock80-body .tile{min-width:0;height:auto}.stock80-body .tw,.stock80-detail .tw{max-width:100%;overflow:auto}.stock80-detail{max-width:100%}@media(max-width:600px){.stock80-body,.stock80-detail{gap:12px}.stock80-body .grid{grid-template-columns:repeat(2,minmax(0,1fr))}}';document.head.append(css);
})();
