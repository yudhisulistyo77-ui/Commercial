/* Repairs lifecycle and semantic presentation; no database writes. */
(function(){'use strict';if(window.UI61)return;
const U=window.UI61={version:61};
const clearV61=masterClear;masterClear=function(...args){const p=window.MEMBER_PROFILE_V40;if(p){p.epoch++;p.data=null;p.analysis=null}const a=window.MEMBER_ANALYTICS_V39;if(a)a.data=null;return clearV61.apply(this,args)};let navigating=false,frame=null;
const beforeRender=render;render=function(...args){if(!navigating){if(frame!==null){cancelAnimationFrame(frame);frame=null;}return beforeRender.apply(this,args);}if(frame!==null)cancelAnimationFrame(frame);const page=S.page;frame=requestAnimationFrame(()=>{frame=null;if(S.page===page)beforeRender.apply(this,args)});};
const beforeGo=go;go=function(...args){navigating=true;try{return beforeGo.apply(this,args)}finally{navigating=false}};
const palette=['blue','purple','orange','teal'];
function numeric(text){let v=String(text).replace(/\u2212/g,'-').replace(/[^0-9,.()-]/g,'');if(!/\d/.test(v))return null;const neg=v.startsWith('(');v=v.replace(/[()]/g,'').replace(/\./g,'').replace(',','.');const n=Number(v);return Number.isFinite(n)?(neg?-Math.abs(n):n):null;}
U.tone=function(label,text){const n=numeric(text);if(n===null)return 'neutral';if(/growth|pertumbuhan|gap|selisih|perubahan/i.test(label))return n>0?'good':n<0?'bad':'neutral';if(/achiev|pencapaian|capaian|pencapaian/i.test(label))return n>=100?'good':n>=80?'watch':'bad';if(n<0)return 'bad';return palette[[...label].reduce((v,c)=>v+c.charCodeAt(0),0)%palette.length];};
function paint(tile){tile.dataset.v61Tone=U.tone(tile.querySelector('.k')?.textContent||'',tile.querySelector('.v')?.textContent||'');}
if(typeof tile==='function'){const before=tile;tile=function(...args){const node=before.apply(this,args);paint(node);return node;};}
let next=null;const dirty=new Set();new MutationObserver(records=>{for(const r of records){const target=r.target.nodeType===1?r.target:r.target.parentElement;if(target?.closest('table,.tw,.png-export-v49'))continue;const own=target?.closest('.tile');if(own)dirty.add(own);for(const n of r.addedNodes)if(n.nodeType===1){if(n.matches('.tile'))dirty.add(n);else if(!n.matches('table,tr,td,th'))for(const t of n.querySelectorAll('.tile'))dirty.add(t);}}if(dirty.size&&next===null)next=requestAnimationFrame(()=>{next=null;for(const t of dirty)if(t.isConnected&&t.closest('.page.on,.modal'))paint(t);dirty.clear()});}).observe(document.body,{subtree:true,childList:true});
for(const t of document.querySelectorAll('.page.on .tile'))paint(t);
})();
