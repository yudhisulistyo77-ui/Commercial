/* V51 — tampilan tren: panah ▲/▼ di samping angka (bukan di atas) dan gradasi warna di semua menu.
   Makin besar penurunan → makin pekat merah; makin besar kenaikan → makin pekat hijau. */
(()=>{
if(window.__uiV51)return;window.__uiV51=true;
const css=document.createElement('style');css.id='ui-v51';
css.textContent=`
.pill.ach,.pill.ok,.pill.bad,.member-trend-v30,[data-member-growth],[data-member-gap]{white-space:nowrap!important;display:inline-flex!important;flex-direction:row!important;align-items:center;gap:3px;flex-wrap:nowrap!important;overflow-wrap:normal!important;word-break:normal!important;max-width:none!important}
td .pill.ach,td .member-trend-v30{vertical-align:middle}
/* V52: baris filter proporsional — kolom menyesuaikan lebar, dropdown pilih-banyak mengisi kolomnya, tidak menumpuk. */
.comparison-grid{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))!important}
.member-filters-v27{grid-template-columns:repeat(auto-fit,minmax(180px,1fr))!important}
.comparison-grid>.fld,.member-filters-v27>.fld,.member-filters-v27>div{min-width:0}
.comparison-grid .fld .msd,.member-filters-v27 .fld .msd,.mpick-row-v51 .fld .msd{display:block!important;width:100%!important;min-width:0!important;max-width:100%}
.comparison-grid .fld .msd-btn,.member-filters-v27 .fld .msd-btn,.mpick-row-v51 .fld .msd-btn{width:100%!important;min-width:0!important;max-width:100%;box-sizing:border-box}
.comparison-grid .fld>input,.comparison-grid .fld>select,.member-filters-v27 .fld>input,.member-filters-v27 .fld>select{width:100%;min-width:0;box-sizing:border-box}

`;
document.head.append(css);
function shade(ratio){
 if(typeof trendColor==='function'){const c=trendColor(ratio);return {c,bg:`color-mix(in srgb, ${c} 14%, transparent)`,bd:`color-mix(in srgb, ${c} 40%, transparent)`};}
 const mag=Math.min(Math.abs(ratio),.5)/.5,k=Math.round((25+Math.sqrt(mag)*75));const base=ratio>=0?'#16a34a':'#dc2626';const c=`color-mix(in srgb, ${base} ${k}%, #6b7280)`;return {c,bg:`color-mix(in srgb, ${c} 14%, transparent)`,bd:`color-mix(in srgb, ${c} 40%, transparent)`};
}
window.UI_V51={shade};
/* Pertumbuhan member (%) memakai gradasi yang sama dengan menu Sales. */
if(typeof memberTrendV30==='function'){
 const original=memberTrendV30;
 memberTrendV30=function(n,kind='currency',...rest){const node=original.call(this,n,kind,...rest);
  if(kind==='percent'&&typeof n==='number'&&Number.isFinite(n)&&n!==0){const s=shade(n);node.style.setProperty('color',s.c);node.style.setProperty('background',s.bg);node.style.setProperty('border-color',s.bd);}
  return node;};
}
})();
