// 저장된 템플릿을 고르면 고정 슬라이드가 불러와져 새 자막 사이에 들어가는지 브라우저에서 확인한다.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium'});
 const page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await page.goto('http://localhost:8765/ppt/index.html',{waitUntil:'domcontentloaded'});
 await page.click('#demo');await page.waitForTimeout(1200);
 const out=await page.evaluate(async()=>{
  const slide=t=>({width:960,height:540,uid:'f'+t,text:t,background:'#102030',shapes:[{type:'text',x:60,y:200,w:840,h:120,paragraphs:[{align:'center',runs:[{text:t,font:'Malgun Gothic',size:48,bold:true,color:'#ffffff'}]}]}]});
  const record={version:1,id:'fixed-test',name:'고정 시험',instructions:'x',options:{},pair:null,design:await CaptionBuilder.snapshotTemplate(),fixedSlides:[{before:0,total:2,label:'환영',slide:slide('환영합니다')},{before:2,total:2,label:'마무리',slide:slide('마무리 안내')}]};
  await new Promise((ok,no)=>{const r=indexedDB.open('prom-ppt-generation-templates',1);r.onupgradeneeded=()=>r.result.createObjectStore('templates',{keyPath:'id'});r.onsuccess=()=>{const tx=r.result.transaction('templates','readwrite');tx.objectStore('templates').put(record);tx.oncomplete=ok;tx.onerror=no;};});
  CaptionWorkspace.generationTemplate(record);await CaptionRecipes.open();
  const gen=['가','나'].map(t=>({uid:t,text:t,width:960,height:540,shapes:[]})),links=gen.map((_,i)=>({status:'exact',start:i,end:i+1,score:1}));
  const w=CaptionRecipes.withFixed({slides:gen,links});
  return {texts:w.slides.map(s=>s.text),status:w.links.map(l=>l.status),select:document.getElementById('generationTemplate').value};
 });
 assert.equal(out.select,'fixed-test');
 assert.deepEqual(out.texts,['환영합니다','가','나','마무리 안내']);
 assert.deepEqual(out.status,['unlinked','exact','exact','unlinked']);
 assert.deepEqual(errors,[]);
 console.log('PASS 템플릿 선택 시 고정 슬라이드 불러오기와 삽입');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
