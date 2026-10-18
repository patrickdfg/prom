// 줄 높이를 맞추는 빈 줄이 네모(특수 공백)로 보이지 않는지 브라우저에서 확인한다.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium'});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await page.goto('http://localhost:8765/ppt/index.html',{waitUntil:'domcontentloaded'});
 const r=await page.evaluate(async()=>{
  const s=await CaptionBuilder.scene('caption','한 줄 자막입니다.',{padToLines:2});
  const created=JSON.stringify(s.shapes[s.bodyIndex].paragraphs.map(p=>p.runs.map(x=>x.text)));
  // 이미 저장된 슬라이드에 남아 있는 특수 공백도 화면에서는 일반 공백으로 그려진다
  const old=structuredClone(s);old.shapes[old.bodyIndex].paragraphs[1].runs[0].text=' ';
  const host=document.createElement('div');host.style.cssText='width:960px;height:540px;position:relative';document.body.append(host);CaptionRender.show(host,old);
  const spans=[...host.querySelectorAll('span')].map(x=>x.textContent);
  return {created,spans};
 });
 assert.ok(!r.created.includes(' '),'새로 만든 슬라이드에 특수 공백이 없어야 한다: '+r.created);
 assert.ok(r.created.includes('" "'),'빈 줄은 일반 공백 한 칸이어야 한다');
 assert.ok(!r.spans.some(t=>t.includes(' ')),'기존 슬라이드도 화면에서 특수 공백이 없어야 한다');
 assert.deepEqual(errors,[]);console.log('PASS 빈 줄 채움이 네모로 보이지 않음');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
