const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('workspace.js','utf8');const block=source.slice(source.indexOf('  function navigateAudience('),source.indexOf('  let localVoiceMode=false;'));
let rendered=0,resets=0,safeResets=0;
const c={audience:{closed:false},localScroll:false,outputViewMode:'scroll',listening:true,
  lineRange:[[[0,5],[5,5],[5,10]],[[10,15],[15,20]]],
  cursor:0,page:0,heardCarry:'old',sessionText:'old',lastTail:'old',pend:{},
  speechFloor:0,speechResultCount:4,
  safeFollow:{reset(){safeResets++;}},
  window:{PromPptxOriginal:{isActive(){return false;}},PromExtras:{resetVoice(){resets++;}}},
  showBar(){},
  go(pi,manual,source){c.page=Math.max(0,Math.min(1,pi));if(manual)c.cursor=c.lineRange[c.page].find(r=>r[1]>r[0])[0];c.lastManual=manual;c.lastSource=source;rendered++;}};
vm.createContext(c);vm.runInContext(block,c);
assert(c.navigateAudience('next'));assert.equal(c.cursor,5);assert.equal(c.page,0);assert.equal(c.speechFloor,4);assert.equal(c.heardCarry,'');
c.navigateAudience('next');assert.equal(c.cursor,10);assert.equal(c.page,1,'scroll advances across pages one line at a time');
c.navigateAudience('prev');assert.equal(c.cursor,5);assert.equal(c.page,0);
c.navigateAudience('prev');c.navigateAudience('prev');assert.equal(c.cursor,0);
c.cursor=20;c.navigateAudience('next');assert.equal(c.cursor,15,'clamp at last line');
assert(safeResets>0);
c.listening=false;c.page=0;c.cursor=0;c.navigateAudience('next');assert.equal(c.cursor,5,'scroll remains line-based without the microphone');
c.outputViewMode='page';c.listening=true;c.page=0;c.cursor=5;c.navigateAudience('next');
assert.equal(c.page,1);assert.equal(c.cursor,10,'page mode moves a whole page while listening');assert.equal(c.lastManual,true);assert.equal(c.lastSource,'keyboard');
c.navigateAudience('prev');assert.equal(c.page,0);assert.equal(c.cursor,0);
c.listening=false;c.page=0;c.cursor=5;c.navigateAudience('next');assert.equal(c.page,1,'page mode still moves a whole page without the microphone');
c.outputViewMode='scroll';c.window.PromPptxOriginal.isActive=()=>true;c.page=0;c.cursor=0;c.navigateAudience('next');assert.equal(c.page,1,'original PPT slides stay page-based');
c.window.PromPptxOriginal.isActive=()=>false;
c.navigateAudience('home');assert.equal(c.page,0);assert(!c.navigateAudience('invalid'));
c.audience.closed=true;c.localScroll=true;c.outputViewMode='page';c.cursor=0;c.page=0;c.navigateAudience('next');assert.equal(c.cursor,5,'local scrolling steps one line');
c.localScroll=false;const before=rendered;assert(!c.navigateAudience('next'));assert.equal(rendered,before);
const audience=fs.readFileSync('audience.js','utf8');const line=audience.split('\n').find(s=>s.includes('d.extra.manualScrollPage'));assert(line);const doc=[['old page'],['current page'],['next page']],frame={extra:{continuous:true,manualScrollPage:true},document:doc,page:1,cursor:19,ranges:[[[0,10]],[[10,15],[15,20]],[[20,30]]]};const d={d:frame,Array};vm.createContext(d);vm.runInContext(line,d);assert.equal(d.d.cursor,10);assert.equal(d.d.readingAnchor,0);assert.deepEqual(Array.from(d.d.document,pg=>pg.length),[0,1,0]);assert.equal(doc[0][0],'old page','original document preserved');
d.d={...frame,extra:{continuous:true,manualScrollPage:false}};vm.runInContext(line,d);assert.equal(d.d.document,doc,'voice scrolling retains whole document');assert.equal(d.d.cursor,19);
console.log('PASS scroll line navigation, page navigation, mic toggle, original PPT, local scrolling, blank skipping, output guard, display frame preservation');
