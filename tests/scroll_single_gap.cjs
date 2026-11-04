// 원고에 빈 줄이 여러 개 이어져도 스크롤 보기의 문단 간격은 한 줄을 넘지 않는지 확인하는 시험
const{chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1400,height:800}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/,r=>r.abort());
  await page.goto('http://localhost:8765/index.html',{waitUntil:'domcontentloaded'});
  const seq=await page.evaluate(()=>{
   setMode(false);LINES=5;
   const p=t=>({runs:[{t,hex:'000000'}],pb:false});
   // 빈 문단 3개, 줄바꿈 4번, 앞뒤 줄바꿈이 한꺼번에 이어지는 원고
   const paras=[p('첫째 문단입니다.'),p(''),p(''),p(''),p('둘째 문단입니다.\n\n\n\n셋째 문단입니다.\n'),p('\n'),p('\n\n넷째 문단입니다.'),p('다섯째 줄입니다.')];
   const pages=buildPrompter(paras,5);
   const host=document.createElement('div');host.style.cssText='width:1200px;height:700px;position:fixed;left:-5000px';document.body.appendChild(host);
   new PromScrollView(host).update({lines:5,document:pages,cursor:0,page:0,dark:false});
   return [...host.querySelectorAll('.scroll-flow>div')].map(e=>e.classList.contains('scroll-paragraph-gap')?'<간격>':e.textContent);
  });
  assert.equal(seq.join('|'),'첫째 문단입니다.|<간격>|둘째 문단입니다.|<간격>|셋째 문단입니다.|<간격>|넷째 문단입니다.|다섯째 줄입니다.','빈 줄이 여러 개여도 간격은 한 줄');
  assert(!seq.some((x,i)=>x==='<간격>'&&seq[i+1]==='<간격>'),'간격이 겹치지 않는다');
  assert.deepEqual(errors,[]);console.log('PASS scroll view keeps at most one blank line between paragraphs');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
