/* V96 · Sekretaris Visit: membaca rencana visit yang SAMA dengan menu Schedule Management
   (visit-plan-v86.js + perubahan visit_plan_v87) tanpa browser. Input: JSON visit_plan_v87 di stdin. */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const raw=fs.readFileSync(0,'utf8').trim();
const noop=()=>{};
const ctx={console,Date,JSON,Math,Number,String,Array,Object,Set,Map,RegExp,Error,Intl,
  crypto:{randomUUID:()=>'00000000-0000-0000-0000-000000000000'},
  S:{demo:false,settings:{visit_plan_v87:raw||'null'}},
  renderOps:noop,el:noop,$:()=>null,toast:noop,DB:{},localStorage:{getItem:()=>null,setItem:noop}};
ctx.window=ctx;ctx.globalThis=ctx;
vm.createContext(ctx);
for(const f of ['visit-plan-v86.js','visit-v87.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
if(!ctx.VISIT87_UI||typeof ctx.VISIT87_UI.data!=='function')throw Error('visit-v87.js belum versi V96 (U.data tidak ada).');
const d=ctx.VISIT87_UI.data();
const pick=(r,keys)=>Object.fromEntries(keys.map(k=>[k,r[k]??'']));
process.stdout.write(JSON.stringify({
  sched:d.sched.map(r=>pick(r,['date','spv','cabang','metode','trip','kegiatan','status','hasil','pic'])),
  itinerary:d.itinerary.map(r=>pick(r,['trip','date','time','task','detail','status','hasil','pic'])),
  trips:d.trips.map(r=>pick(r,['id','code','spv','spvLabel','label','start','end','mode','status']))
}));
