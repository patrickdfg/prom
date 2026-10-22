/* Both editors read the same template artwork without changing stored templates. */
(function(root){
'use strict';
function collect(records,kind){
 const background=kind==='background',seen=new Set(),items=[];
 for(const record of records||[]){
  if(String(record.id||'').startsWith('__prom-template-backup__:'))continue;
  for(const [key,layout] of Object.entries(record.design?.layouts||{}))for(const shape of layout.shapes||[]){
   if(shape.type!=='image'||!/^data:image\//.test(shape.src||'')||!(shape.w>0&&shape.h>0))continue;
   const full=shape.background||(shape.w>=(layout.width||960)*.85&&shape.h>=(layout.height||540)*.85);
   if(background!==!!full||seen.has(shape.src))continue;
   seen.add(shape.src);
   items.push({src:shape.src,shape:structuredClone(shape),label:record.name+' · '+(record.layoutCatalog?.find(x=>x.key===key)?.name||key)});
  }
 }
 return items;
}
async function records(){
 await root.PromBuiltinTemplates?.ready;
 const database=await new Promise((resolve,reject)=>{
  const request=indexedDB.open('prom-ppt-generation-templates',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('templates',{keyPath:'id'});
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 });
 try{return await new Promise((resolve,reject)=>{
  const transaction=database.transaction('templates','readonly'),request=transaction.objectStore('templates').getAll();
  transaction.oncomplete=()=>resolve(request.result);
  transaction.onerror=transaction.onabort=()=>reject(transaction.error||Error('그림 보관함을 읽지 못했습니다.'));
 });}finally{database.close();}
}
const api={collect,records};
if(typeof module==='object'&&module.exports)module.exports=api;else root.CaptionImageLibrary=api;
})(typeof window==='object'?window:globalThis);
