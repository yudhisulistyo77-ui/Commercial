import {syncSheet} from '../sheets-sync-v68.mjs';
import {csv,parseTraffic,SOURCE_URL} from '../traffic-source-v63.mjs';
const base=(process.env.SUPABASE_URL||'').replace(/\/$/,''),key=process.env.SUPABASE_KEY||'';
if(!base||!key||key.startsWith('sb_publishable_'))throw Error('SUPABASE_URL dan secret/service role diperlukan.');
const headers={apikey:key,'Content-Type':'application/json',...(key.startsWith('eyJ')?{Authorization:'Bearer '+key}:{})};
async function db(path,args){const r=await fetch(base+'/rest/v1/'+path,{headers,method:args===undefined?'GET':'POST',...(args===undefined?{}:{body:JSON.stringify(args)}),signal:AbortSignal.timeout(90000)});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error('Database HTTP '+r.status+': '+(d.message||d.error||'periksa SQL V68'));return d;}
const rpc=(name,args)=>db('rpc/'+name,args);let failed=0;
for(const kind of ['loss','service','product','csl']){try{const d=await syncSheet(kind,{rpc,progress:message=>console.log(kind+': '+message)});console.log(kind+': '+d.inserted+' baru; '+d.updated+' koreksi; '+d.skipped+' tidak berubah; '+(d.empty_count||0)+' kosong dilewati; '+(d.invalid_date_count||0)+' tanggal tidak valid dilewati; '+(d.retained??'semua bila sumber kosong')+' data lama dipertahankan.')}catch(e){failed++;console.error(kind+': '+e.message)}}
try{const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Makassar'}).format(new Date()),from=today.slice(0,4)+'-01-01';const [stores,aliases,response]=await Promise.all([db('stores?select=id,name'),db('store_aliases?select=store_id,alias'),fetch(SOURCE_URL,{signal:AbortSignal.timeout(90000)})]);if(!response.ok)throw Error('Google Sheet HTTP '+response.status);const parsed=parseTraffic(csv(await response.text()),stores,aliases,from,today);
// Import one complete traffic window: current RPC skips existing rows and retains manual overrides.
const d=await rpc('commercial_traffic_import_v62',{p_from:from,p_to:today,p_stores:parsed.stores,p_rows:parsed.rows});console.log('traffic: '+(d.inserted??d.rows)+' baru; '+(d.updated||0)+' koreksi; '+(d.skipped||0)+' tidak berubah. Koreksi manual dipertahankan.');if(parsed.warnings.length)console.warn('traffic: '+parsed.warnings.length+' nama toko belum cocok alias.');
}catch(e){failed++;console.error('traffic: '+e.message)}
if(failed){console.error(failed+' sumber belum berhasil. Sumber lain tetap diproses.');process.exitCode=1}
