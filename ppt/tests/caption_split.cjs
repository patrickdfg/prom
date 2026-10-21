const assert=require('node:assert/strict');
global.window=global;global.CaptionContentRules=require('../content-rules.js');global.CaptionCore=require('../core.js');global.crypto=require('node:crypto').webcrypto;
global.document={currentScript:{src:'http://localhost/ppt/builder.js'},fonts:{load:async()=>{}},createElement:()=>({getContext:()=>({font:'',measureText:t=>({width:t.length*22})})})};require('../builder.js');
const row=(text,paragraph)=>({text,paragraph,runs:[{text,hex:'0000FF'}]}),make=rows=>({lines:rows.map(r=>r.text),richLines:rows});
assert.deepEqual(CaptionBuilder.analyze(make([row('“번호 없는 인용문은 만들지 않습니다.”',0)]),{allText:true}),[]);
const source=make([row('앞의 설교 전문은 제외합니다.',0),row('1. “말씀을 듣고 살아라.”',1),row('2. 다음 항목도 그대로 나옵니다.',2),row('마지막 설명은 제외합니다.',3)]),r=CaptionBuilder.analyze(source);
assert.equal(r.length,2);assert(r.every(s=>s.layout==='proverb'));assert(r[0].text.includes('“말씀을 듣고 살아라.”'));assert(!r.some(s=>/설교 전문|마지막 설명/.test(s.text)));
const long='3. '+('긴 항목 안의 내용은 누락하지 않고 다음 장으로 이어져야 합니다. '.repeat(180)),parts=CaptionBuilder.analyze(make([row(long,4)]));assert(parts.length>1);assert(parts.slice(0,-1).every(s=>s.text.endsWith('\n>>')));assert(!parts.at(-1).text.endsWith('>>'));
console.log('PASS removed color/full-text caption route, numbered punctuation/source scope and long-item continuation');
