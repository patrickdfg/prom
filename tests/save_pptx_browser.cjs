// 프롬프터 'PPT 저장': 쪽 수만큼 슬라이드가 든 PPTX가 내려받아지는지 확인한다.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium'});
 const page=await browser.newPage({acceptDownloads:true,viewport:{width:1366,height:768}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.showSaveFilePicker=undefined;});
 await page.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await page.goto('http://localhost:8765/index.html',{waitUntil:'domcontentloaded'});
 if(process.env.HWP){await page.check('input[name=lines][value="7"]');await page.setInputFiles('#file',process.env.HWP);await page.waitForFunction(()=>!document.getElementById('start').disabled);await page.click('#start');}
 else await page.evaluate(()=>{baseName='시험';startWith(parseTxt('주님은 사랑이십니다.\n\n다음 문단입니다. 이어서 읽습니다.'))});
 await page.waitForTimeout(300);
 const n=await page.evaluate(()=>P.length);
 await page.click('#save');
 const [dl]=await Promise.all([page.waitForEvent('download'),page.click('#savePptx')]);
 const out=process.env.OUT||'/tmp/prompter_test.pptx';fs.copyFileSync(await dl.path(),out);
 

 assert.deepEqual(errors,[]);console.log('PASS PPT 저장',n,'쪽',fs.statSync(out).size,'바이트',out);await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
