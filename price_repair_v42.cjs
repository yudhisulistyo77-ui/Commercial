'use strict';
const {spawnSync}=require('node:child_process');
const {isDC}=require('./moka_price_sync_v38.cjs');
const outletList=(process.env.PRICE_OUTLETS||'TIGALAPANKAOS MANADO').split(',').map(x=>x.trim()).filter(Boolean);
if(!outletList.length||outletList.length>30)throw Error('Pilih 1–30 outlet');
const chosen=outletList.filter(name=>{if(isDC(name)){console.log('Price List dilewati: '+name+' (DC/gudang)');return false}return true});
if(!chosen.length)process.exit(0);
const task=spawnSync('python3',[__dirname+'/moka_sync.py'],{stdio:'inherit',env:{...process.env,ONLY_OUTLETS:chosen.join(','),SYNC_MODE:'price',SKIP_SALES:'1',INCLUDE_LIBRARY:'1'},timeout:7200000});
if(task.error)throw task.error;process.exitCode=task.status||0;
