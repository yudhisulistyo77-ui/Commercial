/* V90 — Member: kelompok customer MK / RT / Non member (selain MK & RT).
   Siapa customernya, belanja apa saja (item per customer), dan item apa saja yang terjual per kelompok.
   Sumber: Sinkron Member Moka (nota per customer + item per customer). CSV tersedia untuk setiap tabel. */
(function(){'use strict';
if(window.MEMBER_GROUPS_V90)return;
const G={group:'LAINNYA',query:'',page:0,from:'',to:'',epoch:0};
const LABEL={MK:'MK · B2B (kode MK)',RT:'RT · Retail member (kode RT)',LAINNYA:'Non member · selain MK & RT',ALL:'Semua customer'};
const pad=n=>String(n).padStart(2,'0');
function defaults(){const t=opsToday(),y=bazarDateShift(t,-1);if(!G.to){G.to=y;G.from=y.slice(0,8)+'01';}}
const storesArg=()=>{try{const l=typeof storeList==='function'?storeList():[];return l.length?l.map(Number):(typeof scopeStoreIds==='function'?scopeStoreIds():null);}catch{return null;}};
const rpc=args=>masterRpc('commercial_member_groups_v90',{p_from:G.from,p_to:G.to,p_stores:storesArg(),p_group:G.group,p_query:G.query||null,...args});
function csvDownload(rows,name){if(window.TABLE_CSV_V39)TABLE_CSV_V39.download(rows,name);else{const t='﻿'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n'),u=URL.createObjectURL(new Blob([t],{type:'text/csv;charset=utf-8'})),a=el('a',{href:u,download:name+'.csv'});document.body.append(a);a.click();a.remove();}}

async function show(host){
 defaults();const my=++G.epoch;
 const from=opsInput(G.from,'date',{'aria-label':'Dari tanggal'}),to=opsInput(G.to,'date',{'aria-label':'Sampai tanggal'});
 const grp=opsSelect(Object.entries(LABEL),G.group,{'aria-label':'Kelompok customer'});
 const q=opsInput(G.query,'search',{placeholder:'Nama customer, kode, atau item…','aria-label':'Cari customer atau item'});
 const apply=el('button',{class:'btn pri',type:'button'},'Terapkan'),status=el('p',{class:'note',role:'status',style:'display:none'});
 apply.onclick=()=>{if(!from.value||!to.value||from.value>to.value){status.textContent='Periksa rentang tanggal.';status.style.display='';return;}G.from=from.value;G.to=to.value;G.group=grp.value;G.query=q.value.trim();G.page=0;show(host);};
 grp.onchange=()=>apply.click();q.onkeydown=e=>{if(e.key==='Enter')apply.click();};
 const body=el('div',{},el('p',{class:'note'},'Memuat kelompok customer…'));
 host.replaceChildren(el('div',{class:'member-filters-v27'},opsField('Dari',from),opsField('Sampai',to),opsField('Kelompok',grp),opsField('Cari',q)),el('div',{class:'rowline'},apply,el('span',{class:'sub'},'Mengikuti filter Cabang di atas. Pilihan member & kota tidak dipakai di tab ini.')),status,body);
 let d;try{d=await rpc({p_offset:G.page*100,p_limit:100});}catch(e){if(my!==G.epoch)return;body.replaceChildren(el('p',{class:'note warn'},/commercial_member_groups_v90|PGRST202|Could not find/i.test(e.message||'')?'Tabel kelompok customer butuh V90.sql. Jalankan V90.sql di Supabase SQL Editor.':'Kelompok customer belum dimuat: '+e.message));return;}
 if(my!==G.epoch||!host.isConnected)return;
 const sum=d.summary||[],tot=k=>sum.reduce((n,r)=>n+Number(r[k]||0),0);
 const overview=card('Kelompok customer',d.from+' – '+d.to+' · MK = kode MK (B2B) · RT = kode RT (retail member) · Non member = nama tanpa kode MK/RT',
  mkTable([H('KELOMPOK',{s:1}),H('CUSTOMER',{r:1}),H('NOTA',{r:1}),H('NET SALES',{r:1}),H('% NET',{r:1}),H('QTY ITEM',{r:1}),H('JENIS ITEM',{r:1}),''],
   sum.map(r=>[LABEL[r.group]||r.group,int(r.customers),int(r.trx),compact(r.net),tot('net')?(Number(r.net)/tot('net')*100).toLocaleString('id-ID',{maximumFractionDigits:1})+'%':'—',int(r.qty),int(r.items),
     el('button',{class:'btn sm'+(G.group===r.group?' pri':''),type:'button',onclick:()=>{G.group=r.group;G.page=0;show(host);}},'Lihat')]),
   ['TOTAL',int(tot('customers')),int(tot('trx')),compact(tot('net')),'100%',int(tot('qty')),'','']));
 /* customer + belanjaan */
 const custHeads=['CUSTOMER','KODE / KEY','KELOMPOK','CABANG','NOTA','QTY','NET SALES','JENIS ITEM','ITEM YANG DIBELI (qty)','PERTAMA','TERAKHIR'];
 const custRow=r=>[r.name,r.key,r.group,r.stores||'—',int(r.trx),int(r.qty||0),compact(r.net),int(r.item_count||0),el('div',{style:'min-width:280px;max-width:520px;white-space:normal;font-size:12px'},r.items||'—'),r.first_date,r.last_date];
 const pages=Math.max(1,Math.ceil(Number(d.customers_total||0)/100));
 const csvCust=el('button',{class:'btn sm',type:'button',onclick:async e=>{const b=e.currentTarget;b.disabled=true;try{const all=[];for(let at=0;at<d.customers_total;at+=500){const part=await rpc({p_offset:at,p_limit:500});all.push(...(part.customers||[]));}csvDownload([custHeads,...all.map(r=>[r.name,r.key,r.group,r.stores,r.trx,r.qty,r.net,r.item_count,r.items,r.first_date,r.last_date])],'customer-'+G.group+'-'+G.from+'-'+G.to);}catch(err){toast(err.message);}finally{b.disabled=false;}}},'CSV seluruh customer');
 const customers=card('Customer '+(LABEL[d.group]||d.group)+' & belanjaannya',int(d.customers_total)+' customer · net '+compact(d.customers_net||0)+' · '+int(d.customers_trx||0)+' nota · urut net terbesar'+(d.query?' · cari "'+d.query+'"':''),
  el('div',{class:'rowline'},csvCust,el('span',{class:'sub'},'Kolom item menampilkan 12 item dengan nilai terbesar per customer; CSV & tabel item di bawah memuat seluruh item.')),
  mkTable(custHeads.map((h,i)=>H(h,{r:i>=4&&i<=7})),(d.customers||[]).map(custRow)),
  el('div',{class:'rowline'},el('button',{class:'btn sm',type:'button',disabled:G.page===0,onclick:()=>{G.page--;show(host);}},'Sebelumnya'),el('span',{class:'sub'},'Halaman '+(G.page+1)+' / '+pages),el('button',{class:'btn sm',type:'button',disabled:G.page+1>=pages,onclick:()=>{G.page++;show(host);}},'Berikutnya')));
 /* item terjual per kelompok */
 const items=d.items||[],itemNet=items.reduce((n,r)=>n+Number(r.net||0),0);
 const itemHeads=['ITEM · WARNA','KATEGORI','QTY','NET SALES','% NET','PEMBELI'];
 const itemsCard=card('Item yang terjual · '+(LABEL[d.group]||d.group),int(d.items_total)+' item (nama tanpa ukuran) · refund mengurangi'+(d.items_total>items.length?' · tampil '+items.length+' teratas':''),
  el('div',{class:'rowline'},el('button',{class:'btn sm',type:'button',onclick:()=>csvDownload([itemHeads,...items.map(r=>[r.item,r.category,r.qty,r.net,itemNet?r.net/itemNet:'',r.buyers])],'item-'+G.group+'-'+G.from+'-'+G.to)},'CSV item')),
  mkTable(itemHeads.map((h,i)=>H(h,{r:i>=2})),items.map(r=>[r.item,r.category||'—',int(r.qty),compact(r.net),itemNet?(r.net/itemNet*100).toLocaleString('id-ID',{maximumFractionDigits:1})+'%':'—',int(r.buyers)]),['TOTAL','',int(items.reduce((n,r)=>n+Number(r.qty||0),0)),compact(itemNet),'','']));
 const cats=d.categories||[];
 const catCard=card('Kategori yang terjual · '+(LABEL[d.group]||d.group),'ringkasan per kategori Moka',
  mkTable([H('KATEGORI',{s:1}),H('QTY',{r:1}),H('NET SALES',{r:1}),H('JENIS ITEM',{r:1}),H('PEMBELI',{r:1})],cats.map(r=>[r.category,int(r.qty),compact(r.net),int(r.items),int(r.buyers)])));
 const cov=d.coverage||{};
 body.replaceChildren(overview,
  !cov.item_lines?el('p',{class:'note warn'},'Belum ada data item member pada periode ini. Jalankan Sinkron Moka dengan komponen Member.'):el('p',{class:'sub'},'Data item member tersedia '+(cov.first_item||'—')+' s.d. '+(cov.last_item||'—')+'.'),
  customers,el('div',{class:'grid g2'},itemsCard,catCard));
}
window.MEMBER_GROUPS_V90={show,state:G};
})();
