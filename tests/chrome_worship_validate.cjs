// Verify native event preservation and deterministic production replay.
// node tests/chrome_worship_validate.cjs <private-root>
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {create}=require('./recording_replay.cjs');
const root=path.resolve(process.argv[2]),repo=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
let checked=0;
for(const mode of ['mic','track']){
 const base=path.join(root,'chrome-tests',mode);if(!fs.existsSync(base))continue;
 for(const date of fs.readdirSync(base))for(const id of fs.readdirSync(path.join(base,date))){
  const folder=path.join(base,date,id),state=read(path.join(folder,'state.json'));
  if(state.lastEvent!=='finish')continue;
  const meta=read(path.join(folder,'metadata.json'));
  for(const [file,expected]of Object.entries(meta.speechSourceSha256)){
   const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,file))).digest('hex');
   if(actual!==expected)throw Error('Source hash mismatch: '+file);
  }
  const layout=read(path.join(root,date,'pages.json')),h=create(layout.pages),events=fs.readFileSync(path.join(folder,'events.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  let carry='',session='',results=0,errors=0,lastTime=-Infinity,lastSource=-Infinity;
  for(const e of events){
   if(e.elapsed<lastTime||e.audioTime<lastSource-.1)throw Error('Non-monotonic event timestamps: '+id);
   lastTime=e.elapsed;lastSource=e.audioTime;
   if(e.type==='result'){
    results++;session=e.results.map(r=>r.alternatives[0]?.transcript||'').join('');
    if(session!==e.sessionText||carry!==e.carry)throw Error('Native event text altered: '+id);
    const t=h.feed({time:e.elapsed,text:session,carry,final:e.results.at(-1)?.isFinal});
    if(t.actual!==e.tracked.actual||t.page!==e.tracked.page)throw Error('Replay differs: '+id+' event '+results);
   }else if(e.type==='end'){carry=(carry+session).slice(-60);session='';}
   else if(e.type==='error')errors++;
  }
  if(results!==state.results||errors!==state.errors||h.c.cursor!==state.cursor)throw Error('Incomplete state counters: '+id);
  if(events.at(-1)?.type!=='finish')throw Error('Missing terminal event: '+id);
  const proof={id,results,errors,timestampsMonotonic:true,sourceHashesMatch:true,
   allRawResultsPreserved:true,productionReplayMatches:true,checkedAt:new Date().toISOString()};
  fs.writeFileSync(path.join(folder,'validation.json'),JSON.stringify(proof,null,1));
  console.log(id,results,'native results verified');checked++;
 }
}
console.log('Verified finished recordings:',checked);
