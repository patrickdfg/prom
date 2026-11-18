// 원고의 쪽 나누기(Ctrl+Enter)와 제목·본문 뒤 인사(할렐루야)가 새 쪽 맨 위에서 시작하는지 확인하는 시험
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('index.html','utf8');
const c={PromLineBreaks:require('../korean-line-breaks.js'),TextDecoder,Uint8Array,DataView,localStorage:{getItem(){return null}}};vm.createContext(c);
vm.runInContext([...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)][2][1],c);
vm.runInContext(source.slice(source.indexOf('function parseTagged('),source.indexOf('/* ---------- 워드')),c);
vm.runInContext(source.slice(source.indexOf('const pw='),source.indexOf('// 프롬프터 대본(쪽)을 모바일용')),c);
const para=(text,extra={})=>({runs:[{t:text,hex:'000000'}],pb:false,...extra});
const rows=pages=>pages.map(pg=>pg.map(l=>l.map(r=>r.t).join('')));
const topRows=pages=>rows(pages).map(pg=>pg[0]);
const preface=[para('<2026년 10월 7일 수요말씀>'),para(''),para('이기는 자'),para('본 문 :'),para('<요한계시록 6장 2절> “내가 이에 보니 흰 말이 있는데 그 탄 자가 활을 가졌고 면류관을 받고 나가서 이기고 또 이기려고 하더라”'),para('')];
const sermon=[para('할렐루야!'),para('이번 주 주일에는 끝까지 하나님 안에서 성령과 주와 사는 것이 이기는 것이라는 주제로 말씀했습니다.'),para('오늘은 주일에 이어 이기는 자라는 주제의 말씀을 전하겠습니다.')];
for(const K of [5,6,7]){
  // 제목·본문이 앞에 있으면 본문이 끝난 자리에서 쪽을 바꿔 할렐루야가 새 쪽 맨 위에서 시작한다
  const pages=c.buildPrompter([...preface,...sermon],K);
  assert(topRows(pages).includes('할렐루야!'),'할렐루야가 쪽 맨 위에 있다 '+K);
  const hi=topRows(pages).indexOf('할렐루야!');
  assert(hi>=1,'앞에 제목·본문 쪽이 있다 '+K);
  assert(rows(pages)[hi-1].every(t=>!/할렐루야/.test(t)),'앞 쪽에는 할렐루야가 없다 '+K);
  // 제목·본문 없이 할렐루야부터 시작하는 원고는 그대로 첫 쪽부터 시작한다
  const plain=c.buildPrompter(sermon,K);
  assert.equal(rows(plain)[0][0],'할렐루야!','할렐루야로 시작하는 원고는 첫 쪽 첫 줄 '+K);
  // 원고의 명시적 쪽 나누기(Ctrl+Enter)는 새 쪽에서 시작한다
  const hard=c.buildPrompter([para('앞쪽 문장입니다.'),para('명시적인 쪽 나눔 뒤의 문장입니다.',{pb:true}),para('그 뒤에 이어지는 문장입니다.')],K);
  assert.equal(rows(hard).length,2,'쪽 나누기 앞뒤로 두 쪽 '+K);
  assert(rows(hard)[1][0].startsWith('명시적인'),'쪽 나누기 뒤는 새 쪽 맨 위 '+K);
  // 쪽 나누기가 없으면 짧은 문단도 쪽을 꽉 채운다
  const soft=c.buildPrompter([para('첫째 문단입니다.'),para(''),para('둘째 문단입니다.'),para(''),para('셋째 문단입니다.')],K);
  assert.equal(rows(soft).length,1,'쪽 나누기가 없으면 한 쪽에 이어진다 '+K);
}
// 할렐루야가 없는 원고에는 억지로 쪽을 바꾸지 않는다
const none=c.buildPrompter([para('<2026년 10월 7일 수요말씀>'),para(''),para('본 문 :'),para('첫째 문장입니다.'),para('둘째 문장입니다.')],5);
assert.equal(rows(none).length,1);
console.log('PASS manuscript page breaks (Ctrl+Enter) start a new page and the greeting after title/scripture starts on a fresh page in 5/6/7 rows');
