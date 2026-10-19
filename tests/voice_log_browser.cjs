// 음성 인식 기록이 쌓이고, 저장 파일에 원고·판정·위치가 들어가는지 브라우저에서 확인한다.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium'});
 const page=await browser.newPage({acceptDownloads:true,viewport:{width:1366,height:768}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
 await page.goto('http://localhost:8765/index.html',{waitUntil:'domcontentloaded'});
 await page.evaluate(async()=>{try{localStorage.removeItem('prompterVoiceLog')}catch(_){}
  startWith(parseTxt('오늘 상원은 총기 규제 강화 법안을 표결에 부쳤습니다. 해당 법안은 하원에 이어 최종 통과했습니다.\n\n다음 문단은 새로운 내용입니다.'));
  await new Promise(r=>setTimeout(r,300));listening=true;
  for(const t of ['오늘 상원은 총기 규제','오늘 상원은 총기 규제 강화 법안을 표결에','엉뚱한 말입니다 아무거나'])heardLogged(t);});
 const [dl]=await Promise.all([page.waitForEvent('download'),page.evaluate(()=>document.getElementById('saveVoiceLog').click())]);
 const file=await dl.path(),doc=JSON.parse(fs.readFileSync(file,'utf8'));
 assert.match(dl.suggestedFilename(),/^prompter_voice_log_\d{8}_\d{4}\.json$/);
 const heard=doc.events.filter(e=>e.k==='heard');
 assert.equal(heard.length,3);assert.ok(heard[0].msg&&heard[0].to>=heard[0].from&&heard[0].heard.includes('상원'));
 assert.ok(doc.manuscript.norm.includes('상원'))&&assert.ok(doc.manuscript.pages[0].lines[0].range);
 assert.ok(heard[2].msg.includes('안 맞음')||heard[2].to===heard[1].to,'맞지 않는 말은 위치가 그대로이거나 안 맞음으로 기록');
 assert.equal(doc.settings.lead,'3');
 assert.deepEqual(errors,[]);console.log('PASS 음성 인식 기록 저장');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
