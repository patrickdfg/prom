const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'),nodes={},saved=new Map(),spoken=[];let cancels=0,moves=0;
function node(){const set=new Set();return {hidden:false,value:'',textContent:'',disabled:false,children:[],classList:{add:n=>set.add(n),remove:n=>set.delete(n),contains:n=>set.has(n)},appendChild(x){this.children.push(x);}};}
const syn={cancel(){cancels++;},speak:u=>spoken.push(u),getVoices:()=>[],addEventListener(){}};
const c={window:{speechSynthesis:syn},document:{fullscreenElement:{},createElement:node},localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},$:id=>nodes[id]||(nodes[id]=node()),SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},PromVideoCues:require('../video-cues.js'),videoSpeech:[],P:[[[{t:'오늘은 서로 사랑하며 감사하는 마음으로 하루를 살아가는 것에 대하여 말씀을 함께 나누고 기쁨으로 걸어가겠습니다.'.repeat(3),c:'k'}]]],page:0,editing:false,listening:false,notifyUI(){},keepAwake(){},toast(){},go(i){c.page=i;moves++;}};
vm.createContext(c);vm.runInContext(html.slice(html.indexOf('const SYN='),html.indexOf('// 읽어주는 중에는 화면을 누르면')),c);
assert(nodes.ttsRateControls.hidden,'controls hidden before read-aloud');c.tPlay();assert(!nodes.ttsRateControls.hidden);assert.equal(nodes.tts.textContent,'읽기 끝내기');assert.equal(nodes.ttsRateInline.textContent,'1.0');
const first=spoken.at(-1);first.onboundary({charIndex:8});nodes.ttsRatePlus.onclick();assert.equal(spoken.at(-1).rate,1.1);assert.equal(spoken.at(-1).text,first.text.slice(8),'continue from current word rather than replay page');assert.equal(moves,0);
const count=spoken.length;first.onend();assert.equal(spoken.length,count,'cancelled utterance cannot advance');nodes.ttsRateMinus.onclick();assert.equal(nodes.ttsRateInline.textContent,'1.0');
nodes.tRate.oninput({target:{value:'1.35'}});nodes.tRate.onchange();assert.equal(nodes.ttsRateInline.textContent,'1.35');assert.equal(JSON.parse(saved.get('readSettings')).rate,1.35);
for(let i=0;i<30;i++)nodes.ttsRatePlus.onclick();assert.equal(spoken.at(-1).rate,2);assert(nodes.ttsRatePlus.disabled);for(let i=0;i<30;i++)nodes.ttsRateMinus.onclick();assert(nodes.ttsRateMinus.disabled);assert.equal(spoken.at(-1).rate,.5);
c.tPause();assert(!nodes.ttsRateControls.hidden,'paused reading remains an active reading session');c.tStop();assert(nodes.ttsRateControls.hidden);assert.equal(nodes.tts.textContent,'읽어주기');
c.tPlay();for(let i=0;i<20&&!nodes.ttsRateControls.hidden;i++)spoken.at(-1).onend();assert(nodes.ttsRateControls.hidden,'natural completion also hides speed controls');
console.log('PASS conditional speed controls, +/- steps, word continuation, no page restart, stale callbacks, slider sync, persistence, bounds, pause and stop');
