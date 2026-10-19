// 폰 화면: 옆으로 밀면 쪽 넘김, 읽어주기 중(전체화면 포함) 화면을 누르면 속도 조절 창이 뜨는지 확인한다.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium'});
 const ctx=await browser.newContext({viewport:{width:412,height:860},isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const fake={speaking:false,pending:false,cancel(){},speak(u){setTimeout(()=>u.onend&&u.onend(),50000)},getVoices(){return []},pause(){},resume(){},addEventListener(){}};Object.defineProperty(window,'speechSynthesis',{value:fake});window.SpeechSynthesisUtterance=function(t){this.text=t};});
 await page.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await page.goto('http://localhost:8765/index.html',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>startWith(parseTxt(Array.from({length:30},(_,i)=>(i+1)+'번째 줄 입니다.').join('\n'))));await page.waitForTimeout(300);
 const swipe=(x0,x1)=>page.evaluate(([x0,x1])=>{const s=document.getElementById('stage');const mk=(x)=>new Touch({identifier:1,target:s,clientX:x,clientY:400});s.dispatchEvent(new TouchEvent('touchstart',{touches:[mk(x0)],changedTouches:[mk(x0)],bubbles:true}));s.dispatchEvent(new TouchEvent('touchend',{touches:[],changedTouches:[mk(x1)],bubbles:true}));},[x0,x1]);
 assert.ok(await page.evaluate(()=>P.length)>2);
 await swipe(320,100);assert.equal(await page.evaluate(()=>page),1,'왼쪽으로 밀면 다음 쪽');
 await swipe(320,100);assert.equal(await page.evaluate(()=>page),2);
 await swipe(100,330);assert.equal(await page.evaluate(()=>page),1,'오른쪽으로 밀면 앞 쪽');
 await swipe(200,230);assert.equal(await page.evaluate(()=>page),1,'짧게 밀면 그대로');
 // 읽어주기 + 전체화면 상태에서 화면 누르기 (밀기 직후 0.5초 동안의 누르기는 무시하므로 기다린다)
 await page.waitForTimeout(600);
 await page.evaluate(()=>{document.getElementById('tts').click();document.getElementById('view').classList.add('solo-presentation');document.getElementById('ttsPanel').classList.remove('open');});
 assert.equal(await page.evaluate(()=>ttsOn),true);
 await page.evaluate(()=>document.getElementById('stage').click());
 assert.equal(await page.evaluate(()=>getComputedStyle(document.getElementById('ttsPanel')).display),'block','전체화면에서도 속도 창');
 await page.screenshot({path:process.env.SHOT||'/tmp/tts_panel.png'});
 await page.evaluate(()=>document.getElementById('stage').click());
 assert.equal(await page.evaluate(()=>getComputedStyle(document.getElementById('ttsPanel')).display),'none','다시 누르면 닫힘');
 assert.deepEqual(errors,[]);console.log('PASS 폰 스와이프·읽어주기 속도 창');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
