// 방송용 PPT: 음성 인식이 결과 없이 30초 멈추면 다시 켜는지, network 끊김 직후 안내를 띄우지 않는지 확인한다.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium'});
 const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install();
 await page.addInitScript(()=>{window.__recs=[];window.SpeechRecognition=class{constructor(){window.__recs.push(this);this.aborted=0;}start(){setTimeout(()=>this.onstart&&this.onstart(),10);}abort(){this.aborted++;setTimeout(()=>this.onend&&this.onend(),10);}stop(){this.abort();}};});
 await page.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await page.goto('http://localhost:8765/ppt/index.html',{waitUntil:'domcontentloaded'});
 await page.click('#demo');await page.clock.runFor(1500);
 await page.evaluate(()=>{if(!document.querySelector('#manuscript .script-line'))document.querySelector('button')});
 const hasLines=await page.evaluate(()=>document.querySelectorAll('#manuscript .script-line').length);
 assert.ok(hasLines>0,'예시 원고');
 await page.click('#mic');await page.clock.runFor(100);
 assert.equal(await page.evaluate(()=>window.__recs.length),1);
 // 결과가 오는 동안에는 다시 켜지 않는다
 for(let i=0;i<5;i++){await page.evaluate(()=>{const r=window.__recs.at(-1);r.onresult({results:[[{transcript:'안녕'}]]});});await page.clock.runFor(10000);}
 assert.equal(await page.evaluate(()=>window.__recs.length),1,'결과가 오면 그대로');
 // network 끊김 직후: 안내 없음
 const before=await page.textContent('#status').catch(()=>'');
 await page.evaluate(()=>window.__recs.at(-1).onerror({error:'network'}));
 assert.ok(!/재연결 중/.test(await page.textContent('#status').catch(()=>'')),'network 안내 숨김');
 // 35초 동안 결과가 없으면 다시 켠다
 await page.clock.runFor(36000);await page.clock.runFor(2000);
 assert.ok(await page.evaluate(()=>window.__recs[0].aborted)>=1,'멈춤 감지 후 중단');
 assert.ok(await page.evaluate(()=>window.__recs.length)>=2,'다시 켬');
 assert.deepEqual(errors,[]);console.log('PASS 방송용 PPT 인식 정지 감시');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
