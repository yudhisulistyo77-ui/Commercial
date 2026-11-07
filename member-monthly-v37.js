/* Unified Member monthly view. The monthly RPC enforces PIN, menu/store scope
 * and phone permission on the server. No raw customer profiles in static assets. */
(function(){
 'use strict';
 const M=window.MEMBER_MONTHLY_V37={query:'',kind:'all',count:10,epoch:0};
 async function show(host){
  const epoch=++M.epoch;
  S.month=Number(S.month)||Number(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Makassar'}).format(new Date()).slice(5,7));
  S.monthRange=null;
  host.replaceChildren();
  const years=opsSelect([2024,2025,2026,2027].map(y=>[y,String(y)]),S.year,{'aria-label':'Tahun transaksi member'});
  const months=opsSelect(MONTHS.map((m,i)=>[i+1,m]),S.month,{'aria-label':'Bulan transaksi member'});
  years.onchange=()=>{S.year=+years.value;show(host)};months.onchange=()=>{S.month=+months.value;show(host)};
  const stores=el('div');multiSelectDropdown(stores,S.stores.map(s=>({value:String(s.id),label:s.name})),storeList(),arr=>{S.store=arr.join(',');show(host)},{allLabel:'Semua cabang yang diizinkan'});
  host.append(el('div',{class:'member-filters-v27'},opsField('Tahun',years),opsField('Bulan',months),opsField('Cabang belanja',stores)));
  if (MASTER.session?.user?.role === 'master') {
    const input=el('input',{type:'file',accept:'.csv',hidden:''});
    const message=el('p',{class:'sub',role:'status'});
    const upload=el('button',{type:'button',class:'btn',onclick:()=>input.click()},'Upload Customer List CSV');
    input.onchange=async()=>{
      const file=input.files?.[0];if(!file)return;upload.disabled=true;
      try {
        const aoa=PRICE_ENGINE.csv(await file.text());const names=aoa.shift().map(h=>String(h).trim().toLowerCase().replace(/[^a-z0-9]/g,''));
        const col=(...aliases)=>names.findIndex(h=>aliases.includes(h));
        const category=col('category','kategoricustomer'),status=col('status','statuscustomer');
        const id=col('customerkey','customerid','id'),name=col('name','customername','namacustomer'),city=col('city','kota'),phone=col('phone','customerphone','phone number'.replace(/ /g,''),'telepon','notelp','notelf'),since=col('custsince','customersince','createdat');
        if(id<0||name<0)throw Error('Kolom Customer ID dan Name wajib ada. Profil tidak dicocokkan otomatis berdasarkan nama atau telepon.');
        const seen=new Set(),rows=aoa.filter(r=>r.some(v=>String(v).trim())).map(r=>{
          const key=String(r[id]??'').trim();if(!key||seen.has(key))throw Error('Customer ID kosong/ganda: '+key);seen.add(key);
          const d=since>=0?String(r[since]||'').slice(0,10):'';
          return {customer_key:key,name:String(r[name]||'').trim(),city:city>=0?String(r[city]||'').trim():null,phone:phone>=0?String(r[phone]||'').trim():null,cust_since:/^\d{4}-\d{2}-\d{2}$/.test(d)?d:null,source:{kind:'manual_customer_list',file:file.name,category:category>=0?String(r[category]||'').trim():null,status:status>=0?String(r[status]||'').trim():null}};
        });
        if(!rows.length)throw Error('Tidak ada profil pada file.');
        await masterRpc('commercial_member_profiles_save_v37',{p_rows:rows});show(host);
      }catch(e){message.textContent=e.message}finally{upload.disabled=false;input.value=''}
    };
    host.append(el('div',{class:'rowline',style:'margin:12px 0'},upload,input,message));
  }
  const area=el('div');host.append(area);area.append(el('p',{class:'note'},'Memuat transaksi bulanan…'));
  let data;
  try{data=await masterRpc('commercial_member_view_v38',{p_year:Number(S.year),p_month:Number(S.month),p_stores:storeList().length?storeList().map(Number):null})}
  catch(e){if(epoch===M.epoch&&area.isConnected)area.replaceChildren(el('p',{class:'note warn',role:'alert'},'Transaksi bulanan belum dapat dibaca: '+e.message));return}
  if(epoch!==M.epoch||!area.isConnected||MEM27.view!=='monthly')return;
  area.replaceChildren();
  const query=opsInput(M.query,'search',{'aria-label':'Cari nama kota telepon member',placeholder:'Nama, kota, nomor telepon…'});
  const kind=opsSelect([['all','Semua'],['b2b','B2B · MK…'],['repeat','Repeat ≥2 transaksi'],['single','Aktif tidak repeat · 1 transaksi']],M.kind,{'aria-label':'Frekuensi member'});
  const limit=opsSelect([10,20,50,100].map(n=>[n,n+' customer']),M.count,{'aria-label':'Jumlah Top dan Low member'});
  const controls=el('div',{class:'member-filters-v27'},opsField('Pencarian',query),opsField('Kelompok / frekuensi',kind),opsField('Top / Low',limit));
  const result=el('div');area.append(controls,result);
  function paint(){
   const q=M.query.trim().toLowerCase();const rows=(data.records||[]).filter(r=>(!q||[r.name,r.city,r.phone,r.phone_last4,r.customer_key,...(r.stores||[]).map(s=>s.store)].join(' ').toLowerCase().includes(q))&&(M.kind==='all'||M.kind==='b2b'&&r.is_b2b||M.kind==='repeat'&&r.trx>=2||M.kind==='single'&&r.trx===1));
   result.replaceChildren();
   const net=rows.reduce((s,r)=>s+Number(r.net||0),0),trx=rows.reduce((s,r)=>s+Number(r.trx||0),0);
   result.append(el('div',{class:'grid g4'},tile('Customer',int(rows.length),'pada bulan dan cabang pilihan',null),tile('Repeat',int(rows.filter(r=>r.trx>=2).length),'≥2 transaksi termasuk hari yang sama',null),tile('Aktif tidak repeat',int(rows.filter(r=>r.trx===1).length),'tepat 1 transaksi',null),tile('Revenue member',compact(net),int(trx)+' transaksi',null)));
   if(!data.profile_count)result.append(el('p',{class:'note warn'},'Customer List belum dimuat. Nama memakai transaksi; kota dan telepon lengkap ditandai belum tersedia.'));
   if(!data.pii_allowed)result.append(el('p',{class:'note'},'Akses nomor telepon lengkap tidak diberikan untuk pengguna ini.'));
   const sorted=[...rows].sort((a,b)=>Number(b.net)-Number(a.net)||a.name.localeCompare(b.name,'id'));
   const year=Number(data.year),prior=year-1,older=year-2;
   const history=(r,y)=>y===year?Number(r.net):r.sales_history?.[String(y)]??null;
   const totalYear=(list,y)=>list.every(r=>history(r,y)!=null)?list.reduce((s,r)=>s+Number(history(r,y)),0):null;
   const table=(title,list)=>card(title,MONTHS[Number(data.month)-1]+' '+year+' · histori memakai bulan yang sama dari transaksi Moka; — = cakupan belum lengkap',memberTableV27(['Customer / Profil','Cabang belanja','Transaksi','Frekuensi','Sales '+older,'Sales '+prior,'Sales '+year,'GAP '+year+'–'+prior,'Growth','Last Visit'],list.map(r=>[
    el('div',{},el('b',{},r.name),el('small',{style:'display:block'},[r.city||'Kota belum tersedia',r.phone||(r.phone_last4?'…'+r.phone_last4:'Telepon belum tersedia')].join(' · ')),el('small',{style:'display:block'},'Kategori: '+(r.category||'belum tersedia')+' · Status: '+(r.status||'belum tersedia')+' · Member sejak '+(r.cust_since||'belum tersedia'))),
    (r.stores||[]).map(s=>s.store).join(', '),int(r.trx),r.frequency,history(r,older)==null?'—':compact(history(r,older)),history(r,prior)==null?'—':compact(history(r,prior)),compact(r.net),memberGapV29(Number(r.net),history(r,prior)),memberGrowthV30(Number(r.net),history(r,prior)),r.last_visit||'—'
   ]),['TOTAL DAFTAR','',int(list.reduce((s,r)=>s+Number(r.trx),0)),'',totalYear(list,older)==null?'—':compact(totalYear(list,older)),totalYear(list,prior)==null?'—':compact(totalYear(list,prior)),compact(list.reduce((s,r)=>s+Number(r.net),0)),memberGapV29(totalYear(list,year),totalYear(list,prior)),memberGrowthV30(totalYear(list,year),totalYear(list,prior)),'']));
   const positive=sorted.filter(r=>Number(r.net)>0);result.append(table('Top Customer',positive.slice(0,M.count)),table('Low Customer',positive.slice().reverse().slice(0,M.count)));
   const details=el('details',{},el('summary',{},'Seluruh customer dan rincian cabang · '+rows.length+' customer'));
   details.append(table('Semua customer bulan pilihan',sorted));
   details.append(card('Breakdown per customer × cabang','Transaksi dan revenue aktual per cabang, bukan seluruh revenue customer diulang di setiap toko',memberTableV27(['Customer','Cabang','Transaksi','Revenue','Last Visit'],sorted.flatMap(r=>(r.stores||[]).map(s=>[r.name,s.store,int(s.trx),compact(s.net),s.last_visit||'—'])),['TOTAL','',int(trx),compact(net),''])));
   result.append(details);
  }
  query.oninput=()=>{M.query=query.value;paint()};kind.onchange=()=>{M.kind=kind.value;paint()};limit.onchange=()=>{M.count=+limit.value;paint()};paint();
 }
 if(window.V28)V28.renderMemberTransactions=show;
})();
