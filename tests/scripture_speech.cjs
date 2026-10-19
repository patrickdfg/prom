const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const B=require('../scripture-speech.js'),O=require('../optional-speech.js'),S=require('../speech-match.js'),V=require('../video-cues.js'),C=require('../ppt/core.js');
const norm=s=>s.replace(/[^가-힣a-zA-Z0-9]/g,'').toLowerCase();
const middle='오늘우리가함께기억할말씀은어려운이웃의손을잡고끝까지동행하는사랑입니다';
const commentary='이제이말씀이우리의가정과일터에서어떻게실천되어야하는지구체적으로함께살펴보겠습니다';
const raw='요한복음 3:16\n'+'말씀본문입니다'.repeat(240)+middle+'나머지본문입니다'.repeat(90)+'\n'+commentary;
const index=B.build(raw),cursor=index.references[0].end;
assert.equal(index.text,norm(raw));
for(const ref of ['요 3:16','요한복음 3장 16절','고린도전서 13장','요한\n복음 3:16','시편 23:1','롬 ８：２８']){
 assert.equal(B.build(ref,norm).references.length,1,ref);
}
let hit=B.match(commentary,index,cursor);assert.equal(hit.pos,index.text.length);assert.equal(hit.scripture,true);
hit=B.match(middle,index,cursor);assert.equal(hit.pos,index.text.indexOf(middle)+middle.length,'partial reading stops at actual words');
assert.equal(B.match('요한복음삼장십육절',index,cursor),null);
const repeat=B.build('요 3:16\n'+'본문'.repeat(800)+middle+'\n'+middle);
assert.equal(B.match(middle,repeat,repeat.references[0].end),null,'repeated verse alone cannot choose a location');
const short=B.build(raw),fragment=commentary.slice(0,20);
assert.equal(B.match(fragment,short,cursor,1000),null,'short distant phrase waits');
assert.equal(B.match(fragment,short,cursor,1100),null,'duplicate callback does not confirm');
assert.equal(B.match(commentary.slice(0,24),short,cursor,1200).pos,short.text.indexOf(commentary)+24);
const expired=B.build(raw);B.match(fragment,expired,cursor,1000);
assert.equal(B.match(commentary.slice(0,24),expired,cursor,15000),null,'expired evidence cannot confirm');
const moved=B.build(raw);B.match(fragment,moved,cursor,1000);
assert.equal(B.match(commentary.slice(0,24),moved,cursor+1,1200),null,'manual movement resets evidence');
assert.equal(B.match(commentary,B.build(raw.replace('요한복음 3:16','일반 제목')),0),null,'ordinary prose does not enable long recovery');
assert.equal(B.match(commentary,B.build('요 3:16\n'+'본문'.repeat(3100)+commentary),0),null,'bounded search');
for(const file of ['index.html','classic.html']){
 const html=fs.readFileSync(file,'utf8'),context={PromVideoCues:V,PromOptionalSpeech:O,PromScriptureSpeech:B,PromSpeechMatch:S,page:0,cursor:0,heardCarry:'',lastTail:'',cap(){},cueMatch:()=>null,render(){},go(p){context.page=p},$:id=>id==='lead'?{value:'0'}:{textContent:''}};
 vm.createContext(context);
 vm.runInContext(html.slice(html.indexOf('const keep=ch=>'),html.indexOf('/* ---------- 화면 ---------- */')),context);
 const start=html.indexOf('function onHeard(text){'),end=html.indexOf('// 마이크를 한 번',start);
 vm.runInContext(html.slice(start,end),context);
 context.pages=raw.split('\n').map(t=>[[{t,c:'k'}]]);context.heard=commentary;
 vm.runInContext('P=pages;index();onHeard(heard)',context);
 assert.equal(context.cursor,index.text.length,file+' actual handler skips unread Scripture');
}
hit=C.locateSpeech(commentary,C.normalize(raw),cursor,null,B.build(raw,C.normalize));
assert.equal(hit.pos,C.normalize(raw).length);assert.equal(hit.scripture,true);
console.log('PASS Scripture partial/omitted reading, repetition, confirmation/expiry/manual reset, limits, actual PROM/classic handlers and broadcast PPT');
