/* Template-owned layout names. Semantic keys remain stable for manuscript generation. */
(function(root){
'use strict';
function catalog(record,defaults={}){
 const bank=record.design?.layouts||{},saved=record.layoutCatalog;
 // 성령말씀은 실제 생성에 쓰는 표지와 누적 본문만 마스터 목록에 노출합니다.
 // 숨겨진 레이아웃 데이터는 삭제하지 않아 기존 사용자 편집과 엔진 호환성을 보존합니다.
 if(record.id==='builtin-spirit-word'||record.copiedFrom==='builtin-spirit-word'){
  return [{key:'cover',name:'성령말씀 표지'},{key:'word',name:'성령말씀 누적 본문'}].filter(e=>Object.hasOwn(bank,e.key));
 }
 let entries;
 if(Array.isArray(saved)&&saved.length)entries=saved;
 else {
  const learned=[...new Set((record.pair?.evidence?.candidates||[]).map(c=>c.layout).filter(k=>Object.hasOwn(bank,k)))];
  entries=(learned.length?learned:Object.keys(bank)).map(key=>{
   const role=defaults[key]||key,source=String(bank[key].sourceLayoutName||'').trim();
   const generic=/^(?:空白|빈(?: 화면)?|제목(?: 및 내용)?|제목만|내용|사용자 지정|blank|custom|title(?: and content)?|layout|레이아웃)(?:\s*\d+)?$/i.test(source);
   return {key,name:source&&!generic&&source!==role?source+' · '+role:role};
  });
 }
 const seen=new Set(),names=new Set(),out=[];
 for(const entry of entries){
  const key=entry?.key;if(!Object.hasOwn(bank,key)||seen.has(key))continue;seen.add(key);
  const base=String(entry.name||defaults[key]||key).trim()||key;let name=base,n=2;
  while(names.has(name))name=base+' '+n++;
  names.add(name);out.push({key,name});
 }
 // A damaged/old catalog must not leave the master editor with an empty selection.
 if(!out.length&&Object.keys(bank).length)return catalog({...record,layoutCatalog:null,pair:null},defaults);
 return out;
}
const label=(record,entry)=>String(record.name||'템플릿')+' · '+entry.name;
function prepare(record,defaults={}){
 const entries=catalog(record,defaults),names=new Map(entries.map(e=>[e.key,e])),bank=record.design?.layouts||{};
 const layouts=Object.fromEntries(Object.entries(bank).map(([key,scene])=>[key,{...scene,layoutName:label(record,names.get(key)||{name:defaults[key]||key})}]));
 return {...record,layoutCatalog:entries,design:{...record.design,layouts}};
}
const api={catalog,label,prepare};if(typeof module==='object'&&module.exports)module.exports=api;else root.MakeTemplateLayouts=api;
})(typeof window==='object'?window:globalThis);
