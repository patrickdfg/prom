const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium'});try{
 const ctx=await browser.newContext({viewport:{width:1450,height:1000}}),page=await ctx.newPage(),errors=[];ctx.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));page.on('pageerror',e=>errors.push(e.message));await ctx.route('https://accounts.google.com/**',r=>r.abort());
 await page.goto((process.env.PROM_BASE||'http://localhost:8765/')+'ppt/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.CaptionWorkspace&&window.CaptionPresentationKeys);
 await page.evaluate(()=>{
  const slides=Array.from({length:5},(_,i)=>({uid:'key-'+i,text:'화면 '+(i+1),width:960,height:540,background:'#fff',shapes:[{type:'text',x:10,y:20,w:900,h:200,paragraphs:[{runs:[{text:'화면 '+(i+1),size:40,font:'Malgun Gothic'}]}]}]}));
  CaptionWorkspace.open({version:1,lines:['첫 번째 원고입니다.'],slides,links:slides.map((_,i)=>i===0?{status:'manual',start:0,end:5,score:1}:{status:'unlinked',start:null,end:null,score:0})});
 });
 const current=()=>page.locator('#slideList .slide-card[aria-current="true"]').evaluateAll(nodes=>nodes.length?Number(nodes[0].querySelector('strong').textContent.replace('번','')):0);
 const press=async(key,n,target=page)=>{await target.keyboard.press(key);await page.waitForFunction(n=>document.querySelector('#slideList .slide-card[aria-current="true"] strong')?.textContent===n+'번',n);assert.equal(await current(),n);};
 // A first Space from standby shows the selected first slide rather than skipping it.
 await page.locator('#green').click();await page.locator('body').click({position:{x:2,y:2}});await press('Space',1);assert.equal(await page.locator('#automatic').isChecked(),false);
 await press('ArrowRight',2);await press('ArrowDown',3);await press('ArrowLeft',2);await press('ArrowUp',1);await press('ArrowLeft',1);await press('End',5);await press('Space',5);await press('Home',1);await press('PageDown',2);await press('PageUp',1);
 await page.locator('.slide-card').nth(2).click();await page.locator('.slide-card').nth(2).focus();await press('Space',4);await press('Shift+Space',3);
 // A focused navigation button must not trigger a second native click on keyup.
 await page.locator('#next').focus();await press('Space',4);await page.waitForTimeout(100);assert.equal(await current(),4);
 await page.keyboard.down('Space');await page.keyboard.down('Space');await page.keyboard.up('Space');assert.equal(await current(),5);
 await page.locator('#search').focus();await page.keyboard.press('ArrowLeft');await page.keyboard.press('Space');assert.equal(await current(),5);assert.equal(await page.locator('#search').inputValue(),' ');
 await page.locator('#divider').focus();await page.keyboard.press('ArrowLeft');assert.equal(await current(),5);
 await page.locator('body').click({position:{x:2,y:2}});await press('Home',1);await page.keyboard.press('Control+ArrowRight');assert.equal(await current(),1);
 // Manual navigation immediately takes control from speech-based automatic output.
 await page.locator('#automatic').check();assert.equal(await page.locator('#automatic').isChecked(),true);await page.locator('body').click({position:{x:2,y:2}});await press('ArrowRight',2);assert.equal(await page.locator('#automatic').isChecked(),false);
 const popup=page.waitForEvent('popup');await page.locator('#openOutput').click();const out=await popup;await out.waitForLoadState('domcontentloaded');await out.waitForFunction(()=>document.title.startsWith('2번 자막'));if(!await out.evaluate(()=>!!document.fullscreenElement))await out.locator('#fullscreen').click();await out.waitForFunction(()=>!!document.fullscreenElement);
 await press('Space',3,out);await out.waitForFunction(()=>document.title.startsWith('3번 자막'));await press('ArrowDown',4,out);await press('ArrowRight',5,out);await press('ArrowRight',5,out);await press('ArrowLeft',4,out);await press('ArrowUp',3,out);await press('Home',1,out);await press('Shift+Space',1,out);
 // Output-window keys cannot change the live slide while the control editor is open.
 await page.locator('#editSelected').click();await page.waitForSelector('#editorDialog[open]');await page.locator('#editText').focus();await page.keyboard.press('Space');await press('ArrowRight',1,out);await page.locator('#editorClose').click();await press('PageDown',2,out);await press('End',5,out);await press('PageUp',4,out);
 await out.keyboard.down('Space');await out.keyboard.down('Space');await out.keyboard.up('Space');await page.waitForFunction(()=>document.querySelector('#liveLabel').textContent.startsWith('5번'));await page.waitForTimeout(100);assert.equal(await current(),5);
 assert.deepEqual(errors,[]);console.log('PASS controller/output arrows, Space, Shift+Space, Page Up/Down, Home/End; first/last boundaries, focused cards/buttons, repeat protection, input/dialog isolation, automatic-to-manual control and synchronized output');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
