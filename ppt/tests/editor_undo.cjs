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
 const editor=context.window.CaptionEditor;project.links.forEach(link=>link.score=0);
 await editor.open(0);const original=structuredClone(preview);assert.equal($('editUndo').disabled,true);assert.equal($('editRedo').disabled,true);
 await $('editCenterBoth').onclick();const centered=structuredClone(preview);assert.notEqual(centered.shapes[0].y,original.shapes[0].y);assert.equal($('editUndo').disabled,false);
 $('editUndo').onclick();assert.deepEqual(preview,original);assert.equal($('editUndo').disabled,true);assert.equal($('editRedo').disabled,false);
 $('editRedo').onclick();assert.deepEqual(preview,centered);
 await $('editorApply').onclick();assert.equal($('editUndo').disabled,false,'saving current slide retains undo');$('editUndo').onclick();assert.deepEqual(preview,original);await $('editorApply').onclick();assert.deepEqual(structuredClone(project.slides[0]),original,'undo can be saved');
 await $('editAddText').onclick();const added=structuredClone(preview);assert.equal(added.shapes.length,2);$('editUndo').onclick();assert.equal(preview.shapes.length,1);$('editRedo').onclick();assert.equal(preview.shapes.length,2);
 $('editRemoveText').onclick();assert.equal(preview.shapes.length,1);$('editUndo').onclick();assert.deepEqual(preview,added,'element deletion restores exact element and selection');assert.equal($('editShape').value,1);
 $('editText').value='A new caption';$('editText').input();const textEdit=structuredClone(preview);$('editUndo').onclick();assert.deepEqual(preview,added,'text edit undone');$('editRedo').onclick();assert.deepEqual(preview,textEdit,'text edit redone');
 $('editUndo').onclick();$('editX').value='20';$('editX').input();assert.equal($('editRedo').disabled,true,'new edit discards abandoned redo branch');
 $('editStart').value='3';$('editStart').input();$('editUndo').onclick();assert.equal($('editStart').value,'','link input restored');$('editRedo').onclick();assert.equal($('editStart').value,'3');$('editUndo').onclick();
 let prevented=false;const key=(key,shiftKey=false,editable=false)=>({key,shiftKey,ctrlKey:true,target:{closest:()=>editable?{}:null},preventDefault(){prevented=true},stopPropagation(){}});
 $('editorDialog').keydown(key('z'));assert.equal(prevented,true);prevented=false;$('editorDialog').keydown(key('z',false,true));assert.equal(prevented,false,'text inputs keep native keyboard undo');
 await $('editLater').onclick();assert.equal($('editUndo').disabled,true,'history is isolated to current caption');assert.equal($('editRedo').disabled,true);
 project.slides[0]={...structuredClone(original),bodyIndex:0,editor:{layout:'caption',text:'First caption'}};await editor.open(0);await $('editCenterY').onclick();const beforePending=structuredClone(original);let finishScene;context.CaptionBuilder.scene=()=>new Promise(resolve=>finishScene=resolve);$('editText').value='Pending content';$('editText').input();$('editUndo').onclick();finishScene({...structuredClone(original),bodyIndex:0,editor:{layout:'caption',text:'Pending content'}});await Promise.resolve();await Promise.resolve();assert.equal($('editText').value,'First caption','late asynchronous layout cannot overwrite undo');assert.equal(preview.shapes[0].y,original.shapes[0].y);
 console.log('PASS editor undo/redo, save then undo and save, object addition/deletion, text edits, branching, link fields, keyboard/native input behavior, slide isolation and stale async cancellation');
 const {create}=require('../editor-history.js'),state=n=>({draft:{shapes:[{src:'original image',x:n}]},target:0,form:{start:'',end:'',reveal:false}}),history=create(state(0),{limit:4,delay:650});
 history.record(state(1),'typing',1000);history.record(state(2),'typing',1200);assert.equal(history.undo().draft.shapes[0].x,0,'typing coalesces into one undo');assert.equal(history.redo().draft.shapes[0].x,2);
 const restored=history.undo();restored.draft.shapes[0].src='changed';assert.equal(history.redo().draft.shapes[0].src,'original image','restores are independent copies');
 for(let n=3;n<=10;n++)history.record(state(n));let count=0;while(history.canUndo){history.undo();count++;}assert.equal(count,3,'bounded history retains at most configured states');
 console.log('PASS bounded history, coalesced typing and immutable snapshots');
})().catch(e=>{console.error(e);process.exitCode=1});
