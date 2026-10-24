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
 const body=project.slides[0].shapes[0];Object.assign(body,{x:13.23,y:17.39,w:333.37,h:100.13});body.paragraphs[0].align='left';body.paragraphs[0].runs.push({text:' accent',font:'Another Font',size:41.173,color:'#ff0000',bold:true});
 const picture={type:'image',masterSlot:'base:1',src:'data:image/png;base64,ORIGINAL',x:9.17,y:73.41,w:517.31,h:137.19};project.slides[0].shapes.push(picture);
 const originalBody=structuredClone(body),otherSlide=structuredClone(project.slides[1]),links=structuredClone(project.links);
 await editor.open(0);assert.match($('editGeometryTitle').textContent,/글상자/);
 await $('editCenterX').onclick();assert.equal(preview.shapes[0].x,(960-body.w)/2);assert.equal(preview.shapes[0].y,body.y);assert.equal(preview.shapes[0].w,body.w);assert.equal(preview.shapes[0].h,body.h);assert.equal(preview.shapes[0].paragraphs[0].align,'left','object alignment keeps text paragraph alignment');assert.deepEqual(preview.shapes[0].paragraphs,originalBody.paragraphs,'object alignment preserves mixed fonts, sizes and colors');
 assert.deepEqual(preview.shapes[1],project.slides[0].shapes[1],'text alignment leaves picture intact');
 await $('editCenterY').onclick();assert.equal(preview.shapes[0].y,(540-body.h)/2);
 await $('editorApply').onclick();assert.equal(project.slides[0].shapes[0].x,(960-body.w)/2);assert.equal(project.slides[0].shapes[0].y,(540-body.h)/2);assert.deepEqual(project.slides[0].shapes[0].paragraphs,originalBody.paragraphs,'saving preserves mixed text styling');assert.deepEqual(project.slides[1],otherSlide);assert.deepEqual(structuredClone(project.links),links);
 $('editShape').value='1';$('editShape').onchange();assert.match($('editGeometryTitle').textContent,/그림/);assert.match($('editGeometrySize').textContent,/517 × 137 px/);
 await $('editCenterBoth').onclick();assert.equal(preview.shapes[1].x,(960-picture.w)/2);assert.equal(preview.shapes[1].y,(540-picture.h)/2);assert.equal(preview.shapes[1].w,picture.w);assert.equal(preview.shapes[1].h,picture.h);assert.equal(preview.shapes[1].src,picture.src);assert.equal(preview.shapes[1].manualGeometry,true);
 $('editW').value='40';$('editW').input();await $('editCenterX').onclick();assert.equal(preview.shapes[1].w,384);assert.equal(preview.shapes[1].x,288);assert.equal(preview.shapes[1].h,picture.h);
 await $('editorApply').onclick();await $('editLater').onclick();await $('editEarlier').onclick();$('editShape').value='1';$('editShape').onchange();assert.equal(Number($('editW').value),40);assert.equal(Number($('editX').value),30);assert.equal(preview.shapes[1].h,picture.h);assert.deepEqual(structuredClone(project.links),links);
 // An object almost centered must still snap exactly, even if the display rounds to the same value.
 project.slides[0].shapes[1].x=288.1;await editor.open(0);$('editShape').value='1';$('editShape').onchange();await $('editCenterX').onclick();assert.equal(preview.shapes[1].x,288);
 for(const name of ['make/index.html','ppt/index.html']){const html=fs.readFileSync(name,'utf8'),nav=html.indexOf('id="editDelete"'),geometry=html.indexOf('class="editor-geometry"');assert(geometry>nav&&geometry<html.indexOf('</section>',nav),'geometry toolbar follows preview navigation');for(const id of ['editX','editY','editW','editH','editCenterX','editCenterY','editCenterBoth'])assert.equal(html.split('id="'+id+'"').length,2,'one control per id');}
 console.log('PASS picture/text object centering, independent axes, exact fractional size preservation, near-center snap, geometry edits, save/reopen, image source and manuscript links, both editor placements');
})().catch(e=>{console.error(e);process.exitCode=1});
