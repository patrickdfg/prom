// PPT 자동 제작: 템플릿을 로그인한 구글 드라이브에 저장하고, 내 드라이브에서 불러온다. 올리고 내려받는 일은 모두 사용자가 버튼을 눌렀을 때만 한다.
// - 템플릿 줄의 「드라이브에 저장」: 그 템플릿을 드라이브 「설교 PPT 템플릿」 폴더에 올린다(같은 템플릿은 덮어쓴다).
// - 「드라이브에 모두 저장」: 드라이브에 없거나 이 컴퓨터 것이 더 새로운 템플릿을 한 번에 올린다.
// - 「드라이브에서 불러오기」→「가져오기」: 드라이브 템플릿을 이 컴퓨터로 가져온다.
// - 이 컴퓨터에서 템플릿을 지워도 드라이브 복사본은 그대로 둔다. 드라이브 목록의 「드라이브에서 삭제」를 눌러야 휴지통으로 옮긴다(30일 안에 복구 가능).
// 이 앱이 만든 파일만 다루는 drive.file 권한이라 다른 드라이브 파일은 보지도 건드리지도 못한다.
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const API='https://www.googleapis.com/drive/v3/',UPLOAD='https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_NAME='설교 PPT 템플릿',FOLDER_KEY='promMakeDriveFolder',APP='make-template';
const L=()=>window.MakeLogin,M=()=>window.PromMake;
let chain=Promise.resolve(),busy=false,remote=[];

const esc=s=>String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
const when=t=>new Date(t).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
function note(msg){const n=$('tplDriveState');if(n)n.textContent=msg||'';}
function paint(){
  const on=!!L()?.loggedIn();
  for(const id of ['tplDriveSync','tplDriveList'])if($(id))$(id).disabled=!on||busy;
  if(!on){note('상단에서 구글 로그인하면 템플릿을 내 드라이브에 저장하고 불러올 수 있습니다.');const box=$('tplDriveFiles');if(box){box.replaceChildren();box.hidden=true;}}
}
// 한 번에 하나씩 순서대로(저장 순서가 뒤바뀌어 옛 것이 덮어쓰지 않게)
const enqueue=fn=>(chain=chain.then(fn,fn));

async function folder(){
  let id='';try{id=localStorage.getItem(FOLDER_KEY)||''}catch(_){}
  if(id){try{const f=await (await L().request(API+'files/'+encodeURIComponent(id)+'?fields=id,trashed')).json();if(!f.trashed)return id;}catch(e){if(/만료/.test(e.message))throw e;}}
  const q="name = '"+FOLDER_NAME+"' and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
  const found=await (await L().request(API+'files?'+new URLSearchParams({q,fields:'files(id)',pageSize:'1'}))).json();
  id=found.files?.[0]?.id;
  if(!id){const made=await (await L().request(API+'files?fields=id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:FOLDER_NAME,mimeType:'application/vnd.google-apps.folder'})})).json();id=made.id;}
  try{localStorage.setItem(FOLDER_KEY,id)}catch(_){}
  return id;
}
async function findRemote(tid){
  const q="trashed = false and appProperties has { key='promApp' and value='"+APP+"' } and appProperties has { key='tid' and value='"+esc(tid)+"' }";
  const found=await (await L().request(API+'files?'+new URLSearchParams({q,fields:'files(id,name,appProperties)',pageSize:'1'}))).json();
  return found.files?.[0]||null;
}
async function listRemote(){
  const q="trashed = false and appProperties has { key='promApp' and value='"+APP+"' }";
  const out=[];let pageToken='';
  do{
    const params={q,fields:'nextPageToken,files(id,name,modifiedTime,appProperties)',orderBy:'modifiedTime desc',pageSize:'100'};if(pageToken)params.pageToken=pageToken;
    const data=await (await L().request(API+'files?'+new URLSearchParams(params))).json();
    out.push(...(data.files||[]));pageToken=data.nextPageToken||'';
  }while(pageToken);
  return out;
}
// 같은 템플릿(tid)이 있으면 덮어쓰고, 없으면 새로 만든다
async function upload(rec,existing){
  const name=rec.name+'_템플릿.json',blob=new Blob([JSON.stringify(rec)],{type:'application/json'});
  const props={promApp:APP,tid:rec.id,updatedAt:String(rec.updatedAt||0)};
  const hdr={'Content-Type':'application/json','X-Upload-Content-Type':'application/json','X-Upload-Content-Length':String(blob.size)};
  const start=existing
    ?await L().request(UPLOAD+'/'+encodeURIComponent(existing.id)+'?uploadType=resumable&fields=id',{method:'PATCH',headers:hdr,body:JSON.stringify({name,appProperties:props})})
    :await L().request(UPLOAD+'?uploadType=resumable&fields=id',{method:'POST',headers:hdr,body:JSON.stringify({name,mimeType:'application/json',parents:[await folder()],appProperties:props})});
  const loc=start.headers.get('Location');
  if(!loc||new URL(loc).origin!=='https://www.googleapis.com')throw Error('업로드 주소를 받지 못했습니다.');
  await L().request(loc,{method:'PUT',headers:{'Content-Type':'application/json'},body:blob});
}
// 템플릿 줄의 「드라이브에 저장」
async function saveOne(id){
  const rec=M()?.get(id);if(!rec)return;
  if(rec.builtin&&!rec.edited){note('사이트 기본 템플릿은 고치기 전에는 올리지 않아도 누구나 쓸 수 있습니다. 고친 뒤에 저장하세요.');return;}
  if(!L()?.loggedIn()){note('먼저 상단에서 구글 로그인해 주세요.');M()?.toast?.('먼저 상단에서 구글 로그인해 주세요.');return;}
  busy=true;paint();note('드라이브에 저장 중… · '+rec.name);
  try{await upload(rec,await findRemote(rec.id));note('드라이브에 저장했습니다 · '+rec.name+' · '+when(Date.now()));M()?.toast?.(`"${rec.name}" 템플릿을 드라이브에 저장했습니다.`);}
  catch(e){note(e.message+' 이 컴퓨터 저장은 그대로입니다.');}
  busy=false;paint();
}
// 「드라이브에 모두 저장」: 드라이브에 없거나 이 컴퓨터 것이 더 새로우면 올린다
async function syncAll(){
  if(!L()?.loggedIn())return;
  busy=true;paint();note('드라이브와 맞춰 보는 중…');
  try{
    const files=await listRemote(),byTid=new Map(files.map(f=>[f.appProperties?.tid,f]));
    let up=0;
    for(const rec of M().records()){
      if(rec.builtin&&!rec.edited)continue;   // 고치지 않은 사이트 기본 템플릿은 누구나 쓰므로 올리지 않는다
      const f=byTid.get(rec.id);
      if(!f||(rec.updatedAt||0)>(Number(f.appProperties?.updatedAt)||0)){note('드라이브에 저장 중… · '+rec.name);await upload(rec,f||null);up++;}
    }
    remote=await listRemote();renderRemote();
    note(up?`드라이브에 ${up}개를 저장했습니다 · ${when(Date.now())}`:'드라이브와 같습니다 · '+when(Date.now()));
  }catch(e){note(e.message+' 이 컴퓨터 저장은 그대로입니다.');}
  busy=false;paint();
}
async function refreshRemote(){
  if(!L()?.loggedIn())return;
  busy=true;paint();note('드라이브 목록을 불러오는 중…');
  try{remote=await listRemote();renderRemote();note(`내 드라이브 템플릿 ${remote.length}개`);}
  catch(e){note(e.message);}
  busy=false;paint();
}
function renderRemote(){
  const box=$('tplDriveFiles');if(!box)return;box.replaceChildren();
  for(const f of remote){
    const row=document.createElement('div');row.className='tpl';
    const name=document.createElement('b');name.textContent=(f.name||'').replace(/_템플릿\.json$|\.json$/,'');
    const small=document.createElement('small');small.textContent='드라이브 수정 '+when(f.modifiedTime);
    const b=document.createElement('button');b.type='button';b.textContent='가져오기';b.onclick=()=>importRemote(f);
    const d=document.createElement('button');d.type='button';d.className='danger';d.textContent='드라이브에서 삭제';d.onclick=()=>trashRemote(f);
    row.append(name,b,d,small);box.append(row);
  }
  box.hidden=!remote.length;
}
async function importRemote(f){
  if(busy)return;
  busy=true;paint();note('드라이브에서 가져오는 중… · '+f.name);
  try{
    const rec=await (await L().request(API+'files/'+encodeURIComponent(f.id)+'?alt=media')).json();
    if(rec?.version!==1||!rec.id||!rec.design?.layouts)throw Error('템플릿 파일이 아닙니다.');
    const local=M().get(rec.id);
    if(local&&!confirm(`이 컴퓨터에 같은 템플릿 "${local.name}"이 있습니다. 드라이브 버전으로 덮어쓸까요?`)){note('가져오기를 취소했습니다.');busy=false;paint();return;}
    await M().putSynced(rec);
    note(`"${rec.name}" 템플릿을 가져왔습니다.`);M().toast?.(`"${rec.name}" 템플릿을 드라이브에서 가져왔습니다.`);
  }catch(e){note(e.message);}
  busy=false;paint();
}
async function trashRemote(f){
  if(busy||!L()?.loggedIn())return;
  const label=(f.name||'').replace(/_템플릿\.json$|\.json$/,'');
  if(!confirm(`드라이브의 "${label}" 템플릿을 휴지통으로 옮길까요? 이 컴퓨터의 템플릿은 그대로입니다.`))return;
  busy=true;paint();
  try{await L().request(API+'files/'+encodeURIComponent(f.id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({trashed:true})});remote=remote.filter(x=>x.id!==f.id);renderRemote();note(`드라이브의 "${label}" 템플릿을 휴지통으로 옮겼습니다.`);}
  catch(e){note(e.message);}
  busy=false;paint();
}

window.addEventListener('make-template-upload',e=>enqueue(()=>saveOne(e.detail.id)));
window.addEventListener('make-login',e=>{if(e.detail.loggedIn){paint();note('로그인했습니다. 「드라이브에 저장」을 누르면 내 드라이브에 올라갑니다.');}else{remote=[];paint();}});
$('tplDriveSync')&&($('tplDriveSync').onclick=()=>enqueue(syncAll));
$('tplDriveList')&&($('tplDriveList').onclick=()=>enqueue(refreshRemote));
paint();
})();
