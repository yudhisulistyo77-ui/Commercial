/* CSV exports use the currently filtered model where provided; otherwise rendered rows only. */
(function(){'use strict';
const C=window.TABLE_CSV_V39={};
const visible=node=>!node.hidden&&node.style.display!=='none'&&!node.classList.contains('hidden');
function text(node){if(node==null)return '';if(typeof node==='number')return node;if(node.raw!=null)return node.raw;if(!node.nodeType)return String(node);const inputs=[...node.querySelectorAll('input:not([type=hidden]),select,textarea')];if(inputs.length)return inputs.map(n=>n.type==='password'?'[tersembunyi]':n.type==='checkbox'?(n.checked?'Ya':'Tidak'):n.tagName==='SELECT'?(n.selectedOptions[0]?.textContent||n.value):n.value).join(' | ');const raw=node.dataset?.v??node.querySelector('[data-v]')?.dataset.v;if(raw!=null&&raw!==''&&Number.isFinite(Number(raw)))return Number(raw);const copy=node.cloneNode(true);copy.querySelectorAll('button,.sortar,[data-export-control]').forEach(n=>n.remove());return copy.textContent.replace(/\s+/g,' ').trim()}
const safe=x=>{if(typeof x==='number')return Number.isFinite(x)?String(x):'';const s=String(x??'');return /^[\t\r\n ]*[=+@-]/.test(s)?"'"+s:s};
C.encode=rows=>'\ufeff'+rows.map(r=>r.map(v=>'"'+safe(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');
C.download=(rows,name)=>{const blob=new Blob([C.encode(rows)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=String(name||'Data').replace(/[^a-zA-Z0-9_. -]/g,'').trim().replace(/\s+/g,'_')+'_'+new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Makassar'}).format(new Date())+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);return blob};
function headers(table){
 if(!table.tHead)return [...(table.rows[0]?.cells||[])].map((_,i)=>'Kolom '+(i+1));
 const grid=[];[...table.tHead.rows].forEach((row,ri)=>{grid[ri]||=[];let ci=0;for(const cell of row.cells){while(grid[ri][ci]!=null)ci++;const label=cell.dataset.t||cell.textContent.replace(/[▲▼↕]/g,'').trim();for(let y=ri;y<ri+cell.rowSpan;y++){grid[y]||=[];for(let x=ci;x<ci+cell.colSpan;x++)grid[y][x]=label}ci+=cell.colSpan}});
 const size=Math.max(0,...grid.map(r=>r.length));return Array.from({length:size},(_,i)=>[...new Set(grid.map(r=>r[i]).filter(Boolean))].join(' / ')||'Kolom '+(i+1));
}
function rowCells(row){const values=[];for(const cell of row.cells){values.push(text(cell));for(let i=1;i<cell.colSpan;i++)values.push('')}return values}
C.rows=(table,{all=false}={})=>{
 const h=headers(table),omit=new Set(h.map((s,i)=>/^(AKSI|ACTION|ACTIONS|DETAIL|PILIH|TINDAKAN)$/i.test(s.trim())?i:-1));let rows;
 if(all&&table._csvAllV39){rows=table._csvAllV39().map(r=>r.map(text));const input=table.closest('.tw')?.previousElementSibling?.querySelector('.tsearch');const q=input?.value.trim().toLowerCase();if(q)rows=rows.filter(r=>r.join(' ').toLowerCase().includes(q));}
 else rows=[...table.tBodies].flatMap(b=>[...b.rows]).filter(visible).filter(r=>!r.classList.contains('tot')&&!(r.cells.length===1&&r.cells[0].colSpan>1)).map(rowCells);
 return [h,...rows].map(r=>h.flatMap((_,i)=>omit.has(i)?[]:[r[i]??'']));
};
C.attach=scope=>{scope.querySelectorAll('table').forEach(table=>{if(table.dataset.csvV39)return;table.dataset.csvV39='1';const page=table.closest('.page'),title=table.closest('.card')?.querySelector('header h2,h2,h3')?.textContent||page?.querySelector('h1')?.textContent||table.closest('.box')?.querySelector('h2')?.textContent||'Data';const bar=el('div',{class:'table-csv-v39','data-export-control':''});const button=(label,all)=>el('button',{type:'button',class:'btn sm',onclick:()=>{const rows=C.rows(table,{all});C.download(rows,title+(all?'_seluruh_filter':'_halaman'));if(typeof toast==='function')toast('CSV: '+Math.max(0,rows.length-1)+' baris sesuai filter'+(all?'':' pada tabel/halaman ini'))}},label);
 bar.append(button(table._csvAllV39?'CSV halaman ini':'Unduh CSV · tabel ini',false));if(table._csvAllV39)bar.append(button('CSV seluruh hasil filter',true));else bar.append(el('small',{},'Isi tabel/halaman ini · mengikuti filter dan pencarian. Data lintas halaman memakai unduhan seluruh hasil jika tersedia.'));
 table.before(bar);
 })};
let frame;const scan=()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=null;document.querySelectorAll('.page.on,.modal .box').forEach(C.attach)})};new MutationObserver(scan).observe(document.body,{subtree:true,childList:true});scan();
const style=document.createElement('style');style.textContent='.table-csv-v39{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:10px 0;max-width:100%}.table-csv-v39 small{color:var(--muted,#9eacc2);font-size:11px;line-height:1.4;flex:1 1 220px}.table-csv-v39 .btn{flex:0 0 auto}';document.head.append(style);
})();
