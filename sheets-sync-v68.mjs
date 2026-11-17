import {csv,headers,validateHeaders,parseRows,sourceURL} from './sheets-source-v64.mjs?v=76';
// One parser/transaction protocol for browser and scheduled worker. No secrets in this module.
export async function syncSheet(kind,{rpc,fetcher=fetch,progress=()=>{},digest=async text=>{const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(h)].map(v=>v.toString(16).padStart(2,'0')).join('');}}){
 let run,committed=false;
 try{
  const start=await rpc('commercial_sheet_sync_v68',{p_kind:kind,p_action:'begin',p_data:{}});run=start.run_id;
  const src=start.source;progress('Membaca sumber '+src.sheet+'…');
  const urls=[sourceURL(src.spreadsheet,src.sheet,'',src.gid),`https://docs.google.com/spreadsheets/d/${src.spreadsheet}/gviz/tq?tqx=out:csv&gid=${Number(src.gid)}`];let matrix,last;
  for(const url of urls){try{const response=await fetcher(url,{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(45000)});if(!response.ok)throw Error('Google Sheet HTTP '+response.status);matrix=csv(await response.text());break;}catch(e){last=e;}}
  if(!matrix)throw Error('Sumber Google Sheet belum dapat dibaca: '+last.message+'. Periksa izin baca spreadsheet dan ID tab.');if(!matrix.length)throw Error('Sheet kosong; data lama dipertahankan.');
  let headerIndex=-1,heads;for(let i=0;i<Math.min(30,matrix.length);i++){try{const candidate=headers(matrix[i]);validateHeaders(kind,candidate);heads=candidate;headerIndex=i;break;}catch{}}if(headerIndex<0)throw Error('Header sumber tidak ditemukan pada 30 baris awal. Periksa nama tab dan struktur '+kind+'.');
  const parsed=parseRows(kind,heads,matrix.slice(headerIndex+1),headerIndex+2);if(!parsed.rows.length)throw Error('Tidak ada baris valid; data lama dipertahankan.');
  const signature=await digest(JSON.stringify([src.spreadsheet,src.gid,heads,parsed.rows]));
  if(signature!==src.snapshot_hash_v68||Number(src.stored_rows_v68)!==parsed.rows.length||Number(src.cursor)!==parsed.cursor){
   for(let i=0;i<parsed.rows.length;i+=500){progress('Memeriksa baris '+(i+1)+'–'+Math.min(i+500,parsed.rows.length)+' dari '+parsed.rows.length+'…');await rpc('commercial_sheet_sync_v68',{p_kind:kind,p_action:'batch',p_run:run,p_data:{headers:heads,rows:parsed.rows.slice(i,i+500)}});}
  }
  const result=await rpc('commercial_sheet_sync_v68',{p_kind:kind,p_action:'commit',p_run:run,p_data:{expected:parsed.rows.length,cursor:parsed.cursor,hash:signature}});committed=true;return result;
 }finally{if(run&&!committed)try{await rpc('commercial_sheet_sync_v68',{p_kind:kind,p_action:'abort',p_run:run,p_data:{}})}catch{}}
}
