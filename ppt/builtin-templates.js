// 처음 쓰는 사람도 주일예배·새벽설교 템플릿을 바로 고를 수 있게, 사이트에 들어 있는 기본 템플릿을 이 기기의 템플릿 보관함(IndexedDB)에 넣는다
window.PromBuiltinTemplates=(()=>{
'use strict';
// version을 올리면 고치지 않은 기본 템플릿은 새 것으로 바뀐다. 사용자가 마스터 편집으로 고친 것(edited)은 그대로 둔다.
const LIST=[
  {id:'builtin-sunday',file:'sunday.json',version:1},
  {id:'builtin-dawn',file:'dawn.json',version:2},
];
const KEY='promBuiltinTemplates',DB='prom-ppt-generation-templates';
const base=new URL('templates/',document.currentScript.src);
function db(){return new Promise((ok,no)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('templates',{keyPath:'id'});r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});}
function req(d,mode,fn){return new Promise((ok,no)=>{const tx=d.transaction('templates',mode),r=fn(tx.objectStore('templates'));tx.oncomplete=()=>ok(r?.result);tx.onerror=()=>no(tx.error);});}
async function seed(){
  let done={};try{done=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(_){}
  const todo=LIST.filter(t=>done[t.id]!==t.version);if(!todo.length)return 0;
  const d=await db();let added=0;
  for(const t of todo){
    try{
      const have=await req(d,'readonly',s=>s.get(t.id));
      if(have&&(have.edited||have.builtinVersion>=t.version)){done[t.id]=t.version;continue;}
      const res=await fetch(new URL(t.file+'?v='+t.version,base));if(!res.ok)continue;
      const rec=await res.json();if(rec?.version!==1||!rec.design?.layouts)continue;
      Object.assign(rec,{id:t.id,builtin:true,builtinVersion:t.version,edited:false});
      await req(d,'readwrite',s=>s.put(rec));done[t.id]=t.version;added++;
    }catch(_){/* 인터넷이 없으면 다음에 다시 */}
  }
  try{localStorage.setItem(KEY,JSON.stringify(done))}catch(_){}
  d.close();return added;
}
const ready=seed().catch(()=>0);
return {ready,list:LIST};
})();
