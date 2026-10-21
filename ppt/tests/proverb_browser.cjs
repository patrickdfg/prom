// 잠언 번호 항목이 한 항목 한 장으로 만들어지고, 길면 ">>"로 이어지는지 브라우저에서 확인한다.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium'});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await page.goto('http://localhost:8765/ppt/index.html',{waitUntil:'domcontentloaded'});
 const r=await page.evaluate(async()=>{
  const row=(text,hex='000000')=>({text,runs:[{text,hex}]});
  const long='2. 신앙생활 하면서 그렇게도 좋은 것이 있다. 죄를 회개하여 깨끗이 함이 그렇게도 좋다. 그는 죄의 짐을 없애 버린 자이다. 죄는 영을 병들게 하고 죽게 한다. 고로 죄를 지으면 하나님은 괴롭게 하여 깨닫게 하신다. 그래도 회개하지 않으면 심판하신다.';
  const rows=[row('1. 짧은 항목은 한 장이다. 그 말씀을 지키자.'),row('이어서 잠언으로 말씀을 나누겠습니다.','ff6600'),row('2. 첫 항목입니다. 짧습니다.'),row(long+long.replace('2. ',' ')+long.replace('2. ',' ')),row('3. 마지막입니다.'),row('교회 광고','0000ff'),row('4. 이건 광고 구간의 번호 목록입니다.')];
  const project={lines:rows.map(x=>x.text),richLines:rows};
  const specs=CaptionBuilder.analyze(project,{bank:await CaptionBuilder.templates?.()}).map(s=>({layout:s.layout,text:s.text}));
  return specs;
 });
 const proverbs=r.filter(s=>s.layout==='proverb');
 assert.ok(proverbs.length>=3,'잠언 장이 만들어져야 한다: '+JSON.stringify(r));
 assert.ok(!r.some(s=>/^4\./.test(s.text)),JSON.stringify(r)+'광고 구간의 번호 목록은 제외');
 
 const long=proverbs.filter(s=>/신앙생활|죄는 영을|괴롭게/.test(s.text));
 assert.ok(long.length>=2,'긴 항목은 두 장 이상: '+JSON.stringify(proverbs));
 assert.ok(long[0].text.endsWith('\n>>'),'앞 장은 >> 로 끝난다');
 assert.ok(!long[long.length-1].text.includes('>>'),'마지막 장에는 >> 가 없다');
 
 assert.deepEqual(errors,[]);console.log('PASS 잠언 한 항목 한 장, 길면 >> 로 이어짐');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
