// 방송용 PPT의 원고·인식 사건·시험용 마이크 녹음을 관리자 드라이브로 전송합니다.
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
const audioString=(blob)=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);});
const audioChunk=(blob,mime)=>{if(!state||!blob.size)return;const current=state;current.pending=current.pending.then(async()=>{const base64=await audioString(blob);if(base64.length>2350000){current.failures++;return;}await send({kind:'audio',session:current.id,mime,base64});}).catch(()=>{current.failures++;});};
async function record(current){
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)return;
 try{
  const stream=await navigator.mediaDevices.getUserMedia({audio:true});
  if(state!==current){stream.getTracks().forEach(t=>t.stop());return;}
  current.stream=stream;
  const mime=['audio/webm;codecs=opus','audio/webm','audio/ogg','audio/mp4'].find(x=>MediaRecorder.isTypeSupported(x));
  const recorder=current.recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
  const type=recorder.mimeType.split(';')[0];
  recorder.ondataavailable=e=>audioChunk(e.data,type);
  recorder.onerror=()=>{current.failures++;};
  recorder.start(10000);
 }catch{current.failures++;}
}
window.PromDiagnostic={
 start(manuscript){
  if(!enabled()||state)return;
  const current=state={id:randomId(),events:[],pending:Promise.resolve(),stream:null,recorder:null,timer:null,failures:0};
  enqueue({kind:'manifest',app:'ppt',startedAt:new Date().toISOString(),userAgent:navigator.userAgent,manuscript});
  current.timer=setInterval(flush,15000);
  record(current);
 },
 event(event){if(!state)return;state.events.push({...event});if(state.events.length>=250)flush();},
 stop(){
  if(!state)return;
  const current=state;
  clearInterval(current.timer);
  current.events.push({k:'diagnostic-stop',t:Date.now()});
  flush();
  if(current.recorder&&current.recorder.state!=='inactive')current.recorder.stop();
  current.stream?.getTracks().forEach(t=>t.stop());
  // 종료 이벤트 이후 도착하는 마지막 오디오 조각을 받기 위해 잠시 유지한다.
  setTimeout(()=>{if(state===current)state=null;},3000);
 },
 active(){return !!state;}
};
})();