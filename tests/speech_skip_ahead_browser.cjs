// 읽지 않는 태그·설명 줄을 건너뛰고 이어 읽을 때 위치를 빠르게 다시 찾는지 브라우저에서 확인한다.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await b.newPage({viewport:{width:1366,height:768}});
await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());await p.goto('http://localhost:8765/index.html',{waitUntil:'domcontentloaded'});
const skipLen=+process.argv[2]||2;
const res=await p.evaluate(async(skipLen)=>{
 const spoken1=['오늘 상원은 총기 규제 강화 법안을 표결에 부쳤습니다.','해당 법안은 하원에 이어 최종 통과했습니다.','이는 매우 역사적인 순간입니다.'];
 const skip=['#sean2','이 장면에서는 국회 의사당 전경 화면이 나오고 자막이 올라갑니다. 현장 영상 소스는 별도 폴더에 있습니다.','편집 담당자는 이 부분에서 배경음악을 줄여 주세요.'].slice(0,skipLen+1);
 const spoken2=['미국 역사 이래 총기 문제의 가장 획기적인 조치로 여겨집니다.','미국 정가는 물론 언론과 전문가들조차 이번 결과에 놀라고 있습니다.','지금까지 현장에서 취재한 내용을 종합하면 초당적 합의로 마련되었습니다.','대통령은 내일 법안에 서명할 예정이라고 밝혔습니다.'];
 const text=[...spoken1,...skip,...spoken2].join('\n');
 startWith(parseTxt(text));await new Promise(r=>setTimeout(r,300));listening=true;
 const rows=[];P.forEach((pg,pi)=>pg.forEach((ln,li)=>{const r=lineRange[pi][li];if(r[1]>r[0])rows.push({r,t:ln.map(x=>x.t).join('')})}));
 const rowOf=c=>rows.findIndex(x=>c>=x.r[0]&&c<x.r[1]);
 const spokenWords=[...spoken1,...spoken2].join(' ').split(/\s+/);
 const log=[];let said='';
 for(let i=0;i<spokenWords.length;i++){
  said+=(said?' ':'')+spokenWords[i];
  if(i%2==1||i==spokenWords.length-1){onHeard(said);await new Promise(r=>setTimeout(r,3));log.push([i,spokenWords[i],rowOf(cursor),(document.getElementById('voiceFeedback').textContent||'').slice(-30)]);}
 }
 return {rows:rows.map(x=>x.t),log};
},skipLen);
const first=res.log.find(x=>x[2]>=11);
assert.ok(first,'건너뛴 뒤 줄을 찾아야 한다');assert.ok(first[0]<=27,'이어 읽은 지 몇 낱말 안에 따라와야 한다: '+first.join(' | '));
console.log('PASS 설명 줄을 건너뛰고 이어 읽으면 따라간다 (낱말 '+first[0]+'번째)');
await b.close();})();
