// 마이크를 끄면 원고(처음 한 번)와 인식 기록이 드라이브 폴더에 올라가는지, 가짜 구글 서버로 브라우저에서 확인한다.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium'});
 const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[],ups=[],meta=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://accounts.google.com/gsi/client',r=>r.fulfill({contentType:'text/javascript',body:`window.google={accounts:{oauth2:{hasGrantedAllScopes:()=>true,initTokenClient:o=>({requestAccessToken:()=>setTimeout(()=>o.callback({access_token:'T',expires_in:3600}),10)})}}};`}));
 await page.route(/^https:\/\/www\.googleapis\.com\//,async r=>{
  const u=r.request().url(),m=r.request().method(),h={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Expose-Headers':'Location','Access-Control-Allow-Methods':'*'};
  if(m==='OPTIONS')return r.fulfill({status:204,headers:h});
  assert.equal(r.request().headers().authorization,'Bearer T');
  if(u.includes('/about'))return r.fulfill({headers:h,json:{user:{emailAddress:'me@test'}}});
  if(u.includes('uploadType=resumable')){meta.push(JSON.parse(r.request().postData()));return r.fulfill({headers:{...h,Location:'https://www.googleapis.com/upload/put/'+meta.length},json:{}});}
  if(u.includes('/upload/put/')){ups.push(r.request().postDataBuffer().length);return r.fulfill({headers:h,json:{id:'x'}});}
  if(m==='POST'&&u.includes('/drive/v3/files'))return r.fulfill({headers:h,json:{id:'F1'}});
  if(u.includes('/drive/v3/files?'))return r.fulfill({headers:h,json:{files:[]}});
  return r.fulfill({status:404,headers:h});
 });
 await page.route(/^https?:\/\/(?!localhost|accounts\.google\.com|www\.googleapis\.com)/,r=>r.abort());
 await page.goto('http://localhost:8765/index.html',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>{try{localStorage.removeItem('prompterVoiceLog');localStorage.removeItem('promDriveFolder')}catch(_){}});
 await page.setInputFiles('#file',{name:'주일설교.txt',mimeType:'text/plain',buffer:Buffer.from('오늘 말씀은 사랑입니다.\n\n다음 문단입니다.')});
 await page.waitForFunction(()=>!document.getElementById('start').disabled);
 await page.check('#driveAuto');await page.waitForTimeout(200);
 await page.click('#driveLogin');await page.waitForFunction(()=>/me@test/.test(document.getElementById('driveState').textContent));
 await page.click('#start');await page.waitForTimeout(300);
 await page.evaluate(()=>{listening=true;heardLogged('오늘 말씀은 사랑입니다');stopMic();});
 await page.waitForFunction(()=>/2개 파일/.test(document.getElementById('driveState').textContent),null,{timeout:5000});
 assert.equal(meta.length,2);assert.match(meta[0].name,/^\d{4}-\d\d-\d\d \d{4} 주일설교\.txt$/);assert.match(meta[1].name,/주일설교 인식기록\.json$/);
 assert.deepEqual(meta.map(x=>x.parents[0]),['F1','F1']);assert.ok(ups[0]>0&&ups[1]>0);
 // 두 번째로 마이크를 끄면 원고는 다시 올리지 않고 기록만 올린다
 await page.evaluate(()=>{listening=true;heardLogged('다음 문단입니다');stopMic();});
 await page.waitForFunction(()=>/1개 파일/.test(document.getElementById('driveState').textContent),null,{timeout:5000});
 assert.equal(meta.length,3);assert.match(meta[2].name,/인식기록\.json$/);
 // 자동 저장을 끄면 올리지 않는다
 await page.evaluate(()=>{localStorage.setItem('promDriveAuto','0');listening=true;stopMic();});await page.waitForTimeout(500);
 assert.equal(meta.length,3);
 assert.deepEqual(errors,[]);console.log('PASS 드라이브 자동 저장');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
