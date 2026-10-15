const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
class E {
 constructor(){this.children=[];this.style={};this.clientHeight=1080;this.clientWidth=1800;this.scrollWidth=1000;this.scrollTop=0;this.isConnected=true;this.classList={toggle(){}};}
 appendChild(e){this.children.push(e)}replaceChildren(){this.children=[]}getBoundingClientRect(){return {top:100}}scrollTo(value){this.lastScroll=value}
}
const c={PromSlideLayout:require('../slide-layout.js'),window:{},document:{createElement:()=>new E()},innerHeight:1080,innerWidth:1920,requestAnimationFrame:fn=>fn(),matchMedia:()=>({matches:false})};
vm.createContext(c);vm.runInContext(fs.readFileSync('scroll-view.js','utf8'),c);
for(const lines of [5,6,7]){
 const host=new E(),view=new c.window.PromScrollView(host);
 const document=Array.from({length:3},()=>Array.from({length:lines},()=>[{t:'원고 본문',c:'k'}]));
 const ranges=document.map((pg,pi)=>pg.map((_,li)=>[(pi*lines+li)*10,(pi*lines+li+1)*10]));
 const frame={document,lines,page:0,cursor:0,ranges};view.update(frame);
 assert.equal(view.slides[0].body.style.width,c.PromSlideLayout.measure(1920,1080,lines).width+'px');assert.equal(view.slides.length,3);assert.equal(view.rows.length,lines*3);
 for(const slide of view.slides){assert.equal(slide.el.style.height,'1080px');assert.equal(parseFloat(slide.el.style.fontSize),c.PromSlideLayout.measure(1920,1080,lines).font);}
 view.update({...frame,page:1,cursor:lines*10});assert.equal(view.position,'1:0');assert(host.lastScroll);
}
const source=fs.readFileSync('workspace.js','utf8');
const block=source.slice(source.indexOf('  function openSlideshow('),source.indexOf("  addEventListener('message',e=>{if(e.origin===location.origin"));
let opened=0,focused=0;const nodes={audience:{},scrollAudience:{}};
const d={continuous:false,channel:{},audience:null,channelId:'test',window:{open(){opened++;return {closed:false,focus(){focused++},startSlideshowFullscreen(){}}}},$:id=>nodes[id],toast(){},publish(){d.published=d.continuous}};
vm.createContext(d);vm.runInContext(block,d);
nodes.scrollAudience.onclick();assert(d.continuous);assert.equal(opened,1);
nodes.audience.onclick();assert(!d.continuous);assert.equal(d.published,false);assert.equal(focused,1);
nodes.scrollAudience.onclick();assert.equal(d.published,true);assert.equal(opened,1);
console.log('PASS 5/6/7-row slide sizing, page grouping, speech position tracking, separate launch buttons and mode switching in reused window');
