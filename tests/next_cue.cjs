// Exercise production indexing and recognition with a stuck cursor, without a speech server.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const extract=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b));
const nodes={labNextLine:{checked:true},heard:{},lead:{value:'3'}};
const c={$:id=>nodes[id],editing:false,heardCarry:'',lastTail:'',cap(){},render(){},go(p){vm.runInContext('page='+p,c)}};
vm.createContext(c);
vm.runInContext(extract('const keep=','/* ---------- 화면 ---------- */')+'\nlet page=0,cursor=0;\n'+extract('function nextCueLine(){','function renderCue(){')+extract('function onHeard(text){','// 마이크를 한 번 열어'),c);
const run=s=>vm.runInContext(s,c);
run(`P=[Array.from({length:5},(_,i)=>[{t:'오늘의 긴 원고를 읽으며 감사하는 마음을 배웁니다 '+i,c:'k'}]),[[],[{t:'99',c:'r'}],[{t:'새로운 이야기를 시작하며 함께 앞으로 나아갑니다',c:'k'}],[{t:'두 번째 문장도 읽습니다',c:'k'}]]];index();`);
assert.equal(run('nextCueLine().text'),'새로운 이야기를 시작하며 함께 앞으로 나아갑니다');
const original=run('JSON.stringify(P)'),norm=run('norm');
run("onHeard('새로운 이야기를 시작하며 함께 앞으로 나아갑니다')");assert.equal(run('page'),1,'next line recovers from cursor stuck at start');
assert.equal(run('nextCueLine()'),null,'last page has no cue');
run('page=0;cursor=0;lastTail="";');c.editing=true;assert.equal(run('nextCueLine()'),null);c.editing=false;
assert.equal(run("cueMatch('새로운')"),null,'short fragment must not trigger recovery');
assert.equal(run('JSON.stringify(P)'),original);assert.equal(run('norm'),norm);
nodes.labNextLine.checked=false;assert.equal(run('nextCueLine()'),null);assert.equal(run("cueMatch(normStr('함께 앞으로 나아갑니다'))"),null);
nodes.labNextLine.checked=true;
run('P[0][0]=P[1][2];index();');assert.equal(run("cueMatch(normStr('함께 앞으로 나아갑니다'))"),null,'same phrase on current page must not trigger recovery');
run("P[0][0]=[{t:'다른문장입니다',c:'k'}];P[1][2]=[{t:'새로운이야기를시작해요',c:'k'}];index();");assert.notEqual(run("cueMatch(normStr('앞말새로운이야기를시작해요'))"),null,'short cue after carried speech');
// Parse every inline script, including the application script.
for(const [,script]of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(script);
console.log('PASS cue recovery, disabled/edit/final-page hiding, short/repeated phrase guards, carried speech, unchanged manuscript, inline syntax');
