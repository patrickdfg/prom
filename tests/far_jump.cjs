// 원고 전체에서 12글자쯤만 맞는 '다시 찾음'이 먼 곳(450자 넘게)이면 바로 따르지 않고 이어 읽는 흐름이 확인될 때만 따른다.
// 실제 예배 시험(9월 13일): 109→3626 점프 후 앞으로만 가는 커서가 21분간 돌아오지 못했다.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function load(file){
  const src=fs.readFileSync(file,'utf8');
  const m=src.match(/let farCand=null;\s*function farConfirm\([\s\S]*?return false\s*\}/);
  assert.ok(m,file+': farConfirm 코드를 찾지 못함');
  let now=1e6;const c={Date:{now:()=>now}};vm.createContext(c);vm.runInContext(m[0],c);
  return {confirm:p=>vm.runInContext('farConfirm('+p+')',c),tick:ms=>{now+=ms}};
}
for(const file of ['index.html','ppt/app.js']){
  const f=load(file);
  assert.equal(f.confirm(3626),false,file+': 먼 결과 첫 발견은 따르지 않는다');
  f.tick(3000);assert.equal(f.confirm(3630),false,file+': 24자 미만 진행은 확인으로 치지 않는다');
  f.tick(3000);assert.equal(f.confirm(3660),true,file+': 24~120자 이어 읽으면 따른다');
  assert.equal(f.confirm(3700),false,file+': 확인 뒤에는 다시 처음부터');
  f.tick(20000);assert.equal(f.confirm(500),false,file+': 15초가 지나면 후보를 새로 잡는다');
  f.tick(20000);assert.equal(f.confirm(900),false);f.tick(1000);assert.equal(f.confirm(2000),false,file+': 흐름이 다른 먼 결과로 확인되지 않는다');
}
// onHeard: 먼 결과·되돌림이 확인 거쳐야 따르는 분기 연결(소스 점검)
const html=fs.readFileSync('index.html','utf8');
assert.match(html,/ppt=pptSpeech\(text\)\)!==null&&\(!ppt\.far\|\|farConfirm\(ppt\.pos\)\)/,'PROM 분기에 확인 절차 연결');
assert.match(html,/cursor=backTo\?hit\.pos:Math\.max\(cursor,hit\.pos\)/,'확인된 되돌림만 뒤로 이동');
const app=fs.readFileSync('ppt/app.js','utf8');
assert.match(app,/hit\.reacquired&&Math\.abs\(hit\.pos-cursor\)>450&&!farConfirm\(hit\.pos\)\)hit=null/,'PPT 앱에 확인 절차 연결');
console.log('PASS far jump: 먼 다시 찾음은 이어 읽을 때만 따름 (PROM·PPT), 되돌림도 같은 확인');
