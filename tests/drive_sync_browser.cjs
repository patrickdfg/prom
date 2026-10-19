// 구글 로그인 뒤 저장하면 드라이브에도 올라가고, 다른 컴퓨터(새 창)에서 로그인하면 목록에서 열 수 있는지 가짜 구글 서버로 확인한다.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium'});
 const store=new Map();let seq=0;const calls=[];
 async function setup(ctx){
  const page=await ctx.newPage({viewport:{width:1366,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.showSaveFilePicker=undefined;});
  await page.route('https://accounts.google.com/gsi/client',r=>r.fulfill({contentType:'text/javascript',body:`window.google={accounts:{oauth2:{hasGrantedAllScopes:()=>true,initTokenClient:o=>({requestAccessToken:()=>setTimeout(()=>o.callback({access_token:'T',expires_in:3600}),10)})}}};`}));
  await page.route(/^https:\/\/www\.googleapis\.com\//,async r=>{
   const req=r.request(),u=new URL(req.url()),m=req.method(),h={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Expose-Headers':'Location','Access-Control-Allow-Methods':'*'};
   if(m==='OPTIONS')return r.fulfill({status:204,headers:h});
   calls.push(m+' '+u.pathname);
   if(u.pathname.endsWith('/about'))return r.fulfill({headers:h,json:{user:{emailAddress:'me@test'}}});
   if(u.pathname.startsWith('/upload/put/')){const id=u.pathname.split('/').pop();store.get(id).body=req.postData();store.get(id).modifiedTime=new Date().toISOString();return r.fulfill({headers:h,json:{id}});}
   if(u.pathname.startsWith('/upload/drive/v3/files')){let id=u.pathname.split('/files/')[1];if(!id){const meta=JSON.parse(req.postData());id='f'+(++seq);store.set(id,{id,...meta,body:''});}return r.fulfill({headers:{...h,Location:'https://www.googleapis.com/upload/put/'+id},json:{}});}
   const id=u.pathname.split('/files/')[1];
   if(id&&u.searchParams.get('alt')==='media')return r.fulfill({headers:h,body:store.get(id).body});
   if(id)return r.fulfill({headers:h,json:{id,trashed:false}});
   if(m==='POST')return r.fulfill({headers:h,json:{id:'folder1'}});
   const q=u.searchParams.get('q')||'';const nm=q.match(/name = '([^']*)'/)?.[1];
   const files=[...store.values()].filter(f=>q.includes('prompter-file')&&(!nm||f.name===nm)).map(f=>({id:f.id,name:f.name,modifiedTime:f.modifiedTime||new Date().toISOString()}));
   return r.fulfill({headers:h,json:{files}});
  });
  await page.route(/^https?:\/\/(?!localhost|accounts\.google\.com|www\.googleapis\.com)/,r=>r.abort());
  await page.goto('http://localhost:8765/index.html',{waitUntil:'domcontentloaded'});
  return {page,errors};
 }
 // 1번 컴퓨터: 로그인 → 원고 열기 → 저장 두 번(두 번째는 덮어쓰기)
 const a=await setup(await browser.newContext({acceptDownloads:true}));
 await a.page.click('#driveLogin');await a.page.waitForFunction(()=>/me@test/.test(document.getElementById('driveState').textContent));
 await a.page.setInputFiles('#file',{name:'주일설교.txt',mimeType:'text/plain',buffer:Buffer.from('오늘 말씀은 사랑입니다.\n\n다음 문단입니다.')});
 await a.page.waitForFunction(()=>!document.getElementById('start').disabled);await a.page.click('#start');
 await a.page.evaluate(()=>savePages());
 await a.page.waitForFunction(()=>/드라이브에도 저장/.test(document.getElementById('driveState').textContent),null,{timeout:5000});
 assert.equal(store.size,1);const f=[...store.values()][0];assert.equal(f.name,'주일설교_프롬프터.json');assert.equal(f.parents[0],'folder1');assert.match(f.body,/"app":"sermon-prompter"/);
 await a.page.evaluate(()=>{P[0][0][0].t='고친 첫 줄';savePages();});
 await a.page.waitForTimeout(800);assert.equal(store.size,1,'같은 이름은 덮어쓰기');assert.match(f.body,/고친 첫 줄/);
 assert.ok(calls.some(c=>c.startsWith('PATCH /upload/drive/v3/files/')));
 // 2번 컴퓨터: 새 창에서 로그인하면 목록이 뜨고, 누르면 연다
 const b=await setup(await browser.newContext());
 await b.page.click('#driveLogin');await b.page.waitForSelector('#driveFiles .drive-file');
 assert.match(await b.page.textContent('#driveFiles'),/주일설교/);
 await b.page.screenshot({path:process.env.SHOT||'/tmp/drive_sync.png'});
 await b.page.click('#driveFiles .drive-file');
 await b.page.waitForFunction(()=>document.getElementById('view').style.display==='block'&&P.length>0);
 assert.equal(await b.page.evaluate(()=>P[0][0].map(r=>r.t).join('')),'고친 첫 줄');
 assert.deepEqual([...a.errors,...b.errors],[]);
 console.log('PASS 드라이브 저장·다른 컴퓨터에서 열기');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
