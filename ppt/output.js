(()=>{'use strict';const id=location.hash.slice(1),host=document.getElementById('output'),notice=document.getElementById('notice'),button=document.getElementById('fullscreen');let last=Date.now(),stale=false,requested=false;CaptionRender.show(host,null);
if(!/^[a-f0-9-]{36}$/.test(id)||!('BroadcastChannel'in window)){notice.textContent='조작창의 송출창 열기 버튼으로 열어 주세요.';return;}
const channel=new BroadcastChannel('prom-ppt-'+id);channel.onmessage=e=>{const d=e.data;if(d?.type==='heartbeat'){last=Date.now();channel.postMessage({type:'alive'});if(stale)channel.postMessage({type:'ready'});return;}if(d?.type!=='frame')return;last=Date.now();stale=false;notice.hidden=true;CaptionRender.show(host,d.slide,d.green);document.title=d.index<0?'녹색 대기 · 설교 자막':`${d.index+1}번 · 설교 자막`;};channel.postMessage({type:'ready'});
setInterval(()=>{if(Date.now()-last>8000&&!stale){stale=true;CaptionRender.show(host,null);notice.hidden=false;notice.textContent='조작창 연결 끊김 · 녹색 화면';}},2000);
async function fullscreen(){if(document.fullscreenElement||requested)return;requested=true;try{await document.documentElement.requestFullscreen();}catch{button.textContent='클릭하여 전체화면';}finally{requested=false;}}
window.captionFullscreen=fullscreen;button.onclick=fullscreen;host.onclick=fullscreen;fullscreen();
})();
