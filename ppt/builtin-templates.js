// 처음 쓰는 사람도 주일예배·새벽설교 템플릿을 바로 고를 수 있게, 사이트에 들어 있는 기본 템플릿을 이 기기의 템플릿 보관함(IndexedDB)에 넣는다
window.PromBuiltinTemplates=(()=>{
'use strict';
// version을 올리면 고치지 않은 기본 템플릿은 새 것으로 바뀐다. 사용자가 마스터 편집으로 고친 것(edited)은 그대로 둔다.
const LIST=[
  {id:'builtin-sunday',file:'sunday.json',version:1},
  {id:'builtin-dawn',file:'dawn.json',version:2},
  {id:'builtin-spirit-word',file:'sunday.json',version:6,transform:'spirit'},
];
const KEY='promBuiltinTemplates',DB='prom-ppt-generation-templates';
const base=new URL('templates/',document.currentScript.src);
function db(){return new Promise((ok,no)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('templates',{keyPath:'id'});r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});}
function req(d,mode,fn){return new Promise((ok,no)=>{const tx=d.transaction('templates',mode),r=fn(tx.objectStore('templates'));tx.oncomplete=()=>ok(r?.result);tx.onerror=()=>no(tx.error);});}
// '성령말씀'은 클로드 성령사연 스킬의 문장 리빌 제작 규칙을 따르는 공용 프리셋입니다.
// 기존 사이트 템플릿의 레이아웃 스키마를 유지하면서 편집 가능한 진남색/흰색 자막 디자인을 만듭니다.
function spiritPreset(rec){
 rec.name='기본 성령말씀 템플릿';
 rec.worship=false;
 rec.options={...(rec.options||{}),sourceMode:'spirit',cumulative:true,allText:false,greenLayout:'word'};
 rec.instructions=`# 성령말씀 — 성령사연 클로드 스킬 기반
- 성령사연 PDF·텍스트 원고의 문장을 원문 그대로 살리고 요약·문장 병합·삭제를 하지 않는다.
- 표지는 한 장만 만들며 '20XX년 성령 사연 N' 제목만 파란 굵은 글씨로 표시한다. 서두 인용문은 본문 첫 문장으로 보낸다.
- 빈 줄 및 주제 전환을 기준으로 블록을 나눈다. 블록이 바뀌면 누적 화면을 새로 시작한다.
- 본문은 문장별 누적 공개: 1 → 1+2 → 1+2+3 순으로 구성한다.
- 누적된 실제 표시 줄 수가 6줄을 초과하면 새 그룹으로 분리한다. 마침표·물음표·느낌표 등 문장 끝을 최우선으로 하고 쉼표·연결어미와 페이지별 줄 수 균형을 함께 평가해 자연스럽게 나눈다. 가능한 한 6+1처럼 한 줄만 남는 분할은 피한다.
- 한 문장이 여러 줄인 경우 원문 줄바꿈을 보존하고, 긴 줄은 단어 단위로 균형 있게 분리한다.
- 전체 기본 글자 32pt, 줄간격 1.3배, 흰색 굵은 글자, 가운데 정렬, 배경 그림을 유지한다.
- 누적 그룹의 최종 상태가 화면 가운데 오도록 동일 그룹 전체 슬라이드의 세로 기준선을 고정한다.
- 마지막 문장까지 누적된 최종 화면은 2번 보여 준다.
- 여러 사연이 한 원고에 있으면 사연 번호마다 새 표지와 새 누적 흐름을 시작한다.
- 배경 원본 및 완전한 픽셀 재현 기준은 클로드 스킬 assets/template.pptx이다. 본 PROM 공용 템플릿은 편집 가능한 웹 기본 디자인이다.`;
 for(const [key,scene] of Object.entries(rec.design?.layouts||{})){
   if(!Array.isArray(scene.shapes))continue;
   const body=scene.shapes[scene.bodyIndex];
   if(!body||body.type!=='text')continue;
   // 배경 그림은 레이아웃에 포함된 이미지 도형이므로 제거하지 않습니다.
   // 원본 템플릿의 이미지와 레이어를 보존합니다.
   body.anchor='ctr';body.wrap=true;body.lineReduction=0;
   for(const p of body.paragraphs||[]){
     p.align='center';p.defaultSize=32;p.fixedLineSpacing=true;p.lineSpacing={unit:'ratio',value:1.3};
     for(const run of p.runs||[]){run.font='Malgun Gothic';run.size=32;run.bold=true;run.color=key==='cover'?'#65AFFF':'#FFFFFF';}
   }
 }
 rec.layoutCatalog=Object.keys(rec.design?.layouts||{}).map(key=>({key,name:key==='cover'?'성령말씀 표지':key==='word'?'성령말씀 누적 본문':key==='wordSpirit'?'성령 말씀':key==='caption'?'성령말씀 자막':key}));
 return rec;
}
async function seed(){
  let done={};try{done=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(_){}
  // Name migration must run even when built-in version is already marked installed.
  const todo=LIST;if(!todo.length)return 0;
  const d=await db();let added=0;
  for(const t of todo){
    try{
      const have=await req(d,'readonly',s=>s.get(t.id));
      // Rename the existing public spirit preset without replacing locally edited artwork.
      if(t.id==='builtin-spirit-word'&&have?.name==='성령말씀'){
        have.name='기본 성령말씀 템플릿';
        await req(d,'readwrite',s=>s.put(have));
      }
      // Never replace an existing browser template, even after a built-in version bump.
      // Custom artwork may have been saved without the edited flag.
      if(have){done[t.id]=t.version;continue;}
      const res=await fetch(new URL(t.file+'?v='+t.version,base));if(!res.ok)continue;
      let rec=await res.json();if(rec?.version!==1||!rec.design?.layouts)continue;
      if(t.transform==='spirit')rec=spiritPreset(rec);
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
