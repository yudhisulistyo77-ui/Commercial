'use strict';
const {spawnSync}=require('node:child_process'),fs=require('node:fs');
const outlets=[...new Set((process.env.PRICE_OUTLETS||'TIGALAPANKAOS MANADO').split(',').map(s=>s.trim()).filter(Boolean))];
if(!outlets.length||outlets.length>30)throw Error('Pilih 1–30 outlet untuk pemulihan Price List.');
const results=[];for(const outlet of outlets){const task=spawnSync(process.execPath,[__dirname+'/moka_price_sync_v38.cjs',outlet],{encoding:'utf8',timeout:330000});if(task.status!==0){const reason=(task.stderr||task.error?.message||'Helper gagal').trim().slice(-400);results.push({outlet,status:'error',reason});console.error(outlet+': '+reason);continue}try{const receipt=JSON.parse(task.stdout.split('\n').find(l=>l.startsWith('PRICE_RESULT_JSON=')).slice('PRICE_RESULT_JSON='.length));if(receipt.outlet!==outlet||!['saved','unchanged','skipped'].includes(receipt.status))throw Error('Status tidak valid');results.push(receipt);console.log(outlet+': '+receipt.status)}catch(e){results.push({outlet,status:'error',reason:e.message})}}
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'\n### Pemulihan Price List\n\n| Toko | Status | Keterangan |\n|---|---|---|\n'+results.map(r=>`| ${r.outlet.replace(/\|/g,' ')} | ${r.status} | ${(r.reason||'').replace(/[\r\n|]/g,' ')} |`).join('\n')+'\n');
if(results.some(r=>r.status==='error'))process.exitCode=1;
