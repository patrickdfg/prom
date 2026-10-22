const {chromium}=require('playwright'),assert=require('node:assert/strict');
const base=process.env.PROM_BASE||'http://localhost:8765/';
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium'});try{
 const context=await browser.newContext({viewport:{width:1500,height:1000}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await context.route('https://accounts.google.com/**',r=>r.abort());
 for(const app of ['ppt/','make/']){
  await page.goto(base+app,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.CaptionImageLibrary&&window.CaptionEditor&&window.CaptionWorkspace);
  if(app==='make/'){
   await page.waitForFunction(()=>document.querySelector('#makeTemplate option[value="builtin-sunday"]'));
   await page.click('details.manuscript-paste summary');await page.fill('#makePasteList textarea','1. 첫째 원고\n2. 둘째 원고\n3. 셋째 원고');await page.click('#makeRun');
   await page.waitForFunction(()=>!document.querySelector('#makeRun').disabled&&!document.querySelector('#makeDownload').disabled);
  }
  const source=await page.evaluate(async()=>{const records=await CaptionImageLibrary.records();return JSON.stringify(records);});
  await page.evaluate(async()=>{
   const slides=await Promise.all(['첫째 원고','둘째 원고','셋째 원고'].map(t=>CaptionBuilder.scene('caption',t)));
   CaptionWorkspace.apply(slides,slides.map(()=>({status:'unlinked',start:null,end:null,score:0})),{selected:2});
   await CaptionEditor.open(2);
  });
  assert(await page.locator('#editorDialog').isVisible(),JSON.stringify(await page.evaluate(()=>({status:document.querySelector('#status')?.textContent,toast:document.querySelector('#toast')?.textContent,title:document.querySelector('#editorTitle')?.textContent}))));
  const before=await page.evaluate(()=>CaptionWorkspace.snapshot());
  await page.click('#editArtLibrary');await page.waitForSelector('#editLibraryGrid button');
  if(process.env.SHOT&&app==='ppt/')await page.screenshot({path:process.env.SHOT+'-library.png'});
  const artSrc=await page.locator('#editLibraryGrid img').first().getAttribute('src');
  await page.locator('#editLibraryGrid button').first().click();
  await page.waitForFunction(()=>document.querySelector('#editShape').selectedOptions[0]?.textContent.includes('추가 그림'));
  assert(await page.locator('#editorPreview img').evaluateAll((imgs,src)=>imgs.some(i=>i.src===src),artSrc),'selection appears in preview');
  await page.fill('#editX','12');await page.fill('#editW','25');
  await page.click('#editBgLibrary');await page.waitForSelector('#editLibraryGrid button');
  const bgSrc=await page.locator('#editLibraryGrid img').first().getAttribute('src');
  await page.locator('#editLibraryGrid button').first().click();
  await page.waitForFunction(()=>document.querySelector('#editorHint').textContent.includes('배경그림을 화면 전체'));
  await page.click('#editorApply');
  const saved=await page.evaluate(()=>CaptionWorkspace.snapshot());
  assert.deepEqual(saved.links,before.links);assert.deepEqual(saved.slides.slice(0,2),before.slides.slice(0,2));
  const s=saved.slides[2],art=s.shapes.find(s=>s.extraImage);assert.equal(art.src,artSrc);assert.equal(art.x,s.width*.12);assert.equal(art.w,s.width*.25);assert.equal(s.shapes.find(s=>s.editorBackground).src,bgSrc);assert.equal(s.editor.text,before.slides[2].editor.text);
  await page.click('#editorClose');await page.evaluate(()=>CaptionEditor.open(2));
  assert.equal(await page.evaluate(()=>document.querySelector('#editorPreview img')!==null),true);
  const restored=await page.evaluate(()=>CaptionWorkspace.snapshot().slides[2]);assert.deepEqual(restored,s);
  const roundtrip=await page.evaluate(async()=>{const p=CaptionWorkspace.snapshot(),blob=await CaptionPptx.create(p),back=await CaptionImport.deck(new File([blob],'library.pptx'));return back.slides[2].shapes.filter(sh=>sh.type==='image').map(sh=>({src:sh.src,x:sh.x/back.slides[2].width,w:sh.w/back.slides[2].width}));});
  assert(roundtrip.some(sh=>sh.src===artSrc&&Math.abs(sh.x-art.x/s.width)<.001&&Math.abs(sh.w-art.w/s.width)<.001),'PPTX retains picture and geometry');assert(roundtrip.some(sh=>sh.src===bgSrc),'PPTX retains background');
  await page.click('#editBackgroundClear');await page.click('#editorApply');assert.equal(await page.evaluate(()=>CaptionWorkspace.snapshot().slides[2].shapes.filter(s=>s.editorBackground).length),0);assert.equal(await page.evaluate(()=>CaptionWorkspace.snapshot().slides[2].shapes.filter(s=>s.extraImage).length),1);
  assert.equal(await page.evaluate(async()=>JSON.stringify(await CaptionImageLibrary.records())),source,'source templates unchanged');
  await page.click('#editArtLibrary');await page.waitForSelector('#editLibraryGrid button');await page.click('#editLibraryClose');assert.equal(await page.locator('#editLibraryDialog').isVisible(),false);
  if(process.env.SHOT&&app==='ppt/')await page.screenshot({path:process.env.SHOT});
  await page.click('#editorClose');console.log('PASS '+app+' third caption: shared gallery, preview, geometry, save/reopen, isolated slides/links/templates, PPTX export and background clear');
  if(app==='ppt/'){
   await page.waitForFunction(()=>document.querySelector('#saveState').textContent.includes('이 기기에 저장됨'));
   const expected=await page.evaluate(()=>CaptionWorkspace.snapshot().slides);
   await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>{try{return CaptionWorkspace.snapshot().slides.length===3}catch{return false}});
   assert.deepEqual(await page.evaluate(()=>CaptionWorkspace.snapshot().slides),expected,'browser restart retains embedded images and geometry');
  }
 }
 // Make master uses exactly the same read-only collection.
 await page.click('[data-tab="master"]');await page.waitForFunction(()=>window.PromMake?.draft);
 await page.click('#mArtLibrary');await page.waitForSelector('#mArtLibraryGrid button');
 const expected=await page.evaluate(()=>CaptionImageLibrary.collect(PromMake.records(),'artwork').map(x=>x.src));
 assert.deepEqual(await page.locator('#mArtLibraryGrid img').evaluateAll(imgs=>imgs.map(i=>i.src)),expected);
 await page.locator('#mArtLibraryGrid button').first().click();await page.click('#mSave');
 assert.equal(await page.title(),'PPT 만들기');
 for(const app of ['', 'ppt/']){await page.goto(base+app,{waitUntil:'domcontentloaded'});await page.locator('.family-btn').first().click();assert.equal(await page.locator('.family-panel a').filter({hasText:'PPT 만들기'}).count(),1);}
 assert.deepEqual(errors,[]);console.log('PASS Make master collection/save and PROM/PPT navigation name');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
