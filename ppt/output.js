(()=>{'use strict';const id=location.hash.slice(1),host=document.getElementById('output'),notice=document.getElementById('notice'),button=document.getElementById('fullscreen');let last=Date.now(),stale=false,requested=false,fallback=null;const transition=new CaptionTransition(host);transition.show(null,-1,'#00ff00',true);
if(!/^[a-f0-9-]{36}$/.test(id)||!('BroadcastChannel'in window)){notice.textContent='조작창의 송출창 열기 버튼으로 열어 주세요.';return;}
const channel=new BroadcastChannel('prom-ppt-'+id);channel.onmessage=e=>{const d=e.data;if(d?.type==='heartbeat'){last=Date.now();channel.postMessage({type:'alive'});if(stale)channel.postMessage({type:'ready'});return;}if(d?.type!=='frame')return;last=Date.now();stale=false;fallback=d.fallback||null;notice.hidden=true;transition.show(d.slide,d.index,d.green,!d.slide&&d.immediate);document.title=(d.label||(d.index<0?'녹색 대기':`${d.index+1}번 자막`))+' · 방송용 PPT';};channel.postMessage({type:'ready'});
// Keyboard input in the fullscreen output controls the same live slide as the control window.
addEventListener('keydown',event=>{const action=CaptionPresentationKeys.action(event);if(!action)return;event.preventDefault();if(!event.repeat)channel.postMessage({type:'navigate',action});});
setInterval(()=>{if(Date.now()-last>8000&&!stale){stale=true;transition.show(fallback,fallback?-2:-1,'#00ff00',true);notice.hidden=false;notice.textContent='조작창 연결 끊김 · '+(fallback?'기본예배화면':'녹색 화면');}},2000);
function syncFullscreen(){const active=!!document.fullscreenElement;button.hidden=active;button.classList.add('fullscreen-start');button.title='송출창만 전체화면으로 전환합니다';button.textContent='전체화면 ⛶';channel.postMessage({type:'fullscreen-state',active});}
async function fullscreen(target){if(!target||!Number.isFinite(target.left)){try{target=window.opener?.CaptionOutputScreens?.target()||null;}catch{target=null;}}if(document.fullscreenElement||requested)return;requested=true;try{await PromOutputFullscreen.enter(target);syncFullscreen();}finally{requested=false;}}
document.addEventListener('fullscreenchange',syncFullscreen);syncFullscreen();
window.captionFullscreen=fullscreen;button.onclick=fullscreen;host.onclick=fullscreen;fullscreen();
})();

