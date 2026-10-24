const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements=new Map();
function element(){return {value:'',children:[],get options(){return this.children},hidden:false,disabled:false,checked:false,open:false,textContent:'',parentElement:{hidden:false,nextElementSibling:{hidden:false}},closest(){return {hidden:false}},replaceChildren(){this.children=[]},append(x){this.children.push(x)},addEventListener(type,fn){if(type==='close')this.closeEvent=fn;else this[type]=fn},showModal(){this.open=true},close(){this.open=false;this.closeEvent?.()},focus(){},select(){}};}
const $=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id)};
const slide=(uid,text)=>({uid,width:960,height:540,text,shapes:[{type:'text',x:0,y:0,w:960,h:100,paragraphs:[{align:'center',runs:[{text,size:32,font:'Original Font',color:'#111111'}]}]}]});
const project={slides:[slide('a','First caption'),slide('b','Second caption'),slide('c','Third caption')],links:Array.from({length:3},()=>({status:'unlinked',start:null,end:null})),lines:[]};
let preview,applyCount=0;
const context={window:{},document:{getElementById:$,createElement:element},structuredClone,crypto:require('node:crypto').webcrypto,confirm:()=>true,
 CaptionCore:require('../core.js'),CaptionBuilder:{async scene(layout,text,options={}){return {...slide(options.uid||'new',text),bodyIndex:0,editor:{layout,text,...options}}},colorType:()=>'',plain:s=>s,styledRuns:(text,options)=>[{...options,text}]},
 CaptionMasters:{key:()=> 'original',identify(s){s.shapes.forEach((sh,i)=>{sh.masterSlot||='base:'+i});return s}},CaptionRender:{show:(host,s)=>preview=structuredClone(s),release(){}},
 CaptionRecipes:{async sync(){}},CaptionWorkspace:{prepareEdit(){},snapshot:()=>structuredClone(project),rows:()=>[],currentRange:()=>null,message:s=>{throw Error(s)},apply(slides,links){applyCount++;project.slides=slides;project.links=links;}}};
vm.runInNewContext(fs.readFileSync('ppt/editor-history.js','utf8'),context);
vm.runInNewContext(fs.readFileSync('ppt/editor.js','utf8'),context);
(async()=>{
 const editor=context.window.CaptionEditor;
 await editor.open(0);assert.equal($('editText').value,'First caption');assert.equal($('editEarlier').disabled,true);
 await $('editLater').onclick();assert.equal($('editText').value,'Second caption');assert.equal(preview.uid,'b');assert.equal($('editorTitle').textContent,'2번 자막 편집');assert.equal(applyCount,0,'browsing must not rewrite imported shapes');
 await $('editEarlier').onclick();assert.equal($('editText').value,'First caption');assert.equal(preview.uid,'a');assert.equal(project.slides.map(s=>s.uid).join(','),'a,b,c','navigation must not reorder slides');
 $('editText').value='Edited first';$('editText').input();await $('editLater').onclick();assert.equal(project.slides[0].shapes[0].paragraphs[0].runs[0].text,'Edited first','save pending edits before navigation');assert.equal($('editText').value,'Second caption');
 $('editText').value='Edited copy';$('editText').input();await $('editDuplicate').onclick();assert.equal($('editorTitle').textContent,'3번 자막 편집');assert.equal($('editText').value,'Edited copy');assert.notEqual(preview.uid,'b');assert.equal(project.slides[2].shapes[0].paragraphs[0].runs[0].text,'Edited copy');assert.equal(project.links[2].status,'unlinked');assert.equal($('editorDialog').open,true);
 await $('editLater').onclick();assert.equal($('editText').value,'Third caption');assert.equal($('editLater').disabled,true);
 const beforeSplit=project.slides.length;
 $('editText').value='First split\nSecond split';$('editText').input();$('editReveal').checked=true;$('editReveal').input();
 await $('editorApply').onclick();assert.equal($('editorDialog').open,true,'apply keeps editor open');assert.equal(project.slides.length,beforeSplit+1,'split creates cumulative slides');assert.equal($('editText').value,'First split','continue editing saved first part');assert.equal($('editReveal').checked,false,'reset split checkbox to prevent duplicate expansion');
 const savedCount=project.slides.length;await $('editorApply').onclick();assert.equal(project.slides.length,savedCount,'repeat apply edits current saved slide without splitting twice');assert.equal($('editorDialog').open,true);await $('editLater').onclick();assert.equal($('editText').value,'First split\nSecond split','next shows saved cumulative part');
 $('editorClose').onclick();assert.equal($('editorDialog').open,false,'explicit close still closes');
 console.log('PASS apply stays open after split, saved draft refresh, no repeated splitting, next part navigation, explicit close');
 console.log('PASS previous/next contents and preview, stable order, no rewrite on browse, pending edit save, edited duplicate, boundary controls');
})();
