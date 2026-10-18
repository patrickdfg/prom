// 템플릿을 바꾸거나 저장해도 이전 작업의 레이아웃 마스터 수정이 다른 템플릿에 섞이지 않는지 브라우저에서 확인한다.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium'});
 const page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await page.goto('http://localhost:8765/ppt/index.html',{waitUntil:'domcontentloaded'});
 await page.click('#demo');await page.waitForTimeout(1200);
 const r=await page.evaluate(async()=>{
  const base=await CaptionBuilder.snapshotTemplate(false),body=base.layouts.caption.bodyIndex,mk=(id,name,size)=>({version:1,id,name,instructions:'x',options:{},pair:null,fixedSlides:[],design:{...base,layoutMasters:{'generated:caption':{[body]:{size}}}}});
  const put=rec=>new Promise((ok,no)=>{const q=indexedDB.open('prom-ppt-generation-templates',1);q.onupgradeneeded=()=>q.result.createObjectStore('templates',{keyPath:'id'});q.onsuccess=()=>{const tx=q.result.transaction('templates','readwrite');tx.objectStore('templates').put(rec);tx.oncomplete=ok;tx.onerror=no;};});
  const get=id=>new Promise(ok=>{const q=indexedDB.open('prom-ppt-generation-templates',1);q.onsuccess=()=>{const g=q.result.transaction('templates').objectStore('templates').get(id);g.onsuccess=()=>ok(g.result);};});
  await put(mk('iso-a','주일',50));await put(mk('iso-b','새벽',70));
  const size=async()=>{const s=await CaptionBuilder.scene('caption','가나다');return s.shapes[s.bodyIndex].paragraphs[0].runs[0].size;};
  const pick=async id=>{const sel=document.getElementById('generationTemplate');sel.value=id;sel.dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,600));};
  const leftover={'generated:caption':{[body]:{size:99}}};
  CaptionWorkspace.layoutMasters(leftover);await CaptionRecipes.open();
  await pick('iso-a');const a=await size(),leftA=CaptionWorkspace.layoutMasters();
  CaptionWorkspace.layoutMasters(leftover);await pick('iso-b');const b=await size();
  // 편집한 마스터를 새 이름으로 저장하면 그 템플릿에만 들어간다
  CaptionWorkspace.layoutMasters({'generated:caption':{[body]:{size:33}}});
  document.getElementById('generationTemplateName').value='저녁';document.getElementById('saveGenerationTemplate').click();await new Promise(r=>setTimeout(r,900));
  const saved=(await new Promise(ok=>{const q=indexedDB.open('prom-ppt-generation-templates',1);q.onsuccess=()=>{const g=q.result.transaction('templates').objectStore('templates').getAll();g.onsuccess=()=>ok(g.result);};})).find(x=>x.name==='저녁');
  const after=await get('iso-b');
  return {a,b,leftA,saved:saved?.design.layoutMasters['generated:caption'][body].size,b2:after.design.layoutMasters['generated:caption'][body].size,left:CaptionWorkspace.layoutMasters(),now:await size()};
 });
 assert.equal(r.a,50,'주일 템플릿 값');assert.deepEqual(r.leftA,{},'전환하면 임시 수정이 비워진다');
 assert.equal(r.b,70,'새벽 템플릿 값(주일 값이 섞이지 않음)');
 assert.equal(r.saved,33,'저장한 템플릿에는 편집한 마스터가 들어간다');assert.equal(r.b2,70,'기존 새벽 템플릿은 바뀌지 않는다');
 assert.deepEqual(r.left,{});assert.equal(r.now,33,'저장 뒤 현재 작업도 저장한 값을 쓴다');
 assert.deepEqual(errors,[]);
 console.log('PASS 템플릿 전환·저장 시 마스터 격리');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
