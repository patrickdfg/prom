const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),O=require('../optional-speech.js'),V=require('../video-cues.js'),C=require('../ppt/core.js');
const norm=s=>s.toLowerCase().replace(/[^가-힣a-z0-9]/g,'');
const examples=[
 ['오늘은 (잠시 쉬고) 감사하며 살아갑시다.','오늘은 감사하며 살아갑시다.'],
 ['우리는（설명을 생략합니다）서로 사랑하며 함께 걸어갑니다.','우리는 서로 사랑하며 함께 걸어갑니다.'],
 ['모두가 (설명 (덧붙이는 설명) 끝) 기쁨으로 살아가기를 바랍니다.','모두가 기쁨으로 살아가기를 바랍니다.'],
 ['믿음으로 ('+'매우 긴 설명을 넣습니다 '.repeat(90)+') 함께 걸어가는 우리 모두가 되기를 바랍니다.','믿음으로 함께 걸어가는 우리 모두가 되기를 바랍니다.'],
 ['함께 (여러 줄에\n걸친\n설명입니다) 감사하며 한마음으로 살아갑시다.','함께 감사하며 한마음으로 살아갑시다.'],
 ['오늘은 (첫 설명) 기뻐하며 (다른 설명) 서로 사랑하고 감사합니다.','오늘은 기뻐하며 서로 사랑하고 감사합니다.'],
 ['(처음부터 읽지 않는 설명입니다) 우리는 감사하며 한마음으로 살아갑니다.','우리는 감사하며 한마음으로 살아갑니다.']
];
for(const [raw,heard] of examples){const index=O.build(raw);assert.equal(index.text,norm(heard));assert.equal(O.match(norm(heard),index,0),norm(raw).length,raw.slice(0,30));const hit=C.locateSpeech(heard,norm(raw),0,index);assert.equal(hit.pos,norm(raw).length,'PPT must use canonical character offsets');assert.equal(C.locateSpeech(raw,norm(raw),0,index).pos,norm(raw).length,'reading the parentheses remains supported');}
const mixedRaw='우리는 (처음 설명) 기뻐하며 (두 번째 설명) 서로 사랑하고 한마음으로 감사합니다.';assert.equal(O.match(norm('우리는 처음 설명 기뻐하며 서로 사랑하고 한마음으로 감사합니다.'),O.build(mixedRaw),0),norm(mixedRaw).length,'reading one note and skipping another');
assert.equal(O.build('앞 문장입니다 (닫히지 않은 설명은 그대로 둡니다').groups.length,0);assert.equal(O.build('앞 ) 잘못된 괄호 ( 뒤에도 본문입니다').groups.length,0);
const plain=O.build('앞 문장입니다. 중간 본문은 반드시 읽어야 합니다. 뒤 문장입니다.');assert.equal(O.match('앞문장입니다뒤문장입니다',plain,0),null,'do not skip ordinary text');
const repeated=O.build('오늘은 (설명) 서로 사랑하며 감사합니다. 오늘은 (설명) 서로 사랑하며 감사합니다.');assert.equal(O.match('오늘은서로사랑하며감사합니다',repeated,0),null,'ambiguous omissions must not jump');
assert.equal(O.match('감사',O.build('(긴 설명) 감사합니다'),0),null,'short generic phrases are insufficient');
const end=examples[0],full=norm(end[0]);assert.equal(O.match(norm(end[1]),O.build(end[0]),full.length),null,'stale speech cannot rewind');
// Exercise the actual production index and onHeard handlers, including row/page-wrapped parentheses.
for(const file of ['index.html','classic.html']){
 const html=fs.readFileSync(file,'utf8'),context={PromVideoCues:V,PromOptionalSpeech:O,PromScriptureSpeech:require('../scripture-speech.js'),page:0,cursor:0,heardCarry:'',lastTail:'',cap(){},cueMatch:()=>null,render(){},go(p){context.page=p},$:id=>id==='lead'?{value:'0'}:{textContent:''}};
 vm.createContext(context);vm.runInContext(html.slice(html.indexOf('const keep=ch=>'),html.indexOf('/* ---------- 화면 ---------- */')),context);
 const start=html.indexOf('function onHeard(text){'),end=html.indexOf('// 마이크를 한 번',start);vm.runInContext(html.slice(start,end),context);
 for(const [raw,heard] of examples){context.pages=raw.split('\n').map(line=>[[{t:line,c:'k'}]]);vm.runInContext('P=pages;page=0;cursor=0;heardCarry="";lastTail="";index();',context);context.heard=heard;vm.runInContext('onHeard(heard)',context);assert.equal(context.cursor,norm(raw).length,file+' omitted '+raw.slice(0,25));assert.equal(vm.runInContext('norm.length',context),norm(raw).length,'canonical index remains unchanged');}
}
const data=V.build([[[{t:'오늘은 (영상 시작) 서로 (부연 설명) 사랑하며 감사합니다.',c:'k'}]]]);const projection=O.build(data.spokenRows.flat().join('\n'));const pos=O.match(norm('오늘은 서로 사랑하며 감사합니다.'),projection,0);assert.equal(pos,data.text.length,'silent video markers and omitted parentheticals share canonical offsets');assert.equal(data.cues[0].action,'obs');
console.log('PASS omitted/read parentheses, full-width/nested/multiline/multiple/long notes, canonical cursor mapping, main/classic/PPT handlers, video cues, unmatched delimiters, ordinary-text and ambiguous/short/stale guards');
