(function(){'use strict';
const V=window.TABLES_V40={threshold:100};
V.apply=root=>{for(const table of root.querySelectorAll('table')){let wrap=table.closest('.tw');if(!wrap){wrap=el('div',{class:'tw'});table.before(wrap);wrap.append(table)}
 const count=[...table.tBodies].flatMap(b=>[...b.rows]).filter(r=>!r.hidden&&r.style.display!=='none'&&!r.classList.contains('tot')&&!(r.cells.length===1&&r.cells[0].colSpan>1)).length;
 const scrolling=count>100,mode=scrolling?'scroll':'all';if(table.dataset.rowsV40!==mode||table.dataset.rowCountV40!==String(count)){table.dataset.rowsV40=mode;table.dataset.rowCountV40=count;wrap.dataset.rowsV40=mode;wrap.style.setProperty('max-height',scrolling?'min(70vh,760px)':'none','important');wrap.style.setProperty('height','auto','important');wrap.style.setProperty('overflow-y',scrolling?'auto':'visible','important');wrap.style.setProperty('overflow-x','auto','important');wrap.style.setProperty('min-height','0','important');wrap.setAttribute('aria-label',count+' baris data · '+(scrolling?'gulir vertikal karena lebih dari 100 baris':'seluruh baris terbuka'));}
 }};
let frame;const scan=()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=null;document.querySelectorAll('.page.on,.modal .box').forEach(V.apply)})};new MutationObserver(scan).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['style','hidden']});scan();
const css=document.createElement('style');css.textContent=':root .tw[data-rows-v40=all]{max-height:none!important;height:auto!important}:root .tw[data-rows-v40=scroll]{max-height:min(70vh,760px)!important;overflow-y:auto!important}:root .tw[data-rows-v40=scroll] thead th{position:sticky;top:0;z-index:2;background:var(--panel,#131f31)}';document.head.append(css);
})();
