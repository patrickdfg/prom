// 자막이 이어질 때 이전 장이 새 장 아래에서 불투명하게 유지되는지(녹색이 비치지 않는지) 확인하는 브라우저 시험
const assert=require('node:assert/strict'),path=require('node:path');
let chromium;try{({chromium}=require('playwright'));}catch{console.log('SKIP playwright 없음');process.exit(0);}
(async()=>{
 const browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 const page=await browser.newPage();
 await page.setContent('<style>.caption-frame{position:absolute;inset:0;transition:opacity 200ms ease-in-out}#host{position:relative;width:200px;height:100px}</style><div id="host"></div>');
 await page.evaluate(()=>{window.CaptionRender={show(layer,slide){layer.textContent=slide.text;layer.style.background='#00ff00';},release(){}};});
 await page.addScriptTag({path:path.join(__dirname,'..','transitions.js')});
 const state=()=>page.evaluate(()=>[...document.getElementById('host').children].map(el=>[el.textContent,+getComputedStyle(el).opacity]));
 const wait=ms=>page.waitForTimeout(ms);
 await page.evaluate(()=>{window.t=new CaptionTransition(document.getElementById('host'));t.show({text:'A'},0);});
 await wait(320);assert.deepEqual(await state(),[['A',1]],'첫 장이 완전히 보임');
 // 이어지는 자막 — 전환 도중에도 이전 장 A는 불투명(1)이어야 하고, 끝나면 A만 사라진다
 await page.evaluate(()=>t.show({text:'B'},1));await wait(90);
 let s=await state();assert.equal(s.length,2,'전환 중에는 두 장');assert.equal(s[0][0],'A');assert.equal(s[0][1],1,'이전 장이 투명해지면 녹색이 비침');assert.ok(s[1][1]<1,'새 장은 서서히 나타남');
 await wait(330);assert.deepEqual(await state(),[['B',1]],'전환이 끝나면 새 장만 남음');
 // 연속으로 빠르게 바뀌어도 맨 아래 장은 불투명하게 남아 녹색이 비치지 않는다
 await page.evaluate(()=>{t.show({text:'C'},2);setTimeout(()=>t.show({text:'D'},3),60);});await wait(110);
 s=await state();assert.equal(s[0][1],1,'맨 아래 장은 불투명해야 녹색이 비치지 않음');await wait(400);assert.deepEqual(await state(),[['D',1]]);
 // 녹색으로 돌아갈 때는 모든 장이 서서히 사라지고, 아래 장이 비쳐 보이지 않는다
 await page.evaluate(()=>{t.show({text:'E'},4);setTimeout(()=>t.show(null,-1),40);});await wait(120);
 s=await state();assert.ok(s.every(x=>x[1]<1),'녹색으로 돌아갈 때 이전 장이 다시 보이면 안 됨');await wait(400);assert.deepEqual(await state(),[]);
 await browser.close();console.log('PASS crossfade keeps outgoing slide opaque, cleans up, and fades only to green');
})().catch(e=>{console.error(e);process.exit(1);});
