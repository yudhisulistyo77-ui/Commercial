/* Commercial V60: bounded, event-driven presentation. No data/auth/network changes. */
(function(){
'use strict';
if(window.MOTION60)return;
const root=document.documentElement,reduce=matchMedia('(prefers-reduced-motion: reduce)');
const CAP=12,OBSERVE_CAP=28;
const running=new Set();let frame=null,current=null,seen=new WeakSet(),observed=0,sequence=0;
const values=new Set();
function maxActive(){return window.innerWidth<=680?16:CAP;}
function enabled(){return root.dataset.uiMotion==='on'&&!reduce.matches&&!document.hidden;}
function finishAll(){for(const a of [...running]){try{a.finish();}catch{}try{a.cancel();}catch{}running.delete(a);}}
function play(node,frames,options={}){
 if(!enabled()||!node?.isConnected||typeof node.animate!=='function'||running.size>=maxActive())return;
 const a=node.animate(frames,{duration:300,easing:'cubic-bezier(.2,.7,.3,1)',fill:'backwards',...options});
 running.add(a);const release=()=>running.delete(a);a.onfinish=release;a.oncancel=release;return a;
}
function reveal(node){
 if(!node.isConnected||!enabled())return;
 const delay=Math.min(sequence++%6*18,90);
 if(node.matches('.chart')){
  // At most eight bars and one line per chart. Values/labels never change.
  for(const bar of [...node.querySelectorAll('rect[data-ui59-point],rect[style*="cursor: pointer"]')].slice(0,8)){
   const b=bar.getBBox();if(b.height<=0)continue;
   play(bar,[{transform:'scaleY(.04)',opacity:.65},{transform:'scaleY(1)',opacity:1}],{duration:380,delay});
  }
  const path=[...node.querySelectorAll('path[stroke]')].find(p=>p.getAttribute('fill')==='none'&&p.getAttribute('stroke')!=='none');
  if(path&&typeof path.getTotalLength==='function'){
   const length=path.getTotalLength();if(Number.isFinite(length)&&length>0)play(path,[{strokeDasharray:length+' '+length,strokeDashoffset:length},{strokeDasharray:length+' '+length,strokeDashoffset:0}],{duration:450,delay});
  }
 }else if(node.matches('.meter > i')){
  play(node,[{transform:'scaleX(.05)',opacity:.65},{transform:'scaleX(1)',opacity:1}],{duration:380,delay});
 }else{
  play(node,[{opacity:.65,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{delay});
 }
}
const intersection=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
 for(const e of entries)if(e.isIntersecting){intersection.unobserve(e.target);reveal(e.target);}
},{threshold:.08,rootMargin:'0px 0px -12px 0px'}):null;
function observe(node){
 if(seen.has(node)||observed>=OBSERVE_CAP)return;seen.add(node);observed++;
 if(intersection)intersection.observe(node);else reveal(node);
}
function refresh(){
 frame=null;root.dataset.motionV60=enabled()?'on':'off';
 if(!enabled()){intersection?.disconnect();finishAll();values.clear();current=null;return;}
 const page=document.querySelector('#login-v38 .ui59-login-shell')||document.querySelector('.page.on');
 if(!page)return;
 if(page!==current){intersection?.disconnect();finishAll();seen=new WeakSet();observed=0;sequence=0;current=page;}
 if(page.matches('.ui59-login-shell'))observe(page);
 else for(const n of page.querySelectorAll('.phead,.tile,.card,.tw,.chart,.meter > i')){
  // Avoid two simultaneous panel translations on nested cards.
  if(n.matches('.card,.tile,.tw')&&n.parentElement.closest('.card,.tile'))continue;
  observe(n);if(observed>=OBSERVE_CAP)break;
 }
 for(const n of [...values].slice(0,8))if(page.contains(n))play(n,[{opacity:.55,transform:'translateY(2px)'},{opacity:1,transform:'translateY(0)'}],{duration:240});
 values.clear();
}
function schedule(){if(frame===null)frame=requestAnimationFrame(refresh);}
const changes=new MutationObserver(records=>{
 let relevant=false;
 for(const r of records){
  if(r.type==='attributes'){if(r.target.matches('.page'))relevant=true;continue;}
  const target=r.target.nodeType===1?r.target:r.target.parentElement;
  if(target?.closest('.png-export-v49,[data-png-host-v49],.tip,.toast,table,.tw,.tbar'))continue;
  const value=target?.closest('.tile .v');if(value){values.add(value);relevant=true;}
  if([...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1))relevant=true;
 }
 if(relevant)schedule();
});
changes.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
new MutationObserver(schedule).observe(root,{attributes:true,attributeFilter:['data-ui-motion']});
reduce.addEventListener('change',()=>{if(reduce.matches)finishAll();schedule();});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){intersection?.disconnect();finishAll();values.clear();current=null;root.dataset.motionV60='off';}
 else schedule();
});
window.addEventListener('beforeprint',finishAll);
// Finish transient effects before existing PNG/CSV handlers read the layout.
document.addEventListener('click',e=>{const b=e.target.closest?.('button,a');if(b&&/salin\s*png|unduh\s*csv|ekspor|export/i.test(b.textContent||''))finishAll();},true);
window.MOTION60={version:60,refresh:schedule,finish:finishAll,stats:()=>({active:running.size,observed,cap:maxActive(),enabled:enabled()})};
schedule();
})();
