// 쪽 구성 템플릿(1=꽉 채움, 2=문단별 쪽 >>)을 시작 화면에서 고르고, 저장·열기·HWPX 왕복에서 유지되는지 확인하는 시험
const{chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const sent=n=>Array.from({length:n},(_,i)=>'이것은 '+(i+1)+'번째로 길게 이어지는 문장입니다.').join(' ');
const SAMPLE=['<2026년 10월 7일 수요말씀>','','이기는 자','본 문 :','<요한계시록 6장 2절> 내가 이에 보니 흰 말이 있는데','','할렐루야!','','이번 주 주일에는 말씀했습니다.','',sent(4),'','짧은 문단입니다.','',sent(5)].join('\n');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium',headless:true}),dir=fs.mkdtempSync(path.join(os.tmpdir(),'prom-template-'));
 try{
  const context=await browser.newContext({acceptDownloads:true,viewport:{width:1600,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await context.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/,r=>r.abort());
  await page.addInitScript(()=>window.showSaveFilePicker=undefined);
  await page.goto('http://localhost:8765/index.html',{waitUntil:'domcontentloaded'});
  // 시작 화면: 템플릿 선택과 특징 설명
  assert.deepEqual(await page.locator('#pageTemplate option').allTextContents(),['템플릿1 · 꽉 채움','템플릿2 · 문단별 쪽']);
  assert.equal(await page.inputValue('#pageTemplate'),'1','기본은 템플릿1');
  const note1=await page.locator('#templateNote').textContent();assert(note1.includes('꽉 채움')&&note1.includes('>> 표시가 없고'),'템플릿1 설명');
  await page.selectOption('#pageTemplate','2');
  const note2=await page.locator('#templateNote').textContent();assert(note2.includes('문단별 쪽')&&note2.includes('>> 를 붙입니다'),'템플릿2 설명');assert.notEqual(note1,note2);
  const stat=()=>page.evaluate(()=>({tpl:pageTemplate,pages:P.length,gt:P.flat().filter(l=>/>>/.test(l.map(r=>r.t).join(''))).length,blank:P.flat().filter(l=>!l.map(r=>r.t).join('').trim()).length,rows:P.map(pg=>pg.length),mixed:P.some(pg=>pg.filter(l=>{const t=l.map(r=>r.t).join('').trim();return t&&t!=='>>'}).some((l,i)=>i>0&&l.some(r=>r.paragraphStart)))}));
  const open=async t=>{await page.selectOption('#pageTemplate',t);await page.setInputFiles('#file',{name:'sample.txt',mimeType:'text/plain',buffer:Buffer.from(SAMPLE)});await page.waitForFunction(()=>!!pending);await page.click('#start');await page.waitForFunction(()=>document.getElementById('view').style.display==='block');return stat();};
  const t1=await open('1');
  assert.equal(t1.tpl,1);assert.equal(t1.gt,0,'템플릿1에는 >> 가 없다');assert.equal(t1.blank,0,'템플릿1에는 빈 줄 채움이 없다');assert(t1.rows.slice(0,-1).filter(n=>n!==5).length<=1,'템플릿1은 쪽을 꽉 채운다(할렐루야 앞 쪽만 모자랄 수 있다)');
  assert.equal(t1.mixed,true,'템플릿1은 한 쪽에 여러 문단이 이어진다');
  await page.click('#back').catch(()=>{});
  const t2=await open('2');
  assert.equal(t2.tpl,2);assert(t2.gt>0,'템플릿2에는 >> 가 있다');assert(t2.blank>0,'템플릿2는 짧은 쪽을 빈 줄로 채운다');assert.equal(t2.mixed,false,'템플릿2는 한 쪽에 서로 다른 문단을 섞지 않는다');assert(t2.pages>t1.pages,'템플릿2는 문단별로 쪽을 나눠 쪽이 더 많다');
  // 선택은 이 브라우저에 기억된다
  assert.equal(await page.evaluate(()=>localStorage.getItem('prompterTemplate')),'2');
  // 저장 파일(JSON): 템플릿을 함께 저장하고, 템플릿2 쪽은 열어도 >> 와 빈 줄 채움을 그대로 둔다
  const save=async name=>{await page.click('#save');const[d]=await Promise.all([page.waitForEvent('download'),page.click('#saveProject')]);const f=path.join(dir,name);await d.saveAs(f);return f;};
  const file2=await save('t2.json');assert.equal(JSON.parse(fs.readFileSync(file2,'utf8')).template,2);
  await page.click('#back').catch(()=>{});
  await page.selectOption('#pageTemplate','1');await page.setInputFiles('#file',file2);await page.waitForFunction(()=>!!pending);await page.click('#start');await page.waitForFunction(()=>document.getElementById('view').style.display==='block');
  const again2=await stat();assert.equal(again2.tpl,2,'템플릿2로 저장한 파일은 템플릿2로 열린다(시작 화면 선택과 무관)');assert.equal(again2.gt,t2.gt);assert.equal(again2.blank,t2.blank);assert.equal(JSON.stringify(again2.rows),JSON.stringify(t2.rows));
  await page.click('#back').catch(()=>{});
  await open('1');const file1=await save('t1.json');assert.equal(JSON.parse(fs.readFileSync(file1,'utf8')).template,1);
  await page.click('#back').catch(()=>{});
  await page.setInputFiles('#file',file1);await page.waitForFunction(()=>!!pending);await page.click('#start');await page.waitForFunction(()=>document.getElementById('view').style.display==='block');
  const again1=await stat();assert.equal(again1.tpl,1);assert.equal(again1.gt,0);
  // HWPX 왕복: 템플릿2 표시가 유지된다
  const hw=await page.evaluate(async()=>{const pages=[[[{t:'가',c:'k'}],[],[],[],[]]];const r=[];for(const template of [1,2]){const blob=await PromHwpx.create(pages,{count:5,template});r.push((await parseHwpx(await blob.arrayBuffer())).template)}return r});
  assert.equal(JSON.stringify(hw),'[1,2]');
  assert.deepEqual(errors,[]);console.log('PASS page template select with feature notes, template1 fill/no >>, template2 blocks with >>, JSON save/open and HWPX round-trip keep the template');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
