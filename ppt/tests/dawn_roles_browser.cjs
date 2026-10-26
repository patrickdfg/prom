const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1400,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://accounts.google.com/**',r=>r.abort());
  await page.goto((process.env.PROM_BASE||'http://127.0.0.1:8765/')+'make/');await page.waitForFunction(()=>window.PromMake?.get('builtin-dawn'));
  const fresh=await page.evaluate(()=>PromMake.get('builtin-dawn')),sunday=await page.evaluate(()=>PromMake.get('builtin-sunday'));
  const clean=s=>{s=structuredClone(s);delete s.layoutName;return s};
  for(const key of ['wordGod','wordSon'])assert.deepEqual(clean(fresh.design.layouts[key]),clean(sunday.design.layouts[key]),key+' matches Sunday role artwork and geometry');
  assert.deepEqual(clean(fresh.design.layouts.word),clean(sunday.design.layouts.wordTeacher),'generic word uses neutral artwork');
  assert.notDeepEqual(clean(fresh.design.layouts.word),clean(fresh.design.layouts.proverb));
  assert.deepEqual(fresh.design.layouts.wordSpirit.shapes.filter(s=>s.type==='image'),sunday.design.layouts.wordSpirit.shapes.filter(s=>s.type==='image'));
  const behavior=await page.evaluate(async()=>{
   const B=CaptionBuilder;await B.useTemplate(PromMake.get('builtin-dawn').design);
   const results=['지금은 하나님의 창조 목적을 이루는 시대요,','하나님이 말씀하셨습니다. 서로 사랑하라.','성자님이 말씀하셨습니다. 서로 사랑하라.','성령님이 말씀하셨습니다. 서로 사랑하라.'].map(t=>B.speakerLayout(t));
   results.push(B.speakerLayout('서로 사랑하며 살아라.','word','wordGod'));
   const text='1. 하나님을 사랑하며 살아라.',p={lines:[text],richLines:[{text,paragraph:0,source:0,runs:[{text,hex:'008000'}]}]};
   p.lines.push('2. 작은 일부터 행하라.');p.richLines.push({text:p.lines[1],paragraph:1,source:0,runs:[{text:p.lines[1],hex:'000000'}]});p.richLines[0].runs[0].hex='000000';
   const specs=B.analyze(p),saved=await B.snapshotTemplate(false);await B.useTemplate(saved);results.push(B.speakerLayout('하나님께 감사하며 살아갑시다.'));
   await B.useTemplate(PromMake.get('builtin-sunday').design);results.push(B.speakerLayout('하나님께 감사하며 살아갑시다.'));
   return {results,numbered:specs.map(s=>s.layout),saved:saved.speakerInference};
  });
  assert.deepEqual(behavior,{results:['word','wordGod','wordSon','wordSpirit','wordGod','word','wordGod'],numbered:['proverb','proverb'],saved:'explicit'});
  // Recreate the old shipped word/God layouts from their unchanged proverb scene.
  const old=structuredClone(fresh);delete old.dawnRolesVersion;delete old.design.speakerInference;old.builtinVersion=4;
  old.design.layouts.word=structuredClone(old.design.layouts.proverb);old.design.layouts.word.layoutName='말씀';
  old.design.layouts.wordGod=clean(old.design.layouts.proverb);const b=old.design.layouts.wordGod.shapes[1];b.x=25.50005249343832;b.y=2.7690288713910762;b.paragraphs[0].defaultSize=48;
  old.design.layouts.wordSon.background='#abcdef';old.edited=false;
  // Optional full historic fixture also exercises the original Son layout migration.
  if(process.env.DAWN_LEGACY_FIXTURE){const legacy=JSON.parse(fs.readFileSync(process.env.DAWN_LEGACY_FIXTURE));old.design.layouts.wordSon=legacy.design.layouts.wordSon;}
  const personal={...structuredClone(old),id:'personal-dawn-roles',name:'개인 새벽 복제본',builtin:false};
  const put=async r=>page.evaluate(async rows=>{const d=await new Promise(ok=>{const r=indexedDB.open('prom-ppt-generation-templates',1);r.onsuccess=()=>ok(r.result)});await new Promise((ok,no)=>{const t=d.transaction('templates','readwrite');for(const r of rows)t.objectStore('templates').put(r);t.oncomplete=ok;t.onerror=()=>no(t.error)});d.close()},r);
  await put([old,personal]);await page.reload();await page.waitForFunction(()=>PromMake.get('builtin-dawn')?.dawnRolesVersion===1);
  const updated=await page.evaluate(()=>PromMake.get('builtin-dawn'));
  for(const key of ['word','wordGod'])assert.deepEqual(clean(updated.design.layouts[key]),clean(fresh.design.layouts[key]));
  assert.deepEqual(clean(updated.design.layouts.wordSon),clean(process.env.DAWN_LEGACY_FIXTURE?fresh.design.layouts.wordSon:old.design.layouts.wordSon));
  for(const key of ['caption','wordSpirit','wordTeacher','proverb','cover','verse'])assert.deepEqual(updated.design.layouts[key],old.design.layouts[key]);
  assert.deepEqual(updated.fixedSlides,old.fixedSlides);assert.deepEqual(updated.design.layoutMasters,old.design.layoutMasters);
  const stored=await page.evaluate(async()=>{const d=await new Promise(ok=>{const r=indexedDB.open('prom-ppt-generation-templates',1);r.onsuccess=()=>ok(r.result)});const rows=await new Promise(ok=>{const r=d.transaction('templates').objectStore('templates').getAll();r.onsuccess=()=>ok(r.result)});d.close();return rows});
  assert.deepEqual(stored.find(r=>r.id===personal.id),personal);const backup=stored.find(r=>r.id.startsWith('__prom-template-backup__:builtin-dawn:roles-v5:'));assert(backup);const restored={...backup,id:old.id};delete restored.backupOf;delete restored.backupAt;assert.deepEqual(restored,old);
  // A locally changed layout or a master override must never be replaced, regardless of edited flag.
  const custom=structuredClone(old);custom.design.layouts.word.background='#123456';custom.design.layoutMasters.wordGod={background:'#654321'};custom.design.layouts.wordSon.background='#fedcba';
  await put([custom]);await page.reload();await page.waitForFunction(()=>PromMake.get('builtin-dawn')?.dawnRolesVersion===1);const kept=await page.evaluate(()=>PromMake.get('builtin-dawn'));
  for(const k of ['word','wordGod','wordSon'])assert.deepEqual(clean(kept.design.layouts[k]),clean(custom.design.layouts[k]));assert.deepEqual(kept.design.layoutMasters,custom.design.layoutMasters);
  await put([fresh]);await page.reload();await page.waitForFunction(()=>PromMake.get('builtin-dawn'));
  const exportCheck=await page.evaluate(async()=>{
   await CaptionBuilder.useTemplate(PromMake.get('builtin-dawn').design);const keys=['word','wordGod','wordSon','wordSpirit','proverb'],slides=await Promise.all(keys.map(k=>CaptionBuilder.scene(k,k+' 확인'))),p={version:1,slides,lines:[],links:[]};
   const blob=await CaptionPptx.create(p),back=await CaptionImport.deck(new File([blob],'roles.pptx'));
   const host=document.createElement('div');host.id='roleChecks';host.style.cssText='position:fixed;inset:0;background:#182433;z-index:999999;display:grid;grid-template-columns:1fr 1fr;gap:10px;overflow:auto';document.body.append(host);
   for(const s of slides){const h=document.createElement('div');h.className='slide-host';h.style.cssText='width:640px;height:360px';host.append(h);CaptionRender.show(h,s,s.background)}
   return {count:back.slides.length,texts:back.slides.map(s=>s.shapes.flatMap(x=>(x.paragraphs||[]).flatMap(p=>p.runs.map(r=>r.text))).join(' ')),images:back.slides.map(s=>s.shapes.filter(x=>x.type==='image').length)};
  });
  assert.equal(exportCheck.count,5);for(const [i,key] of ['word','wordGod','wordSon','wordSpirit','proverb'].entries()){assert(exportCheck.texts[i].includes(key+' 확인'));assert(exportCheck.images[i]>0)}
  if(process.env.SHOT)await page.screenshot({path:process.env.SHOT,fullPage:true});assert.deepEqual(errors,[]);
  console.log('PASS dawn role backgrounds vs Sunday, explicit attribution, numbered priority, policy round-trip, legacy update/backups, custom layouts/master/copies preserved, rendered roles and PPTX export');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
