/* Shared display picker for PROM and PPT. Query screen access only after a user action. */
window.PromDisplayScreens=(()=>{
'use strict';
const key=s=>JSON.stringify([s.label||'',s.left,s.top,s.width,s.height]);
function bounds(s){return {left:Math.round(s.availLeft??s.left??0),top:Math.round(s.availTop??s.top??0),width:Math.max(320,Math.round(s.availWidth??s.width??960)),height:Math.max(200,Math.round(s.availHeight??s.height??540))};}
function features(s){const b=s?bounds(s):null;return 'popup=yes'+(b?',fullscreen=yes,'+Object.entries(b).map(([k,v])=>k+'='+v).join(','):',width=1280,height=720');}
// 방송용 PPT는 별도 선택 창 없이 조작창 밖의 모니터를 고른다.
function autoTarget(details){const current=details?.currentScreen;return details?.screens?.find(s=>key(s)!==key(current||{}))||current||details?.screens?.[0]||null;}
function createAutomatic({onMessage}){
 let details=null,chosen=null,notice='';const placed=new WeakMap();
 function target(){return chosen;}
 async function prepare(){
  notice='';
  try{if(typeof window.getScreenDetails==='function'&&window.screen?.isExtended!==false){details=await window.getScreenDetails();chosen=autoTarget(details);}else{details=null;chosen=null;}}
  catch{details=null;chosen=null;notice='모니터 접근 권한을 허용하면 다른 모니터에 자동으로 배치됩니다. 지금은 현재 모니터에 엽니다.';}
  return target();
 }
 async function place(popup,method){if(!popup||popup.closed)return;const screen=target()||window.screen,stamp=key(screen||{});
  try{if(placed.get(popup)!==stamp){if(popup.document.fullscreenElement)await popup.document.exitFullscreen();const b=bounds(screen||{});popup.moveTo(b.left,b.top);popup.resizeTo(b.width,b.height);placed.set(popup,stamp);}if(typeof popup[method]==='function')await popup[method](chosen);}
  catch{onMessage('송출창의 전체화면 버튼을 한 번 눌러 주세요.');}
 }
 return {prepare,target,place,single:()=>details?details.screens.length<=1:window.screen?.isExtended===false,features:()=>features(target()||window.screen),message:()=>notice,ready:()=>true};
}
function create({onLaunch,onMessage=()=>{},automatic=false}){
 if(automatic)return createAutomatic({onMessage});
 let details=null,selected='',manual=false,busy=false,watched=null;try{selected=localStorage.getItem('promOutputScreen')||'';}catch{}
 const button=document.createElement('button');button.type='button';button.className='display-screen-button';button.textContent='송출 모니터 선택';
 const dialog=document.createElement('dialog');dialog.className='display-screen-dialog';dialog.innerHTML='<div class="display-screen-heading"><h2>송출 모니터 선택</h2><button type="button" data-close>닫기</button></div><p>조작창은 현재 화면에 두고, 송출창만 선택한 모니터에서 엽니다.</p><p data-status role="status">모니터 목록을 확인하세요.</p><label>송출할 모니터<select data-screens aria-label="송출할 모니터"></select></label><div class="display-screen-actions"><button type="button" data-refresh>모니터 다시 찾기</button><button type="button" data-launch disabled>선택한 모니터에 송출</button></div><p>처음에는 브라우저의 모니터 접근 권한을 허용해 주세요. 전체화면이 제한되면 송출 화면에서 한 번 클릭하세요.</p><button type="button" data-manual>모니터를 직접 옮겨서 사용</button>';
 document.body.appendChild(dialog);const find=s=>dialog.querySelector(s),select=find('[data-screens]'),info=find('[data-status]'),launch=find('[data-launch]');
 function target(){return manual?null:details?.screens.find(s=>key(s)===selected)||null;}
 function fill(){const old=select.value||selected;select.replaceChildren();for(const [i,s] of details.screens.entries()){const o=document.createElement('option');o.value=key(s);o.textContent='모니터 '+(i+1)+' · '+(s.label||'화면')+' · '+s.width+'×'+s.height+(s===details.currentScreen?' (조작창 화면)':'');select.appendChild(o);}const choice=details.screens.find(s=>key(s)===old)||details.screens.find(s=>s!==details.currentScreen)||details.screens[0];select.value=choice?key(choice):'';launch.disabled=!choice;info.textContent=details.screens.length>1?'다른 모니터를 기본으로 선택했습니다. 원하는 화면을 확인한 뒤 송출하세요.':'모니터가 한 개입니다. 확장 모니터를 연결한 뒤 다시 찾기를 누르세요.';}
 async function refresh(){if(busy)return;busy=true;launch.disabled=true;try{if(typeof window.getScreenDetails!=='function'){info.textContent='이 브라우저는 모니터 자동 선택을 지원하지 않습니다. Chrome 또는 Edge에서 열거나 직접 이동을 사용하세요.';return;}details=await window.getScreenDetails();fill();if(details!==watched){details.addEventListener('screenschange',()=>{fill();onMessage('모니터 연결이 바뀌었습니다. 송출 모니터를 확인하세요.');});details.addEventListener('currentscreenchange',fill);watched=details;}}catch(e){details=null;info.textContent='모니터 목록을 읽지 못했습니다. 사이트의 창 관리 권한을 허용하거나 직접 이동을 사용하세요.';}finally{busy=false;}}
 function show(){if(!dialog.open)dialog.showModal();if(details)fill();else refresh();}
 button.onclick=show;find('[data-close]').onclick=()=>dialog.close();find('[data-refresh]').onclick=refresh;
 launch.onclick=()=>{if(!details?.screens.some(s=>key(s)===select.value)){info.textContent='모니터가 연결되어 있는지 확인하세요.';return;}manual=false;selected=select.value;try{localStorage.setItem('promOutputScreen',selected);}catch{}dialog.close();onLaunch();};
 find('[data-manual]').onclick=()=>{manual=true;dialog.close();onLaunch();};
 async function place(popup,method){const screen=target();try{if(popup.document.fullscreenElement)await popup.document.exitFullscreen();if(screen){const b=bounds(screen);popup.moveTo(b.left,b.top);popup.resizeTo(b.width,b.height);}if(typeof popup[method]==='function')await popup[method](screen);}catch{onMessage('송출창에서 전체화면 버튼을 한 번 눌러 주세요.');}}
 return {button,dialog,show,target,ready:()=>manual||!!target(),features:()=>features(target()),place};
}
return {create,key,bounds,features,autoTarget};
})();
