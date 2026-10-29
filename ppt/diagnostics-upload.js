// 방송용 PPT: 원고·음성인식 문자·위치/오류 이벤트만 관리자 드라이브로 전송합니다. 원음 녹음·오디오 전송은 하지 않습니다.
(()=>{
'use strict';
const URL='https://script.google.com/macros/s/AKfycbxQJ-k-vTozybdcuY9J2uY0jXolSsKhzHUqYmDFOKqpB4vXGCSkTE1BHbKrj8h2vVgZoQ/exec';
const UNTIL=Date.parse('2026-11-28T15:00:00Z');
const enabled=()=>Date.now()<UNTIL;
let state=null;
const randomId=()=>{const bytes=new Uint8Array(12);crypto.getRandomValues(bytes);return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');};
const send=(body)=>fetch(URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain'},body:JSON.stringify(body),keepalive:false}).catch(()=>{if(state)state.failures++;});
const enqueue=(body)=>{if(!state)return;const current=state;current.pending=current.pending.then(()=>send({...body,session:current.id}));};
const flush=()=>{if(!state||!state.events.length)return;const batch=state.events.splice(0,250);enqueue({kind:'events',events:batch});};
window.PromDiagnostic={
 start(manuscript){
  if(!enabled()||state)return;
  const current=state={id:randomId(),events:[],pending:Promise.resolve(),timer:null,failures:0};
  enqueue({kind:'manifest',app:'ppt',startedAt:new Date().toISOString(),userAgent:navigator.userAgent,manuscript});
  current.timer=setInterval(flush,15000);
 },
 event(event){if(!state)return;state.events.push({...event});if(state.events.length>=250)flush();},
 stop(){
  if(!state)return;
  const current=state;
  clearInterval(current.timer);
  current.events.push({k:'diagnostic-stop',t:Date.now()});
  flush();
  // 오디오 녹음이 없으므로 이벤트를 큐에 넣은 직후 새 세션을 받을 수 있다.
  if(state===current)state=null;
 },
 active(){return !!state;}
};
})();