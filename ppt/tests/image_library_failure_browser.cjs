const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium'});
 try{for(const app of ['ppt/','make/'])for(const failure of ['picture','catalog']){
  const context=await browser.newContext(),page=await context.newPage();let fail=true;
  await context.route('**/images/library/**',r=>fail&&(failure==='catalog'?r.request().url().includes('catalog.json'):r.request().url().includes('banner-pink-flowers.png'))?r.abort():r.continue());
  await page.goto((process.env.PROM_BASE||'http://localhost:8765/')+app);
  await page.waitForFunction(()=>window.CaptionImageLibrary&&window.PromBuiltinTemplates);
  if(app==='make/')await page.waitForFunction(()=>window.PromMake);
  await page.evaluate(async()=>{
   await PromBuiltinTemplates.ready;
   const db=await new Promise((ok,no)=>{const q=indexedDB.open('prom-ppt-generation-templates',1);q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error);});
   const src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4WQAAAAASUVORK5CYII=';
   await new Promise((ok,no)=>{const tx=db.transaction('templates','readwrite');tx.objectStore('templates').put({id:'audit-saved-picture',name:'저장된 내 그림',design:{layouts:{caption:{width:960,height:540,shapes:[{type:'image',src,w:100,h:100}]}}}});tx.oncomplete=ok;tx.onerror=()=>no(tx.error);});
   const saved=await new Promise(ok=>{const q=db.transaction('templates').objectStore('templates').get('audit-saved-picture');q.onsuccess=()=>ok(q.result);});db.close();
   if(window.PromMake?.putSynced)await PromMake.putSynced(saved);
  });
  const read=()=>page.evaluate(async()=>{const records=await CaptionImageLibrary.records();return {items:CaptionImageLibrary.collect(records,'artwork').map(x=>({id:x.id,label:x.label})),records:JSON.stringify(records)};});
  const partial=await read();assert(partial.items.some(x=>x.label.includes('저장된 내 그림')));
  if(failure==='picture'){assert(partial.items.some(x=>x.id==='jesus-v1'));assert(!partial.items.some(x=>x.id==='banner-pink-flowers-v1'));}
  if(app==='make/'){
   await page.click('[data-tab="master"]');await page.waitForFunction(()=>window.PromMake?.draft);
   await page.click('#mArtLibrary');await page.waitForSelector('#mArtLibraryGrid button');
   assert(await page.locator('#mArtLibraryGrid').textContent().then(t=>t.includes('저장된 내 그림')));
  }else{
   await page.waitForFunction(()=>window.CaptionRecipes);
   await page.evaluate(async()=>{const s=await CaptionBuilder.scene('caption','시험');CaptionWorkspace.apply([s],[{status:'unlinked',start:null,end:null}]);await CaptionEditor.open(0);});
   await page.click('#editArtLibrary');await page.waitForSelector('#editLibraryGrid button');
   assert((await page.locator('#editLibraryGrid').textContent()).includes('저장된 내 그림'));
  }
  fail=false;const recovered=await read();assert(recovered.items.some(x=>x.id==='jesus-v1'));assert(recovered.items.length>partial.items.length);assert.equal(recovered.records,partial.records);
  console.log('PASS '+app+' '+failure+' failure: saved/healthy gallery usable, retry recovers originals, templates unchanged');await context.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
