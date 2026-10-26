const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true});try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://accounts.google.com/**',r=>r.abort());let fileChoosers=0;page.on('filechooser',()=>fileChoosers++);
 if(process.env.PROM_UI_THEME)await page.addInitScript(theme=>localStorage.setItem('promUiTheme',theme),process.env.PROM_UI_THEME);
 for(const [app,master] of [['make/',false],['ppt/',false],['make/',true]]){
  await page.goto((process.env.PROM_BASE||'http://127.0.0.1:8765/')+app);await page.waitForFunction(()=>window.CaptionWorkspace&&window.CaptionEditor);
  if(app==='make/'){await page.waitForFunction(()=>document.querySelector('#makeTemplate option[value="builtin-sunday"]'));await page.selectOption('#makeTemplate','builtin-sunday');await page.click('details.manuscript-paste summary');await page.fill('#makePasteList textarea','1. 첫째 말씀입니다.\n2. 둘째 말씀입니다.');await page.click('#makeRun');await page.waitForFunction(()=>!document.querySelector('#makeRun').disabled);}
  const imageIndex=await page.evaluate(async()=>{const slides=await Promise.all(['첫째 말씀','둘째 말씀'].map(t=>CaptionBuilder.scene('caption',t))),ix=slides[0].shapes.findIndex(sh=>sh.type==='image');if(ix<0)throw Error('no original image');for(const s of slides)Object.assign(s.shapes[ix],{x:17.25,y:410.5,w:850.75,h:100.25,manualGeometry:true,crop:{l:.1,r:.1,t:0,b:0}});CaptionWorkspace.apply(slides,slides.map(()=>({status:'unlinked',start:null,end:null,score:0})),{selected:0});return ix;});
  const before=await page.evaluate(()=>CaptionWorkspace.snapshot());await page.evaluate(master=>CaptionEditor.open(0,master),master);await page.selectOption('#editShape',String(imageIndex));
  await page.click('#editReplaceImage');await page.waitForSelector('#editLibraryGrid button');assert.equal(await page.locator('#editLibraryTitle').textContent(),'선택 그림 교체');assert.match(await page.locator('#editLibraryStatus').textContent(),/위치와 가로·세로 크기를 그대로/);
  const item=page.locator('#editLibraryGrid button').filter({hasText:'예수님'}).first(),src=await item.locator('img').getAttribute('src');await item.click();await page.waitForFunction(()=>document.querySelector('#editorHint').textContent.includes('기존 위치·크기 그대로'));
  assert.equal(await page.locator('#editUndo').isEnabled(),true);await page.click('#editUndo');await page.click('#editRedo');await page.click('#editorApply');
  const after=await page.evaluate(()=>CaptionWorkspace.snapshot()),shape=after.slides[0].shapes[imageIndex],old=before.slides[0].shapes[imageIndex];
  assert.equal(shape.src,src);assert.equal(shape.crop,null);for(const key of ['x','y','w','h'])assert.equal(shape[key],old[key]);assert.equal(after.slides[0].shapes.length,before.slides[0].shapes.length);assert.deepEqual(after.links,before.links);
  if(master){assert.equal(after.slides[1].shapes[imageIndex].src,src);assert.equal(after.slides[1].shapes[imageIndex].crop,null);}else assert.deepEqual(after.slides[1],before.slides[1]);
  const b=before.slides[0].bodyIndex;assert.deepEqual(after.slides[0].shapes[b].paragraphs,before.slides[0].shapes[b].paragraphs);
  const exported=await page.evaluate(async ix=>{const p=CaptionWorkspace.snapshot(),blob=await CaptionPptx.create(p),back=await CaptionImport.deck(new File([blob],'replace.pptx'));const s=back.slides[0],sh=s.shapes[ix];return {src:sh.src,x:sh.x/s.width,y:sh.y/s.height,w:sh.w/s.width,h:sh.h/s.height}},imageIndex);assert.equal(exported.src,src);for(const key of ['x','w'])assert(Math.abs(exported[key]-old[key]/before.slides[0].width)<.00001);for(const key of ['y','h'])assert(Math.abs(exported[key]-old[key]/before.slides[0].height)<.00001);
  await page.click('#editorClose');console.log('PASS '+app+(master?' master':' normal')+' library replacement, exact geometry, crop reset, undo/redo, text/links, element count and PPTX');
 }
 assert.equal(fileChoosers,0);assert.deepEqual(errors,[]);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
