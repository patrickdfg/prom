// 한 인용이 여러 장으로 이어질 때 중간 문장에 '하나님·성령'이 나와도 배경(화자 레이아웃)이 바뀌지 않는지 확인하는 Node 시험
const assert=require('node:assert/strict');
global.window=global;global.CaptionCore=require('../core.js');
global.crypto=global.crypto||require('node:crypto');
global.document={currentScript:{src:'http://localhost/ppt/builder.js'},fonts:{load:()=>Promise.resolve()},createElement:()=>({getContext:()=>({font:'',measureText:t=>({width:t.length*22})})})};
require('../builder.js');
const B=global.CaptionBuilder;
const green=text=>({text,runs:[{text,hex:'008000'}]});
const run=rows=>B.analyze({lines:rows.map(r=>r.text),richLines:rows},{cumulative:false});
// 1) 이어지는 인용: 모두 같은 레이아웃
let out=run([green('“너희는 예수님 기다리나? 너희는 예수님 기다리나? 너희는 예수님 기다리나? 너희는 예수님 기다리나? 너희는 예수님 기다리나? 너희는 자녀들이냐? 우리는 예수님을 맞고 신부 되어 같이 산다. 그리고 하나님, 성령, 성자, 예수님이 보낸 자 통해 주신 새 말씀, 너희가 기다리는 말씀을 듣고 행해야 얻고 신부 되어 산다.”')]);
assert.ok(out.length>1,'여러 장이어야 한다');
assert.equal(new Set(out.map(s=>s.layout)).size,1,'이어지는 인용은 한 배경: '+out.map(s=>s.layout).join(','));
assert.equal(out[0].layout,'wordSon');
// 2) 새 따옴표로 시작하는 다른 화자의 말씀은 바뀐다
out=run([green('“예수님이 말씀하셨다. 나를 따르라.” “하나님이 말씀하시기를 너희는 내 백성이라 하셨다.”')]);
assert.deepEqual([...new Set(out.map(s=>s.layout))],['wordSon','wordGod']);
console.log('PASS 이어지는 인용은 같은 배경, 새 인용은 화자 배경');
