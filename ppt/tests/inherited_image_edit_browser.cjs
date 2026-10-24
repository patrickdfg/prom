const {chromium}=require('playwright'),assert=require('node:assert/strict');
const base=process.env.PROM_BASE||'http://127.0.0.1:8766/';
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
 const page=await browser.newPage({viewport:{width:1500,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route('https://accounts.google.com/**',r=>r.abort());
 for(const app of ['ppt/','make/']){
  await page.goto(base+app,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.CaptionEditor&&window.CaptionWorkspace);
  if(app==='make/'){
   await page.waitForFunction(()=>document.querySelector('#makeTemplate option[value="builtin-sunday"]'));
   await page.click('details.manuscript-paste summary');await page.fill('#makePasteList textarea','1. 첫째\n2. 둘째\n3. 셋째');await page.click('#makeRun');
   await page.waitForFunction(()=>!document.querySelector('#makeRun').disabled&&!document.querySelector('#makeDownload').disabled);
  }
  await page.evaluate(async()=>{const a=await CaptionBuilder.scene('caption','첫째 원고'),b=await CaptionBuilder.scene('caption','둘째 원고'),c=await CaptionBuilder.scene('word','다른 레이아웃');const image=a.shapes.find(s=>s.type==='image');Object.assign(image,{x:40,y:40,w:240,h:90,manualGeometry:true});window.pictureSlot=image.masterSlot;window.pictureIndex=a.shapes.indexOf(image);CaptionWorkspace.apply([a,b,c],[a,b,c].map(()=>({status:'unlinked',start:null,end:null,score:0})),{selected:0,layoutMasters:{}});window.beforePictureEdit=CaptionWorkspace.snapshot();await CaptionEditor.open(0);});
  const index=await page.evaluate(()=>window.pictureIndex);
  assert(await page.locator('#editShape option[value="'+index+'"]').count(),'original template image can be selected');
  await page.selectOption('#editShape',String(index));assert.equal(await page.locator('#editRemoveText').isEnabled(),true);
  const handle=page.locator('[data-editor-handle="se"]');await handle.waitFor();const box=await handle.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+25,box.y+box.height/2+15,{steps:4});await page.mouse.up();
  assert(Number(await page.inputValue('#editW'))>240/960*100,'handle resizes picture');
  const oldBox=await page.locator('#editorPreview [data-editor-outline]').boundingBox();
  const replacement=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=40;c.height=240;const g=c.getContext('2d');g.fillStyle='#0f0';g.fillRect(0,0,40,240);return c.toDataURL();});
  await page.setInputFiles('#editReplaceFile',{name:'different-aspect.png',mimeType:'image/png',buffer:Buffer.from(replacement.split(',')[1],'base64')});await page.waitForFunction(src=>Array.from(document.querySelectorAll('#editorPreview img')).some(img=>img.src===src),replacement);
  const newBox=await page.locator('#editorPreview [data-editor-outline]').boundingBox();for(const key of ['x','y','width','height'])assert(Math.abs(oldBox[key]-newBox[key])<1,'replacement preserves displayed '+key);
  await page.fill('#editW','45');await page.fill('#editH','22');await page.click('#editorApply');
  const saved=await page.evaluate(()=>CaptionWorkspace.snapshot());
  assert(saved.slides[0].shapes.some(s=>s.type==='image'&&Math.abs(s.w/saved.slides[0].width-.45)<.001&&Math.abs(s.h/saved.slides[0].height-.22)<.001));
  assert.deepEqual(saved.slides.slice(1),await page.evaluate(()=>beforePictureEdit.slides.slice(1)));
  const body=saved.slides[0].bodyIndex;await page.selectOption('#editShape',String(body));await page.fill('#editText','본문을 바꿔도 그림은 유지');await page.click('#editorApply');
  assert(await page.evaluate(()=>{const s=CaptionWorkspace.snapshot().slides[0];return s.shapes.some(sh=>sh.masterSlot===pictureSlot&&Math.abs(sh.w/s.width-.45)<.001);}), 'image edit survives body regeneration');
  await page.selectOption('#editShape',String(index));await page.click('#editRemoveText');await page.click('#editorApply');
  assert(await page.evaluate(()=>!CaptionWorkspace.snapshot().slides[0].shapes.some(s=>s.masterSlot===pictureSlot)),'deleted original picture stays deleted after save');
  await page.fill('#editText','삭제 후 본문 편집');await page.click('#editorApply');
  assert(await page.evaluate(()=>!CaptionWorkspace.snapshot().slides[0].shapes.some(s=>s.masterSlot===pictureSlot)));
  await page.click('#editorClose');await page.evaluate(()=>CaptionEditor.open(1,true));
  const masterImage=await page.locator('#editShape option').evaluateAll(opts=>opts.find(o=>o.textContent.startsWith('그림'))?.value);assert.notEqual(masterImage,undefined);await page.selectOption('#editShape',masterImage);await page.fill('#editW','55');await page.fill('#editH','24');await page.click('#editorApply');
  assert(await page.evaluate(()=>{const s=CaptionWorkspace.snapshot().slides[1];return s.shapes.some(sh=>sh.type==='image'&&Math.abs(sh.w/s.width-.55)<.001&&Math.abs(sh.h/s.height-.24)<.001);}));
  await page.selectOption('#editShape',masterImage);await page.click('#editRemoveText');await page.click('#editorApply');
  assert(await page.evaluate(async()=>{const s=await CaptionBuilder.scene('caption','새 본문');return !s.shapes.some(sh=>sh.masterSlot===pictureSlot);}));
  assert.deepEqual(await page.evaluate(()=>CaptionWorkspace.snapshot().slides[2]),await page.evaluate(()=>beforePictureEdit.slides[2]));
  const roundtrip=await page.evaluate(async()=>{const p=CaptionWorkspace.snapshot(),blob=await CaptionPptx.create(p),back=await CaptionImport.deck(new File([blob],'pictures.pptx'));return {flag:back.slides[0].imageEdited,images:back.slides[0].shapes.filter(s=>s.type==='image').length,expected:p.slides[0].shapes.filter(s=>s.type==='image').length};});assert.equal(roundtrip.flag,true);assert.equal(roundtrip.images,roundtrip.expected);
  await page.click('#editorClose');console.log('PASS '+app+' original image select, handles/numeric resize, delete, body regeneration, isolated slides/layouts, shared master and PPTX persistence');
 }
 // The template master must retain manual picture geometry in its generated preview.
 await page.goto(base+'make/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.PromMake&&document.querySelector('#mTemplate option[value="builtin-sunday"]'));
 await page.click('[data-tab="master"]');await page.waitForFunction(()=>PromMake.draft);
 await page.selectOption('#mLayout','caption');
 const option=await page.locator('#mShape option').evaluateAll(opts=>opts.find(o=>o.textContent.startsWith('그림'))?.value);assert.notEqual(option,undefined);await page.selectOption('#mShape',option);
 await page.fill('#mX','10');await page.fill('#mY','10');await page.fill('#mW','880');await page.fill('#mH','500');
 const source=await page.evaluate(()=>{const s=PromMake.draft.layouts.caption,sh=s.shapes[Number(document.querySelector('#mShape').value)];return {src:sh.src,w:sh.w,h:sh.h,manual:sh.manualGeometry};});assert.equal(source.manual,true);
 await page.waitForFunction(src=>{const img=Array.from(document.querySelectorAll('#mPreview img')).find(i=>i.src===src);return img&&img.parentElement.style.width==='880px'&&img.parentElement.style.height==='500px';},source.src);
 const handle=page.locator('#mPreview .hdl[data-h="se"]');const hb=await handle.boundingBox();await page.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2);await page.mouse.down();await page.mouse.move(hb.x+hb.width/2-25,hb.y+hb.height/2-20,{steps:4});await page.mouse.up();
 const width=Number(await page.inputValue('#mW'));assert(width<880);await page.click('#mSave');await page.waitForFunction(()=>document.querySelector('#mStatus').textContent.includes('저장했습니다'));await page.click('#mRevert');await page.selectOption('#mShape',option);assert.equal(Number(await page.inputValue('#mW')),width);
 await page.click('#mDel');await page.click('#mSave');await page.waitForFunction(()=>document.querySelector('#mStatus').textContent.includes('저장했습니다'));await page.click('#mRevert');assert(await page.evaluate(src=>!PromMake.draft.layouts.caption.shapes.some(sh=>sh.type==='image'&&sh.src===src),source.src));
 console.log('PASS Make template master numeric/handle image resizing, preview geometry, save/reopen and delete');
 assert.deepEqual(errors,[]);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
