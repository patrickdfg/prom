// Exercise the actual cue dispatch block without moving real presentation windows.
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=readFileSync('workspace.js','utf8');
const V=require('../video-cues.js');
const start=source.indexOf('      if(P.length && !editing){');
assert.notEqual(start,-1);
const end=source.indexOf('\n    },',start);
assert.notEqual(end,-1);
const dispatch=source.slice(start,end);
function setup(){
  const requests=[],warnings=[];
  const c={P:[],videoCues:[],cursor:0,PromVideoCues:V,page:0,editing:false,window:{},textOf:pg=>pg,AbortSignal,
    toast:message=>warnings.push(message),Date:{now:()=>10000},
    fetch:(url,options)=>{requests.push({url,options});return Promise.resolve({ok:true});}};
  vm.createContext(c);
  return {c,requests,warnings,async render(text,position){c.P=[[[{t:text,c:'k'}]]];const data=V.build(c.P);c.videoCues=data.cues;c.cursor=position??data.text.length;vm.runInContext(dispatch,c);await new Promise(setImmediate);}};
}
(async()=>{
const valid=[
  ['(영상)','obs'],['(영상끝)','slideshow'],
  ['(영상1 시작)','obs'],['(영상 찬양 시작)','obs'],
  ['(영상 특별영상 끝)','slideshow'],['(영상3 끝)','slideshow'],
  ['(영상 시작)','obs'],['(영상 끝)','slideshow'],
  ['( 영상 12 특별 영상 시작 )','obs'],['(영상\t찬양 2\t끝\t)','slideshow'],
  ['(영상찬양시작)','obs'],['(영상3끝)','slideshow'],
  ['본문 앞 (영상 찬양 시작) 본문 뒤','obs'],
  ['(영상1 시작)\n(영상1 끝)','slideshow'],
  ['(영상끝) (영상2 시작)','obs'],
  ['(영상3 끝) (영상 찬양)','slideshow']
];
for(const [text,target]of valid){
  const t=setup();await t.render(text);
  assert.equal(t.requests.length,1,text);
  assert.equal(t.requests[0].url,'http://127.0.0.1:17986/'+target,text);
  assert.equal(t.requests[0].options.method,'POST');
  assert.equal(t.requests[0].options.credentials,'omit');
}
const invalid=[
  '영상 찬양 시작','(영상 찬양)','(영상1)','(동영상 시작)',
  '(영상 찬양 시작합니다)','(영상 특별영상 끝부분)','(영상 시작 취소)',
  '(영상! 시작)','(영상 test 시작)','(영상 찬양\n시작)',
  '(영상 찬양) 시작)','(영상 찬양 시작','영상끝)'
];
for(const text of invalid){
  const t=setup();await t.render(text);assert.equal(t.requests.length,0,text);
}
const positional=setup(),body='영상 전 문장입니다.(영상1 시작)영상의 첫 대사와 마지막 대사입니다.(영상1 끝)설교가 계속됩니다.';
const indexed=V.build([[[{t:body,c:'k'}]]]);
await positional.render(body,0);assert.equal(positional.requests.length,0,'future markers on the same page must not run');
await positional.render(body,indexed.cues[0].position);assert.equal(positional.requests.length,1);assert(positional.requests[0].url.endsWith('/obs'));
await positional.render(body,indexed.cues[1].position-1);assert.equal(positional.requests.length,1,'last video character must complete before end');
await positional.render(body,indexed.cues[1].position);assert.equal(positional.requests.length,2);assert(positional.requests[1].url.endsWith('/slideshow'));
await positional.render(body,indexed.cues[1].position);assert.equal(positional.requests.length,2);
await positional.render(body,0);assert.equal(positional.requests.length,2,'seeking before the start leaves slides visible');
const t=setup();
await t.render('(영상1 시작)');await t.render('(영상1 시작)');
await t.render('일반 본문');await t.render('(영상 찬양 시작)');
assert.equal(t.requests.length,1,'repeated renders and starts must not switch twice');
await t.render('(영상 특별영상 끝)');await t.render('(영상끝)');
assert.equal(t.requests.length,2,'legacy and named ends share deduplication');
t.c.editing=true;await t.render('(영상3 시작)');
assert.equal(t.requests.length,2,'editing must not switch windows');
t.c.editing=false;await t.render('(영상3 시작)');
assert.equal(t.requests.length,3,'a new start after an end switches again');
t.c.P=[];vm.runInContext(dispatch,t.c);
assert.equal(t.requests.length,3,'empty documents must not switch windows');
const offline=setup();
offline.c.fetch=()=>Promise.reject(new Error('bridge unavailable'));
await offline.render('(영상 찬양 시작)');
assert.equal(offline.c.window.__promObsCue,undefined,'failed requests must not be remembered as successful');
assert.equal(offline.warnings.length,1,'connection failure must be visible');
offline.c.fetch=()=>Promise.resolve({ok:true});
offline.c.Date.now=()=>14000;
await offline.render('(영상 찬양 시작)');
assert.equal(offline.c.window.__promObsCue,'obs','retry must work after bridge is restored');
const missing=setup();missing.c.fetch=()=>Promise.resolve({ok:false,status:409});
await missing.render('(영상끝)');
assert.equal(missing.c.window.__promObsCue,undefined,'missing windows must not count as successful');
assert.equal(missing.warnings.length,1);
const pending=setup();let finish;
pending.c.fetch=(url)=>{pending.requests.push(url);return new Promise(resolve=>finish=resolve);};
await pending.render('(영상 시작)');await pending.render('(영상 시작)');
assert.equal(pending.requests.length,1,'in-flight requests must not be duplicated');
pending.c.window.PromUI={render(){vm.runInContext(dispatch,pending.c);}};
await pending.render('(영상 끝)');
finish({ok:true});await new Promise(setImmediate);
assert.equal(pending.requests.length,2,'latest cue must run when the previous request finishes');
assert.ok(pending.requests[1].endsWith('/slideshow'));
finish({ok:true});await new Promise(setImmediate);
assert.equal(pending.c.window.__promObsCue,'slideshow');
console.log(`PASS ${valid.length} valid cues, ${invalid.length} false positives, deduplication, editing, bridge failure/recovery, missing windows, queued cues`);
})().catch(e=>{console.error(e);process.exitCode=1;});
