/* Viewport-level dropdowns; no data/auth/caching behavior changes. */
(function(){'use strict';
const css=document.createElement('style');css.id='dropdown-layout-v50';css.textContent=`
.msd-pop.msd-portal-v50{display:flex!important;position:fixed!important;z-index:1100;box-sizing:border-box;min-height:0;margin:0;padding:7px;border-radius:10px;overflow:hidden;isolation:isolate}
.msd-portal-v50 .msd-opts{min-height:0;overflow:auto;overscroll-behavior:contain}.msd-portal-v50 .msd-opt{flex-shrink:0}.msd-portal-v50 .msd-search{min-width:0;width:100%;flex-shrink:0}.msd-portal-v50 .msd-foot{min-width:0;flex-shrink:0}.msd-portal-v50 .msd-foot button{min-width:0;white-space:normal}
`;document.head.append(css);
let frame;const reposition=event=>{if(!activeMultiSelect)return;if(event?.target instanceof Node&&activeMultiSelect.pop?.contains(event.target))return;if(frame)return;frame=requestAnimationFrame(()=>{frame=null;activeMultiSelect?.position?.();});};
window.addEventListener('resize',reposition);document.addEventListener('scroll',reposition,true);window.visualViewport?.addEventListener('resize',reposition);window.visualViewport?.addEventListener('scroll',reposition);
})();
