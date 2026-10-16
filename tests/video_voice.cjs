const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),V=require('../video-cues.js');
const row=t=>[{t,c:'k'}];
const intro='잠시 뒤에 준비한 영상을 함께 보시겠습니다',a='하나님께서는 언제나 우리를 사랑하고 계십니다',b='그러므로 서로 사랑하면서 감사하며 살아갑시다',after='이제 영상에서 보았던 말씀을 함께 나누겠습니다';
const pages=[[row(intro+'(영상1 시작)')],[row(a)],[row(b+'(영상1 끝)')],[row(after)]];
const built=V.build(pages),norm=s=>s.replace(/[^가-힣a-zA-Z0-9]/g,'').toLowerCase();
assert.equal(built.text,norm(intro+a+b+after));assert.equal(built.cues[0].position,norm(intro).length);assert.equal(built.cues[1].position,norm(intro+a+b).length);
assert.equal(V.speech([{t:'앞(영상',c:'k'},{t:'1 ',c:'r'},{t:'시작)뒤',c:'b'}]),'앞뒤','split formatted commands must stay silent');
assert.equal(V.strip('(요 3:16) 말씀'),'(요 3:16) 말씀','ordinary parentheses remain speech');
assert.equal(V.strip('(영상 찬양) 소개'),'(영상 찬양) 소개','invalid command remains ordinary speech');
const wrapped=V.build([[row('앞 문장(영상'),row('특별영상 1 시작)영상 대사(영상'),row('특별영상 1 끝)다음 문장')]]);assert.equal(wrapped.text,norm('앞 문장영상 대사다음 문장'));assert.equal(wrapped.cues.length,2);assert.equal(wrapped.spokenRows[0][1],'영상 대사');
const html=fs.readFileSync('index.html','utf8'),extra=fs.readFileSync('extras.js','utf8');
const section=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b));
function setup(lab=false){
 const nodes={labNextLine:{checked:false},voiceLab:{checked:lab},heard:{},lead:{value:'3'}};let renders=0;
 const c={PromVideoCues:V,PromVoiceLab:require('../voice-lab.js'),$:id=>nodes[id],editing:false,heardCarry:'',lastTail:'',Date,cap:()=>{},render:()=>renders++};
 vm.createContext(c);vm.runInContext(section('const keep=','/* ---------- 화면 ---------- */')+'\nlet page=0,cursor=0;\n'+section('function nextCueLine(){','function renderCue(){')+section('function onHeard(text){','// 마이크를 한 번 열어'),c);
 c.go=p=>{vm.runInContext('page='+p,c);renders++;};c.PAGES=structuredClone(pages);vm.runInContext('P=PAGES;index();',c);
 if(lab)vm.runInContext("let voiceKey='',voicePages=[],pending=null,lastSample='',lastPage=-1;\n"+extra.slice(extra.indexOf(' function indexVoice()'),extra.indexOf(' const originalMic=')),c);
 return {c,run:s=>vm.runInContext(s,c),feed:text=>c.onHeard(text),renders:()=>renders};
}
for(const lab of [false,true]){
 const t=setup(lab);let transcript='';
 const states=[];for(const spoken of [intro,a,b,after]){transcript+=spoken;t.feed(transcript);states.push({cursor:t.run('cursor'),cue:t.run('PromVideoCues.active(videoCues,cursor)?.action')});}
 assert.equal(states[0].cue,'obs','start at intro completion '+lab);assert.equal(states[1].cue,'obs','video speech continues '+lab);assert.equal(states[2].cue,'slideshow','end on final video character '+lab);assert.equal(states[3].cursor,built.text.length,'resume preacher without speaking markers '+lab);
 const echo=setup(lab);echo.feed(intro);echo.feed(intro+a);echo.feed(intro+a+b);const finished=echo.run('cursor');echo.feed(intro+a);assert.equal(echo.run('cursor'),finished,'late video echo must not rewind and reopen OBS '+lab);
 const early=setup(lab);early.run('page=1;cursor=pEnd[0]-2;');early.feed(intro);assert.equal(early.run('cursor'),built.ends[0],'early page must not reset reading cursor '+lab);
 const commands=setup(lab);commands.c.PAGES=[[row('(영상 찬양 시작)')],[row(a)],[row('(영상 찬양 끝)')],[row(after)]];commands.run('P=PAGES;index();page=0;cursor=0;');commands.feed(a);assert.equal(commands.run('cursor'),norm(a).length,'skip standalone command page '+lab);assert.equal(commands.run('PromVideoCues.active(videoCues,cursor).action'),'slideshow','end on standalone marker '+lab);
}
console.log('PASS silent markers, split formatting, ordinary parentheses, normal/lab video audio, exact start/end positions, post-video continuation, early page advance and command-only pages');
