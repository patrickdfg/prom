const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),C=require('../core.js');
const source=fs.readFileSync('ppt/app.js','utf8');
const fn=source.slice(source.indexOf('function syncAuto()'),source.indexOf('function setAuto('));
const c={C,auto:true,project:{links:[{status:'exact',start:10,end:20},{status:'exact',start:20,end:30}]},cursor:10,displayCursor:9,live:-1,showLive(i){this.result=i;}};
// The actual auto-dispatch must use the consumed-character cursor at the previous sentence's end.
c.showLive=i=>c.result=i;vm.createContext(c);vm.runInContext(fn,c);c.syncAuto();assert.equal(c.result,0);
c.cursor=20;c.displayCursor=19;c.live=0;c.syncAuto();assert.equal(c.result,1,'next caption must appear before its first character is consumed');
c.cursor=30;c.live=1;c.syncAuto();assert.equal(c.result,-1,'last caption must clear when finished');
c.auto=false;c.result=null;c.cursor=10;c.syncAuto();assert.equal(c.result,null,'manual mode must remain isolated');
let next=0;const timers=new Map(),drawn=[],released=[];
class Layer {constructor(){this.style={};this.dataset={};this.children=[];}appendChild(el){el.parent=this;this.children.push(el);}replaceChildren(){for(const el of this.children)el.parent=null;this.children=[];}remove(){if(this.parent)this.parent.children=this.parent.children.filter(el=>el!==this);}get offsetWidth(){return 100;}}
const d={window:{},Set,JSON,document:{createElement:()=>new Layer()},matchMedia:()=>({matches:false}),CaptionRender:{show:(el,slide)=>drawn.push(slide),release:el=>released.push(el)},setTimeout:fn=>{timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id)};
vm.createContext(d);vm.runInContext(fs.readFileSync('ppt/transitions.js','utf8'),d);
const host=new Layer(),view=new d.window.CaptionTransition(host);view.show({text:'one'},0);const first=view.current;
view.show({text:'two'},1);assert.equal(drawn.length,2,'incoming caption must render immediately');assert.notEqual(first.style.opacity,'0','outgoing caption must stay opaque under the incoming one so green never shows through');assert.equal(view.current.style.opacity,'1');assert.equal(host.children.length,2);
view.show({text:'two'},1);assert.equal(drawn.length,2,'duplicate frames must not restart fades');
for(const [id,fn]of [...timers]){timers.delete(id);fn();}assert.equal(host.children.length,1);assert.equal(view.old.size,0);
view.show(null,-1);assert.equal(view.current,null);assert.equal(host.children[0].style.opacity,'0');
view.show({text:'three'},2);view.show(null,-1,'#00ff00',true);assert.equal(host.children.length,0);assert.equal(timers.size,0,'safety clear must cancel all pending fades');
console.log('PASS previous-end caption boundary, manual mode, immediate fade-in, duplicate suppression, fade-out, cleanup, immediate safety clear');
