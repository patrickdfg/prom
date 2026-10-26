const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1500,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await context.route('https://accounts.google.com/**',r=>r.abort());
  const base=process.env.PROM_BASE||'http://127.0.0.1:8765/';
  const theme=async value=>{await page.evaluate(v=>{if(PromUiTheme.get()!==v)PromUiTheme.toggle()},value);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))};
  const stable=async(locator,label)=>{
   await theme('dark');await locator.scrollIntoViewIfNeeded();await locator.evaluate(async el=>{await document.fonts.ready;await Promise.all([...el.querySelectorAll('img'),...(el.tagName==='IMG'?[el]:[])].map(im=>im.decode().catch(()=>{})))});
   // A sticky toolbar can overlap a scrolled master canvas; capture the media underneath it.
   const shot={animations:'disabled',caret:'hide',style:'header.top,#toast,.toast,#statusbar,#bar,#voiceFeedback{visibility:hidden}'};
   const dark=await locator.screenshot(shot);await theme('light');const light=await locator.screenshot(shot);
   const difference=await page.evaluate(async images=>{const load=async data=>{const im=new Image();im.src='data:image/png;base64,'+data;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);return {width:im.width,height:im.height,data:g.getImageData(0,0,im.width,im.height).data}};const [a,b]=await Promise.all(images.map(load));if(a.width!==b.width||a.height!==b.height)return {dimensions:false};let max=0,changed=0;for(let y=8;y<a.height-8;y++)for(let x=8;x<a.width-8;x++)for(let c=0;c<4;c++){const i=(y*a.width+x)*4+c,d=Math.abs(a.data[i]-b.data[i]);max=Math.max(max,d);if(d>2)changed++}return {dimensions:true,max,changed}},[dark.toString('base64'),light.toString('base64')]);
   if(difference.changed&&process.env.SHOT){const name=label.replace(/[^a-z0-9]/gi,'_');require('node:fs').writeFileSync(process.env.SHOT+'-'+name+'-dark.png',dark);require('node:fs').writeFileSync(process.env.SHOT+'-'+name+'-light.png',light);}
   assert(difference.dimensions,label+' geometry');assert.equal(difference.changed,0,label+' colors '+JSON.stringify(difference));
   assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).filter),'none');
  };
  // Main prompter: actual reading pages keep their chosen background and colored words.
  await page.goto(base);await page.waitForFunction(()=>window.PromUiTheme);await theme('light');assert.equal(await page.locator('.setup-card').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');assert.notEqual(await page.locator('#fileTab').evaluate(el=>getComputedStyle(el).backgroundColor),await page.locator('#pasteTab').evaluate(el=>getComputedStyle(el).backgroundColor),'selected tab stays distinct');if(process.env.SHOT)await page.screenshot({path:process.env.SHOT+'-prom-setup.png'});await page.click('#demo');await page.waitForSelector('#view:visible');
  // Scrollbars are UI and intentionally change color; compare the actual reading rows.
  if(await page.locator('#localScroll').isVisible())for(const i of [0,1])await stable(page.locator('#localScroll .scroll-line').nth(i),'prompter scroll reading row '+i);
  await page.evaluate(()=>document.querySelector('#viewSingle').click());await page.waitForSelector('#page:visible');
  const reading=await page.locator('#page').innerHTML();await stable(page.locator('#page'),'prompter reading page');
  await page.evaluate(()=>document.querySelector('#edit').click());await page.waitForSelector('#continuousEditor:modal');
  assert.equal(await page.locator('#continuousEditor .ce-lines').first().isVisible(),true);await page.click('#ceCancel');assert.equal(await page.locator('#page').innerHTML(),reading);
  await page.evaluate(()=>document.querySelector('#fs').click());await page.waitForFunction(()=>!!document.fullscreenElement);await stable(page.locator('#page'),'fullscreen reading page');await page.evaluate(()=>document.exitFullscreen());
  console.log('PASS main prompter reading colors, continuous editor cancel and browser fullscreen');
  for(const app of ['make/','ppt/']){
   await page.goto(base+app);await page.waitForFunction(()=>window.CaptionEditor&&window.CaptionWorkspace&&window.PromUiTheme);
   if(app==='make/'){
    await page.waitForFunction(()=>document.querySelector('#makeTemplate option[value="builtin-dawn"]'));await page.selectOption('#makeTemplate','builtin-dawn');await page.click('details.manuscript-paste summary');await page.fill('#makePasteList textarea','1. 첫째 말씀입니다.\n2. 둘째 말씀입니다.');await page.click('#makeRun');await page.waitForFunction(()=>!document.querySelector('#makeRun').disabled);
    await stable(page.locator('#makeGrid .thumb .slide-canvas').first(),'Make grid');
   }else{
    await page.evaluate(async()=>{const slides=await Promise.all(['첫째 말씀','둘째 말씀'].map(t=>CaptionBuilder.scene('word',t)));CaptionWorkspace.apply(slides,slides.map(()=>({status:'unlinked',start:null,end:null,score:0})),{selected:0})});
    await stable(page.locator('#slideList .slide-canvas').first(),'PPT grid');
   }
   const before=await page.evaluate(()=>CaptionWorkspace.snapshot());await page.evaluate(()=>CaptionEditor.open(0));await page.waitForSelector('#editorDialog:modal');await stable(page.locator('#editorPreview .slide-canvas'),'slide editor '+app);
   const ui=await page.locator('#editorDialog').evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color}));assert.equal(ui.background,'rgb(255, 255, 255)');assert.equal(ui.color,'rgb(23, 35, 51)');
   await page.click('#editBgLibrary');await page.waitForSelector('#editLibraryGrid img');await stable(page.locator('#editLibraryGrid img').first(),'background gallery '+app);if(process.env.SHOT)await page.screenshot({path:process.env.SHOT+'-'+app.replace('/','')+'-gallery.png'});await page.click('#editLibraryClose');
   await page.click('#editArtLibrary');await page.waitForSelector('#editLibraryGrid img');await stable(page.locator('#editLibraryGrid img').first(),'artwork gallery '+app);await page.click('#editLibraryClose');await page.click('#editorClose');
   await page.evaluate(()=>CaptionEditor.open(0,true));await page.waitForSelector('#editorDialog:modal');await stable(page.locator('#editorPreview .slide-canvas'),'layout master editor '+app);await page.click('#editorClose');
   assert.deepEqual(await page.evaluate(()=>CaptionWorkspace.snapshot()),before,'theme changes do not mutate slides/links '+app);
   if(app==='make/'){
    await page.evaluate(async()=>{await PromMake.openMaster('builtin-dawn');document.querySelector('.tabs button[data-tab="master"]').click()});await page.waitForSelector('#mPreview .slide-canvas');await stable(page.locator('#mPreview .slide-canvas'),'template master preview');
    for(const [open,dialog,grid] of [['mBgLibrary','mBgLibraryDialog','mBgLibraryGrid'],['mArtLibrary','mArtLibraryDialog','mArtLibraryGrid']]){
     await page.click('#'+open);await page.waitForSelector('#'+grid+' img');await stable(page.locator('#'+grid+' img').first(),dialog);await page.evaluate(id=>document.getElementById(id).close(),dialog);
    }
   }
   await theme('light');const family=page.locator('.family-btn').first();await family.click();await page.waitForSelector('.family-panel:visible');assert(await page.locator('.family-panel a').count()>=3);await family.click();
   if(process.env.SHOT)await page.screenshot({path:process.env.SHOT+'-'+app.replace('/','')+'.png'});
   console.log('PASS '+app+' original colors in grid/editor/master/background+art galleries, light controls, menu and immutable slides');
  }
  // Shared setting and reload use the same native theme, including first opening in light mode.
  const second=await context.newPage();await second.goto(base+'make/');await second.waitForFunction(()=>window.PromUiTheme);assert.equal(await second.evaluate(()=>PromUiTheme.get()),'light');await theme('dark');await second.waitForFunction(()=>document.documentElement.dataset.ui==='dark');await theme('light');await second.waitForFunction(()=>document.documentElement.dataset.ui==='light');await second.reload();await second.waitForFunction(()=>window.PromUiTheme);assert.equal(await second.evaluate(()=>getComputedStyle(document.documentElement).filter),'none');
  assert.deepEqual(errors,[]);console.log('PASS theme persistence/cross-tab changes; no page errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
