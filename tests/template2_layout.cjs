// 템플릿2(문단별 쪽)에서 글을 쪽 위에서부터 놓고, 짧은 쪽 둘이 딱 맞으면 합치며, 쪽 나누기·인사 앞에서는 쪽을 바꾸는지 확인하는 시험
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('index.html','utf8');
const c={PromLineBreaks:require('../korean-line-breaks.js'),TextDecoder,Uint8Array,DataView,localStorage:{getItem(){return null}}};vm.createContext(c);
vm.runInContext([...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)][2][1],c);
vm.runInContext(source.slice(source.indexOf('function parseTagged('),source.indexOf('/* ---------- 워드')),c);
vm.runInContext(source.slice(source.indexOf('const pw='),source.indexOf('// 프롬프터 대본(쪽)을 모바일용')),c);
vm.runInContext('pageTemplate=2',c);
const para=(text,extra={})=>({runs:[{t:text,hex:'000000'}],pb:false,...extra});
const S=(n,t)=>Array.from({length:n},(_,i)=>t+(i+1)+'번째 문장입니다.').join(' ');
const rows=pages=>pages.map(pg=>pg.map(l=>l.map(r=>r.t).join('')));
const text=r=>r.map(pg=>pg.filter(t=>t.trim()&&t.trim()!=='>>'));
for(const K of [5,6,7]){
  // 짧은 두 덩어리의 줄 수가 딱 K줄이면 한 쪽으로 합친다 (1줄+(K-1)줄)
  const a=rows(c.buildPrompter([para('할렐루야!'),para(''),para(S(K-1,'가')),para(''),para(S(K,'나'))],K));
  assert.equal(text(a)[0].length,K,'1줄+'+(K-1)+'줄이 한 쪽 '+K);
  assert(text(a)[0][0].startsWith('할렐루야'));
  // 3줄+(K-3)줄도 합친다
  const b=rows(c.buildPrompter([para(S(3,'가')),para(''),para(S(K-3,'나')),para(''),para(S(K,'다'))],K));
  assert.equal(text(b)[0].length,K,'3줄+'+(K-3)+'줄이 한 쪽 '+K);
  // 원고의 쪽 나누기(Ctrl+Enter)는 합치지 않는다
  const d=rows(c.buildPrompter([para(S(3,'가')),para(S(K-3,'나'),{pb:true})],K));
  assert.equal(d.length,2,'쪽 나누기 앞뒤는 두 쪽 '+K);assert(text(d)[1][0].startsWith('나1'));
  // 제목·본문 뒤 인사(할렐루야)는 새 쪽 맨 위에서 시작한다
  const h=rows(c.buildPrompter([para('<2026년 9월 30일 수요말씀>'),para(''),para('본 문 :'),para('<빌립보서 3장 8~9절> 모든 것을 해로 여깁은'),para(''),para('할렐루야!'),para(''),para(S(K-1,'가'))],K));
  const hi=h.findIndex(pg=>pg.some(t=>t.startsWith('할렐루야')));assert(hi>=1&&h[hi][0].startsWith('할렐루야'),'할렐루야는 쪽 맨 위 '+K);
  // 모든 쪽은 글이 맨 위에서 시작하고(앞쪽 빈 줄 채움 없음), 이어지는 쪽의 >> 는 글 바로 아래 줄에 있다
  const e=rows(c.buildPrompter([para(S(K+2,'가')),para(''),para(S(4,'나')),para(''),para(S(K*2+1,'다'))],K));
  e.forEach((pg,i)=>{
    assert(pg[0].trim()&&pg[0].trim()!=='>>','쪽은 위에서부터 시작 '+K+' '+(i+1)+'쪽 '+JSON.stringify(pg));
    const gt=pg.findIndex(t=>t.trim()==='>>');
    if(gt>=0){assert(pg[gt-1].trim(),'>> 는 글 바로 아래 '+K+' '+(i+1)+'쪽');assert(pg.slice(gt+1).every(t=>!t.trim()),'>> 아래는 빈 줄 채움뿐 '+K);}
  });
}
console.log('PASS template 2: top-aligned pages, >> right under the text, exact-fit merging of short blocks, hard breaks and greeting start new pages');
