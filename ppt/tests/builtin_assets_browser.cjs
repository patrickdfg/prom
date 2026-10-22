const {chromium}=require('playwright'),assert=require('node:assert/strict'),catalog=require('../images/library/catalog.json');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium'});try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route('https://accounts.google.com/**',r=>r.abort());
 for(const app of ['ppt/','make/']){
  await page.goto((process.env.PROM_BASE||'http://localhost:8765/')+app,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.CaptionEditor&&window.CaptionImageLibrary);
  if(app==='make/'){
   await page.waitForFunction(()=>document.querySelector('#makeTemplate option[value="builtin-sunday"]'));
   await page.click('details.manuscript-paste summary');await page.fill('#makePasteList textarea','1. 첫째\n2. 둘째\n3. 셋째');await page.click('#makeRun');
   await page.waitForFunction(()=>!document.querySelector('#makeRun').disabled&&!document.querySelector('#makeDownload').disabled);
  }
  await page.evaluate(async()=>{await CaptionImageLibrary.ready();const slides=await Promise.all(['첫째','둘째','셋째'].map(t=>CaptionBuilder.scene('caption',t)));CaptionWorkspace.apply(slides,slides.map(()=>({status:'unlinked',start:null,end:null,score:0})),{selected:2});await CaptionEditor.open(2);});
  const before=await page.evaluate(async()=>JSON.stringify(await CaptionImageLibrary.records()));
  for(const [i,item] of catalog.items.filter(x=>x.kind==='artwork').entries()){
   await page.click('#editArtLibrary');await page.getByRole('button',{name:item.label,exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('#editLibraryDialog').open===false);
   await page.click('#editorApply');
   assert.equal(await page.evaluate(()=>CaptionWorkspace.snapshot().slides[2].shapes.filter(x=>x.extraImage).length),i+1);
  }
  const alpha=await page.evaluate(async()=>{
   const items=CaptionImageLibrary.collect([],'artwork'),values=[];
   for(const item of items){const image=new Image();image.src=item.src;await image.decode();const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const g=c.getContext('2d');g.drawImage(image,0,0);const data=g.getImageData(0,0,c.width,c.height).data;let clear=0,solid=0;for(let i=3;i<data.length;i+=4){if(data[i]===0)clear++;if(data[i]>0)solid++;}values.push({label:item.label,clear,solid});}return values;
  });assert.equal(alpha.length,catalog.items.filter(x=>x.kind==='artwork').length);for(const item of alpha){assert(item.clear>0,item.label+' needs transparency');assert(item.solid>0,item.label+' must contain artwork');}
  for(const item of catalog.items.filter(x=>x.kind==='background')){
   await page.click('#editBgLibrary');await page.getByRole('button',{name:item.label,exact:true}).click();await page.click('#editorApply');
   const count=await page.evaluate(()=>CaptionWorkspace.snapshot().slides[2].shapes.filter(x=>x.editorBackground).length);assert.equal(count,1);
  }
  const result=await page.evaluate(async()=>{const p=CaptionWorkspace.snapshot(),blob=await CaptionPptx.create(p),back=await CaptionImport.deck(new File([blob],'assets.pptx'));return {before:p.slides[2].shapes.filter(x=>x.type==='image').map(x=>x.src).sort(),after:back.slides[2].shapes.filter(x=>x.type==='image').map(x=>x.src).sort()};});assert.deepEqual(result.after,result.before);
  assert.equal(await page.evaluate(async()=>JSON.stringify(await CaptionImageLibrary.records())),before);
  await page.click('#editorClose');console.log('PASS '+app+' all 5 original catalog assets, transparent artwork, background replacement, save and PPTX roundtrip; stored templates unchanged');
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
