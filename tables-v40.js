(function(){'use strict';
const V=window.TABLES_V40={threshold:100};
V.apply=root=>{for(const table of root.matches?.('table')?[root]:root.querySelectorAll('table')){let wrap=table.closest('.tw');if(!wrap){wrap=el('div',{class:'tw'});table.before(wrap);wrap.append(table)}
 const count=[...table.tBodies].flatMap(b=>[...b.rows]).filter(r=>!r.hidden&&r.style.display!=='none'&&!r.classList.contains('tot')&&!(r.cells.length===1&&r.cells[0].colSpan>1)).length;
 const scrolling=count>100,mode=scrolling?'scroll':'all';if(table.dataset.rowsV40!==mode||table.dataset.rowCountV40!==String(count)){table.dataset.rowsV40=mode;table.dataset.rowCountV40=count;wrap.dataset.rowsV40=mode;wrap.style.setProperty('max-height',scrolling?'min(70vh,760px)':'none','important');wrap.style.setProperty('height','auto','important');wrap.style.setProperty('overflow-y',scrolling?'auto':'visible','important');wrap.style.setProperty('overflow-x','auto','important');wrap.style.setProperty('min-height','0','important');wrap.setAttribute('aria-label',count+' baris data · '+(scrolling?'gulir vertikal karena lebih dari 100 baris':'seluruh baris terbuka'));}
 }};
let frame;const pending=new Set();const queue=table=>{if(table?.isConnected&&(table.closest('.page.on')||table.closest('.modal')))pending.add(table)};
const scan=records=>{for(const r of records){const target=r.target.nodeType===1?r.target:r.target.parentElement;if(r.type==='attributes'){if(target?.matches('tr,table'))queue(target.closest('table'));continue;}queue(target?.closest('table'));for(const n of r.addedNodes)if(n.nodeType===1){if(n.matches('table'))queue(n);n.querySelectorAll('table').forEach(queue);}}if(frame||!pending.size)return;frame=requestAnimationFrame(()=>{frame=null;for(const t of pending)if(t.isConnected)V.apply(t);pending.clear();});};new MutationObserver(scan).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['style','hidden']});document.querySelectorAll('.page.on,.modal .box').forEach(V.apply);
const css=document.createElement('style');css.textContent=':root .tw[data-rows-v40=all]{max-height:none!important;height:auto!important}:root .tw[data-rows-v40=scroll]{max-height:min(70vh,760px)!important;overflow-y:auto!important}:root .tw[data-rows-v40=scroll] thead th{position:sticky;top:0;z-index:2;background:var(--panel,#131f31)}';document.head.append(css);
})();

/* V51: scroll di dalam tabel. Saat tabel sudah di ujung atas/bawah, sisa putaran mouse/trackpad
   diteruskan ke halaman sehingga bisa langsung turun ke tabel berikutnya (tanpa harus keluar dari tabel). */
(()=>{if(window.__tableWheelV51)return;window.__tableWheelV51=true;
document.addEventListener('wheel',e=>{if(e.ctrlKey||Math.abs(e.deltaY)<=Math.abs(e.deltaX))return;
 const box=e.target.closest?.('.tw');if(!box)return;
 const dy=e.deltaMode===1?e.deltaY*16:e.deltaMode===2?e.deltaY*innerHeight:e.deltaY;
 const canScroll=box.scrollHeight>box.clientHeight+1&&/(auto|scroll)/.test(getComputedStyle(box).overflowY);
 if(canScroll){const atTop=box.scrollTop<=0,atBottom=box.scrollTop+box.clientHeight>=box.scrollHeight-1;
  if((dy>0&&!atBottom)||(dy<0&&!atTop)){const room=dy>0?box.scrollHeight-box.clientHeight-box.scrollTop:box.scrollTop;if(Math.abs(dy)<=room)return;
   e.preventDefault();box.scrollTop+=dy;window.scrollBy(0,dy>0?dy-room:dy+room);return;}}
 e.preventDefault();window.scrollBy(0,dy);
},{passive:false,capture:true});})();
