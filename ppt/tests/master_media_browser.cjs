const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium'});try{
 const page=await browser.newPage({viewport:{width:1510,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route('https://accounts.google.com/**',r=>r.abort());await page.route('https://www.googleapis.com/**',r=>r.abort());
 await page.goto((process.env.PROM_BASE||'http://localhost:8765/')+'ppt/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.CaptionEditor&&window.CaptionWorkspace&&window.CaptionMedia);
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=80;c.height=40;const x=c.getContext('2d');x.fillStyle='#ff00ff';x.fillRect(0,0,80,40);return c.toDataURL();});
 const file={name:'logo.png',mimeType:'image/png',buffer:Buffer.from(png.split(',')[1],'base64')};
 const png2=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=80;c.height=40;const x=c.getContext('2d');x.fillStyle='#00aaff';x.fillRect(0,0,80,40);return c.toDataURL();}),replacement={...file,name:'replacement.png',buffer:Buffer.from(png2.split(',')[1],'base64')};
 await page.evaluate(async()=>{const a=await CaptionBuilder.scene('caption','첫째 <r>강조</r>'),b=await CaptionBuilder.scene('caption','둘째 원고'),c=await CaptionBuilder.scene('word','다른 레이아웃');CaptionWorkspace.apply([a,b,c],[a,b,c].map(()=>({status:'unlinked',start:null,end:null,score:0})),{layoutMasters:{},selected:0});window.originalMediaProject=CaptionWorkspace.snapshot();});
 await page.click('#editMaster');await page.waitForSelector('#editorDialog[open]');assert(await page.locator('#editAddImage').isVisible());assert(await page.locator('#editBackgroundTools').isVisible());
 // Original template pictures can be replaced as well as newly inserted images.
 await page.selectOption('#editShape','0');await page.setInputFiles('#editReplaceFile',replacement);await page.waitForTimeout(100);await page.click('#editorApply');
 assert.equal(await page.evaluate(()=>CaptionWorkspace.snapshot().slides[1].shapes[0].src),png2);
 await page.evaluate(src=>{const bytes=Uint8Array.from(atob(src.split(',')[1]),c=>c.charCodeAt(0)),dt=new DataTransfer();dt.items.add(new File([bytes],'pasted.png',{type:'image/png'}));document.querySelector('#editorDialog').dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));},png);
 await page.waitForFunction(()=>document.querySelector('#editShape').selectedOptions[0]?.textContent.includes('추가 그림'));await page.click('#editRemoveText');
 await page.setInputFiles('#editImageFile',file);await page.waitForFunction(()=>document.querySelector('#editShape').selectedOptions[0]?.textContent.includes('추가 그림'));
 await page.fill('#editX','12');await page.fill('#editW','25');await page.click('#editBackward');await page.click('#editorApply');
 await page.waitForFunction(()=>CaptionWorkspace.snapshot().slides[0].shapes.some(sh=>sh.extraImage));
 await page.evaluate(()=>{const p=CaptionWorkspace.snapshot(),orig=window.originalMediaProject;for(const s of p.slides.slice(0,2)){if(s.shapes.filter(sh=>sh.extraImage).length!==1)throw Error('image missing/duplicated');if(s.shapes[s.bodyIndex].type!=='text')throw Error('body lost');}if(JSON.stringify(p.links)!==JSON.stringify(orig.links)||p.slides[1].editor.text!==orig.slides[1].editor.text)throw Error('manuscript changed');if(p.slides[2].shapes.some(sh=>sh.extraImage))throw Error('other layout changed');});
 const choose=async text=>{const value=await page.locator('#editShape option').evaluateAll((opts,t)=>opts.find(o=>o.textContent.includes(t))?.value,text);assert.notEqual(value,undefined);await page.selectOption('#editShape',value);};
 await choose('추가 그림');await page.setInputFiles('#editReplaceFile',replacement);await page.waitForTimeout(100);await page.click('#editDuplicateShape');await page.click('#editForward');await page.click('#editRemoveText');
 await page.click('#editAddText');await page.fill('#editText','공통 안내');await page.click('#editAddShape');await page.fill('#editColor','#123456');
 await page.setInputFiles('#editBackgroundFile',file);await page.waitForFunction(()=>document.querySelector('#editorHint').textContent.includes('배경그림을 화면 전체'));
 await page.click('#editorApply');await page.waitForFunction(()=>CaptionWorkspace.snapshot().slides[0].backgroundEdited);
 const verify=await page.evaluate(async()=>{const p=CaptionWorkspace.snapshot(),next=await CaptionBuilder.scene('caption','새 본문'),result=[];for(const s of [p.slides[0],p.slides[1],next])result.push({images:s.shapes.filter(sh=>sh.extraImage).length,text:s.shapes.filter(sh=>sh.extraText).map(sh=>sh.paragraphs.flatMap(p=>p.runs.map(r=>r.text)).join('')),rect:s.shapes.find(sh=>sh.extraShape)?.color,bg:s.shapes.filter(sh=>sh.editorBackground).length,body:s.shapes[s.bodyIndex]?.type});const blob=await CaptionPptx.create(p),back=await CaptionImport.deck(new File([blob],'master.pptx'));window.mediaRoundTrip=back;return {result,slots:back.slides[0].shapes.map(sh=>sh.masterSlot),expected:p.slides[0].shapes.map(sh=>sh.masterSlot)};});
 for(const s of verify.result)assert.deepEqual(s,{images:1,text:['공통 안내'],rect:'#123456',bg:1,body:'text'});assert.deepEqual(verify.slots,verify.expected);assert.equal(await page.evaluate(()=>CaptionWorkspace.snapshot().slides[1].shapes.find(sh=>sh.extraImage).src),png2);
 // Editing a normal slide must not duplicate inherited master extras during regeneration.
 await page.click('#editorClose');await page.click('#editSelected');await page.fill('#editText','수정한 본문');await page.click('#editorApply');
 assert.equal(await page.evaluate(()=>CaptionWorkspace.snapshot().slides[0].shapes.filter(sh=>sh.extraImage).length),1);
 await page.click('#editorClose');await page.click('#editMaster');await choose('추가 그림');await page.click('#editRemoveText');await page.click('#editBackgroundClear');await page.click('#editorApply');
 const removed=await page.evaluate(async()=>{const p=CaptionWorkspace.snapshot(),s=await CaptionBuilder.scene('caption','다음 본문');return [p.slides[0],p.slides[1],s].map(s=>({im:s.shapes.filter(sh=>sh.extraImage).length,bg:s.shapes.filter(sh=>sh.editorBackground).length,body:s.shapes[s.bodyIndex]?.type}));});for(const s of removed)assert.deepEqual(s,{im:0,bg:0,body:'text'});
 if(process.env.SHOT)await page.screenshot({path:process.env.SHOT});assert.deepEqual(errors,[]);console.log('PASS master images/add/replace/duplicate/delete/order/background/text/shape; same layout, new slides, content/links, normal editor and PPTX roundtrip');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
