// 음성 추적이 멈췄을 때 낭독 속도로 가까운 구간만 찾고 연속된 긴 문장이 확인된 경우에만 복구한다.
(function(root){
'use strict';
function create(clock=()=>Date.now()){
 let lastPos=0,lastAt=clock(),rate=0,pacePos=0,paceAt=lastAt,pending=null;
 function reset(pos){
  lastPos=pacePos=pos;lastAt=paceAt=clock();rate=0;pending=null;
 }
 function progress(pos){
  if(pos<=lastPos)return;
  const now=clock(),duration=now-paceAt;
  if(duration>=3000&&duration<=30000){
   const measured=(pos-pacePos)*1000/duration;
   if(measured>=1&&measured<=12)rate=rate?rate*.7+measured*.3:measured;
   pacePos=pos;paceAt=now;
  }
  lastPos=pos;lastAt=now;pending=null;
 }
 function recover(heard,manuscript,cursor){
  const now=clock(),elapsed=now-lastAt;
  if(cursor!==lastPos||rate<=0||elapsed<10000||heard.length<32)return null;
  const predicted=Math.min(180,rate*Math.min(30,elapsed/1000));
  const low=Math.max(cursor+1,cursor+Math.floor(predicted)-55);
  const high=Math.min(manuscript.length,cursor+180,cursor+Math.ceil(predicted)+55);
  if(high-low<32)return null;
  let hit=null;
  for(let length=Math.min(60,heard.length,high-low);length>=32;length--){
   const tail=heard.slice(-length),at=manuscript.indexOf(tail);
   if(at<low||at+length>high||manuscript.indexOf(tail,at+1)>=0)continue;
   hit=at+length;break;
  }
  if(hit===null){pending=null;return null;}
  if(pending&&now-pending.t<=12000&&hit>=pending.pos+12&&hit<=pending.pos+100){
   pending=null;return hit;
  }
  pending={pos:hit,t:now};
  return null;
 }
 return {reset,progress,recover};
}
const api={create};if(typeof module==='object'&&module.exports)module.exports=api;else root.PromSafeFollow=api;
})(typeof window==='object'?window:globalThis);
