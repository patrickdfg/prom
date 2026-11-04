// 쪽 이어짐 표시(>>)와 빈 줄 채움이 새 원고에 없고, 예전 원고는 열 때 정리되는지 확인하는 시험
const{chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/,r=>r.abort());
  await page.goto('http://localhost:8765/index.html',{waitUntil:'domcontentloaded'});
  const sentences=Array.from({length:14},(_,i)=>'이것은 '+(i+1)+'번째로 길게 이어지는 문장입니다.').join(' ');
  const text=sentences+'\n\n짧은 문단입니다.\n\n'+sentences.slice(0,120)+'.';
  for(const count of [5,6,7]){
   const pages=await page.evaluate(({text,count})=>{setMode(false);LINES=count;const src=parseTxt(text);return buildPrompter(src.ms?src.ms:pagesToMs(src),count)},{text,count});
   assert(pages.length>=3,'쪽이 여러 장 생긴다');
   for(const [i,pg] of pages.entries()){
    const rows=pg.map(l=>l.map(r=>r.t).join(''));
    assert(rows.length<=count,count+'줄 이하');
    assert(rows.every(t=>t.trim()),'빈 줄 채움이 없다 '+count+'줄 '+(i+1)+'쪽');
    assert(rows.every(t=>!/>>/.test(t)),'>> 표시가 없다 '+count+'줄 '+(i+1)+'쪽');
   }
   assert(pages.slice(0,-1).every(pg=>pg.length===count),'마지막 쪽을 뺀 모든 쪽이 꽉 찬다 '+count);
   const rows=pages.flat();      // 문단이 쪽 가운데서 시작할 수 있으므로 쪽 첫 줄이 아니라 모든 줄에서 새 문단 표시를 찾는다
   assert.equal(rows[0].some(r=>r.paragraphStart),false);assert(rows.slice(1).filter(l=>l.some(r=>r.paragraphStart)).length>=2,'새 문단의 첫 줄은 paragraphStart 로 안다');
  }
  // 예전 저장 파일(>> 와 앞뒤 빈 줄 채움, paragraphStart 없음)은 열 때 정리하고 문단 경계를 paragraphStart 로 남긴다
  const run=t=>[{t,c:'k'}];
  const legacy={app:'sermon-prompter',v:1,lines:5,meta:{},pages:[
   [[],run('첫째 줄'),run('둘째 줄'),run('셋째 줄'),run('>>')],      // 이어지는 쪽(맨 아랫줄이 >>)
   [[],run('이어진 줄'),[],run('간격 뒤 줄'),[]],      // 글 사이의 빈 줄 = 스크롤 보기의 문단 간격
   [run('마지막 줄'),run('>>'),run('>> 앞 줄'),[],[]],      // 글 사이의 >> 줄도 간격이었다
   [[],run('새 문단'),[],[],[]],
  ]};
  await page.evaluate(()=>openPrompter([[ [{t:'다른 원고',c:'k'}],[],[],[],[] ]]));
  await page.setInputFiles('#file',{name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});
  await page.waitForFunction(()=>!!pending);await page.click('#start');
  await page.waitForFunction(()=>P.length===2&&P[0][0][0]?.t==='첫째 줄');
  const loaded=await page.evaluate(()=>P.map(pg=>pg.map(l=>({t:l.map(r=>r.t).join(''),ps:l.some(r=>r.paragraphStart)}))));
  assert.deepEqual(loaded.map(pg=>pg.map(l=>l.t)),[['첫째 줄','둘째 줄','셋째 줄','이어진 줄','간격 뒤 줄'],['마지막 줄','>> 앞 줄','새 문단']],'>> 와 빈 줄을 빼고 쪽을 5줄씩 다시 채운다');
  assert.deepEqual(loaded.flat().filter(l=>l.ps).map(l=>l.t),['간격 뒤 줄','>> 앞 줄'],'쪽 안의 빈 줄과 >> 줄은 문단 간격(paragraphStart)으로 남고, 쪽 가장자리 채움은 간격이 아니다');
  assert.deepEqual(errors,[]);console.log('PASS no >> and no blank filler in 5/6/7-row pagination, legacy saved file cleaned and refilled on open with block boundaries kept');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
