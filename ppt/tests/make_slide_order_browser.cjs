const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('https://accounts.google.com/**',r=>r.abort());
  await page.goto((process.env.PROM_BASE||'http://127.0.0.1:8765/')+'make/');
  await page.waitForFunction(()=>document.querySelector('#makeTemplate option[value="builtin-sunday"]'));
  await page.selectOption('#makeTemplate','builtin-sunday');await page.click('details.manuscript-paste summary');
  await page.fill('#makePasteList textarea','1. 첫 번째 말씀입니다.\n2. 두 번째 말씀입니다.\n3. 세 번째 말씀입니다.');
  await page.click('#makeRun');await page.waitForFunction(()=>!document.querySelector('#makeRun').disabled);
  const before=await page.evaluate(()=>CaptionWorkspace.snapshot());assert.equal(before.slides.length,3);
  for(const id of ['makeRevealCaption','makeMoveBefore','makeMoveAfter'])assert.equal(await page.locator('#'+id).isVisible(),false);
  await page.locator('#makeGrid .thumb').nth(1).click();await page.click('#makeAddCaption');
  await page.waitForFunction(()=>document.querySelector('#editorDialog').open);await page.fill('#editText','선택한 장 뒤에 추가한 자막');await page.click('#editorApply');
  await page.waitForFunction(()=>CaptionWorkspace.snapshot().slides.length===4);await page.click('#editorClose');
  const inserted=await page.evaluate(()=>CaptionWorkspace.snapshot());assert.equal(inserted.slides[2].editor.text,'선택한 장 뒤에 추가한 자막');
  assert.deepEqual(inserted.slides.slice(0,2),before.slides.slice(0,2));assert.deepEqual(inserted.slides[3],before.slides[2]);assert.deepEqual(inserted.links.slice(0,2),before.links.slice(0,2));assert.deepEqual(inserted.links[3],before.links[2]);
  await page.click('#makeMoveBefore');let p=await page.evaluate(()=>CaptionWorkspace.snapshot());assert.equal(p.slides[1].uid,inserted.slides[2].uid);assert.deepEqual(p.links[2],before.links[1]);
  await page.click('#makeMoveAfter');p=await page.evaluate(()=>CaptionWorkspace.snapshot());assert.deepEqual(p,inserted);
  await page.locator('#makeGrid .thumb').nth(3).dragTo(page.locator('#makeGrid .thumb').first());
  p=await page.evaluate(()=>CaptionWorkspace.snapshot());assert.equal(p.slides[0].uid,before.slides[2].uid);assert.deepEqual(p.links[0],before.links[2]);
  assert.equal(await page.locator('#makeMoveBefore').isDisabled(),true);assert.equal(await page.locator('#makeMoveAfter').isDisabled(),false);
  const moved=structuredClone(p);await page.evaluate(()=>{const p=CaptionWorkspace.snapshot();CaptionWorkspace.apply(p.slides,p.links,{selected:-1})});
  assert.equal(await page.locator('#makeRevealCaption').isVisible(),false);await page.click('#makeAddCaption');await page.waitForFunction(()=>document.querySelector('#editorDialog').open);await page.fill('#editText','선택 없이 맨 뒤 추가');await page.click('#editorApply');await page.waitForFunction(()=>CaptionWorkspace.snapshot().slides.length===5);await page.click('#editorClose');
  p=await page.evaluate(()=>CaptionWorkspace.snapshot());assert.equal(p.slides[4].editor.text,'선택 없이 맨 뒤 추가');assert.deepEqual(p.slides.slice(0,4),moved.slides);assert.equal(await page.locator('#makeMoveAfter').isDisabled(),true);
  const count=await page.evaluate(async()=>{const blob=await CaptionPptx.create(CaptionWorkspace.snapshot());return (await CaptionImport.deck(new File([blob],'order.pptx'))).slides.length});assert.equal(count,5);
  assert.deepEqual(errors,[]);if(process.env.SHOT)await page.screenshot({path:process.env.SHOT});
  console.log('PASS Make add-after-selection/no-selection append, forward/back/drag reorder, slide-link pairing, selection controls/boundaries, existing content preservation and PPTX export');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
