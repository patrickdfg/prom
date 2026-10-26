const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://accounts.google.com/**',r=>r.abort());
  const base=process.env.PROM_BASE||'http://127.0.0.1:8765/';await page.goto(base+'make/');await page.waitForFunction(()=>window.PromMake?.get('builtin-dawn'));
  const fresh=await page.evaluate(()=>PromMake.get('builtin-dawn'));
  const title=r=>r.fixedSlides[0].slide.shapes[12].paragraphs[0].runs[0].text,footer=r=>r.fixedSlides[0].slide.shapes[11].paragraphs[0].runs[0].text;
  assert.equal(title(fresh),'새벽예배');assert.equal(footer(fresh),'기도로 준비하겠습니다.');
  await page.selectOption('#makeTemplate','builtin-dawn');assert.equal(await page.locator('#makeColorGuide').isVisible(),true);assert.match(await page.locator('#makeColorGuide').textContent(),/파란 글씨 → 하단 2줄 자막/);assert.match(await page.locator('#makeColorGuide').textContent(),/녹색 글씨 → 전체 화면/);
  await page.selectOption('#makeTemplate','builtin-spirit-word');assert.equal(await page.locator('#makeColorGuide').isVisible(),false);await page.selectOption('#makeTemplate','builtin-dawn');
  // Old default with custom body/artwork and no edited flag must retain those changes.
  const old=structuredClone(fresh);delete old.dawnOpeningVersion;old.builtinVersion=2;old.edited=false;
  old.fixedSlides[0].slide.shapes[11].paragraphs[0].runs[0].text='';old.fixedSlides[0].slide.shapes[12].paragraphs[0].runs[0].text='';
  old.design.layouts.word.background='#abcdef';old.fixedSlides[0].slide.shapes[0].x-=1;
  const personal={...structuredClone(old),id:'personal-dawn-copy',name:'내 새벽설교 복제본',builtin:false};
  const put=async records=>page.evaluate(async records=>{const db=await new Promise((ok,no)=>{const r=indexedDB.open('prom-ppt-generation-templates',1);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});await new Promise((ok,no)=>{const tx=db.transaction('templates','readwrite');for(const r of records)tx.objectStore('templates').put(r);tx.oncomplete=ok;tx.onerror=()=>no(tx.error)});db.close()},records);
  await put([old,personal]);await page.reload();await page.waitForFunction(()=>PromMake.get('builtin-dawn')?.dawnOpeningVersion===1);
  const updated=await page.evaluate(()=>PromMake.get('builtin-dawn'));assert.equal(title(updated),'새벽예배');assert.equal(footer(updated),'기도로 준비하겠습니다.');assert.deepEqual(updated.design,old.design);assert.equal(updated.fixedSlides[0].slide.shapes[0].x,old.fixedSlides[0].slide.shapes[0].x);assert.equal(updated.edited,false);
  const rawPersonal=await page.evaluate(async()=>{const db=await new Promise(ok=>{const r=indexedDB.open('prom-ppt-generation-templates',1);r.onsuccess=()=>ok(r.result)});const value=await new Promise(ok=>{const r=db.transaction('templates').objectStore('templates').get('personal-dawn-copy');r.onsuccess=()=>ok(r.result)});db.close();return value});assert.deepEqual(rawPersonal,personal);
  const backups=async()=>page.evaluate(async()=>{const db=await new Promise(ok=>{const r=indexedDB.open('prom-ppt-generation-templates',1);r.onsuccess=()=>ok(r.result)});const list=await new Promise(ok=>{const r=db.transaction('templates').objectStore('templates').getAll();r.onsuccess=()=>ok(r.result)});db.close();return list.filter(r=>r.id.startsWith('__prom-template-backup__:builtin-dawn:opening-v3:'))});
  const history=await backups();assert.equal(history.length,1);const saved={...history[0],id:old.id};delete saved.backupAt;delete saved.backupOf;assert.deepEqual(saved,old);
  await page.reload();await page.waitForFunction(()=>PromMake.get('builtin-dawn'));assert.equal((await backups()).length,1);
  await page.selectOption('#makeTemplate','builtin-dawn');await page.click('details.manuscript-paste summary');await page.fill('#makePasteList textarea','1. 첫째 말씀입니다.\n2. 둘째 말씀입니다.');await page.click('#makeRun');await page.waitForFunction(()=>!document.querySelector('#makeRun').disabled);assert.equal(await page.locator('#makeDownload').isDisabled(),false);
  const output=await page.evaluate(async()=>{const p=CaptionWorkspace.snapshot(),blob=await CaptionPptx.create(p),back=await CaptionImport.deck(new File([blob],'dawn.pptx'));return back.slides[0].shapes.flatMap(s=>(s.paragraphs||[]).flatMap(p=>p.runs.map(r=>r.text))).join('\n')});assert(output.includes('새벽예배'));assert(output.includes('기도로 준비하겠습니다.'));
  await page.locator('#makeGrid .thumb').first().dblclick();await page.waitForFunction(()=>document.querySelector('#editorDialog').open);if(process.env.SHOT)await page.screenshot({path:process.env.SHOT});await page.click('#editorClose');
  const customized=structuredClone(old);customized.fixedSlides[0].slide.shapes[12].paragraphs[0].runs[0].text='우리 교회 표지';await put([customized]);await page.reload();await page.waitForFunction(()=>PromMake.get('builtin-dawn'));assert.deepEqual(await page.evaluate(()=>PromMake.get('builtin-dawn')),customized,'custom cover text is never overwritten');
  assert.deepEqual(errors,[]);console.log('PASS dawn opening title/footer, original body/artwork and copies preserved, full backup/idempotency, custom cover guard, color guide scope and generated PPTX');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
