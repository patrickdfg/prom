// PPT 자동 제작: 상단 구글 로그인. 프롬프터·방송용 PPT와 같은 공개 클라이언트 ID(../ppt/drive-config.js)와 같은 드라이브 파일 권한(drive.file)을 쓴다.
// 로그인은 사용자가 버튼을 눌렀을 때만 창을 띄우고, 토큰은 이 페이지 메모리에만 두며(새로고침하면 로그아웃) 서버로 보내지 않는다.
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const SCOPE='https://www.googleapis.com/auth/drive.file',API='https://www.googleapis.com/drive/v3/';
let token='',expires=0,account='',client=null,sdkPromise=null,busy=false,noteTimer=0;

const loggedIn=()=>!!token&&Date.now()<expires;
function note(msg,ms=6000){
  const n=$('loginNote');if(!n)return;
  clearTimeout(noteTimer);n.textContent=msg||'';n.hidden=!msg;
  if(msg&&ms)noteTimer=setTimeout(()=>{n.hidden=true;n.textContent='';},ms);
}
function paint(){
  const on=loggedIn();
  $('googleConnect').textContent=busy?'로그인 중…':on?'계정 바꾸기':'구글 로그인';
  $('googleConnect').disabled=busy;
  $('googleDisconnect').hidden=!on;
  const a=$('loginAccount');a.hidden=!on;a.textContent=on?account:'';a.title=on?account:'';
}
function clear(){token='';expires=0;account='';paint();}
function sdk(){
  if(window.google?.accounts?.oauth2)return Promise.resolve();
  return sdkPromise||(sdkPromise=new Promise((resolve,reject)=>{
    const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;
    const fail=()=>{s.remove();sdkPromise=null;reject(Error('구글 연결을 불러오지 못했습니다. 인터넷 연결을 확인하세요.'));};
    const timer=setTimeout(fail,15000);
    s.onload=()=>{clearTimeout(timer);resolve();};s.onerror=()=>{clearTimeout(timer);fail();};
    document.head.append(s);
  }));
}
function initClient(){
  client=google.accounts.oauth2.initTokenClient({client_id:window.PROM_GOOGLE_CLIENT_ID,scope:SCOPE,include_granted_scopes:false,
    callback:async r=>{
      try{
        if(r.error||!r.access_token)throw Error('구글 로그인이 완료되지 않았습니다.');
        if(!google.accounts.oauth2.hasGrantedAllScopes(r,SCOPE))throw Error('드라이브 파일 저장 권한을 허용해 주세요.');
        token=r.access_token;expires=Date.now()+(Number(r.expires_in)||3600)*1000-30000;
        account='내 구글 계정';busy=false;paint();note('로그인했습니다.',3000);   // 먼저 로그인 상태를 보여 주고 계정명은 아래에서 채운다
        const mine=token,ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),5000);
        try{
          const res=await fetch(API+'about?fields=user(displayName,emailAddress)',{headers:{Authorization:'Bearer '+mine},signal:ctl.signal});
          const info=res.ok?await res.json():null;
          if(token===mine&&info?.user){account=info.user.emailAddress||info.user.displayName||account;paint();}
        }catch(_){}finally{clearTimeout(timer);}
      }catch(e){busy=false;clear();note(e.message);}
    },
    error_callback:()=>{busy=false;paint();note('로그인 창이 닫혔거나 차단되었습니다. 팝업을 허용해 주세요.');}});
}
$('googleConnect').onclick=()=>{
  if(busy)return;
  if(!window.PROM_GOOGLE_CLIENT_ID){note('구글 연결 설정이 없습니다.');return;}
  if(!client){
    busy=true;paint();
    sdk().then(()=>{initClient();busy=false;paint();note('구글 연결 준비가 끝났습니다. 「구글 로그인」을 한 번 더 눌러 주세요.');})
      .catch(e=>{busy=false;paint();note(e.message);});
    return;
  }
  busy=true;paint();
  try{client.requestAccessToken({prompt:'select_account'});}
  catch(_){busy=false;paint();note('로그인 창을 열 수 없습니다. 팝업을 허용해 주세요.');}
};
$('googleDisconnect').onclick=()=>{
  const t=token;clear();
  try{if(t&&window.google?.accounts?.oauth2)google.accounts.oauth2.revoke(t,()=>{});}catch(_){}
  note('로그아웃했습니다. 공용 PC에서는 사용 후 브라우저 사이트 데이터를 지워 주세요.');
};
// 클라이언트 ID가 설정돼 있으면 미리 불러 두어 첫 클릭에서 바로 로그인 창이 뜨게 한다(창은 사용자가 누를 때만).
if(window.PROM_GOOGLE_CLIENT_ID)sdk().then(initClient).catch(()=>{});
paint();
window.MakeLogin={loggedIn:()=>loggedIn(),account:()=>account,token:()=>loggedIn()?token:''};
})();
