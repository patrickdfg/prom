// 문단 속 줄바꿈으로 만든 빈 줄(문단 맨 앞·맨 끝의 줄바꿈, 줄바꿈 두 번)이 스크롤 보기의 문단 간격이 되는지 확인하는 시험
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('index.html','utf8');
const c={PromLineBreaks:require('../korean-line-breaks.js'),TextDecoder,Uint8Array,DataView,localStorage:{getItem(){return null}}};vm.createContext(c);
vm.runInContext([...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)][2][1],c);
vm.runInContext(source.slice(source.indexOf('function parseTagged('),source.indexOf('/* ---------- 워드')),c);
vm.runInContext(source.slice(source.indexOf('const pw='),source.indexOf('// 프롬프터 대본(쪽)을 모바일용')),c);
const para=text=>({runs:[{t:text,hex:'000000'}],pb:false});
const gaps=K=>{
  const pages=c.buildPrompter([
    para('첫째 줄입니다.'),
    para('\n둘째 문단입니다.\n'),            // 앞의 줄바꿈 = 빈 줄, 뒤의 줄바꿈 = 빈 줄
    para('셋째 줄입니다.\n\n넷째 문단입니다.'),  // 줄바꿈 두 번 = 빈 줄
    para('다섯째 줄입니다.'),                  // 빈 줄 없이 이어지는 문단은 간격이 없다
  ],K);
  const rows=pages.flat().map(l=>({t:l.map(r=>r.t).join('').replace(/\s*>>$/,''),gap:l.some(r=>r.paragraphStart)}));
  return {rows,gap:rows.filter(r=>r.gap).map(r=>r.t)};
};
for(const K of [5,6,7]){
  const {rows,gap}=gaps(K);
  assert.equal(JSON.stringify(rows.map(r=>r.t)),JSON.stringify(['첫째 줄입니다.','둘째 문단입니다.','셋째 줄입니다.','넷째 문단입니다.','다섯째 줄입니다.']),'글자와 순서 '+K);
  assert.equal(JSON.stringify(gap),JSON.stringify(['둘째 문단입니다.','셋째 줄입니다.','넷째 문단입니다.']),'빈 줄이 있던 자리만 간격이 된다 '+K);
}
console.log('PASS line-break blank lines (leading, trailing, doubled) become paragraph gaps in 5/6/7-row pagination');
