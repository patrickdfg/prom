// Exercise the actual cue dispatch block without moving real presentation windows.
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=readFileSync('workspace.js','utf8');
const start=source.indexOf('      if(P.length && !editing){');
assert.notEqual(start,-1);
const end=source.indexOf('\n    },',start);
assert.notEqual(end,-1);
const dispatch=source.slice(start,end);
function setup(){
  const requests=[];
  const c={P:[],page:0,editing:false,window:{},textOf:pg=>pg,AbortSignal,
    fetch:(url,options)=>{requests.push({url,options});return Promise.resolve();}};
  vm.createContext(c);
  return {c,requests,render(text){c.P=[text];vm.runInContext(dispatch,c);}};
}
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
  const t=setup();t.render(text);
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
  const t=setup();t.render(text);assert.equal(t.requests.length,0,text);
}
const t=setup();
t.render('(영상1 시작)');t.render('(영상1 시작)');
t.render('일반 본문');t.render('(영상 찬양 시작)');
assert.equal(t.requests.length,1,'repeated renders and starts must not switch twice');
t.render('(영상 특별영상 끝)');t.render('(영상끝)');
assert.equal(t.requests.length,2,'legacy and named ends share deduplication');
t.c.editing=true;t.render('(영상3 시작)');
assert.equal(t.requests.length,2,'editing must not switch windows');
t.c.editing=false;t.render('(영상3 시작)');
assert.equal(t.requests.length,3,'a new start after an end switches again');
t.c.P=[];vm.runInContext(dispatch,t.c);
assert.equal(t.requests.length,3,'empty documents must not switch windows');
const offline=setup();
offline.c.fetch=()=>Promise.reject(new Error('bridge unavailable'));
offline.render('(영상 찬양 시작)');
assert.equal(offline.c.window.__promObsCue,'obs');
console.log(`PASS ${valid.length} valid cues, ${invalid.length} false positives, deduplication, editing, empty document, unavailable bridge`);
