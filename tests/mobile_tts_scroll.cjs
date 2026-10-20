// 폰: 읽어주기를 누르면 스크롤 보기로 바뀌고, 읽는 만큼 위치·화면이 따라 내려가는지 가짜 음성으로 확인한다.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium'});
 const ctx=await browser.newContext({viewport:{width:412,height:860},isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install();
 await page.addInitScript(()=>{const fake={speaking:false,pending:false,cancel(){fake.cur=null},speak(u){fake.cur=u;const L=u.text.length;let i=0;const step=()=>{if(fake.cur!==u)return;i+=8;if(i<L){u.onboundary&&u.onboundary({charIndex:i});setTimeout(step,200)}else u.onend&&u.onend()};setTimeout(step,200)},getVoices(){return []},pause(){},resume(){},addEventListener(){}};Object.defineProperty(window,'speechSynthesis',{value:fake});window.SpeechSynthesisUtterance=function(t){this.text=t};});
 await page.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await page.goto('http://localhost:8765/index.html',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>startWith(parseTxt(Array.from({length:60},(_,i)=>(i+1)+'번째 문장으로 원고의 한 줄을 채웁니다.').join('\n'))));await page.clock.runFor(500);
 await page.evaluate(()=>document.getElementById('tts').click());await page.clock.runFor(300);
 assert.equal(await page.evaluate(()=>document.getElementById('view').classList.contains('local-scroll')),true,'스크롤 보기로 전환');
 const s0=await page.evaluate(()=>({c:cursor,top:document.getElementById('localScroll').scrollTop}));
 await page.clock.runFor(3000);
 const s1=await page.evaluate(()=>({c:cursor,top:document.getElementById('localScroll').scrollTop,p:page}));
 assert.ok(s1.c>s0.c+20,'읽는 만큼 위치 이동 '+JSON.stringify([s0,s1]));
 await page.clock.runFor(15000);
 const s2=await page.evaluate(()=>({c:cursor,top:document.getElementById('localScroll').scrollTop,p:page}));
 assert.ok(s2.c>s1.c&&s2.top>s0.top,'화면도 내려감 '+JSON.stringify([s0,s1,s2]));
 // PC 크기에서는 바꾸지 않는다
 const pc=await (await browser.newContext({viewport:{width:1366,height:768}})).newPage();
 await pc.addInitScript(()=>{Object.defineProperty(window,'speechSynthesis',{value:{cancel(){},speak(){},getVoices(){return []},addEventListener(){}}});window.SpeechSynthesisUtterance=function(t){this.text=t};});
 await pc.route(/^https?:\/\/(?!localhost)/,r=>r.abort());await pc.goto('http://localhost:8765/index.html',{waitUntil:'domcontentloaded'});
 await pc.evaluate(()=>{startWith(parseTxt('가나다라 마바사.'));document.getElementById('tts').click()});
 assert.equal(await pc.evaluate(()=>document.getElementById('view').classList.contains('local-scroll')),false,'PC는 그대로');
 assert.deepEqual(errors,[]);console.log('PASS 폰 읽어주기 자동 스크롤',JSON.stringify([s0,s1,s2]));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
