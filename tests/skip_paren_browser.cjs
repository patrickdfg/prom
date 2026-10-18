// 프롬프터에서 ( ) 안의 글 제외 체크가 켜졌을 때만 괄호 글이 빠지는지 브라우저에서 확인한다.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium'});
 const errors=[];
 const run=async(checked)=>{
  const page=await browser.newPage({viewport:{width:1200,height:800}});page.on('pageerror',e=>errors.push(e.message));
  await page.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
  await page.goto('http://localhost:8765/index.html',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{try{localStorage.clear()}catch(_){}});
  if(checked)await page.check('#skipParen');
  const text=await page.evaluate(async()=>{
   const t='주님은 사랑이십니다. (여기서 손을 든다) 우리는 감사합니다.\n\n（전각 괄호 지시）\n\n말씀은 요 3:16 (요 3:16) 에 있습니다.';
   startWith(parseTxt(t));await new Promise(r=>setTimeout(r,300));
   return P.flat(2).map(r=>r.t).join(' ');
  });
  await page.close();return text;
 };
 const off=await run(false),on=await run(true);
 assert.ok(off.includes('여기서 손을 든다')&&off.includes('전각 괄호 지시'),'체크 없으면 그대로: '+off);
 assert.ok(!on.includes('여기서 손을 든다')&&!on.includes('전각 괄호')&&!on.includes('(요 3:16)'),'체크하면 괄호 글이 빠진다: '+on);
 assert.ok(on.includes('주님은 사랑이십니다.')&&on.includes('우리는 감사합니다.')&&on.includes('요 3:16'),'괄호 밖의 글은 남는다: '+on);
 assert.deepEqual(errors,[]);console.log('PASS 프롬프터 괄호 안 글 제외 체크');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
