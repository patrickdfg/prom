// 글머리표(◎ ○ ◯)가 화면 줄에 남고, 줄 끝에 홀로 떨어지지 않으며, 음성 맞춤 글자에는 들어가지 않는지 확인하는 시험
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('index.html','utf8');
const c={PromLineBreaks:require('../korean-line-breaks.js'),TextDecoder,Uint8Array,DataView,localStorage:{getItem(){return null}}};vm.createContext(c);
vm.runInContext([...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)][2][1],c);
vm.runInContext(source.slice(source.indexOf('function parseTagged('),source.indexOf('/* ---------- 워드')),c);
vm.runInContext(source.slice(source.indexOf('const pw='),source.indexOf('// 프롬프터 대본(쪽)을 모바일용')),c);
const para=(...runs)=>({runs:runs.map(t=>({t,hex:'000000'})),pb:false});
const rows=pages=>pages.flat().map(l=>l.map(r=>r.t).join(''));
for(const K of [5,6,7]){
  const pages=c.buildPrompter([
    para('할렐루야!'),para(''),
    para('◎ ','상식은 확인하고 물어보지 않아도 예전에 본 대로입니다.'),     // 문단 모양의 글머리표는 글자 한 덩어리로 앞에 붙는다
    para(''),
    para('○ 누가 믿고 따르든지 간에 기독교의 그 허황된 말들 예수님이 하늘 구름 타고 온다는 말을 이룰 곳 어디에 있습니까'),   // 직접 쓴 글머리표
    para(''),
    para('◯ ','짧은 문장입니다.'),
  ],K);
  const r=rows(pages);
  assert(r.some(t=>t.startsWith('◎ 상식은')),'◎ 가 문단 맨 앞에 남는다 '+K);
  assert(r.some(t=>t.startsWith('○ 누가')),'직접 쓴 ○ 도 남는다 '+K);
  assert(r.some(t=>t.startsWith('◯ 짧은')),'◯ 도 남는다 '+K);
  assert(r.every(t=>!/^[◎○◯]\s*$/.test(t.trim())),'글머리표만 있는 줄은 없다 '+K);
}
// 음성 맞춤은 글자·숫자만 쓴다(index.html 의 keep). 글머리표는 거기에 들지 않는다
assert(source.includes('const keep=ch=>/[가-힣a-zA-Z0-9]/.test(ch);'));assert(![...'◎○◯'].some(ch=>/[가-힣a-zA-Z0-9]/.test(ch)));
console.log('PASS bullet marks stay on screen, never stand alone on a line, and are ignored by speech matching');
