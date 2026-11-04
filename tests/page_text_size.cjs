// 글꼴 옆의 쪽 보기 글자 크기 버튼이 보이고, 크기가 바뀌고 저장되며, 긴 줄이 화면 폭을 넘지 않는지 확인하는 시험
const{chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/,r=>r.abort());
  await page.goto('http://localhost:8765/index.html',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{const line=t=>[{t,c:'k'}];setMode(false);LINES=5;openPrompter([[line('짧은 줄'),line('가장 길게 쓴 줄은 열일곱 글자쯤 됩니다'),line('셋째 줄'),line('넷째 줄'),line('다섯째 줄')]]);});
  const order=await page.evaluate(()=>{const g=document.querySelector('.style-group'),ids=[...g.querySelectorAll('select,button,input')].map(e=>e.id);return ids});
  assert(order.indexOf('pageTextSmaller')>order.indexOf('fontFamily')&&order.indexOf('pageTextLarger')<order.indexOf('fontBold'),'글자 크기 버튼은 글꼴 바로 옆에 있다');
  const size=()=>page.evaluate(()=>({label:document.getElementById('pageTextReset').textContent,fs:parseFloat(getComputedStyle(document.getElementById('page')).fontSize),stored:localStorage.getItem('promPageTextScale')}));
  const base=await size();assert.equal(base.label,'100%');
  await page.click('#pageTextSmaller');const small=await size();assert.equal(small.label,'90%');assert(Math.abs(small.fs/base.fs-0.9)<.01,'90% 크기');assert.equal(small.stored,'90');
  await page.click('#pageTextReset');assert.equal((await size()).label,'100%');
  for(let i=0;i<8;i++)await page.click('#pageTextLarger',{force:true});
  const big=await size();assert.equal(big.label,'140%');assert(await page.locator('#pageTextLarger').isDisabled(),'140%에서 더 키울 수 없다');
  const overflow=await page.evaluate(()=>[...document.querySelectorAll('#lines .ln')].map(r=>{const k=r.children;return k.length?k[k.length-1].getBoundingClientRect().right-k[0].getBoundingClientRect().left-r.clientWidth:0}));
  assert(overflow.every(x=>x<=1),'크게 해도 긴 줄이 폭을 넘지 않는다 '+overflow.join(','));
  for(let i=0;i<10;i++)await page.click('#pageTextSmaller',{force:true});
  assert.equal((await size()).label,'60%');assert(await page.locator('#pageTextSmaller').isDisabled(),'60%에서 더 줄일 수 없다');
  await page.reload({waitUntil:'domcontentloaded'});
  assert.equal(await page.evaluate(()=>document.getElementById('pageTextReset').textContent),'60%','새로 열어도 크기를 기억한다');
  assert.deepEqual(errors,[]);console.log('PASS page text size buttons next to font, 60-140% range, persisted, long lines stay inside width');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
