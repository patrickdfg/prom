// Production extras state/events with deterministic speech, media, and DOM adapters.
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const nodes={},store=new Map([['promExtra:voiceLab','true']]);
class El{
 constructor(){this.checked=false;this.value='';this.hidden=false;this.disabled=false;this.events={};this.children=[];this.style={};this.classes=new Set();this.classList={contains:k=>this.classes.has(k),toggle:(k,v)=>v?this.classes.add(k):this.classes.delete(k)};}
 set innerHTML(s){for(const m of s.matchAll(/<[^>]+id="([^"]+)"[^>]*>/g)){const el=nodes[m[1]]=new El();el.value=m[0].match(/value="([^"]*)"/)?.[1]||'';}}
 appendChild(x){this.children.push(x)}before(){}after(){}addEventListener(n,f){(this.events[n]||=[]).push(f)}click(){for(const f of this.events.click||[])f();this.onclick?.();}showModal(){this.open=true}close(){this.open=false}getBoundingClientRect(){return {height:100}}}
for(const id of ['labOptWrap','more','stage','view','viewSingle','viewMultiple','note','bar','heard','dim','theme','page'])nodes[id]=new El();nodes.theme.value='dark';nodes.dim.checked=true;
let stopCount=0,goCount=0,originalCalls=0,scrollCalls=0,stoppedTracks=0;
const c={videoSpeech:[],PromVideoCues:require('../video-cues.js'),norm:'가'.repeat(40),pageOf:pos=>Math.min(3,Math.floor(pos/10)),console,Blob,Date,Math,Number,JSON,setInterval:()=>1,clearInterval(){},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},localStorage:{removeItem:k=>store.delete(k),getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},$:id=>nodes[id],document:{body:new El(),createElement:()=>new El()},addEventListener(){},confirm:()=>true,editing:false,listening:false,ANDROID:true,P:Array.from({length:4},(_,i)=>[[{t:'원고의 내용입니다 '+i,c:'k'}]]),lineRange:[[[0,10]],[[10,20]],[[20,30]],[[30,40]]],pStart:[0,10,20,30],pEnd:[10,20,30,40],lastLine:[0,10,20,30],page:0,cursor:0,heardCarry:'',normStr:s=>s.replace(/[^가-힣a-zA-Z0-9]/g,''),PromVoiceLab:require('../voice-lab.js'),PromScrollView:class{update(){scrollCalls++}},toast:msg=>{c.lastToast=msg},cap:msg=>{c.lastCap=msg},pageSay:i=>(c.P[i]||[]).flat().map(r=>r.t).join(''),tPlay(){c.ttsStarted=true},endEdit(){c.editing=false},onHeard(){originalCalls++},startMic(){c.listening=true},stopMic(){c.listening=false;stopCount++}};
const ui={finishNote(){},render(){},beforeBodyEdit(){},hasSlideshow:()=>true};c.PromUI=ui;c.window={PromUI:ui,MediaRecorder:true};c.render=()=>ui.render();c.go=i=>{c.page=i;goCount++;ui.render();};
c.navigator={mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){stoppedTracks++}}]})}};
c.MediaRecorder=class{static isTypeSupported(){return true}constructor(){this.state='inactive';this.mimeType='audio/webm'}start(){this.state='recording'}stop(){this.state='inactive';this.ondataavailable({data:new Blob(['sound'])});this.onstop()}};
vm.createContext(c);const root=fs.readFileSync('index.html','utf8');vm.runInContext(root.slice(root.indexOf('function lineSpeech('),root.indexOf('function locate3(')),c);vm.runInContext(fs.readFileSync('extras.js','utf8'),c);
(async()=>{
 const api=c.window.PromExtras;
 assert(nodes.nextLineTools.children.includes(nodes.labOptWrap),'existing next-line setting moved into tools');assert(!nodes.labOptWrap.hidden);
 assert(!nodes.continuousView,'scroll choice removed from dialog');assert.equal(scrollCalls,0);
 nodes.mirrorX.checked=true;nodes.mirrorX.onchange();assert(api.settings().mirrorX);assert.equal(store.get('promExtra:mirrorX'),'true');
 nodes.stageMessage.value='<script>시간 5분 남음</script>';nodes.sendStageMessage.click();assert.equal(api.settings().message,nodes.stageMessage.value);nodes.clearStageMessage.click();assert.equal(api.settings().message,'');
 nodes.repeatFrom.value='2';nodes.repeatTo.value='3';nodes.repeatTTS.checked=true;assert.equal(api.ttsPage(3),1);assert.equal(api.ttsPage(2),2);nodes.playRepeat.click();assert.equal(c.page,1);assert(c.ttsStarted);nodes.repeatTo.value='99';assert.equal(api.ttsPage(3),3);assert(!nodes.repeatTTS.checked);
 c.onHeard('원고');assert.equal(originalCalls,1);assert(!nodes.voiceLab,'removed voice lab must not be offered');assert(!store.has('promExtra:voiceLab'),'obsolete preference is cleared');c.onHeard('오늘 주차장에서 자동차 열쇠를 잃어버렸습니다');assert.equal(originalCalls,2,'speech continues through the default handler');assert.equal(goCount,1);
 c.listening=true;await nodes.recordStart.onclick();assert.equal(stopCount,1);assert(nodes.recordStart.disabled);assert(!nodes.recordStop.disabled);
 c.startMic();assert(!c.listening,'Android recording and speech recognition are mutually exclusive');nodes.recordStop.click();assert(!nodes.recordDownload.hidden);assert.equal(nodes.recordDownload.href,'blob:test');assert(stoppedTracks>0);assert(!nodes.recordStart.disabled);
 c.navigator.mediaDevices.getUserMedia=async()=>{throw Error('denied')};nodes.recordDownload.click();await nodes.recordStart.onclick();assert(!nodes.recordStart.disabled);assert(nodes.recordStatus.textContent.includes('시작하지 못'));
 console.log('PASS scrolling/view/edit transitions, mirror settings, emergency set/clear, TTS range bounds, default speech handler and obsolete preference cleanup, recording/start/stop/download/permission failure, Android mic exclusion');
})().catch(e=>{console.error(e);process.exitCode=1});
