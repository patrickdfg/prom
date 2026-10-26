const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://accounts.google.com/**',r=>r.abort());await page.goto((process.env.PROM_BASE||'http://127.0.0.1:8765/')+'make/');
  await page.waitForFunction(()=>document.querySelector('#makeTemplate option[value="builtin-sunday"]'));await page.selectOption('#makeTemplate','builtin-sunday');
  await page.click('details.manuscript-paste summary');await page.fill('#makePasteList textarea','1. 첫 번째 원고입니다.\n2. 두 번째 원고입니다.\n3. 세 번째 원고입니다.\n4. 네 번째 원고입니다.');await page.click('#makeRun');await page.waitForFunction(()=>!document.querySelector('#makeRun').disabled);
  assert.equal(await page.locator('#makeRevealCaption').isVisible(),false);
  await page.evaluate(async()=>{
   const p=CaptionWorkspace.snapshot(),s=await CaptionBuilder.scene('proverb',p.lines.join('\n'));
   CaptionWorkspace.apply([s,p.slides[3]],[{status:'exact',start:0,end:CaptionCore.index(p.lines).text.length,score:1},{status:'unlinked',start:null,end:null,score:0}],{selected:-1});
  });
  const before=await page.evaluate(()=>CaptionWorkspace.snapshot());await page.locator('#makeGrid .thumb').first().click();assert.equal(await page.locator('#makeRevealCaption').textContent(),'한 줄씩 누적');await page.click('#makeRevealCaption');
  const after=await page.evaluate(()=>CaptionWorkspace.snapshot());assert.equal(after.slides.length,5);assert.deepEqual(after.slides[4],before.slides[1]);
  const plain=s=>s.shapes[s.bodyIndex].paragraphs.map(p=>p.runs.map(r=>r.text).join('')).filter(t=>t.trim());
  const expected=plain(before.slides[0]);assert.equal(expected.length,4);
  for(let i=0;i<4;i++){
   assert.deepEqual(plain(after.slides[i]),expected.slice(0,i+1));assert.equal(after.slides[i].editor.cumulative,true);assert.equal(after.slides[i].editor.step,i+1);assert.equal(after.slides[i].shapes[after.slides[i].bodyIndex].paragraphs.length,4);
   assert.equal(after.links[i].status,'exact');if(i)assert.equal(after.links[i].start,after.links[i-1].end);
  }
  assert.equal(after.links[0].start,0);assert.equal(after.links[3].end,before.links[0].end);
  // Same frame, same first-line position through all four steps.
  const positions=await page.evaluate(async()=>{
   await document.fonts.ready;const p=CaptionWorkspace.snapshot(),host=document.createElement('div');Object.assign(host.style,{position:'fixed',top:'0',left:'0',width:'960px',height:'540px'});document.body.append(host);const ys=[];
   for(const s of p.slides.slice(0,4)){CaptionRender.show(host,s);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));ys.push(host.querySelector('.slide-text-content>div').getBoundingClientRect().top);}
   CaptionRender.release?.(host);host.remove();return ys;
  });assert(positions.every(y=>Math.abs(y-positions[0])<1),JSON.stringify(positions));
  const stable=JSON.stringify(after);await page.click('#makeRevealCaption');assert.equal(JSON.stringify(await page.evaluate(()=>CaptionWorkspace.snapshot())),stable,'repeat does not duplicate cumulative slides');
  const exported=await page.evaluate(async()=>{const blob=await CaptionPptx.create(CaptionWorkspace.snapshot());return (await CaptionImport.deck(new File([blob],'reveal.pptx'))).slides.map(s=>s.shapes.filter(sh=>sh.type==='text').flatMap(sh=>(sh.paragraphs||[]).map(p=>p.runs.map(r=>r.text).join(''))).filter(t=>t.trim()));});
  for(let i=0;i<4;i++)assert.deepEqual(exported[i],expected.slice(0,i+1));
  if(process.env.SHOT)await page.screenshot({path:process.env.SHOT});assert.deepEqual(errors,[]);
  console.log('PASS cumulative 1/12/123/1234, selection-only button, steady line positions, source ranges, repeat guard, unchanged neighboring slide and PPTX roundtrip');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
