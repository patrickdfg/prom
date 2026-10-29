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
for(const file of ['ppt/app.js']){
  const f=load(file);
  assert.equal(f.confirm(3626),false,file+': 먼 결과 첫 발견은 따르지 않는다');
  f.tick(3000);assert.equal(f.confirm(3630),false,file+': 24자 미만 진행은 확인으로 치지 않는다');
  f.tick(3000);assert.equal(f.confirm(3660),true,file+': 24~120자 이어 읽으면 따른다');
  assert.equal(f.confirm(3700),false,file+': 확인 뒤에는 다시 처음부터');
  f.tick(20000);assert.equal(f.confirm(500),false,file+': 15초가 지나면 후보를 새로 잡는다');
  f.tick(20000);assert.equal(f.confirm(900),false);f.tick(1000);assert.equal(f.confirm(2000),false,file+': 흐름이 다른 먼 결과로 확인되지 않는다');
}
// 메인 PROM은 장거리 자동 이동과 과거 위치로의 되돌림을 모두 차단한다.
const html=fs.readFileSync('index.html','utf8');
assert.doesNotMatch(html,/let farCand=null/,'PROM 장거리 재탐색을 제거한다');
assert.match(html,/r\.reacquired\|\|r\.pos<=cursor\|\|r\.pos-cursor>120/,'PROM 전역 재탐색 결과를 차단한다');
assert.match(html,/if\(!trustedOmission&&to-cursor>\(recovered\?180:120\)\)/,'PROM 최대 이동폭을 제한한다');
const app=fs.readFileSync('ppt/app.js','utf8');
assert.match(app,/hit\.reacquired&&Math\.abs\(hit\.pos-cursor\)>450&&!farConfirm\(hit\.pos\)\)hit=null/,'PPT 앱에 확인 절차 연결');
console.log('PASS far jump: PROM의 무제한 점프 제거 · 기존 PPT 앱 먼 위치 확인 유지');
