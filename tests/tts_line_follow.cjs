// 읽어주기: 읽는 위치를 알려 주지 않는 음성(안드로이드)에서도 시간으로 어림해 줄 단위로 따라가고, 지금 줄 글자색이 강조색인지 확인한다.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium'});
 const ctx=await browser.newContext({viewport:{width:412,height:860},isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install();
 // onboundary 없이 문장 끝(onend)만 알려 주는 음성: 한 글자에 0.12초
 await page.addInitScript(()=>{const fake={cancel(){fake.cur=null},speak(u){fake.cur=u;setTimeout(()=>u.onstart&&u.onstart(),10);setTimeout(()=>{if(fake.cur===u)u.onend&&u.onend()},u.text.length*120)},getVoices(){return []},addEventListener(){}};Object.defineProperty(window,'speechSynthesis',{value:fake});window.SpeechSynthesisUtterance=function(t){this.text=t};});
 await page.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await page.goto('http://localhost:8765/index.html',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>startWith(parseTxt(Array.from({length:40},(_,i)=>(i+1)+'번째 문장으로 원고의 한 줄을 채웁니다.').join('\n'))));await page.clock.runFor(500);
 await page.evaluate(()=>document.getElementById('tts').click());await page.clock.runFor(300);
 const rows=[];for(let i=0;i<12;i++){await page.clock.runFor(1000);rows.push(await page.evaluate(()=>{const c=document.querySelector('#localScroll .scroll-current');return c?c.textContent:''}));}
 const distinct=[...new Set(rows)].length;
 assert.ok(distinct>=5,'12초 동안 현재 줄이 여러 번 바뀜: '+distinct+' '+JSON.stringify(rows));
 const color=await page.evaluate(()=>{const c=document.querySelector('#localScroll .scroll-current');return [getComputedStyle(c).color,getComputedStyle(document.getElementById('localScroll')).getPropertyValue('--focus')]});
 assert.notEqual(color[0],'rgb(0, 0, 0)','현재 줄 강조색');
 await page.evaluate(()=>document.getElementById('tts').click());
 assert.equal(await page.evaluate(()=>document.getElementById('view').classList.contains('tts-reading')),false,'끝내면 강조 해제');
 assert.deepEqual(errors,[]);console.log('PASS 읽어주기 줄 단위 따라가기',distinct,color[0]);await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
