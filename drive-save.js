// 프롬프터: 마이크를 끄면 불러온 원고와 음성 인식 기록을 구글 드라이브 '설교 프롬프터 기록' 폴더에 저장한다.
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const SCOPE='https://www.googleapis.com/auth/drive.file',API='https://www.googleapis.com/drive/v3/';
const FOLDER_NAME='설교 프롬프터 기록',AUTO_KEY='promDriveAuto',FOLDER_KEY='promDriveFolder';
let token='',expires=0,account='',client=null,sdkPromise=null,afterLogin=null,busy=false;
const uploaded=new Set(); // 이번에 이미 올린 원고(같은 원고를 마이크 끌 때마다 또 올리지 않는다)

const note=(msg,ms)=>{const s=$('driveState');if(s)s.textContent=msg;if(ms&&typeof toast==='function')toast(msg,ms);};
const loggedIn=()=>!!token&&Date.now()<expires;
function paint(){
  const b=$('driveLogin');if(b){b.textContent=loggedIn()?'계정 바꾸기':'구글 로그인';b.disabled=busy;}
  const n=$('driveSaveNow');if(n)n.disabled=busy;
  if(!busy&&!$('driveState').textContent)note(loggedIn()?account+' 연결됨':'로그인하면 드라이브에 저장할 수 있습니다.');
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
  if(!loggedIn())throw Error('드라이브 로그인이 만료되었습니다.');
  const res=await fetch(url,{...options,headers:{...(options.headers||{}),Authorization:'Bearer '+token}});
  if(res.status===401){token='';expires=0;throw Error('드라이브 로그인이 만료되었습니다.');}
  if(!res.ok)throw Error(res.status===403?'드라이브 권한이나 저장 용량을 확인해 주세요.':'드라이브 저장에 실패했습니다 ('+res.status+').');
  return res;
}
function initClient(){
  client=google.accounts.oauth2.initTokenClient({client_id:window.PROM_GOOGLE_CLIENT_ID,scope:SCOPE,include_granted_scopes:false,
    callback:async r=>{
      const next=afterLogin;afterLogin=null;
      try{
        if(r.error||!r.access_token)throw Error('구글 로그인이 완료되지 않았습니다.');
        if(!google.accounts.oauth2.hasGrantedAllScopes(r,SCOPE))throw Error('드라이브 파일 저장을 허용해 주세요.');
        token=r.access_token;expires=Date.now()+(Number(r.expires_in)||3600)*1000-30000;
        const info=await (await request(API+'about?fields=user(displayName,emailAddress)')).json();
        account=info.user.emailAddress||info.user.displayName||'내 구글 계정';
        busy=false;note(account+' 연결됨');paint();
        if(next)next();
      }catch(e){busy=false;note(e.message,6000);paint();}
    },
    error_callback:()=>{afterLogin=null;busy=false;note('로그인 창이 닫혔거나 차단되었습니다. 팝업을 허용해 주세요.',6000);paint();}});
}
function login(prompt,then){
  if(!window.PROM_GOOGLE_CLIENT_ID){note('구글 연결 설정이 없습니다.',5000);return false;}
  if(!client)return false;
  afterLogin=then||null;busy=true;paint();
  try{client.requestAccessToken({prompt});return true}catch(_){afterLogin=null;busy=false;paint();note('로그인 창을 열 수 없습니다. 팝업을 허용해 주세요.',6000);return false;}
}

// 저장할 파일 목록: 불러온 원고(처음 한 번)와 인식 기록(매번)
const z=n=>String(n).padStart(2,'0');
function stamp(){const d=new Date();return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())+' '+z(d.getHours())+z(d.getMinutes());}
function title(){try{return (typeof baseName!=='undefined'&&baseName)||'대본'}catch(_){return '대본'}}
function manuscript(){
  const s=window.promSource;
  if(s&&s.blob){const key=s.name+'|'+s.blob.size+'|'+(s.blob.lastModified||'');return {key,name:s.name,blob:s.blob};}
  try{
    if(typeof P==='undefined'||!P.length)return null;
    const text=P.map(pg=>pg.map(l=>l.map(x=>x.t).join('')).join('\n')).join('\n\n');
    return {key:'text|'+text.length+'|'+text.slice(0,200),name:title()+'.txt',blob:new Blob([text],{type:'text/plain;charset=utf-8'})};
  }catch(_){return null}
}
function collect(){
  const files=[],when=stamp(),m=manuscript();
  if(m&&!uploaded.has(m.key))files.push({name:when+' '+m.name,blob:m.blob,type:m.blob.type||'application/octet-stream',key:m.key});
  try{const doc=voiceLogDoc();if(doc.events.length)files.push({name:when+' '+title()+' 인식기록.json',blob:new Blob([JSON.stringify(doc)],{type:'application/json'}),type:'application/json'});}catch(_){}
  return files;
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
async function upload(file,parent){
  const start=await request('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',{method:'POST',
    headers:{'Content-Type':'application/json','X-Upload-Content-Type':file.type,'X-Upload-Content-Length':String(file.blob.size)},
    body:JSON.stringify({name:file.name,mimeType:file.type,parents:[parent],appProperties:{promApp:'prompter'}})});
  const loc=start.headers.get('Location');
  if(!loc||new URL(loc).origin!=='https://www.googleapis.com')throw Error('업로드 주소를 받지 못했습니다.');
  await request(loc,{method:'PUT',headers:{'Content-Type':file.type},body:file.blob});
}
async function saveNow(){
  const files=collect();
  if(!files.length){note('저장할 원고나 인식 기록이 없습니다.',4000);return;}
  busy=true;paint();note('드라이브에 저장 중…');
  try{
    const parent=await folder();
    for(const f of files){await upload(f,parent);if(f.key)uploaded.add(f.key);}
    busy=false;note('드라이브 \''+FOLDER_NAME+'\' 폴더에 '+files.length+'개 파일을 저장했습니다.',6000);
  }catch(e){busy=false;note(e.message+' 원고와 기록은 이 기기에 남아 있습니다. 「드라이브 저장」으로 다시 시도하세요.',8000);}
  paint();
}
// 로그인이 살아 있으면 바로, 만료됐으면 사람이 누른 때에만 로그인 창을 띄워 이어서 저장한다
function run(fromUser){
  if(busy)return;
  if(loggedIn()){saveNow();return;}
  const gesture=fromUser||!!navigator.userActivation?.isActive;
  if(gesture&&login('',saveNow))return;
  note('드라이브 로그인이 필요해 저장하지 못했습니다. 「드라이브 저장」을 눌러 다시 시도하세요.',8000);
}
function autoSave(){
  let on=false;try{on=localStorage.getItem(AUTO_KEY)==='1'}catch(_){}
  if(on)run(false);
}

const auto=$('driveAuto');
if(auto){try{auto.checked=localStorage.getItem(AUTO_KEY)==='1'}catch(_){}
  auto.onchange=()=>{try{localStorage.setItem(AUTO_KEY,auto.checked?'1':'0')}catch(_){}if(auto.checked&&!loggedIn())note('설교 전에 「구글 로그인」을 눌러 두세요. 로그인은 약 1시간 유지됩니다.');};}
$('driveLogin')&&($('driveLogin').onclick=()=>{if(!client){note('구글 연결을 준비하는 중입니다. 잠시 뒤 다시 눌러 주세요.');sdk().then(initClient).catch(e=>note(e.message,5000));return;}login('select_account');});
$('driveSaveNow')&&($('driveSaveNow').onclick=()=>run(true));
if(window.PROM_GOOGLE_CLIENT_ID)sdk().then(initClient).catch(()=>{});
window.PromDrive={autoSave,saveNow:()=>run(true),_collect:collect,_folderName:FOLDER_NAME};
paint();
})();
