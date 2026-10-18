// 원고에서 자막을 나눌 때 닫는 따옴표·문장 경계·화자·줄바꿈 균형을 확인하는 Node 시험
const assert=require('node:assert/strict');
global.window=global;global.CaptionCore=require('../core.js');
global.crypto=global.crypto||require('node:crypto');
global.document={currentScript:{src:'http://localhost/ppt/builder.js'},fonts:{load:()=>Promise.resolve()},createElement:()=>({getContext:()=>({font:'',measureText:t=>({width:t.length*22})})})};
require('../builder.js');
const B=global.CaptionBuilder,K={black:'000000',blue:'0000FF',green:'008000'};
const rows=spec=>({lines:spec.map(r=>r.map(x=>x[1]).join('')),richLines:spec.map(r=>({text:r.map(x=>x[1]).join(''),runs:r.map(([c,text])=>({text,hex:K[c]}))}))});
const run=(spec,options)=>B.analyze(rows(spec),options);
const texts=out=>out.map(s=>s.text);

// 1) 닫는 따옴표는 앞 문장에 붙고, 따옴표 하나만 남은 조각이 생기지 않는다
let out=run([[['blue','“말씀을 듣고 살아라.”']],[['black','설명']],[['blue','‘끝까지 이기는 것이다.’']]]);
assert.deepEqual(texts(out),['“말씀을 듣고 살아라.”','‘끝까지 이기는 것이다.’']);

// 2) 문장 안의 작은따옴표는 문장을 끊지 않는다
out=run([[['green','“자기 육이 해야 한다. 혼과 영은 ‘저 물건 가지고 와.’ 해도 못 한다. 그러나 육이 하면 같이 한다.”']]]);
assert.ok(out.every(s=>!/^[’”]/.test(s.text.split('\n').pop())),'닫는 따옴표로 시작하는 줄');
assert.ok(out.at(-1).text.replace(/\n/g,' ').includes('‘저 물건 가지고 와.’ 해도 못 한다.'),'작은따옴표 문장이 끊김');
assert.ok(out.at(-1).text.endsWith('같이 한다.”'));

// 3) 원고의 줄바꿈(화면 줄 끝)이 문장 중간이면 한 문장으로 잇는다 — 줄마다 공개되지 않는다
out=run([[['blue','구원자를 통해 하나님의 말씀을 듣고 행해야']],[['blue','악에서 구원되어 선에 속해 삽니다.']]]);
assert.equal(out.length,1);assert.equal(out[0].cumulative,false);assert.ok(out[0].text.replace(/\n/g,' ').includes('행해야 악에서'));

// 4) 마침표 뒤에 공백이 없어도 문장이 나뉘고, 5줄을 넘는 말씀은 문장 중간이 아닌 곳에서 장이 바뀐다
const long='전지전능하시고 영원하신 하나님이 보내신 구원자를 통해 하나님을 믿고 성령 안에서 매일 그의 몸 되어 하나님의 뜻과 목적을 이루며 살아야 합니다.';
const long2='그래야만 온전한 선의 사람이 되어 육신도 형통하고 영도 영원한 하나님께 속한 천국에 가서 영원토록 살게 됩니다.';
out=run([[['green',long+long2]]]);
assert.ok(out.length>=2);
const finals=out.filter((s,i)=>!out[i+1]||out[i+1].group!==s.group);
assert.ok(finals.every(s=>/[.”]$/.test(s.text)),'문장 중간에서 장이 끊김');
assert.ok(finals.every(s=>s.text.split('\n').length<=5));

// 5) 화자 — 인용문 앞의 검정 글씨, 이름이 둘이면 기본 말씀 유지
const quote='“물에 떠내려가는 생명을 구하자.”';
assert.equal(run([[['black','성령님 말씀입니다. '],['green',quote]]])[0].layout,'wordSpirit');
assert.equal(run([[['black','예수님은 '],['green',quote]]])[0].layout,'wordSon');
assert.equal(run([[['black','선생이 사명자로서 말합니다.'],['green',quote]]])[0].layout,'wordTeacher');
assert.equal(run([[['black','하나님도 성령도 지금 이같이 말씀해 주십니다. '],['green',quote]]])[0].layout,'word');
assert.equal(run([[['black','그냥 설명입니다. '],['green',quote]]])[0].layout,'word');
assert.equal(run([[['black','성령님 말씀입니다.']],[['green',quote]]])[0].layout,'wordSpirit','앞 줄의 검정 글씨도 사용');
assert.equal(run([[['green','나 하나님과 성령을 위해 행하여라.']]],{greenLayout:'wordSon'})[0].layout,'wordGod','인용문 안의 이름이 우선');

// 6) 줄바꿈 균형 — 마지막 줄에 한 단어만 남지 않는다
out=run([[['blue','하나님은 선생에게 실제 전쟁을 겪게 하시고 섭리사에서 악과의 영적 전쟁을 하게 하셨습니다 그리고 끝까지 함께 하셨습니다.']]]);
for(const s of out){const r=s.text.split('\n');if(r.length>1)assert.ok(r.at(-1).length>=r[0].length*.4,'마지막 줄이 너무 짧음: '+JSON.stringify(r));}
console.log('PASS closing quotes, inner quotes, soft line joins, sentence paging, speaker context, balanced wrapping');
