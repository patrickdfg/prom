const assert=require('node:assert/strict');
global.window=global;global.CaptionContentRules=require('../content-rules.js');global.CaptionCore=require('../core.js');global.crypto=require('node:crypto').webcrypto;
global.document={currentScript:{src:'http://localhost/ppt/builder.js'},fonts:{load:async()=>{}},createElement:()=>({getContext:()=>({font:'',measureText:t=>({width:t.length*22})})})};require('../builder.js');
const row=(text,paragraph)=>({text,paragraph,runs:[{text,hex:'0000FF'}]}),make=rows=>({lines:rows.map(r=>r.text),richLines:rows});
assert.equal(CaptionBuilder.analyze(make([row('“번호 없는 인용문도 전체 화면으로 만듭니다.”',0)]),{allText:true})[0].layout,'caption');
const source=make([row('앞의 설교 전문은 제외합니다.',0),row('1. “말씀을 듣고 살아라.”',1),row('2. 다음 항목도 그대로 나옵니다.',2),row('마지막 설명은 제외합니다.',3)]),r=CaptionBuilder.analyze(source);
assert.equal(r.length,2);assert(r.every(s=>s.layout==='proverb'));assert(r[0].text.includes('“말씀을 듣고 살아라.”'));assert(!r.some(s=>/설교 전문|마지막 설명/.test(s.text)));
const long='3. '+('긴 항목 안의 내용은 누락하지 않고 다음 장으로 이어져야 합니다. '.repeat(180)),parts=CaptionBuilder.analyze(make([row('2. 앞 항목입니다.',3),row(long,4)])).slice(1);assert(parts.length>1);assert(parts.slice(0,-1).every(s=>s.text.endsWith('\n>>')));assert(!parts.at(-1).text.endsWith('>>'));
for(const input of [
 '1. 하나님을 사랑하는 사람은 성실하게 살아갑니다. 그 말씀을 기억합니다.',
 '1 하나님을 사랑하는 사람은 성실하게 살아갑니다. 그 말씀을 기억합니다.',
 '1.\n하나님을 사랑하는 사람은 성실하게 살아갑니다. 그 말씀을 기억합니다.'
]){
 const lines=CaptionBuilder.wrapForLayout(input,'word');
 assert(!lines.some(line=>/^\d+\.?$/.test(line.trim())),JSON.stringify(lines)+' 숫자만 단독으로 표시됨');
 assert(lines.some(line=>/^1\.?\s+\S/.test(line)),JSON.stringify(lines)+' 번호와 본문이 붙지 않음');
}
const sparse=CaptionBuilder.spreadShortText(['1. 우리는 매일 하나님의 말씀을 듣고 생활 속에서 실천해야 합니다. 서로를 사랑하며 늘 감사해야 합니다.'],'word');
assert.equal(sparse.length,2,'내용이 충분한 전체 화면 한 줄은 두 줄로 재배치');
assert.deepEqual(CaptionBuilder.spreadShortText(['짧은 말씀입니다.'],'word'),['짧은 말씀입니다.'],'짧은 항목의 과도한 줄바꿈 방지');
const attached=CaptionBuilder.spreadShortText(['1.','짧은 말씀입니다.'],'word');
assert.deepEqual(attached,['1. 짧은 말씀입니다.'],'줄이 달라도 번호와 다음 본문을 연결');
console.log('PASS automatic full-screen fallback, numbered punctuation/source scope, long-item continuation, number-line safety');
