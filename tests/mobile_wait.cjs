// Actual mobile wait functions, with deterministic microphone samples and timers.
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=readFileSync('index.html','utf8');
const source=html.slice(html.indexOf('let lastResultAt='),html.indexOf('function releaseMic()'));
function setup(){
  let now=0, sample=0, starts=0, stopped=0, trackStops=0, next=0;
  const intervals=new Map(),timeouts=new Map();
  const stream={getTracks:()=>[{stop(){trackStops++}}]};
  const ac={state:'running',resume:async()=>{},suspend:async()=>{},createAnalyser:()=>({fftSize:1024,getFloatTimeDomainData:a=>a.fill(sample)}),createMediaStreamSource:()=>({connect(){}})};
  const c={Date:{now:()=>now},Float32Array,Math,listening:true,navigator:{mediaDevices:{getUserMedia:async()=>stream}},$:()=>({}),startRec:()=>starts++,stopMic:()=>{stopped++;c.listening=false;vm.runInContext('endWait()',c)},toast(){},setInterval:fn=>{intervals.set(++next,fn);return next},clearInterval:id=>intervals.delete(id),setTimeout:fn=>{timeouts.set(++next,fn);return next},clearTimeout:id=>timeouts.delete(id),ac};
  vm.createContext(c);vm.runInContext(source+'\nwaitAC=ac;',c);
  return {c,stream,get starts(){return starts},get stopped(){return stopped},get trackStops(){return trackStops},tick(n,value=0){sample=value;for(let i=0;i<n;i++){now+=50;for(const fn of [...intervals.values()])fn()}},flush(){for(const [id,fn]of [...timeouts]){timeouts.delete(id);fn()}}};
}
(async()=>{
  let t=setup();await t.c.androidWait();t.tick(1200);t.flush();assert.equal(t.starts,0,'one minute of digital silence must not restart');
  t.tick(4,.08);t.flush();assert.equal(t.starts,1,'sustained input resumes once');assert.equal(t.trackStops,1);
  t=setup();await t.c.androidWait();t.tick(10,.08);t.tick(40);t.flush();assert.equal(t.starts,0,'ending chime must not wake recognizer');
  t=setup();t.c.navigator.mediaDevices.getUserMedia=async()=>{throw Error('denied')};await t.c.androidWait();t.flush();assert.equal(t.starts,0);assert.equal(t.stopped,1,'input error stops instead of looping');
  t=setup();let resolve;t.c.navigator.mediaDevices.getUserMedia=()=>new Promise(r=>resolve=r);const pending=t.c.androidWait();t.c.stopMic();resolve(t.stream);await pending;assert.equal(t.trackStops,1,'late permission response releases stream');t.flush();assert.equal(t.starts,0);
  t=setup();await t.c.androidWait();t.tick(40);t.tick(4,.08);t.c.stopMic();t.flush();assert.equal(t.starts,0,'stop cancels pending restart');
  const handler=html.slice(html.indexOf('  rec.onend=()=>{'),html.indexOf('  rec.onstart=()=>{'));
  const recognition={};let waits=0,ends=0;
  const c={rec:recognition,activeRec:recognition,listening:true,ANDROID:true,emptySessions:0,sessionText:'recent speech',heardCarry:'',spLast:1,setDot(){},androidWait(){waits++},stopMic(){ends++;c.listening=false},toast(){},startRec(){throw Error('mobile must wait first')},setTimeout(){throw Error('unexpected restart')}};
  vm.createContext(c);vm.runInContext(handler,c);recognition.onend();assert.equal(waits,1,'even recent speech waits after mobile disconnect');
  for(let i=0;i<3;i++)recognition.onend();assert.equal(ends,1,'three empty sessions stop the loop');
  c.listening=true;c.rec={};recognition.onend();assert.equal(waits,3,'stale recognizer cannot restart the current session');
  console.log('PASS mobile silence, chime rejection, speech wake, permission failure, late stream cleanup, cancelled restart');
})().catch(e=>{console.error(e);process.exitCode=1});
