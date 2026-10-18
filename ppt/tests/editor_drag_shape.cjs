// 편집창에서 도형 추가와 마우스 끌어 옮기기가 동작하는지 브라우저로 확인한다.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium'});
 const page=await browser.newPage({viewport:{width:1500,height:950}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',d=>d.accept());
 await page.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await page.goto('http://localhost:8765/ppt/index.html',{waitUntil:'domcontentloaded'});
 await page.click('#demo');await page.waitForTimeout(1500);
 await page.click('#editSelected');await page.waitForSelector('#editorDialog[open]');await page.waitForTimeout(800);
 const box=async()=>page.$eval('#editorPreview .slide-canvas',c=>{const r=c.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height};});
 // 도형 추가
 await page.click('#editAddShape');await page.waitForTimeout(300);
 const added=await page.$$eval('#editShape option',o=>o.map(x=>x.textContent));
 assert.ok(added.some(t=>t.includes('추가 도형')),'목록에 추가 도형이 있어야 한다: '+added);
 assert.equal(await page.evaluate(()=>document.getElementById('editText').disabled),true,'도형 선택 중에는 문구 칸이 잠긴다');
 await page.screenshot({path:'/tmp/claude-0/work/shape_added.png'});
 // 끌어서 옮기기
 const x0=Number(await page.inputValue('#editX')),y0=Number(await page.inputValue('#editY'));
 const b=await box();const sx=b.x+b.w*(x0/100+.3),sy=b.y+b.h*(y0/100+.1);
 await page.mouse.move(sx,sy);await page.mouse.down();await page.mouse.move(sx+b.w*.1,sy+b.h*.2,{steps:6});await page.mouse.up();await page.waitForTimeout(300);
 const x1=Number(await page.inputValue('#editX')),y1=Number(await page.inputValue('#editY'));
 assert.ok(Math.abs(x1-(x0+10))<1.5&&Math.abs(y1-(y0+20))<1.5,`이동량 확인 x ${x0}->${x1}, y ${y0}->${y1}`);
 await page.screenshot({path:'/tmp/claude-0/work/shape_moved.png'});
 // 글상자도 끌 수 있고, 선택이 바뀐다
 const before=await page.evaluate(()=>document.getElementById('editShape').selectedOptions[0]?.textContent||'');
 const bodyBox=await page.$eval('#editorPreview .slide-text',e=>{const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
 await page.mouse.move(bodyBox.x,bodyBox.y);await page.mouse.down();await page.mouse.move(bodyBox.x,bodyBox.y-30,{steps:4});await page.mouse.up();await page.waitForTimeout(400);
 const after=await page.evaluate(()=>document.getElementById('editShape').selectedOptions[0]?.textContent||'');
 assert.notEqual(before,after,'글상자를 누르면 선택이 바뀐다');
 // 저장 후 도형이 슬라이드에 남는다
 await page.click('#editorApply');await page.waitForTimeout(600);
 assert.ok(await page.evaluate(()=>CaptionWorkspace.snapshot().slides.some(s=>s.shapes.some(x=>x.extraShape))),'저장된 슬라이드에 도형이 남아야 한다');
 assert.deepEqual(errors,[]);
 console.log('PASS 도형 추가, 마우스 이동, 선택 전환, 저장');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
