// 먼 구절 오인식으로 이동하지 않고 낭독 속도·연속 문장 확인 후에만 가까운 위치를 복구하는지 검사한다.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const SafeFollow=require('../speech-safe-follow.js');
const manuscript=Array.from({length:1500},(_,i)=>String.fromCharCode(0xAC00+i)).join('');
let now=0;
const follow=SafeFollow.create(()=>now);
follow.reset(0);
assert.equal(follow.recover(manuscript.slice(64,96),manuscript,0),null,'낭독 속도가 없으면 시간으로 위치를 추측하지 않는다');
now=4000;follow.progress(24); // 4초에 정상 진행한 24자, 초당 약 6자.
now=9000;
assert.equal(follow.recover(manuscript.slice(64,96),manuscript,24),null,'10초 미만 정지에서는 복구하지 않는다');
now=16000;
assert.equal(follow.recover(manuscript.slice(950,990),manuscript,24),null,'잠언 5번처럼 먼 구절은 이동하지 않는다');
assert.equal(follow.recover(manuscript.slice(64,96),manuscript,24),null,'처음 찾은 가까운 문장은 곧바로 이동하지 않는다');
now=18000;
assert.equal(follow.recover(manuscript.slice(78,110),manuscript,24),110,'다른 인식 결과로 이어 읽는 흐름을 확인하면 복구한다');
follow.reset(0);
now=22000;follow.progress(24);
now=34000;
const repeated=manuscript+manuscript.slice(64,110);
assert.equal(follow.recover(manuscript.slice(64,96),repeated,24),null,'원고 전체에 반복되는 문장은 복구 근거로 사용하지 않는다');
follow.reset(0);
now=38000;follow.progress(24);
now=50000;
assert.equal(follow.recover(manuscript.slice(64,96),manuscript,24),null);
follow.reset(24);
now=52000;
assert.equal(follow.recover(manuscript.slice(78,110),manuscript,24),null,'수동 이동 후 과거 복구 후보는 폐기한다');

const html=fs.readFileSync('index.html','utf8');
assert.match(html,/speech-safe-follow\.js/,'실제 프롬프터에서 복구 모듈을 불러온다');
assert.match(html,/r\.reacquired\|\|r\.pos<=cursor\|\|r\.pos-cursor>120/,'전역 재탐색 결과는 채택하지 않는다');
assert.match(html,/if\(!trustedOmission&&to-cursor>\(recovered\?180:120\)\)/,'즉시 추적의 이동폭을 제한한다');
assert.doesNotMatch(html,/let farCand=null/,'기존 원고 전체 장거리 점프 확인 기능을 제거한다');
console.log('PASS 안전형 음성 추적: 큰 점프 금지, 10초 정지, 속도 기반 주변 검색, 반복 구절 배제, 두 번 연속 확인, 수동 이동 초기화');
