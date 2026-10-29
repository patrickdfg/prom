// 확정된 음성인식만 실시간 학습하고 사용자 알림 없이 허용 사전에 반영하는 규칙을 검사한다.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const lexicon=fs.readFileSync('speech-lexicon.js','utf8');

assert.match(html,/if\(fin===true&&typeof lexLearn==='function'\)lexLearn\(true\)/);
assert.match(lexicon,/MIN_COUNT=2/);
assert.match(lexicon,/cursor-120/);
assert.match(lexicon,/cursor\+700/);
const from=html.indexOf('let lexFrom=0;');
const to=html.indexOf('function stopMic(){',from);
assert.ok(from>=0&&to>from,'실시간 학습 함수가 존재해야 합니다.');

const learned=[];
const context={
  vlog:[
    {k:'heard',fin:false,heard:'임시 결과',to:10},
    {k:'heard',fin:true,heard:'확정된 결과',to:20}
  ],
  norm:'확정된 원고 내용',
  PromLexicon:{learn(events){learned.push(events.map(e=>e.heard));}}
};
vm.createContext(context);
vm.runInContext(html.slice(from,to),context);
vm.runInContext('lexLearn(true)',context);
assert.deepEqual(learned,[['확정된 결과']]);

context.vlog.push({k:'heard',fin:false,heard:'다음 임시',to:22});
context.vlog.push({k:'heard',fin:true,heard:'다음 확정',to:33});
vm.runInContext('lexLearn(true)',context);
assert.deepEqual(learned[1],['다음 확정']);
vm.runInContext('lexLearn(true)',context);
assert.equal(learned.length,2,'같은 결과를 반복 학습하지 않아야 합니다');
assert.doesNotMatch(html.slice(from,to),/toast\(|alert\(/);
console.log('PROM 실시간 조용한 학습 검증 통과');
