const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1450,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://accounts.google.com/**',r=>r.abort());
  await page.goto((process.env.PROM_BASE||'http://127.0.0.1:8765/')+'make/');
  await page.waitForFunction(()=>document.querySelector('#makeTemplate option[value="builtin-sunday"]'));
  assert.equal(await page.locator('#makeEditMaster').isVisible(),false);
  await page.selectOption('#makeTemplate','builtin-sunday');
  await page.locator('#tab-make details.manuscript-paste summary').click();
  await page.locator('#makePasteList textarea').fill('1. 첫 번째 말씀입니다.\n2. 두 번째 말씀입니다.');
  await page.click('#makeRun');
  await page.waitForFunction(()=>!document.querySelector('#makeRun').disabled);
  assert.equal(await page.locator('#makeGrid .thumb').count(),2);
  await page.evaluate(()=>{
   const p=CaptionWorkspace.snapshot(),other=structuredClone(p.slides[0]);other.uid=crypto.randomUUID();other.masterId='unrelated-layout';
   CaptionWorkspace.apply([...p.slides,other],[...p.links,structuredClone(p.links[0])],{selected:-1});
  });
  await page.click('#makeEditMaster');
  assert.equal(await page.locator('#editorDialog').isVisible(),false,'selection required');
  await page.locator('#makeGrid .thumb').first().click();
  const before=await page.evaluate(()=>CaptionWorkspace.snapshot());
  await page.click('#makeEditMaster');
  await page.waitForFunction(()=>document.querySelector('#editorDialog').open);
  assert.equal(await page.locator('#editorTitle').textContent(),'레이아웃 마스터 편집');
  assert.match(await page.locator('#editorApply').textContent(),/2장/);
  await page.fill('#editX','12');await page.locator('#editX').dispatchEvent('input');
  await page.click('#editorApply');
  await page.waitForFunction(()=>Object.keys(CaptionWorkspace.snapshot().layoutMasters||{}).length>0);
  const after=await page.evaluate(()=>CaptionWorkspace.snapshot());
  assert.deepEqual(after.links,before.links);
  assert.deepEqual(after.slides[2],before.slides[2]);
  for(let i=0;i<2;i++){
   assert.equal(after.slides[i].shapes[after.slides[i].bodyIndex].x,after.slides[i].width*.12);
   assert.deepEqual(after.slides[i].shapes[after.slides[i].bodyIndex].paragraphs,before.slides[i].shapes[before.slides[i].bodyIndex].paragraphs);
  }
  await page.click('#editorClose');await page.click('#makeEditSelected');
  await page.waitForFunction(()=>document.querySelector('#editorDialog').open);
  assert.equal(await page.locator('#editText').isEnabled(),true);
  await page.click('#editorClose');await page.click('#makeAddCaption');
  await page.waitForFunction(()=>document.querySelector('#editorDialog').open);
  assert.equal(await page.locator('#editText').isEnabled(),true);
  await page.click('#editorClose');
  const roundtrip=await page.evaluate(async()=>{const blob=await CaptionPptx.create(CaptionWorkspace.snapshot());const p=await CaptionImport.deck(new File([blob],'master.pptx'));return p.slides.length;});
  assert.equal(roundtrip,3);assert.deepEqual(errors,[]);
  if(process.env.SHOT)await page.screenshot({path:process.env.SHOT});
  console.log('PASS Make master shortcut: selection guard, matching layouts updated, other layouts/text/links preserved, slide edit/add and PPTX export');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
