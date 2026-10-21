// 프롬프터: 구글 로그인 후 '저장'한 프롬프터 파일을 드라이브에도 올리고, 다른 컴퓨터에서 로그인하면 그 파일 목록을 불러와 연다.
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const SCOPE='https://www.googleapis.com/auth/drive.file',API='https://www.googleapis.com/drive/v3/';
const FOLDER_NAME='설교 프롬프터',FOLDER_KEY='promDriveFolder',APP='prompter-file';
const shared=PromGoogleSession;let token='',expires=0,account='',client=null,sdkPromise=null,busy=false,shownToken='';

const loggedIn=()=>!!token&&Date.now()<expires;
const note=(msg,ms)=>{const s=$('driveState');if(s)s.textContent=msg;if(ms&&typeof toast==='function')toast(msg,ms);};
function paint(){
  const b=$('driveLogin');if(b){b.textContent=loggedIn()?'계정 바꾸기':'구글 로그인';b.disabled=busy;}
  const r=$('driveRefresh');if(r){r.hidden=!loggedIn();r.disabled=busy;}
  if(!loggedIn()&&!busy&&!$('driveState').textContent)note('로그인하면 저장한 원고를 다른 컴퓨터에서도 열 수 있습니다.');
}
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
async function request(url,options={}){
  if(!loggedIn())throw Error('드라이브 로그인이 만료되었습니다. 「구글 로그인」을 다시 눌러 주세요.');
  const mine=token,res=await fetch(url,{...options,headers:{...(options.headers||{}),Authorization:'Bearer '+mine}});
  if(token!==mine)throw Error('계정이 변경되어 이전 요청을 중단했습니다.');
  if(res.status===401){shared.clear(mine);paint();throw Error('드라이브 로그인이 만료되었습니다. 「구글 로그인」을 다시 눌러 주세요.');}
  if(!res.ok)throw Error(res.status===403?'드라이브 권한이나 저장 용량을 확인해 주세요.':'드라이브 요청에 실패했습니다 ('+res.status+').');
  return res;
}
function initClient(){
  client=google.accounts.oauth2.initTokenClient({client_id:window.PROM_GOOGLE_CLIENT_ID,scope:SCOPE,include_granted_scopes:false,
    callback:async r=>{
      try{
        if(r.error||!r.access_token)throw Error('구글 로그인이 완료되지 않았습니다.');
        if(!google.accounts.oauth2.hasGrantedAllScopes(r,SCOPE))throw Error('드라이브 파일 저장을 허용해 주세요.');
        token=r.access_token;expires=Date.now()+(Number(r.expires_in)||3600)*1000-30000;account='내 구글 계정';shared.save({token,expires,account});const mine=token;
        const info=await (await request(API+'about?fields=user(displayName,emailAddress)')).json();
        if(token===mine){account=info.user.emailAddress||info.user.displayName||'내 구글 계정';shared.save({token,expires,account});}
        busy=false;paint();if(token===mine)await list();
      }catch(e){busy=false;note(e.message,6000);paint();}
    },
    error_callback:()=>{busy=false;note('로그인 창이 닫혔거나 차단되었습니다. 팝업을 허용해 주세요.',6000);paint();}});
}
function login(){
  if(!window.PROM_GOOGLE_CLIENT_ID){note('구글 연결 설정이 없습니다.',5000);return;}
  if(!client){note('구글 연결을 준비하는 중입니다. 잠시 뒤 다시 눌러 주세요.');sdk().then(initClient).catch(e=>note(e.message,5000));return;}
  busy=true;paint();
  try{client.requestAccessToken({prompt:'select_account'})}catch(_){busy=false;paint();note('로그인 창을 열 수 없습니다. 팝업을 허용해 주세요.',6000);}
}
async function folder(){
  let id='';try{id=localStorage.getItem(FOLDER_KEY)||''}catch(_){}
  if(id){try{const f=await (await request(API+'files/'+encodeURIComponent(id)+'?fields=id,trashed')).json();if(!f.trashed)return id;}catch(e){if(/만료/.test(e.message))throw e;}}
  const q="name = '"+FOLDER_NAME+"' and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
  const found=await (await request(API+'files?'+new URLSearchParams({q,fields:'files(id)',pageSize:'1'}))).json();
  id=found.files?.[0]?.id;
  if(!id){const made=await (await request(API+'files?fields=id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:FOLDER_NAME,mimeType:'application/vnd.google-apps.folder'})})).json();id=made.id;}
  try{localStorage.setItem(FOLDER_KEY,id)}catch(_){}
  return id;
}
// 같은 이름 파일이 있으면 덮어쓰고, 없으면 새로 만든다
async function upload(name,body){
  if(!loggedIn())return false;
  const q="name = '"+name.replace(/\\/g,'\\\\').replace(/'/g,"\\'")+"' and trashed = false and appProperties has { key='promApp' and value='"+APP+"' }";
  const found=await (await request(API+'files?'+new URLSearchParams({q,fields:'files(id)',pageSize:'1'}))).json();
  const id=found.files?.[0]?.id,blob=new Blob([body],{type:'application/json'});
  let start;
  if(id)start=await request('https://www.googleapis.com/upload/drive/v3/files/'+encodeURIComponent(id)+'?uploadType=resumable&fields=id',{method:'PATCH',headers:{'Content-Type':'application/json','X-Upload-Content-Type':'application/json','X-Upload-Content-Length':String(blob.size)},body:'{}'});
  else start=await request('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',{method:'POST',headers:{'Content-Type':'application/json','X-Upload-Content-Type':'application/json','X-Upload-Content-Length':String(blob.size)},body:JSON.stringify({name,mimeType:'application/json',parents:[await folder()],appProperties:{promApp:APP}})});
  const loc=start.headers.get('Location');
  if(!loc||new URL(loc).origin!=='https://www.googleapis.com')throw Error('업로드 주소를 받지 못했습니다.');
  await request(loc,{method:'PUT',headers:{'Content-Type':'application/json'},body:blob});
  return true;
}
async function save(name,body){
  if(!loggedIn())return;
  try{busy=true;paint();note('드라이브에 저장 중…');await upload(name,body);busy=false;await list();note('드라이브에도 저장했습니다 · '+name.replace(/_프롬프터\.json$|\.json$/,''),5000);}
  catch(e){busy=false;note(e.message+' 이 기기 저장은 그대로입니다.',8000);}
  paint();
}
// 로그인한 계정에 이 프로그램이 저장한 원고 목록을 보여 주고, 누르면 연다
async function list(){
  const box=$('driveFiles');if(!box||!loggedIn())return;
  const mine=token;
  try{
    const q="trashed = false and appProperties has { key='promApp' and value='"+APP+"' }";
    const data=await (await request(API+'files?'+new URLSearchParams({q,fields:'files(id,name,modifiedTime)',orderBy:'modifiedTime desc',pageSize:'30'}))).json();
    if(token!==mine||!loggedIn())return;
    box.replaceChildren();
    const files=data.files||[];
    note(account+' · 드라이브 원고 '+files.length+'개');
    for(const f of files){
      const b=document.createElement('button');b.type='button';b.className='drive-file';
      b.textContent=f.name.replace(/_프롬프터\.json$|\.json$/,'');
      const s=document.createElement('small');s.textContent=new Date(f.modifiedTime).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});b.append(s);
      b.onclick=()=>open(f);box.append(b);
    }
    box.hidden=!files.length;
  }catch(e){note(e.message,6000);}
}
async function open(f){
  if(busy)return;
  try{
    busy=true;paint();note('드라이브에서 여는 중…');
    const text=await (await request(API+'files/'+encodeURIComponent(f.id)+'?alt=media')).text();
    busy=false;paint();note(account+' · '+f.name.replace(/\.json$/,'')+' 열기');
    await loadFile(new File([text],f.name,{type:'application/json'}));
  }catch(e){busy=false;paint();note(e.message,6000);}
}

$('driveLogin')&&($('driveLogin').onclick=login);
$('driveRefresh')&&($('driveRefresh').onclick=list);
if(window.PROM_GOOGLE_CLIENT_ID)sdk().then(initClient).catch(()=>{});
window.PromDrive={save,list,loggedIn};
shared.subscribe(session=>{const changed=shownToken!==(session?.token||'');shownToken=session?.token||'';token=shownToken;expires=session?.expires||0;account=session?.account||'';if(changed){$('driveFiles')?.replaceChildren();if($('driveFiles'))$('driveFiles').hidden=true;note(token?account+' · 연결됨':'구글 로그인하면 저장한 원고를 다른 컴퓨터에서도 열 수 있습니다.');}paint();if(changed&&loggedIn())list();});
paint();
})();
