const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true});try{
 const page=await b.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://accounts.google.com/**',r=>r.abort());await page.goto((process.env.PROM_BASE||'http://127.0.0.1:8765/')+'make/');await page.waitForFunction(()=>PromMake.get('builtin-dawn'));
 const result=await page.evaluate(async()=>{
  const out=[];for(const r of PromMake.records().filter(r=>r.builtin)){
   if(r.design.layouts.passage.background!=='#FFFFFF')throw Error(r.name+' master background');await CaptionBuilder.useTemplate(r.design);const s=await CaptionBuilder.scene('passage','본문 성구 확인',{ref:'요한복음 3:16'});if(s.background!=='#FFFFFF')throw Error(r.name+' generated background');out.push(r.name);
  }
  const d=structuredClone(PromMake.get('builtin-dawn').design);d.layouts.passage.background='#00FF00';d.layouts.passage.backgroundFill={type:'linear',stops:[{color:'#00FF00',offset:0},{color:'#00FF00',offset:1}]};await CaptionBuilder.useTemplate(d);
  const s=await CaptionBuilder.scene('passage','기존 저장본',{ref:'요한복음 3:16'}),source=structuredClone(s.shapes),old=structuredClone(s);old.background='#00ff00';old.backgroundFill=d.layouts.passage.backgroundFill;
  const h=document.createElement('div');h.id='whiteCheck';h.className='slide-host';h.style.cssText='position:fixed;inset:0;width:641px;height:361px;z-index:99999';document.body.append(h);CaptionRender.show(h,old);
  const render={base:old.background,fill:old.backgroundFill||null,host:h.style.background,canvas:h.querySelector('.slide-canvas').style.background};
  const caption=await CaptionBuilder.scene('caption','하단 자막');const captionBefore=JSON.stringify(caption);CaptionSize.scriptureBase(caption);if(JSON.stringify(caption)!==captionBefore)throw Error('caption changed');
  const legacy=structuredClone(s);legacy.background='#00ff00';legacy.backgroundFill=d.layouts.passage.backgroundFill;const p={version:1,slides:[legacy,caption],lines:[],links:[]},blob=await CaptionPptx.create(p),back=await CaptionImport.deck(new File([blob],'white.pptx'));
  return {out,render,background:s.background,shapesUnchanged:JSON.stringify(source)===JSON.stringify(old.shapes),exportBackground:back.slides[0].background,captionBackground:back.slides[1].background,firstText:back.slides[0].shapes.flatMap(s=>(s.paragraphs||[]).flatMap(p=>p.runs.map(r=>r.text))).join(' ')};
 });
 assert.equal(result.out.length,4);assert.equal(result.background,'#FFFFFF');assert.deepEqual(result.render,{base:'#FFFFFF',fill:null,host:'rgb(255, 255, 255)',canvas:'rgb(255, 255, 255)'});assert(result.shapesUnchanged);assert.equal(result.exportBackground.toUpperCase(),'#FFFFFF');assert.equal(result.captionBackground.toUpperCase(),'#00FF00');assert(result.firstText.includes('기존 저장본'));assert(result.firstText.includes('요한복음'));assert.deepEqual(errors,[]);
 console.log('PASS all four default templates, legacy green/gradient passage, preview/output renderer, opaque white PPTX base, unchanged artwork/text and green caption');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
