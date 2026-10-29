const{chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium',headless:true}),dir=process.env.HWPX_OUT||fs.mkdtempSync(path.join(os.tmpdir(),'prom-hwpx-'));
 try{
  const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await context.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/,r=>r.abort());
  await page.addInitScript(()=>window.showSaveFilePicker=undefined);
  await page.goto('http://localhost:8765/index.html',{waitUntil:'domcontentloaded'});
  const fixtures=[];
  for(const count of [5,6,7]){
   const pages=Array.from({length:2},(_,pi)=>Array.from({length:count},(_,li)=>li===1?[]:[{t:pi+'-'+li+'  앞 & <뒤> ',c:'k'},{t:'강조',c:'b'},{t:' 2',c:'r'},{t:' 1.',c:'n'}]));
   await page.evaluate(({pages,count})=>{setMode(false);LINES=count;baseName='저장 시험';document.getElementById('theme').value=count===6?'white':'dark';applyTheme();openPrompter(pages);dirty=true;},{pages,count});
   const before=await page.evaluate(()=>JSON.stringify(P));await page.click('#save');
   assert.deepEqual(await page.locator('#saveDialog .save-options button').allTextContents(),['PPT 저장','HWPX 저장','프롬프터 저장']);
   await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>page),0,'저장 목록의 키가 쪽을 넘기지 않는다');
   await page.keyboard.press('Escape');assert.equal(await page.locator('#saveDialog').evaluate(e=>e.open),false);
   await page.click('#save');const[download]=await Promise.all([page.waitForEvent('download'),page.click('#saveHwpx')]);
   assert(download.suggestedFilename().endsWith('.hwpx'));const file=path.join(dir,'fixture-'+count+'.hwpx');await download.saveAs(file);fixtures.push(file);
   assert.equal(await page.evaluate(()=>JSON.stringify(P)),before);assert.equal(await page.evaluate(()=>dirty),true,'HWPX 내보내기가 원본의 저장 상태를 바꾸지 않는다');
   const check=await page.evaluate(async bytes=>{
    const buffer=new Uint8Array(bytes).buffer,zip=await JSZip.loadAsync(buffer),head=await zip.file('Contents/header.xml').async('string'),section=await zip.file('Contents/section0.xml').async('string'),r=await parseHwpx(buffer);
    return {mime:await zip.file('mimetype').async('string'),first:Object.keys(zip.files)[0],pages:r.pages,lines:r.lines,hasMS:!!r.pages.ms,xmlErrors:[head,section].map(s=>new DOMParser().parseFromString(s,'application/xml').getElementsByTagName('parsererror').length)};
   },Array.from(fs.readFileSync(file)));
   assert.equal(check.mime,'application/hwp+zip');assert.equal(check.first,'mimetype');assert.deepEqual(check.xmlErrors,[0,0]);assert.deepEqual(check.pages,pages);assert.equal(check.lines,count);assert.equal(check.hasMS,false);
   await page.evaluate(()=>openPrompter([[ [{t:'다른 원고',c:'k'}],[],[],[],[] ]]));
   await page.setInputFiles('#file',file);await page.waitForFunction(n=>LINES===n&&P.length===2,count);assert.deepEqual(await page.evaluate(()=>P),pages);assert.equal(await page.locator('#theme').inputValue(),count===6?'white':'dark');
  }
  const ordinary=await page.evaluate(async()=>{const z=new JSZip();z.file('Contents/header.xml','<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head"><hh:charPr id="0" textColor="#000000"/></hh:head>');z.file('Contents/section0.xml','<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"><hp:p><hp:run charPrIDRef="0"><hp:t>일반 원고</hp:t></hp:run></hp:p></hs:sec>');return parseHwpx(await z.generateAsync({type:'arraybuffer'}));});
  assert.equal(ordinary.lines,undefined);assert.equal(ordinary.pages[0][0][0].t,'일반 원고','다른 HWPX 파일은 기존 가져오기를 사용');
  // 본문 XML을 한글에서 편집한 경우에도 예전 사본이 아니라 수정된 본문을 읽는다.
  const edit=await page.evaluate(async bytes=>{const z=await JSZip.loadAsync(new Uint8Array(bytes));let s=await z.file('Contents/section0.xml').async('string');s=s.replace('앞 &amp;','수정 &amp;');z.file('Contents/section0.xml',s);const data=await z.generateAsync({type:'uint8array'});return (await parseHwpx(data.buffer)).pages[0][0][0].t;},Array.from(fs.readFileSync(fixtures[0])));
  assert(edit.includes('수정 &'));
  // 편집 중인 글자를 두 저장 형식 모두 현재 화면에서 가져온다.
  await page.evaluate(()=>{setMode(false);LINES=5;openPrompter([[ [{t:'원문',c:'k'}],[],[],[],[] ]]);beginEdit();document.querySelector('#lines .ln').textContent='고친 원고';dirty=true;});
  await page.click('#save');const[edited]=await Promise.all([page.waitForEvent('download'),page.click('#saveHwpx')]);const editedFile=path.join(dir,'edited.hwpx');await edited.saveAs(editedFile);
  const editedText=await page.evaluate(async bytes=>(await parseHwpx(new Uint8Array(bytes).buffer)).pages[0][0].map(r=>r.t).join(''),Array.from(fs.readFileSync(editedFile)));assert.equal(editedText,'고친 원고');assert.equal(await page.evaluate(()=>editing),true);
  await page.click('#save');const[project]=await Promise.all([page.waitForEvent('download'),page.click('#saveProject')]);const projectFile=path.join(dir,'edited.json');await project.saveAs(projectFile);const saved=JSON.parse(fs.readFileSync(projectFile,'utf8'));assert.equal(saved.app,'sermon-prompter');assert.equal(saved.pages[0][0].map(r=>r.t).join(''),'고친 원고');assert.equal(await page.evaluate(()=>dirty),false);
  // 저장 선택기를 취소하면 다운로드나 편집 상태 변경이 없다.
  await page.evaluate(()=>window.showSaveFilePicker=async()=>{throw new DOMException('cancel','AbortError');});
  let downloaded=false;page.on('download',()=>downloaded=true);await page.click('#save');await page.click('#saveHwpx');await page.waitForTimeout(100);assert.equal(downloaded,false);
  assert.deepEqual(errors,[]);console.log('PASS save format dialog, HWPX 5/6/7-row text/color/blank/page roundtrip, manual XML edit, input preservation and picker cancel');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
