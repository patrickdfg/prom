// 템플릿 만들기 화면(파일 선택 → 비교·추출 → 이름 → 템플릿 만들기)과 자막 만들기 화면이 구분되는지 브라우저에서 확인한다.
// 실제 원고·PPT가 필요하므로 REG_SCRIPT, REG_DECK 환경변수로 경로를 준다. 없으면 건너뛴다.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 if(!process.env.REG_SCRIPT||!process.env.REG_DECK){console.log('SKIP 원고·PPT 경로(REG_SCRIPT, REG_DECK) 없음');return;}
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium'});
 const page=await browser.newPage({viewport:{width:1000,height:1300}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await page.goto('http://localhost:8765/ppt/index.html',{waitUntil:'domcontentloaded'});
 const visible=id=>page.evaluate(i=>{const e=document.getElementById(i);return !!e&&e.offsetParent!==null;},id);
 await page.click('#registerTemplatePair');await page.waitForTimeout(800);
 assert.equal(await visible('analyzeTemplatePair'),true);
 for(const id of ['generateRun','generateTitle','generateDate','generationTemplate','saveGenerationTemplate','renameGenerationTemplate','deleteGenerationTemplate','createTemplate','generationTemplateName'])assert.equal(await visible(id),false,id+' 은(는) 비교 전에 보이지 않아야 한다');
 await page.setInputFiles('#pairScriptFile',process.env.REG_SCRIPT);await page.setInputFiles('#pairDeckFile',process.env.REG_DECK);
 await page.click('#analyzeTemplatePair');await page.waitForSelector('#registerFinish:not([hidden])',{timeout:30000});
 assert.equal(await visible('createTemplate'),true);assert.equal(await visible('generationTemplateName'),true);assert.equal(await visible('generateRun'),false);
 assert.ok(await page.locator('#pairFixedReview input[type=checkbox]:checked').count()>=1,'연결되지 않은 장은 기본으로 체크되어 있어야 한다');
 assert.equal(await page.locator('#pairFixedReview .pair-thumb').count()>=1,true,'연결되지 않은 장의 미리보기가 보여야 한다');
 // 하나를 해제하면 템플릿에 들어가지 않는다
 await page.fill('#generationTemplateName','등록 시험 A');
 await page.locator('#pairFixedReview input[type=checkbox]').first().uncheck();await page.click('#createTemplate');await page.waitForTimeout(2500);
 const list=()=>page.evaluate(()=>new Promise(ok=>{const q=indexedDB.open('prom-ppt-generation-templates',1);q.onsuccess=()=>{const g=q.result.transaction('templates').objectStore('templates').getAll();g.onsuccess=()=>ok(g.result.map(r=>({name:r.name,fixed:r.fixedSlides.length,title:r.options.title,date:r.options.date})));};}));
 let rows=await list();const a=rows.find(r=>r.name==='등록 시험 A');
 assert.ok(a&&a.fixed===0,'체크를 해제한 장은 저장되지 않는다: '+JSON.stringify(rows));assert.equal(a.title,'');assert.equal(a.date,'');
 // 자막 만들기 화면은 템플릿 선택과 표지 입력이 보이고 비교 칸은 숨는다
 await page.click('#generateClose');
 await page.evaluate(()=>{CaptionRecipes.setMode('make');document.getElementById('generateDialog').showModal();return CaptionRecipes.open();});await page.waitForTimeout(600);
 for(const id of ['generationTemplate','generateTitle','generateRun'])assert.equal(await visible(id),true,id);
 for(const id of ['analyzeTemplatePair','createTemplate','pairScriptFile'])assert.equal(await visible(id),false,id);
 assert.deepEqual(errors,[]);console.log('PASS 템플릿 만들기 흐름과 자막 만들기 화면 구분');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
