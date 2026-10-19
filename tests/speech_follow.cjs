const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const rows=['오늘은 우리가 믿음으로 살아가는 길에 대하여 함께 생각해 보려고 합니다','살아가면서 만나는 여러 어려움 속에서도 서로 사랑하며 감사합시다','마지막까지 소망을 잃지 않고 함께 걸어가는 우리 모두가 되기를 바랍니다'];
const normalize=s=>s.replace(/[^가-힣a-zA-Z0-9]/g,'');const text=normalize(rows.join(''));let at=0;const ranges=rows.map(r=>{const start=at;at+=normalize(r).length;return [start,at];});
const c={lineRange:[ranges],pageOf:()=>0};vm.createContext(c);vm.runInContext(html.slice(html.indexOf('function lineSpeech('),html.indexOf('function locate3(')),c);
assert.equal(c.lineSpeech(normalize(rows[0]).slice(0,12),text,0),12,'current row short evidence');
assert.equal(c.lineSpeech('감사합시다',text,0),null,'short common next-row phrase cannot skip row');
assert.equal(c.lineSpeech(normalize(rows[2]),text,0),null,'local search cannot jump to third row');
assert.equal(c.confirmedSpeech(text,text,0),text.length,'one bundled page result can recover without another result');
const faulty=text.slice(0,-15)+'쟈'+text.slice(-14);assert(c.confirmedSpeech(faulty,text,0)>=text.length-2,'long evidence tolerates recognition error');
assert.equal(c.confirmedSpeech(text,text+text,0),null,'repeated long phrase remains ambiguous');
assert.equal(c.confirmedSpeech('하나님',text,0),null,'one word cannot trigger recovery');
assert.equal(c.confirmedSpeech(text,text,text.length),null,'stale recognition cannot rewind');
const map=Array.from({length:text.length},(_,i)=>(i+1)*2);assert.equal(c.confirmedSpeech(text,text,0,0,map),text.length*2,'normalized lab position maps to source cursor');
console.log('PASS local rows, short phrase guard, bundled result, recognition error, ambiguous recovery, echo and source mapping');

const workspace=fs.readFileSync('workspace.js','utf8');const state={localRenderer:{},lineRange:[ranges],cursor:100,pend:{pos:120},lastTail:'old',heardCarry:'old',sessionText:'old',speechResultCount:3,speechFloor:0,window:{PromExtras:{resetVoice(){}}},go:()=>{},render:()=>{}};vm.createContext(state);vm.runInContext(workspace.match(/  localRenderer.onSelect=.*;\r?\n/)[0],state);state.localRenderer.onSelect(0,1);assert.equal(state.cursor,ranges[1][0]);assert.equal(state.speechFloor,3);assert.equal(state.heardCarry,'');assert.equal(state.sessionText,'');
const result=html.slice(html.indexOf('    speechResultCount=e.results.length;'),html.indexOf('    sessionText=t; heardLogged('));state.e={results:[[{transcript:'old one'}],[{transcript:'old two'}],[{transcript:'old interim'}],[{transcript:'새 줄 읽기'}]]};assert.equal(vm.runInContext(result+'t',state),'새 줄 읽기','click discards cumulative old results');
console.log('PASS clicked row cursor, pending state reset and stale cumulative result filtering');

