// 새로 고침처럼 디자인 은행이 기본으로 돌아간 상태에서도, 편집창을 열면 작업에 저장된 템플릿의 레이아웃을 쓰는지 확인한다.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium'});
 const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await page.goto('http://localhost:8765/ppt/index.html',{waitUntil:'domcontentloaded'});
 await page.click('#demo');await page.waitForTimeout(1200);
 // 작업에는 템플릿이 저장돼 있지만 빌더는 기본 디자인인 상태를 만든다
 await page.evaluate(async()=>{const base=await CaptionBuilder.snapshotTemplate(false);base.layouts.word.background='#123456';CaptionWorkspace.generationTemplate({version:1,id:'sync-test',name:'동기화',instructions:'',options:{},pair:null,fixedSlides:[],design:base});await CaptionBuilder.useTemplate(null);});
 assert.notEqual(await page.evaluate(async()=>(await CaptionBuilder.scene('word','가')).background),'#123456','시작 상태는 기본 디자인');
 await page.click('#editSelected');await page.waitForSelector('#editorDialog[open]');await page.waitForTimeout(800);
 await page.selectOption('#editLayout','word');await page.waitForTimeout(600);
 const bg=await page.evaluate(()=>document.querySelector('#editorPreview .slide-canvas').style.background);
 assert.ok(/rgb\(18, 52, 86\)|#123456/i.test(bg),'편집창의 말씀 레이아웃이 템플릿 디자인이어야 한다: '+bg);
 assert.deepEqual(errors,[]);console.log('PASS 편집창이 저장된 템플릿의 레이아웃을 사용');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
