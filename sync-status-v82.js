/* Partial progress never advances the fully verified run date. */
(function(){'use strict';
window.syncStatusV82=function(complete,latest,lastSaved=latest){
 const newer=lastSaved&&(!complete||Date.parse(lastSaved.requested_at||lastSaved.finished_at)>Date.parse(complete.requested_at||complete.finished_at));
 const p=latest?.progress,rows=Array.isArray(p?.per_store)?p.per_store:[];
 const saved=(Array.isArray(lastSaved?.progress?.per_store)?lastSaved.progress.per_store:[]).filter(r=>['OK','UNCHANGED'].includes(r.status)&&/^\d{4}-\d{2}-\d{2}$/.test(r.saved_through||''));
 const date=saved.length?saved.map(r=>r.saved_through).sort().at(-1):null;
 return {partial:!!(newer&&lastSaved.status!=='done'&&date),date:date||null,rows,completeDate:complete?.data_through||(complete?.status==='done'?complete?.data_until?.slice(0,10):null),updated:saved.length};
};
})();
