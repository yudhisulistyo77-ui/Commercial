/* CMC V59: presentation only. No database calls, data rewriting, or auth changes. */
(function(){
'use strict';
if(window.UI59)return;
const U=window.UI59={version:59},root=document.documentElement;
root.dataset.uiVersion='59';
const dark=window.matchMedia('(prefers-color-scheme: dark)'),reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
let motion=true;try{motion=localStorage.getItem('cmc_ui_motion_v59')!=='off';}catch{}
function syncAppearance(){
 const theme=root.getAttribute('data-theme');root.dataset.uiTone=theme==='dark'||(!theme&&dark.matches)?'dark':'light';
 root.dataset.uiMotion=motion&&!reduced.matches?'on':'off';root.dataset.uiPaused=String(document.hidden);
 document.querySelectorAll('[data-ui59-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.ui59Theme===root.dataset.uiTone)));
 document.querySelectorAll('[data-ui59-motion]').forEach(b=>{b.textContent=reduced.matches?'Gerakan dibatasi':motion?'Gerakan aktif':'Gerakan nonaktif';b.disabled=reduced.matches;b.setAttribute('aria-pressed',String(root.dataset.uiMotion==='on'));b.title=reduced.matches?'Mengikuti pengaturan kurangi gerakan pada perangkat':'Hidupkan atau matikan efek gerak ringan';});
 const themeButton=document.querySelector('#themebtn');if(themeButton)themeButton.title='Tema '+(root.dataset.uiTone==='dark'?'gelap':'terang')+' · tekan untuk mengganti';
}
U.setTheme=function(theme){if(!['light','dark',''].includes(theme))return;if(typeof applyTheme==='function')applyTheme(theme);else if(theme)root.dataset.theme=theme;else root.removeAttribute('data-theme');if(typeof save==='function')save('theme',theme);syncAppearance();};
U.setMotion=function(value){motion=!!value;try{localStorage.setItem('cmc_ui_motion_v59',motion?'on':'off');}catch{}syncAppearance();};
if(typeof applyTheme==='function'){const original=applyTheme;applyTheme=function(...args){const value=original.apply(this,args);syncAppearance();return value;};}
dark.addEventListener('change',syncAppearance);reduced.addEventListener('change',syncAppearance);document.addEventListener('visibilitychange',syncAppearance);
new MutationObserver(syncAppearance).observe(root,{attributes:true,attributeFilter:['data-theme']});
syncAppearance();
if(typeof uiPreferencesCard==='function'){const original=uiPreferencesCard;uiPreferencesCard=function(...args){const card=original.apply(this,args),button=el('button',{type:'button',class:'btn sm','data-ui59-motion':'',onclick:()=>U.setMotion(!motion)});card.append(el('div',{class:'rowline',style:'margin-top:14px'},el('span',{class:'note'},'Efek gerak ringan'),button));requestAnimationFrame(syncAppearance);return card;};}
const rail=document.querySelector('#rail');
const backdrop=el('button',{type:'button',class:'ui59-rail-backdrop','aria-label':'Tutup menu',hidden:'',onclick:()=>{rail?.classList.remove('open');document.querySelector('#railtog')?.focus();}});document.body.append(backdrop);
function syncRail(){if(!rail)return;const mobile=window.innerWidth<=900,open=rail.classList.contains('open');rail.inert=mobile&&!open;if(mobile&&!open)rail.setAttribute('aria-hidden','true');else rail.removeAttribute('aria-hidden');backdrop.hidden=!mobile||!open||!!document.querySelector('#login-v38');}
if(rail)new MutationObserver(syncRail).observe(rail,{attributes:true,attributeFilter:['class']});window.addEventListener('resize',syncRail);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&innerWidth<=900&&rail?.classList.contains('open')){rail.classList.remove('open');document.querySelector('#railtog')?.focus();}});syncRail();
function controls(){const bar=el('div',{class:'ui59-login-controls','aria-label':'Tampilan login'});for(const [value,label]of [['light','☀ Terang'],['dark','☾ Gelap']])bar.append(el('button',{type:'button',class:'btn sm','data-ui59-theme':value,onclick:()=>U.setTheme(value)},label));bar.append(el('button',{type:'button',class:'btn sm','data-ui59-motion':'',onclick:()=>U.setMotion(!motion)}));return bar;}
const ART=`<svg class="ui59-login-art" viewBox="0 0 400 190" aria-hidden="true" focusable="false">
<path d="M40 128 C100 128 100 50 178 50 S260 144 352 70" fill="none" stroke="var(--accent)" stroke-width="2.5" opacity=".7"/>
<path d="M40 151 C100 151 100 82 178 82 S260 168 352 102" fill="none" stroke="var(--accent)" stroke-width="1" opacity=".17"/>
<g fill="var(--surface)" stroke="var(--line)"><rect x="9" y="102" width="89" height="61" rx="13"/><rect x="143" y="18" width="91" height="69" rx="13"/><rect x="302" y="38" width="89" height="70" rx="13"/></g>
<g fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="1.2"><circle cx="53" cy="122" r="7"/><circle cx="188" cy="42" r="8"/><circle cx="347" cy="63" r="8"/></g>
<g fill="var(--ink-2)" font-family="var(--font-ui)" font-size="9" font-weight="600" text-anchor="middle"><text x="53" y="146">Sales</text><text x="188" y="68">Member</text><text x="347" y="90">Toko</text></g>
<g fill="var(--accent)"><circle cx="119" cy="82" r="4"/><circle cx="274" cy="107" r="4"/></g>
<g fill="var(--muted)" opacity=".25"><circle cx="107" cy="30" r="2"/><circle cx="274" cy="24" r="2"/><circle cx="227" cy="160" r="2"/><circle cx="365" cy="148" r="2"/></g></svg>`;
function decorateLogin(gate){
 if(!gate||gate.dataset.ui59Login)return;
 const shell=gate.querySelector(':scope >.card'),form=shell?.querySelector('form');if(!shell||!form)return;
 gate.dataset.ui59Login='true';shell.classList.add('ui59-login-shell','ui59-enter');
 const hero=el('section',{class:'ui59-login-hero','aria-label':'Commercial Tigalapan'}),brand=el('div',{class:'ui59-login-brand'});
 const logo=document.querySelector('.brand .mk img');if(logo){const copy=logo.cloneNode(false);copy.alt='CMC';brand.append(copy);}
 brand.append(el('div',{},'COMMERCIAL',el('small',{},'Tigalapan Indonesia')));
 const words=el('div',{},el('h2',{},'Semua cabang. ',el('span',{},'Satu pandangan.')),el('p',{},'Pantau performa sales, kenali pelanggan, dan tentukan langkah berikutnya.'));
 const art=el('div',{'aria-hidden':'true',html:ART});hero.append(brand,words,art,el('div',{class:'ui59-login-foot'},el('i',{}),'Commercial management center'));
 const pane=el('div',{class:'ui59-login-form'}),heading=shell.querySelector(':scope >h1')||el('h1',{});heading.textContent='Selamat datang kembali';
 const description=shell.querySelector(':scope >p')||el('p',{});description.textContent='Masuk ke ruang kerja Anda dengan akun dari Master.';pane.append(heading,description,form);shell.replaceChildren(hero,pane);gate.prepend(controls());
 const password=form.querySelector('input[type=password]');if(password){const field=password.closest('.fld');if(field){field.classList.add('ui59-password-field');const toggle=el('button',{type:'button',class:'ui59-password-toggle','aria-label':'Tampilkan password','aria-pressed':'false',onclick:()=>{const show=password.type==='password';password.type=show?'text':'password';toggle.textContent=show?'Tutup':'Lihat';toggle.setAttribute('aria-label',show?'Sembunyikan password':'Tampilkan password');toggle.setAttribute('aria-pressed',String(show));}},'Lihat');field.append(toggle);}}
 syncAppearance();
}
U.trendFor=function(label,text){
 if(!/growth|pertumbuhan|gap|selisih|perubahan|kenaikan|penurunan/i.test(label)||!/\d/.test(text))return null;
 const digits=String(text).replace(/[^0-9]/g,'');if(digits&&!/[1-9]/.test(digits))return 'flat';
 return /[-−]\s*(?:Rp\s*)?\d|\([^)]*\d[^)]*\)/i.test(text)?'down':'up';
};
const seenCards=new WeakSet(),seenTables=new WeakSet();
function decorate(scope){
 const shell=document.querySelector('#shell'),gate=document.querySelector('#login-v38');if(shell){if(gate){shell.inert=true;shell.dataset.ui59Inert='true';}else if(shell.dataset.ui59Inert){shell.inert=false;delete shell.dataset.ui59Inert;}}
 decorateLogin(document.querySelector('#login-v38'));
 for(const tile of scope.querySelectorAll('.tile')){const trend=U.trendFor(tile.querySelector('.k')?.textContent||'',tile.querySelector('.v')?.textContent||'');if(trend)tile.dataset.ui59Trend=trend;else delete tile.dataset.ui59Trend;}
 for(const node of [...scope.querySelectorAll('.tile,:scope >.card')].slice(0,32)){if(!seenCards.has(node)){seenCards.add(node);if(root.dataset.uiMotion==='on')node.classList.add('ui59-enter');}}
 for(const table of scope.querySelectorAll('table')){if(seenTables.has(table))continue;seenTables.add(table);const count=table.tHead?.rows[0]?.cells.length||table.rows[0]?.cells.length||1;table.style.setProperty('--ui59-table-min',(count<=4?460:count<=7?660:count<=10?900:1100)+'px');}
}
// Preserve chart values and geometry. Metadata enables keyboard access to existing tooltips.
function labelValue(value){try{return typeof compact==='function'?String(compact(value)):String(value);}catch{return String(value);}}
function point(node,text,index){if(!node)return;node.dataset.ui59Point='';node.setAttribute('tabindex',index===0?'0':'-1');node.setAttribute('role','img');node.setAttribute('aria-label',text);}
for(const name of ['groupedBars','comboBarsLine','lineChart']){
 const original=window[name];if(typeof original!=='function')continue;
 window[name]=function(...args){const node=original.apply(this,args),svg=node?.matches?.('svg')?node:node?.querySelector?.('svg');if(!svg)return node;
 const labels=args[0]||[];let index=0;
 const rects=[...svg.querySelectorAll('rect')].filter(n=>n.style.cursor==='pointer');
 if(name==='lineChart'){let j=0;for(let i=0;i<labels.length;i++)if(args[1]?.[i]!=null){const circle=svg.querySelectorAll('circle')[j++];point(circle,labels[i]+' · '+(args[2]?.name||'Nilai')+': '+labelValue(args[1][i]),index++);}}
 else{let j=0;for(let i=0;i<labels.length;i++)for(const series of args[1]||[])if(Number(series.vals[i])>0)point(rects[j++],labels[i]+' · '+series.name+': '+labelValue(series.vals[i]),index++);
  if(name==='comboBarsLine'){let j=0;const opts=args[3]||{};for(let i=0;i<labels.length;i++)if(args[2]?.[i]!=null)point(svg.querySelectorAll('circle')[j++],labels[i]+' · '+(opts.lineName||'Achievement')+': '+(typeof pct==='function'?String(pct(args[2][i],1)):String(args[2][i])),index++);}}
 if(index){svg.setAttribute('role','group');svg.setAttribute('aria-label','Grafik interaktif. Gunakan panah kiri dan kanan untuk berpindah titik data.');}return node;};
}
function showFocused(target){const b=target.getBoundingClientRect();target.dispatchEvent(new PointerEvent('pointerenter',{clientX:b.left+b.width/2,clientY:b.top+Math.min(12,b.height)}));}
document.addEventListener('focusin',e=>{if(e.target.matches?.('[data-ui59-point]'))showFocused(e.target);});
document.addEventListener('focusout',e=>{if(e.target.matches?.('[data-ui59-point]'))e.target.dispatchEvent(new PointerEvent('pointerleave'));});
document.addEventListener('keydown',e=>{const target=e.target;if(!target.matches?.('[data-ui59-point]'))return;const points=[...target.closest('svg').querySelectorAll('[data-ui59-point]')],i=points.indexOf(target);let next;
 if(e.key==='ArrowRight')next=(i+1)%points.length;else if(e.key==='ArrowLeft')next=(i-1+points.length)%points.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=points.length-1;else if(e.key==='Escape'){if(typeof tipHide==='function')tipHide();return;}else return;e.preventDefault();target.setAttribute('tabindex','-1');points[next].setAttribute('tabindex','0');points[next].focus();});
let scheduled=false;
function queue(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;const page=document.querySelector('.page.on');decorate(page||document.body);});}
new MutationObserver(records=>{if(records.some(r=>!((r.target.nodeType===1?r.target:r.target.parentElement)?.closest('table,.tw,.mobile-sort-v38,.tbar'))&&([...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&!n.closest?.('[data-png-host-v49]'))||(r.target.nodeType===1?r.target:r.target.parentElement)?.closest('.tile'))))queue();}).observe(document.body,{subtree:true,childList:true});
// Explicitly remove stale hover/tooltips when navigating without touching render/loadAll.
document.addEventListener('animationend',e=>{if(e.animationName==='ui59-enter')e.target.classList.remove('ui59-enter');});
document.querySelector('#nav')?.addEventListener('click',()=>{if(typeof tipHide==='function')tipHide();queue();});
decorate(document.querySelector('.page.on')||document.body);U.refresh=queue;
})();
