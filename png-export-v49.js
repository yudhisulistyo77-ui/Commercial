/* Export a frozen, visible DOM snapshot. Never rebuild rows from an unfiltered model. */
(function(){'use strict';
const X=window.PNG_EXPORT_V49={};
const compact=s=>String(s||'').replace(/\s+/g,' ').trim();
const REMOVE='[data-export-control],.tbar,.table-csv-v39,.mobile-sort-v38,.pagefilters,.member-filters-v27,.product-filter-grid,.v28-tools,.number-mode-control,.sortar,.spacer,script,style,template';
function paint(value){
 if(!value)return value;
 const re=/(?:color-mix|color|oklab|oklch|lab|lch)\(/g;let out='',last=0,m;
 while((m=re.exec(value))){let end=re.lastIndex,depth=1;while(end<value.length&&depth){if(value[end]==='(')depth++;if(value[end]===')')depth--;end++;}
  if(depth)break;out+=value.slice(last,m.index)+canonColor(value.slice(m.index,end));last=end;re.lastIndex=end;
 }return out+value.slice(last);
}
function visible(n){const s=getComputedStyle(n);return !n.hidden&&n.style.display!=='none'&&!n.classList.contains('hidden')&&s.display!=='none'&&s.visibility!=='hidden'&&s.visibility!=='collapse';}
function context(node){
 const page=node.closest('.page'),parts=[];if(document.documentElement.dataset.numberMode)parts.push('Angka: '+(['short','compact'].includes(document.documentElement.dataset.numberMode)?'Ringkas':'Penuh'));
 const selectors=['.pagefilters .fld','.product-filter-grid .fld'];
 const applied=node.closest('[data-png-context]');if(applied)parts.push(applied.dataset.pngContext);else node.querySelectorAll('[data-png-context]').forEach(n=>{if(visible(n))parts.push(n.dataset.pngContext)});
 if(page)for(const f of page.querySelectorAll(selectors.join(','))){
  if(!visible(f))continue;const label=compact(f.querySelector('label')?.textContent),input=f.querySelector('input:not([type=password]),select'),multi=f.querySelector('.msd-btn');
  const value=multi?multi.textContent:input?.tagName==='SELECT'?[...input.selectedOptions].map(o=>o.textContent).join(', '):input?input.value:multi?.textContent;
  if(label&&compact(value))parts.push(label+': '+compact(value));
 }
 for(const t of node.matches('table')?[node]:node.querySelectorAll('table')){
  const bar=t.closest('.tw')?.previousElementSibling,q=bar?.matches('.tbar')?bar.querySelector('.tsearch'):null;
  if(q?.value.trim())parts.push('Cari: '+q.value.trim());
  const th=t.querySelector('th[data-dir],th[aria-sort=ascending],th[aria-sort=descending]');if(th)parts.push('Urutan: '+compact(th.dataset.t||th.textContent).replace(/[▲▼↕]/g,'').trim()+' '+((th.dataset.dir==='asc'||th.getAttribute('aria-sort')==='ascending')?'↑':'↓'));
 }
 return [...new Set(parts)].join(' · ');
}
function tableGeometry(table){
 const rows=[...(table.tHead?.rows||[]),...[...table.tBodies].flatMap(b=>[...b.rows]),...(table.tFoot?.rows||[])].filter(visible),n=Math.max(0,...rows.map(r=>[...r.cells].reduce((s,c)=>s+c.colSpan,0)));
 const widths=Array(n).fill(60),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
 for(const row of rows.slice(0,202)){let at=0;for(const cell of row.cells){const cs=getComputedStyle(cell);ctx.font=cs.font||'12px Arial';const text=compact(cell.textContent).replace(/[▲▼↕]/g,''),need=Math.min(260,Math.max(60,ctx.measureText(text).width+28))/cell.colSpan;for(let i=0;i<cell.colSpan;i++)widths[at+i]=Math.max(widths[at+i]||60,need);at+=cell.colSpan;}}
 const normal=getComputedStyle(table).display==='table'&&table.tHead&&getComputedStyle(table.tHead).display!=='none';
 const row=rows.find(r=>r.cells.length===n&&[...r.cells].every(c=>c.colSpan===1&&c.rowSpan===1));
 if(normal&&row){const measured=[...row.cells].map(c=>c.getBoundingClientRect().width);if(measured.every(w=>w>0))return measured.map((w,i)=>Math.max(w,widths[i]));}
 return widths;
}
const STYLE=['display','visibility','color','background-color','background-image','background-size','background-position','background-repeat','border-top','border-right','border-bottom','border-left','border-radius','box-shadow','font-family','font-size','font-weight','font-style','line-height','letter-spacing','text-align','text-transform','vertical-align','white-space','word-break','overflow-wrap','padding-top','padding-right','padding-bottom','padding-left','gap','column-gap','row-gap','grid-template-columns','grid-template-rows','align-items','justify-content','flex-direction','flex-wrap','flex-grow','flex-shrink','flex-basis','fill','stroke','stroke-width','text-decoration-color'];
function freeze(original,clone){
 const a=[original,...original.querySelectorAll('*')],b=[clone,...clone.querySelectorAll('*')];
 a.forEach((o,i)=>{const c=b[i],cs=getComputedStyle(o);if(!c)return;
  for(const prop of STYLE){const value=cs.getPropertyValue(prop);if(value)c.style.setProperty(prop,paint(value),'important');}
  if(cs.display==='grid'){const count=Math.max(1,cs.gridTemplateColumns.split(/\s+/).length);c.style.setProperty('grid-template-columns',c.querySelector('table')?'minmax(0,1fr)':`repeat(${count},minmax(0,1fr))`,'important');c.style.setProperty('grid-template-rows','none','important');}
  c.style.setProperty('animation','none','important');c.style.setProperty('transition','none','important');
  if(!visible(o)&&!o.closest('thead,colgroup'))c.dataset.pngRemoveV49='true';
  if(o instanceof HTMLCanvasElement){c.width=o.width;c.height=o.height;c.getContext('2d')?.drawImage(o,0,0);}
  if(o instanceof HTMLImageElement&&o.currentSrc){c.src=o.currentSrc;c.removeAttribute('srcset');}
 });return {originals:a,copies:b};
}
function readableTotals(clone){
 for(const td of clone.querySelectorAll('tfoot th,tfoot td,tr.tot th,tr.tot td')){
  td.style.setProperty('background','#e9eef6','important');td.style.setProperty('color','#152238','important');td.style.setProperty('font-weight','700','important');
  for(const n of [td,...td.querySelectorAll('*')]){n.style.setProperty('color','#152238','important');n.style.setProperty('-webkit-text-fill-color','#152238','important');n.style.setProperty('opacity','1','important');n.style.setProperty('visibility','visible','important');n.style.setProperty('text-shadow','none','important');n.style.setProperty('background-image','none','important');if(n!==td)n.style.setProperty('background-color','transparent','important');n.style.setProperty('background-clip','border-box','important');}
 }
}
X.prepare=function(node){
 if(!node?.isConnected)throw Error('Bagian data sudah berubah. Tunggu filter selesai, lalu salin kembali.');
 const clone=node.cloneNode(true),tables=node.matches('table')?[node]:[...node.querySelectorAll('table')],copies=clone.matches('table')?[clone]:[...clone.querySelectorAll('table')],geometry=tables.map(tableGeometry),caption=context(node);
 freeze(node,clone);
 for(const n of [clone,...clone.querySelectorAll('.page.on')])n.classList.remove('on');copies.forEach(t=>{t.dataset.enh='png-v49';t.dataset.csvV39='1'});
 // Remove filtered/hidden nodes structurally so export CSS cannot revive them.
 clone.querySelectorAll('[data-png-remove-v49]').forEach(n=>n.remove());clone.querySelectorAll(REMOVE).forEach(n=>n.remove());
 clone.querySelectorAll('button').forEach(n=>{if(n.closest('th')){const text=document.createElement('span');text.textContent=n.textContent.trim();n.replaceWith(text);}else if(!n.classList.contains('rank-row'))n.remove();});
 clone.querySelectorAll('input,select,textarea').forEach(n=>{if(n.type==='password'||n.type==='hidden'){n.remove();return;}const s=document.createElement('span');s.textContent=n.tagName==='SELECT'?[...n.selectedOptions].map(o=>o.textContent).join(', '):n.type==='checkbox'?(n.checked?'Ya':'Tidak'):n.value;n.replaceWith(s);});
 // A single table card has one content boundary: its heading and its table/footer.
 if(node.classList.contains('card')&&copies.length===1&&!clone.querySelector('svg,canvas,.rank-chart,.tile')){
  const table=copies[0],head=clone.querySelector(':scope > header');const content=document.createElement('div');content.className='png-table-content';content.append(table);clone.replaceChildren(...(head?[head]:[]),content);
 }
 clone.querySelectorAll('details').forEach(n=>n.open=true);
 for(const n of [clone,...clone.querySelectorAll('*')]){
  if(!n.matches('svg,svg *')){n.style.setProperty('max-height','none','important');n.style.setProperty('min-height','0','important');n.style.setProperty('overflow','visible','important');n.style.setProperty('content-visibility','visible','important');}
  const pos=n.style.position;if(pos==='sticky'||n.matches('th,td,thead,tfoot,tr,.sticky1')){for(const p of ['left','right','top','bottom'])n.style.setProperty(p,'auto','important');n.style.setProperty('position','static','important');n.style.setProperty('transform','none','important');}
 }
 let contentWidth=0;
 copies.forEach((table,i)=>{if(!clone.contains(table)&&clone!==table)return;const widths=geometry[i],width=Math.ceil(Math.max(widths.reduce((a,b)=>a+b,0),node.matches('.card')?node.getBoundingClientRect().width-24:0));contentWidth=Math.max(contentWidth,width);
  table.removeAttribute('data-mobile-cards');table.querySelectorAll(':scope > colgroup').forEach(n=>n.remove());const cols=document.createElement('colgroup');widths.forEach(w=>{const c=document.createElement('col');c.style.width=w+'px';cols.append(c)});table.prepend(cols);
  table.style.setProperty('display','table','important');table.style.setProperty('table-layout','fixed','important');table.style.setProperty('width',width+'px','important');table.style.setProperty('min-width',width+'px','important');table.style.setProperty('max-width','none','important');
  for(const [sel,display]of [['thead','table-header-group'],['tbody','table-row-group'],['tfoot','table-footer-group'],['tr','table-row'],['th,td','table-cell']])table.querySelectorAll(sel).forEach(n=>{n.style.setProperty('display',display,'important');n.style.setProperty('width','auto','important');n.style.setProperty('min-width','0','important');n.style.setProperty('max-width','none','important');n.style.setProperty('height','auto','important');n.style.setProperty('margin','0','important');n.style.setProperty('border-radius','0','important');n.style.setProperty('visibility','visible','important');});
  table.querySelectorAll('th,td').forEach(n=>{n.style.setProperty('padding','9px 10px','important');n.style.setProperty('white-space','normal','important');n.style.setProperty('overflow-wrap','anywhere','important');});
 });
 readableTotals(clone);
 const root=document.createElement('div');root.className='png-export-v49';root.style.cssText='display:flow-root;box-sizing:border-box;padding:0;margin:0;color:#152238;background:#fff;';
 clone.style.setProperty('height','auto','important');clone.style.setProperty('min-height','0','important');clone.style.setProperty('max-height','none','important');clone.style.setProperty('margin','0','important');clone.style.setProperty('position','relative','important');clone.style.setProperty('transform','none','important');clone.style.setProperty('box-sizing','border-box','important');
 const rect=node.getBoundingClientRect(),graphicWidth=Math.max(0,...[...node.querySelectorAll('svg,canvas,.number-chart-scroll')].map(n=>Math.max(n.scrollWidth,n.getBoundingClientRect().width)+Math.max(0,n.getBoundingClientRect().left-rect.left)+20));
 const width=Math.ceil(Math.max(rect.width,graphicWidth,contentWidth+(node.matches('.card')?32:0),320));
 clone.style.setProperty('width',width+'px','important');clone.style.setProperty('max-width','none','important');
 if(node.matches('.card')){clone.style.setProperty('padding','12px','important');clone.querySelector(':scope > header')?.style.setProperty('margin','0 0 10px','important');}
 if(caption){const note=document.createElement('div');note.className='png-context-v49';note.textContent=caption;note.style.cssText='font:11px/1.5 Arial,sans-serif!important;color:#46566f!important;background:#f3f6fa!important;padding:7px 10px!important;white-space:normal!important;';const header=clone.querySelector(':scope > header');if(header)header.append(note);else clone.prepend(note);}
 root.append(clone);root.style.width=width+'px';return {root,clone,width};
};
window.capturePngOfNode=async function(node){
 if(typeof html2canvas!=='function')throw Error('Mesin PNG belum dimuat. Periksa koneksi lalu muat ulang.');
 const {root,width}=X.prepare(node),host=document.createElement('div');host.dataset.pngHostV49='';host.style.cssText='position:fixed;left:-100000px;top:0;pointer-events:none;z-index:-1;';host.append(root);document.body.append(host);
 try{await document.fonts?.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const height=Math.ceil(root.getBoundingClientRect().height),actualWidth=Math.ceil(Math.max(width,root.scrollWidth));if(actualWidth<1||height<1)throw Error('Bagian data kosong.');
  const scale=Math.min(2,Math.sqrt(24000000/(actualWidth*height)),16000/actualWidth,16000/height);if(scale<.65)throw Error('Terlalu banyak data untuk satu PNG yang terbaca. Persempit filter atau gunakan CSV.');
  const canvas=await html2canvas(root,{backgroundColor:'#ffffff',scale,useCORS:true,logging:false,width:actualWidth,height,windowWidth:Math.max(1280,actualWidth),windowHeight:Math.max(800,height),scrollX:0,scrollY:0});
  return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG gagal dibuat.')),'image/png'));
 }finally{host.remove();}
};
window.copyNodeAsImage=async function(node,button){
 const old=button?.textContent;try{if(button){button.disabled=true;button.textContent='Menyiapkan…';}const blob=await capturePngOfNode(node);
  try{await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);toast('PNG disalin sesuai filter dan urutan yang tampil.');}
  catch{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='data-sesuai-filter.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('PNG diunduh karena clipboard gambar tidak tersedia.');}
 }catch(e){toast('Gagal membuat PNG: '+e.message);}finally{if(button){button.disabled=false;button.textContent=old;}}
};
const css=document.createElement('style');css.id='png-layout-v49';css.textContent=`
.png-export-v49 *{box-sizing:border-box}.png-export-v49 table td:before,.png-export-v49 table th:before{content:none!important;display:none!important}
.png-export-v49 header{display:flex!important;align-items:center!important;flex-wrap:wrap!important;gap:6px!important}.png-export-v49 header .png-context-v49{flex:1 0 100%}
.png-export-v49 .page{display:block!important;width:100%!important}.png-export-v49 .tw{width:100%!important;max-width:none!important;max-height:none!important;min-height:0!important;height:auto!important;overflow:visible!important}
.page.on table tr[hidden],.page.on table tr.hidden,.page.on table tr[style*="display: none"],.page.on table tr[style*="display:none"]{display:none!important}
.page.on{width:100%;min-width:0;max-width:100%;box-sizing:border-box}.page.on .card,.page.on .grid>*{min-width:0;box-sizing:border-box}.page.on .card>header{flex-wrap:wrap;align-items:center;gap:8px}.page.on .card>header h2{min-width:0;overflow-wrap:anywhere}.page.on .tbar{flex-wrap:wrap;min-width:0}.page.on .tw{max-width:100%;box-sizing:border-box;overscroll-behavior:contain}.page.on .chart{min-width:0;max-width:100%}
@media(max-width:760px){.page.on .card{padding:12px!important}.page.on .tbar .tsearch{width:100%;flex:1 1 100%;max-width:none}.page.on .grid{gap:10px!important}.page.on .card>header .btn{max-width:100%;white-space:normal}.page.on .card>header>.sub{flex:1 0 100%}.page.on .pagefilters{gap:8px!important}}
`;document.head.append(css);
})();
