const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const s=fs.readFileSync('index.html','utf8'),c={MOBILE:false,MAXW:17.5,pw:t=>t.length/2,R_SENT:/[.!?]$/,R_CLAUSE:/[,;:]$/,plainOf:l=>l.runs.map(r=>r.t).join(''),gtRun:()=>[{t:'>>',c:'k'}]};vm.createContext(c);
vm.runInContext(s.slice(s.indexOf('const paragraphRuns='),s.indexOf('// 일반 원고(hwp·hwpx·글)')),c);
const lines=[0,0,0,1,1,1].map((blk,i)=>({blk,runs:[{t:'문장'+i+'.',c:'k'}],ue:true}));
for(const mobile of [false,true])for(const count of [5,6,7]){c.MOBILE=mobile;const pages=c.paginateLines(lines,count),runs=pages.flat(2).filter(r=>r.t!=='>>');assert.equal(runs.filter(r=>r.paragraphStart).length,1);assert(runs.find(r=>r.t==='문장3.').paragraphStart);assert(!lines[3].runs[0].paragraphStart,'input must stay unchanged');}
vm.runInContext(s.slice(s.indexOf('function snapshotPages(){'),s.indexOf('async function savePages()')),c);c.P=[[[{t:'본문',c:'k',paragraphStart:true}]]];c.editing=false;const saved=c.snapshotPages();assert(saved[0][0][0].paragraphStart);
vm.runInContext(s.slice(s.indexOf('function parseSaved(text){'),s.indexOf("$('save').onclick")),c);c.cleanText=x=>x;c.hasText=p=>p.some(l=>l.some(r=>r.t.trim()));assert(c.parseSaved(JSON.stringify({app:'sermon-prompter',pages:saved,lines:5})).pages[0][0][0].paragraphStart);
console.log('PASS true paragraph boundaries through 5/6/7 pagination, mobile, snapshot and reload');
