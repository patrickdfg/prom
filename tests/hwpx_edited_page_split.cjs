// 한글에서 고치다 쪽 나눔이 빠진 HWPX를 열어도 줄 수가 늘지 않고 문단 경계에서 쪽이 나뉘는지 확인하는 시험
const{chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/,r=>r.abort());
  await page.goto('http://localhost:8765/index.html',{waitUntil:'domcontentloaded'});
  const row=t=>t?[{t,c:'k'}]:[];
  const pages=[
   [row('A1'),row('A2'),row('A3'),row('A4'),row('A5')],
   [row('B1'),row('B2'),row('B3'),row(''),row('')],
   [row('C1'),row('C2'),row('C3'),row('C4'),row('C5')],
   [row('D1'),row('D2'),row(''),row(''),row('')],
   [row('E1'),row('E2'),row('E3'),row('E4'),row('E5')],
   [row('F1'),row('F2'),row('F3'),row('F4'),row('F5')],
   [row('G1'),row('G2'),row('G3'),row('G4'),row('G5')],
  ];
  // 2~5번째 쪽과 7번째 쪽의 쪽 나눔을 지워 한글에서 쪽 나눔이 빠진 모양을 만든다
  const result=await page.evaluate(async({pages,drop})=>{
   const blob=await PromHwpx.create(pages,{count:5}),zip=await JSZip.loadAsync(await blob.arrayBuffer());
   let s=await zip.file('Contents/section0.xml').async('string'),n=0;
   s=s.replace(/pageBreak="1"/g,m=>drop.includes(n++)?'pageBreak="0"':m);
   zip.file('Contents/section0.xml',s);
   const r=await parseHwpx(await zip.generateAsync({type:'arraybuffer'}));
   return {lines:r.lines,pages:r.pages.map(pg=>pg.map(l=>l.map(x=>x.t).join(''))),gaps:r.pages.flat().filter(l=>l.some(x=>x.paragraphStart)).map(l=>l.map(x=>x.t).join(''))};
  },{pages,drop:[0,1,2,3,5]});
  assert.equal(result.lines,5,'쪽 나눔이 빠져도 줄 수가 늘지 않는다');
  assert(result.pages.every(pg=>pg.length<=5),'모든 쪽이 5줄 이하');
  const flat=result.pages.flat().filter(Boolean);
  assert.deepEqual(flat,pages.flat().map(l=>l.map(x=>x.t).join('')).filter(Boolean),'글자와 순서가 그대로 보존된다');
  // 빈 줄(문단 경계)에서 나뉜다. 한 문단이 5줄을 넘으면 5줄씩 자른다
  assert.deepEqual(result.pages[0],['A1','A2','A3','A4','A5']);
  assert.deepEqual(result.pages[1],['B1','B2','B3']);
  assert.deepEqual(result.pages[2],['C1','C2','C3','C4','C5']);
  assert.deepEqual(result.pages[3],['D1','D2']);
  assert.deepEqual(result.pages[4],['E1','E2','E3','E4','E5']);
  assert.deepEqual(result.gaps,['C1','E1'],'글 사이의 빈 줄은 스크롤 보기 간격(paragraphStart)으로 남는다');
  // 앱에서도 5줄 화면으로 열린다
  await page.evaluate(async({pages,drop})=>{
   const blob=await PromHwpx.create(pages,{count:5}),zip=await JSZip.loadAsync(await blob.arrayBuffer());
   let s=await zip.file('Contents/section0.xml').async('string'),n=0;
   s=s.replace(/pageBreak="1"/g,m=>drop.includes(n++)?'pageBreak="0"':m);zip.file('Contents/section0.xml',s);
   const file=new File([await zip.generateAsync({type:'uint8array'})],'edited.hwpx');
   const dt=new DataTransfer();dt.items.add(file);const input=document.getElementById('file');input.files=dt.files;input.dispatchEvent(new Event('change'));
  },{pages,drop:[0,1,2,3,5]});
  await page.waitForFunction(()=>!!pending);await page.click('#start');
  await page.waitForFunction(()=>document.getElementById('view').style.display==='block');
  assert.equal(await page.evaluate(()=>LINES),5);
  assert(await page.evaluate(()=>P.every(pg=>pg.length<=5)));
  assert.deepEqual(errors,[]);console.log('PASS HWPX with lost page breaks keeps 5 rows, splits at paragraph boundaries, preserves text');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
