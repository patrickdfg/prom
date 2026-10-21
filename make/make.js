// PPT 자동 제작 화면: 템플릿 보관(방송용 PPT 앱과 같은 보관함), 원고+완성 PPT로 템플릿 학습, 마스터 레이아웃 편집, 원고로 PPT 만들기
(()=>{
'use strict';
const $=id=>document.getElementById(id),B=CaptionBuilder,clone=x=>structuredClone(x);
const L=MakeTemplateLayouts,R=CaptionContentRules;
const DB='prom-ppt-generation-templates',LAST='promMakeTemplate';
const DEFAULT_OPTIONS={title:'',date:'',greenLayout:'word',cumulative:false,allText:false,sourceMode:'numbered'};
let selected=-1,deckTemplate=null,deckTemplateRec=null;   // 편집 창: 고른 슬라이드 번호, 이 덱을 만든 템플릿 디자인(편집 창이 새 장면을 만들 때 같은 템플릿을 쓰게)
let records=[],busy=false,deck=null,draft=null,draftId='',layoutKey='caption',shapeIx=0,dirty=false,draftCatalog=[];

/* ---------- 공통 ---------- */
let toastTimer;
function toast(msg,ms=3500){const t=$('toast');t.textContent=msg;t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.hidden=true,ms);}
function status(id,msg,error=false){const s=$(id);s.textContent=msg||'';s.classList.toggle('error',!!error);}
const stem=name=>String(name||'').replace(/\.[^.]+$/,'');
function readData(file){return new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok({name:file.name,data:r.result});r.onerror=()=>no(Error('파일을 읽지 못했습니다.'));r.readAsDataURL(file);});}

const makeInputs=MakeManuscripts.mount({input:$('makeScript'),list:$('makePasteList'),add:$('makePasteAdd'),filesNote:$('makeScriptFiles')});
const pairInputs=MakeManuscripts.mount({input:$('pairScript'),list:$('pairPasteList'),add:$('pairPasteAdd'),filesNote:$('pairScriptFiles')});
async function combinedSource(rich,files){if(files.length===1&&rich.names.length===1)return readData(files[0]);return readData(new File([rich.lines.join('\n')],stem(rich.name)+'.txt',{type:'text/plain'}));}

/* ---------- 템플릿 보관함 (IndexedDB, 방송용 PPT 앱과 공유) ---------- */
let dbp;
function db(){return dbp||(dbp=new Promise((ok,no)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('templates',{keyPath:'id'});r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);}));}
async function store(mode,fn){const d=await db();return new Promise((ok,no)=>{const tx=d.transaction('templates',mode),req=fn(tx.objectStore('templates'));tx.oncomplete=()=>ok(req?.result);tx.onerror=()=>no(tx.error);});}
async function load(){await window.PromBuiltinTemplates?.ready;records=(await store('readonly',s=>s.getAll())||[]).map(r=>L.prepare({...MakeAnnouncements.upgrade(r),options:{...r.options,allText:false,sourceMode:R.mode(r),...(R.mode(r)==='worship'?{worshipOmit:R.worshipOmit(r)}:{})},instructions:R.instructions(r.instructions,R.mode(r))},B.layouts)).sort((a,b)=>String(a.name).localeCompare(String(b.name),'ko'));fillSelects();renderList();}
// 저장할 때마다 수정 시각을 남긴다(드라이브에 올릴 때 어느 쪽이 더 새로운지 비교하는 데 쓴다). 드라이브 업로드는 사용자가 버튼을 눌렀을 때만 한다.
async function put(rec){rec=L.prepare(MakeAnnouncements.collapse(MakeAnnouncements.upgrade({...rec,updatedAt:Date.now()})),B.layouts);await store('readwrite',s=>s.put(rec));await load();}
// 드라이브에서 가져온 템플릿은 원래 id·수정 시각 그대로 넣는다(알림 없이).
async function putSynced(rec){rec=L.prepare(MakeAnnouncements.collapse(MakeAnnouncements.upgrade(rec)),B.layouts);await store('readwrite',s=>s.put(rec));await load();}
const byId=id=>records.find(r=>r.id===id)||null;
function useForMake(id){try{localStorage.setItem(LAST,id)}catch{}$('makeTemplate').value=id;$('makeTemplate').onchange();}   // 방금 만들거나 고친 템플릿을 만들기에서 바로 쓰게 한다

// 기본 디자인 (앱에 들어 있는 원본 디자인)
async function defaultDesign(){await B.useTemplate(null);return B.snapshotTemplate(false);}

// 레이아웃 마스터 덧칠(layoutMasters)을 레이아웃 자체에 합쳐서, 편집과 저장을 한 곳에서 하게 한다.
function flatten(design){
  const d=clone(design);d.layoutMasters||={};
  for(const k of Object.keys(d.layouts||{})){for(const key of ['generated:'+k,k]){if(d.layoutMasters[key]){d.layouts[k]=CaptionMasters.apply(d.layouts[k],d.layoutMasters[key]);delete d.layoutMasters[key];}}}
  return d;
}

function fillSelects(){
  for(const id of ['makeTemplate','mTemplate']){
    const sel=$(id),keep=sel.value||(id==='makeTemplate'?(()=>{try{return localStorage.getItem(LAST)||''}catch{return ''}})():draftId);
    sel.replaceChildren();
    if(id==='makeTemplate')sel.append(new Option('기본 디자인 (템플릿 없음)',''));
    for(const r of records)sel.append(new Option(r.name,r.id));
    if([...sel.options].some(o=>o.value===keep))sel.value=keep;
  }
}

function renderList(){
  const box=$('tplList');box.replaceChildren();
  if(!records.length){const p=document.createElement('p');p.className='hint';p.textContent='아직 템플릿이 없습니다. 아래에서 만들어 주세요.';box.append(p);}
  for(const r of records){
    const row=document.createElement('div');row.className='tpl';
    const name=document.createElement('b');name.textContent=r.name;
    const info=document.createElement('small');const ev=r.pair?.evidence;
    info.textContent=(r.builtin?'사이트 기본 템플릿'+(r.edited?' (고친 것)':'')+' · ':'')+(r.worship?'예배 전반 · 제목·성경본문 교체':ev?`원고-PPT 학습 · 연결 ${ev.matchedSlides}/${ev.totalSlides}장`:'기본 디자인에서 시작')+(r.fixedSlides?.length?` · 고정 슬라이드 ${r.fixedSlides.length}장`:'')+(r.announcementTemplate?` · 광고 양식 ${r.announcementTemplate.slots.length}개 (v2)`:'')+` · 레이아웃 ${L.catalog(r,B.layouts).length}개`;
    const btn=(label,fn,cls)=>{const b=document.createElement('button');b.textContent=label;if(cls)b.className=cls;b.onclick=fn;return b;};
    row.append(name,
      btn('마스터 편집',()=>{$('mTemplate').value=r.id;openMaster(r.id);showTab('master');}),
      btn('지침 수정',()=>openInstructions(r.id)),
      btn('복제 · 이름 변경',()=>duplicateTemplate(r.id)),
      btn('이름 바꾸기',async()=>{const n=prompt('새 이름',r.name);if(!n||!n.trim()||n.trim()===r.name)return;await put({...r,name:n.trim()});toast('이름을 바꿨습니다.');}),
      btn('드라이브에 저장',()=>window.dispatchEvent(new CustomEvent('make-template-upload',{detail:{id:r.id}}))),
      btn('파일로 받기',()=>exportTemplate(r)),
      btn('삭제',async()=>{if(!confirm(`"${r.name}" 템플릿을 삭제할까요? 되돌릴 수 없습니다.`))return;await store('readwrite',s=>s.delete(r.id));if(draftId===r.id){draftId='';draft=null;}await load();toast('삭제했습니다.');},'danger'),
      info);
    box.append(row);
  }
  // 다른 컴퓨터로 옮긴 템플릿 파일 가져오기
  const imp=document.createElement('label');imp.className='tpl';imp.innerHTML='<b>템플릿 파일 가져오기 (.json)</b>';
  const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
  input.onchange=async()=>{const f=input.files[0];if(!f)return;try{const rec=JSON.parse(await f.text());if(rec?.version!==1||!rec.design?.layouts)throw Error('템플릿 파일이 아닙니다.');rec.id=crypto.randomUUID();if(records.some(r=>r.name===rec.name))rec.name+=' (가져옴)';await put(rec);toast(`"${rec.name}" 템플릿을 가져왔습니다.`);}catch(e){toast(e.message,6000);}input.value='';};
  imp.append(input);box.append(imp);
}
let copyTemplateId='';
function duplicateTemplate(id){const original=byId(id);if(!original)return;copyTemplateId=id;
 const base=original.name+' 복사본';let suggested=base,n=2;while(records.some(r=>r.name===suggested))suggested=base+' '+n++;
 $('copyTemplateSource').textContent='원본: '+original.name+' · 원본과 별개로 저장합니다.';$('copyTemplateName').value=suggested;$('copyTemplateStatus').textContent='';$('copyTemplateDialog').showModal();$('copyTemplateName').focus();$('copyTemplateName').select();
}
$('copyTemplateClose').onclick=()=>$('copyTemplateDialog').close();
$('copyTemplateRun').onclick=async()=>{const original=byId(copyTemplateId),name=$('copyTemplateName').value.trim();if(!original)return;
 if(!name){status('copyTemplateStatus','복제본 이름을 넣으세요.',true);return;}if(records.some(r=>r.name===name)){status('copyTemplateStatus','같은 이름이 있습니다. 복제본은 다른 이름으로 만들어 주세요.',true);return;}
 $('copyTemplateRun').disabled=$('copyTemplateClose').disabled=true;
 try{const rec={...clone(original),id:crypto.randomUUID(),name,copiedFrom:original.id,createdAt:Date.now()};delete rec.builtin;delete rec.builtinVersion;delete rec.edited;await put(rec);useForMake(rec.id);$('mTemplate').value=rec.id;$('copyTemplateDialog').close();await openMaster(rec.id);if(draftId===rec.id)showTab('master');toast('"'+name+'" 복제본을 만들었습니다. 원본과 따로 수정할 수 있습니다.');}catch(e){status('copyTemplateStatus','복제하지 못했습니다: '+e.message,true);}
 finally{$('copyTemplateRun').disabled=$('copyTemplateClose').disabled=false;}
};
function exportTemplate(r){const blob=new Blob([JSON.stringify(MakeAnnouncements.collapse(MakeAnnouncements.upgrade(r)))],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=r.name+'_템플릿.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);}

/* ---------- 탭 ---------- */
function showTab(name){for(const b of document.querySelectorAll('.tabs button'))b.setAttribute('aria-selected',String(b.dataset.tab===name));for(const s of document.querySelectorAll('.tab'))s.hidden=s.id!=='tab-'+name;if(name==='master'&&!draft)openMaster($('mTemplate').value);}
for(const b of document.querySelectorAll('.tabs button'))b.onclick=()=>showTab(b.dataset.tab);

/* ---------- ② 템플릿 만들기 ---------- */
$('pairRun').onclick=async()=>{
  if(busy)return;const files=pairInputs.files(),pastes=pairInputs.pastes(),df=$('pairDeck').files[0];
  if(!df){status('pairStatus','완성 PPT를 고르고 원고 파일 또는 붙여넣은 글을 넣으세요.',true);return;}
  busy=true;$('pairRun').disabled=true;status('pairStatus','원고와 완성 PPT를 읽고 슬라이드를 맞춰 보는 중…');
  try{
    const rich=await MakeManuscripts.read(files,pastes,CaptionImport.manuscriptRich),parsed=await CaptionImport.deck(df);parsed.name=df.name;
    const name=$('pairName').value.trim()||stem(rich.name)+' 템플릿',scope=$('pairScope').value==='auto'?R.mode({name}):$('pairScope').value;
    let analysis,result;
    if(scope==='worship'){
      const prepared=R.prepareWorship({name,options:{},design:await defaultDesign()},parsed);
      analysis={scope:'worship',matchedSlides:0,totalSlides:parsed.slides.length,candidates:[]};
      result={...prepared,evidence:analysis,fixedSlides:[],options:{cumulative:false}};
    }else{analysis=CaptionPairTemplate.analyze(rich,parsed);result=CaptionPairTemplate.build(analysis,parsed.slides,await defaultDesign());}
    const same=records.find(r=>r.name===name);if(same&&!confirm(`"${name}" 템플릿이 이미 있습니다. 덮어쓸까요?`))throw Error('취소했습니다. 다른 이름을 넣으세요.');
    const rec={version:1,id:same?.id||crypto.randomUUID(),name,instructions:R.instructions(result.instructions,scope),options:{...DEFAULT_OPTIONS,sourceMode:scope},...(result.worship?{worship:result.worship,layoutCatalog:result.layoutCatalog}:{}),
      pair:{version:1,sources:{script:await combinedSource(rich,files),deck:await readData(df),...(files.length>1?{scriptFiles:await Promise.all(files.map(readData))}:{}),pastedScripts:pastes.filter(t=>t.trim())},evidence:result.evidence,extractedInstructions:result.instructions},fixedSlides:result.fixedSlides||[],design:flatten(result.design)};
    await put(rec);
    const learned=L.catalog(rec,B.layouts).map(e=>L.label(rec,e));
    status('pairStatus',scope==='worship'?`"${name}" 예배 전반 템플릿을 만들었습니다. 제목·성경본문 자리만 교체하며 원본 ${parsed.slides.length}장의 예배 순서를 유지합니다.`:`"${name}" 템플릿을 만들었습니다.\n원고와 연결된 슬라이드 ${analysis.matchedSlides}/${analysis.totalSlides}장 · 배운 레이아웃: ${learned.join(', ')}${rec.fixedSlides.length?`\n연결되지 않은 ${rec.fixedSlides.length}장은 고정 슬라이드로 넣었습니다.`:''}\n같은 원고를 다시 올리면 장별 원본 모양·줄바꿈·순서로 재현합니다. ③ 마스터 편집에서 다듬을 수 있습니다.`);
    useForMake(rec.id);$('mTemplate').value=rec.id;draft=null;
  }catch(e){status('pairStatus',e.message||String(e),true);}
  finally{busy=false;$('pairRun').disabled=false;}
};
$('blankRun').onclick=async()=>{
  const name=$('blankName').value.trim();if(!name){toast('템플릿 이름을 넣으세요.');return;}
  if(records.some(r=>r.name===name)){toast('같은 이름의 템플릿이 있습니다.');return;}
  const rec={version:1,id:crypto.randomUUID(),name,options:{...DEFAULT_OPTIONS},instructions:R.rule('numbered'),pair:null,fixedSlides:[],design:flatten(await defaultDesign())};
  await put(rec);useForMake(rec.id);$('blankName').value='';$('mTemplate').value=rec.id;openMaster(rec.id);showTab('master');toast(`"${name}" 템플릿을 만들었습니다. 디자인을 고친 뒤 저장하세요.`);
};

/* ---------- ③ 마스터 편집 (파워포인트 기본 편집) ---------- */
const textBase=sh=>{const p=sh?.paragraphs?.[0]||{},r=(sh?.paragraphs||[]).flatMap(p=>p.runs||[]).find(r=>r.size)||{};return {p,r};};
const plainText=sh=>(sh?.paragraphs||[]).map(p=>(p.runs||[]).map(r=>r.text||'').join('')).join('\n');
const scene=()=>draft.layouts[layoutKey],cur=()=>scene()?.shapes[shapeIx];
const isBody=i=>i===scene().bodyIndex;
// 화면을 거의 다 덮는 그림은 '배경'으로 보고 요소 목록에서 빼서 배경 그림 버튼으로만 바꾼다.
const isBg=(sh,s=scene())=>sh?.type==='image'&&(sh.background||(sh.w>=s.width*.9&&sh.h>=s.height*.9));
const firstFront=()=>{const s=scene();let i=0;while(i<s.shapes.length&&isBg(s.shapes[i],s))i++;return i;};
function shapeLabel(sh,i,s){if(i===s.bodyIndex)return '본문 글상자 (원고 글자가 들어감)';const t=plainText(sh).trim().slice(0,14);if(sh.type==='text')return `글상자 ${i+1}`+(t?` · ${t}`:'');if(sh.type==='image')return `그림 ${i+1}`+(sh.background?' (배경)':'');return ({ellipse:'원',roundRect:'둥근 사각형'}[sh.geom]||'사각형')+` ${i+1}`;}

// 되돌리기·다시 실행: 바꾸기 직전 상태를 쌓는다. 같은 칸을 연달아 고치면 한 번으로 묶는다.
let undoStack=[],redoStack=[],lastMark=0,lastKey='';
function mark(key=''){const now=Date.now();if(key&&key===lastKey&&now-lastMark<800){lastMark=now;return;}undoStack.push(JSON.stringify({layoutKey,shapeIx,layouts:draft.layouts,catalog:draftCatalog}));if(undoStack.length>100)undoStack.shift();redoStack=[];lastMark=now;lastKey=key;paintHistory();}
function restore(json){const s=JSON.parse(json);draft.layouts=s.layouts;draftCatalog=s.catalog;layoutKey=s.layoutKey;shapeIx=s.shapeIx;fillLayouts(layoutKey);dirty=true;fillShapes();preview();}
function undo(){if(!undoStack.length)return;redoStack.push(JSON.stringify({layoutKey,shapeIx,layouts:draft.layouts,catalog:draftCatalog}));restore(undoStack.pop());lastKey='';paintHistory();}
function redo(){if(!redoStack.length)return;undoStack.push(JSON.stringify({layoutKey,shapeIx,layouts:draft.layouts,catalog:draftCatalog}));restore(redoStack.pop());lastKey='';paintHistory();}
function paintHistory(){$('mUndo').disabled=!undoStack.length;$('mRedo').disabled=!redoStack.length;}

function fillLayouts(keep){
 const rec=byId(draftId),sel=$('mLayout');sel.replaceChildren();
 for(const entry of draftCatalog)sel.append(new Option(L.label(rec,entry),entry.key));
 sel.value=draftCatalog.some(e=>e.key===keep)?keep:draftCatalog[0]?.key||'';layoutKey=sel.value;
 $('mLayoutName').value=draftCatalog.find(e=>e.key===layoutKey)?.name||'';
 sel.disabled=$('mLayoutName').disabled=!draftCatalog.length;
}
async function openMaster(id){
  if(dirty&&draft&&!confirm('저장하지 않은 변경이 있습니다. 버리고 다른 템플릿을 열까요?')){$('mTemplate').value=draftId;return;}
  const keep=draftId===id?layoutKey:'';
  draftId=id||'';const rec=byId(draftId);undoStack=[];redoStack=[];paintHistory();
  const editable=rec?MakeAnnouncements.expand(rec):null;draftCatalog=editable?L.catalog(editable,B.layouts):[];fillLayouts(keep);
  if(!rec||!draftCatalog.length){draft=null;dirty=false;$('mPreview').replaceChildren();status('mStatus',records.length?'편집할 템플릿을 고르세요.':'먼저 ② 템플릿 만들기에서 템플릿을 만드세요.');return;}
  $('mTemplate').value=rec.id;draft=flatten(editable.design);dirty=false;
  shapeIx=scene().bodyIndex;fillShapes();await preview();status('mStatus','');
}
function fillShapes(){
  const s=scene(),sel=$('mShape');sel.replaceChildren();
  s.shapes.forEach((sh,i)=>{if(!isBg(sh,s))sel.append(new Option(shapeLabel(sh,i,s),i));});
  if(!s.shapes[shapeIx]||isBg(s.shapes[shapeIx],s))shapeIx=s.bodyIndex;$('mBgClear').disabled=!s.shapes.some(sh=>isBg(sh,s));sel.value=shapeIx;fillControls();
}
const hex=(c,d)=>/^#[0-9a-f]{6}$/i.test(c||'')?c:d;
function fillControls(){
  const s=scene(),sh=cur();if(!sh)return;
  $('mBg').value=hex(s.background,'#00ff00');
  $('mX').value=Math.round(sh.x);$('mY').value=Math.round(sh.y);$('mW').value=Math.round(sh.w);$('mH').value=Math.round(sh.h);
  const isText=sh.type==='text';$('mTextTools').hidden=!isText;$('mShapeTools').hidden=sh.type!=='rect';
  $('mDel').disabled=isBody(shapeIx);$('mDup').disabled=isBody(shapeIx);
  if(isText){
    const {p,r}=textBase(sh);$('mTextRow').hidden=isBody(shapeIx);$('mText').value=plainText(sh);
    $('mFont').value=r.font||'';$('mSize').value=+((r.size||p.defaultSize||32)*72/96).toFixed(3);$('mBold').checked=!!r.bold;$('mItalic').checked=!!r.italic;$('mUnder').checked=!!r.underline&&r.underline!=='none';
    $('mColor').value=hex(r.color,'#ffffff');$('mAlign').value=p.align||'center';$('mAnchor').value=sh.anchor||'t';
    $('mLine').value=p.lineSpacing?.unit==='ratio'?+p.lineSpacing.value.toFixed(2):p.lineSpacing?.unit==='px'&&r.size?+(p.lineSpacing.value/r.size).toFixed(2):1.3;
  }
  if(sh.type==='rect'){$('mGeom').value=sh.geom||'rect';$('mFill').value=hex(sh.color,'#ffffff');$('mNoFill').checked=!hex(sh.color,'');$('mLineColor').value=hex(sh.line?.color,'#000000');$('mLineWidth').value=sh.line?.width||0;}
}

// 미리보기: 실제 만들기와 같은 규칙(글꼴 너비·글상자 높이)으로 줄을 나눠 보여 준다.
let previewScene=null,previewSeq=0;
function wrapSample(text,m){const out=[];for(const para of String(text).split('\n')){let line='';for(const w of para.split(/\s+/).filter(Boolean)){const next=line?line+' '+w:w;if(line&&m.measure(next)>m.width){out.push(line);line=w;}else line=next;}if(line)out.push(line);}return out;}
async function preview(){
  if(!draft)return;const seq=++previewSeq;
  await B.useTemplate(draft);const m=B.metrics(layoutKey),lines=wrapSample($('mSample').value||'미리보기',m),shown=lines.slice(0,m.maxLines);
  const isAd=/^announcement\d+$/.test(layoutKey),s=isAd?MakeAnnouncements.preview(scene(),$('mSample').value):await B.scene(layoutKey,shown.join('\n'));
  if(seq!==previewSeq)return;previewScene=s;CaptionRender.show($('mPreview'),s,s.background||'#00ff00');outline();
  const body=scene().shapes[scene().bodyIndex],{p,r}=textBase(body),size=r.size||32,lh=size*(p.fixedLineSpacing&&p.lineSpacing?.unit==='ratio'?p.lineSpacing.value:p.fixedLineSpacing&&p.lineSpacing?.unit==='px'?p.lineSpacing.value/size:1.3),pad=body.padding||[0,0,0,0],inner=body.h-pad[0]-pad[2];
  const perLine=Math.max(1,Math.floor(m.width/m.measure('가')));
  $('mFit').textContent=isAd?'광고 전용 양식입니다. 배경·글꼴·크기·본문 위치를 저장하면 다음 광고 제작에 적용됩니다.':`이 설정이면 한 장에 ${m.maxLines}줄, 한 줄에 약 ${perLine}자 들어갑니다.`+(inner<lh?' ⚠ 글상자 높이가 글자 한 줄보다 낮아서 글자가 작게 줄어 보입니다. 높이를 키우거나 글자 크기를 줄이세요.':'')+(lines.length>m.maxLines?` (예시 문구 ${lines.length}줄 중 ${m.maxLines}줄만 이 장에 들어가고 나머지는 다음 장으로 넘어갑니다.)`:'');
}
function geometry(){const host=$('mPreview'),s=previewScene;const k=Math.min(host.clientWidth/s.width,host.clientHeight/s.height);return {k,ox:(host.clientWidth-s.width*k)/2,oy:(host.clientHeight-s.height*k)/2};}
const HANDLES=['nw','n','ne','e','se','s','sw','w'];
function outline(){
  const host=$('mPreview');for(const el of host.querySelectorAll('.pick,.hdl'))el.remove();if(!previewScene)return;
  const sh=cur();if(!sh)return;const {k,ox,oy}=geometry(),L=ox+sh.x*k,T=oy+sh.y*k,W=sh.w*k,H=sh.h*k;
  const d=document.createElement('div');d.className='pick';Object.assign(d.style,{left:L+'px',top:T+'px',width:W+'px',height:H+'px'});host.append(d);
  for(const h of HANDLES){const e=document.createElement('div');e.className='hdl';e.dataset.h=h;e.style.cursor=h+'-resize';e.style.left=L+(h.includes('w')?0:h.includes('e')?W:W/2)+'px';e.style.top=T+(h.includes('n')?0:h.includes('s')?H:H/2)+'px';host.append(e);}
}
let raf=0;function changed(){dirty=true;cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{preview();});}
function select(i){shapeIx=i;$('mShape').value=i;fillControls();outline();}

// 칸에서 고친 값 반영
function applyGeometry(){const sh=cur();if(!sh)return;mark('geo');for(const [id,k] of [['mX','x'],['mY','y'],['mW','w'],['mH','h']]){const v=parseFloat($(id).value);if(Number.isFinite(v))sh[k]=k==='w'||k==='h'?Math.max(4,v):v;}changed();}
function applyText(e){
  const sh=cur();if(!sh||sh.type!=='text')return;mark('text:'+(e?.target?.id||''));
  const {r:old}=textBase(sh),font=$('mFont').value.trim()||old.font||'Malgun Gothic',size=Number.isFinite(parseFloat($('mSize').value))?Math.max(6,parseFloat($('mSize').value))*96/72:old.size||32,line=Math.min(3,Math.max(.5,parseFloat($('mLine').value)||1.3));
  const style={font,size,bold:$('mBold').checked,italic:$('mItalic').checked,underline:$('mUnder').checked?'sng':'none'},color=$('mColor').value,align=$('mAlign').value;
  const lines=isBody(shapeIx)?null:$('mText').value.split('\n');
  const base=sh.paragraphs?.[0]||{runs:[{text:''}]};
  const paras=lines?lines.map((t,i)=>({...clone(sh.paragraphs?.[i]||base),runs:[{...(textBase(sh).r),text:t}]})):(sh.paragraphs?.length?sh.paragraphs:[base]);
  sh.paragraphs=paras.map(p=>({...p,align,defaultSize:size,lineSpacing:e?.target?.id==='mLine'?{unit:'ratio',value:line}:clone(p.lineSpacing||null),fixedLineSpacing:true,runs:(p.runs?.length?p.runs:[{text:''}]).map(r=>({...r,...style,color:(r.color||old.color)===old.color||lines?color:r.color}))}));
  sh.anchor=$('mAnchor').value;if(e?.target?.id==='mLine')sh.lineReduction=0;sh.wrap=true;
  if(lines)$('mShape').options[shapeIx].text=shapeLabel(sh,shapeIx,scene());
  changed();
}
function applyShape(){const sh=cur();if(!sh||sh.type!=='rect')return;mark('rect');sh.geom=$('mGeom').value;sh.color=$('mNoFill').checked?'':$('mFill').value;const w=Math.max(0,parseFloat($('mLineWidth').value)||0);sh.line=w?{width:w,color:$('mLineColor').value}:null;changed();}
for(const id of ['mX','mY','mW','mH'])$(id).addEventListener('input',applyGeometry);
for(const id of ['mText','mFont','mSize','mLine','mColor','mAlign','mAnchor','mBold','mItalic','mUnder'])$(id).addEventListener('input',applyText);
for(const id of ['mGeom','mFill','mNoFill','mLineColor','mLineWidth'])$(id).addEventListener('input',applyShape);
$('mBg').addEventListener('input',()=>{if(!draft)return;mark('bg');scene().background=$('mBg').value;changed();});
$('mBgImage').onchange=async()=>{const f=$('mBgImage').files[0];$('mBgImage').value='';if(!f||!draft)return;if(f.size>10*1024*1024){toast('배경 그림은 10MB 이하로 고르세요.');return;}const src=(await readData(f)).data,s=scene();mark();const i=s.shapes.findIndex(sh=>isBg(sh,s));
  if(i>=0)Object.assign(s.shapes[i],{src,x:0,y:0,w:s.width,h:s.height,background:true});else{const body=s.shapes[s.bodyIndex];s.shapes.unshift({type:'image',src,x:0,y:0,w:s.width,h:s.height,background:true});s.bodyIndex=s.shapes.indexOf(body);if(shapeIx>=0)shapeIx++;}
  fillShapes();changed();toast('이 레이아웃의 배경 그림을 바꿨습니다.');};
$('mBgClear').onclick=()=>{if(!draft)return;const s=scene(),body=s.shapes[s.bodyIndex],keep=cur();if(!s.shapes.some(sh=>isBg(sh,s)))return;mark();s.shapes=s.shapes.filter(sh=>!isBg(sh,s));s.bodyIndex=s.shapes.indexOf(body);shapeIx=Math.max(0,s.shapes.indexOf(keep));fillShapes();changed();};
$('mBgGreen').onclick=()=>{if(!draft)return;mark();scene().background='#00ff00';$('mBg').value='#00ff00';changed();};

// 넣기·복제·삭제·순서
function insert(sh){if(!draft)return;mark();const s=scene();sh.masterSlot='added:'+crypto.randomUUID();s.shapes.push(sh);fillShapes();select(s.shapes.length-1);changed();}
const box=(w,h)=>{const s=scene();return {x:Math.round((s.width-w)/2),y:Math.round((s.height-h)/2),w,h};};
$('mAddText').onclick=()=>{if(!draft)return;const b=box(Math.round(scene().width*.5),90);insert({type:'text',...b,anchor:'ctr',padding:[4,8,4,8],wrap:true,lineReduction:0,paragraphs:[{align:'center',defaultSize:40,lineSpacing:{unit:'ratio',value:1.2},fixedLineSpacing:true,runs:[{text:'글자를 입력하세요',font:'Malgun Gothic',size:40,bold:true,color:'#ffffff'}]}]});$('mText').focus();$('mText').select();};
$('mAddRect').onclick=()=>insert({type:'rect',geom:'rect',...box(300,160),color:'#1f6feb',line:null});
$('mAddRound').onclick=()=>insert({type:'rect',geom:'roundRect',...box(300,160),color:'#ffffff',line:{width:3,color:'#c08080'}});
$('mAddEllipse').onclick=()=>insert({type:'rect',geom:'ellipse',...box(200,200),color:'#ffcc00',line:null});
$('mAddImage').onchange=async()=>{const f=$('mAddImage').files[0];$('mAddImage').value='';if(!f||!draft)return;if(f.size>8*1024*1024){toast('그림은 8MB 이하로 고르세요.');return;}const src=(await readData(f)).data,img=new Image();img.src=src;await img.decode().catch(()=>{});const s=scene(),k=Math.min(1,s.width*.5/(img.naturalWidth||1),s.height*.5/(img.naturalHeight||1)),w=Math.round((img.naturalWidth||400)*k),h=Math.round((img.naturalHeight||300)*k);insert({type:'image',src,...box(w,h),manualGeometry:true});};
function duplicate(){if(!draft||isBody(shapeIx))return;const c=clone(cur());c.x+=20;c.y+=20;insert(c);}
function remove(){if(!draft||isBody(shapeIx))return;if(cur()?.background&&!confirm('배경 그림을 지울까요?'))return;mark();const s=scene(),body=s.shapes[s.bodyIndex];s.shapes.splice(shapeIx,1);s.bodyIndex=s.shapes.indexOf(body);shapeIx=s.bodyIndex;fillShapes();changed();}
function order(to){if(!draft)return;const s=scene(),n=s.shapes.length,from=shapeIx,low=firstFront(),dest=Math.max(low,Math.min(n-1,to==='front'?n-1:to==='back'?low:from+to));if(dest===from)return;mark();const body=s.shapes[s.bodyIndex],[sh]=s.shapes.splice(from,1);s.shapes.splice(dest,0,sh);s.bodyIndex=s.shapes.indexOf(body);fillShapes();select(dest);changed();}
$('mDup').onclick=duplicate;$('mDel').onclick=remove;
$('mFront').onclick=()=>order('front');$('mBack').onclick=()=>order('back');$('mForward').onclick=()=>order(1);$('mBackward').onclick=()=>order(-1);
$('mUndo').onclick=undo;$('mRedo').onclick=redo;

$('mTemplate').onchange=()=>openMaster($('mTemplate').value);
$('mLayout').onchange=async()=>{layoutKey=$('mLayout').value;$('mLayoutName').value=draftCatalog.find(e=>e.key===layoutKey)?.name||'';shapeIx=scene().bodyIndex;fillShapes();await preview();};
$('mLayoutName').onchange=()=>{
 if(!draft)return;const entry=draftCatalog.find(e=>e.key===layoutKey),name=$('mLayoutName').value.trim();
 if(!name){$('mLayoutName').value=entry.name;return;}
 if(draftCatalog.some(e=>e.key!==layoutKey&&e.name===name)){toast('이 템플릿에 같은 레이아웃 이름이 있습니다.');$('mLayoutName').value=entry.name;return;}
 if(name===entry.name)return;mark();entry.name=name;scene().layoutName=L.label(byId(draftId),entry);fillLayouts(layoutKey);changed();
};
$('mShape').onchange=()=>select(+$('mShape').value);
$('mSample').addEventListener('input',()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(preview);});
$('mSave').onclick=async()=>{$('mLayoutName').onchange();const rec=byId(draftId);if(!rec||!draft){toast('편집할 템플릿을 고르세요.');return;}await put({...rec,design:clone(draft),layoutCatalog:clone(draftCatalog),...(rec.builtin?{edited:true}:{})});useForMake(rec.id);dirty=false;status('mStatus',`"${rec.name}" 템플릿에 저장했습니다. 다음 만들기부터 이 디자인으로 나옵니다.`);};
$('mRevert').onclick=()=>{dirty=false;openMaster(draftId);};
addEventListener('resize',outline);

// 미리보기에서 누르기·끌어 옮기기·모서리로 크기 조절
(()=>{
  const host=$('mPreview');let drag=null;
  const toSlide=e=>{const rect=host.getBoundingClientRect(),{k,ox,oy}=geometry();return {x:(e.clientX-rect.left-ox)/k,y:(e.clientY-rect.top-oy)/k};};
  host.addEventListener('pointerdown',e=>{
    if(!draft||!previewScene)return;host.focus({preventScroll:true});const p=toSlide(e),shapes=scene().shapes;
    const handle=e.target.closest?.('.hdl')?.dataset.h;
    if(!handle){let hit=-1;for(let i=shapes.length-1;i>=0;i--){const sh=shapes[i];if(sh.background||sh.rotate)continue;if(sh.type==='image'&&sh.w>=previewScene.width*.9&&sh.h>=previewScene.height*.9)continue;if(p.x>=sh.x&&p.x<=sh.x+sh.w&&p.y>=sh.y&&p.y<=sh.y+sh.h){hit=i;break;}}if(hit<0)return;select(hit);}
    const sh=cur();drag={h:handle||'',sx:p.x,sy:p.y,g:{x:sh.x,y:sh.y,w:sh.w,h:sh.h},marked:false};host.setPointerCapture(e.pointerId);e.preventDefault();
  });
  host.addEventListener('pointermove',e=>{
    if(!drag)return;const p=toSlide(e),dx=p.x-drag.sx,dy=p.y-drag.sy,g=drag.g,sh=cur();
    if(!drag.marked&&Math.hypot(dx,dy)<2)return;if(!drag.marked){mark();drag.marked=true;}
    if(!drag.h){sh.x=Math.round(g.x+dx);sh.y=Math.round(g.y+dy);}
    else{let {x,y,w,h}=g;if(drag.h.includes('e'))w=g.w+dx;if(drag.h.includes('s'))h=g.h+dy;if(drag.h.includes('w')){x=g.x+dx;w=g.w-dx;}if(drag.h.includes('n')){y=g.y+dy;h=g.h-dy;}
      if(e.shiftKey&&drag.h.length===2){const r=g.w/g.h;if(w/h>r)w=h*r;else h=w/r;if(drag.h.includes('w'))x=g.x+g.w-w;if(drag.h.includes('n'))y=g.y+g.h-h;}
      if(w<10){if(drag.h.includes('w'))x-=10-w;w=10;}if(h<10){if(drag.h.includes('n'))y-=10-h;h=10;}Object.assign(sh,{x:Math.round(x),y:Math.round(y),w:Math.round(w),h:Math.round(h)});}
    $('mX').value=sh.x;$('mY').value=sh.y;$('mW').value=sh.w;$('mH').value=sh.h;dirty=true;outline();
  });
  const end=()=>{if(!drag)return;const moved=drag.marked;drag=null;if(moved)changed();};host.addEventListener('pointerup',end);host.addEventListener('pointercancel',end);
})();

// 단축키: 되돌리기·다시·복제·복사·붙여넣기·삭제·방향키 이동 (글자 칸에 입력 중일 때는 그 칸의 기본 동작)
let clipboard=null;
addEventListener('keydown',e=>{
  if($('tab-master').hidden||!draft)return;
  const typing=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)&&document.activeElement.type!=='color'&&document.activeElement.type!=='checkbox',mod=e.ctrlKey||e.metaKey,k=e.key.toLowerCase();
  if(mod&&(k==='z'||k==='y')&&!(typing&&/^(mText|mSample|mFont)$/.test(document.activeElement.id))){e.preventDefault();if(k==='y'||e.shiftKey)redo();else undo();return;}
  if(typing)return;
  if(mod&&k==='d'){e.preventDefault();duplicate();return;}
  if(mod&&k==='c'){if(!isBody(shapeIx)){clipboard=clone(cur());toast('복사했습니다.',1200);}return;}
  if(mod&&k==='v'){if(clipboard){e.preventDefault();const c=clone(clipboard);c.x+=20;c.y+=20;insert(c);}return;}
  if(k==='delete'||k==='backspace'){e.preventDefault();remove();return;}
  const step=e.shiftKey?10:1,mv={arrowleft:[-step,0],arrowright:[step,0],arrowup:[0,-step],arrowdown:[0,step]}[k];
  if(mv&&cur()){e.preventDefault();mark('nudge');cur().x+=mv[0];cur().y+=mv[1];fillControls();outline();changed();}
});
// 글꼴 목록
(()=>{const names=['마루 부리OTF 굵은','Malgun Gothic','맑은 고딕','바탕','궁서','돋움','굴림','HY견고딕','HY견명조','나눔고딕','나눔명조','나눔스퀘어','Noto Sans KR','Noto Serif KR','Pretendard','Arial'];for(const n of names){const o=document.createElement('option');o.value=n;$('mFonts').append(o);}})();

/* ---------- ① 만들기 ---------- */
function scopeHint(){const rec=byId($('makeTemplate').value),omit=R.worshipOmit(rec);if(R.mode(rec)==='spirit'){$('makeScopeHint').textContent='성령말씀: 텍스트 원고 전체를 문장별 누적 자막으로 만듭니다. 제목은 표지에 한 번만 표시합니다.';return;}$('makeScopeHint').textContent=R.mode(rec)==='worship'?'제목·성경본문만 교체합니다.'+(omit.length?' 대표기도·성가대/특송은 제외합니다.':'')+' 교독문·광고 등은 원본 PPT 내용이므로 확인해 주세요.':'등록한 같은 원고는 원본 PPT 모양과 순서로 재현합니다. 다른 주일·수요·새벽 원고는 자동 인식합니다. 여러 번호 항목이 있으면 항목별로, 없으면 파랑은 하단 2줄, 초록은 말씀·성구 화면으로 만듭니다. 둘 다 없으면 자막을 생성하지 않습니다.';}
function adaptMakeInputs(){
 const rec=byId($('makeTemplate').value),spirit=R.mode(rec)==='spirit';
 $('makePastePanel').open=spirit;
 $('makeAdsField').hidden=spirit;
 $('makeAdsHint').hidden=spirit;
 $('makeAnnouncements').disabled=spirit;
 $('makeFileField').querySelector('input').accept=spirit?'.hwp,.hwpx,.docx,.txt,.pdf':'.hwp,.hwpx,.docx,.txt';
 $('makeFileField').firstChild.textContent=spirit?'원고 파일 (PDF · HWP · HWPX · DOCX · TXT, 선택)':'원고 파일 (HWP · HWPX · DOCX · TXT, 여러 개 선택)';
}
$('makeTemplate').onchange=()=>{const rec=byId($('makeTemplate').value);try{localStorage.setItem(LAST,$('makeTemplate').value)}catch{}$('makeScope').value=R.mode(rec);scopeHint();adaptMakeInputs();};
$('makeScope').onchange=async()=>{scopeHint();const rec=byId($('makeTemplate').value);if(rec)await put({...rec,options:{...rec.options,sourceMode:$('makeScope').value,allText:false},instructions:R.instructions(rec.instructions,$('makeScope').value)});};
let observer=null;
function renderGrid(slides){
  const grid=$('makeGrid');observer?.disconnect();for(const h of grid.querySelectorAll('.host'))CaptionRender.release?.(h);grid.replaceChildren();
  observer=new IntersectionObserver(entries=>{for(const en of entries)if(en.isIntersecting){const h=en.target;observer.unobserve(h);CaptionRender.show(h,slides[+h.dataset.i]);}},{rootMargin:'300px'});
  slides.forEach((s,i)=>{const t=document.createElement('div');t.className='thumb'+(i===selected?' selected':'');const n=document.createElement('small');n.textContent=i+1;const h=document.createElement('div');h.className='host';h.dataset.i=i;
    const e=document.createElement('button');e.type='button';e.className='thumb-edit';e.textContent='편집';e.onclick=ev=>{ev.stopPropagation();selected=i;markSelected();CaptionEditor.open(i);};
    t.onclick=()=>{selected=i;markSelected();};t.ondblclick=()=>CaptionEditor.open(i);
    t.append(n,h,e);grid.append(t);observer.observe(h);});
}
function markSelected(){[...$('makeGrid').children].forEach((t,i)=>t.classList.toggle('selected',i===selected));}
$('makeRun').onclick=async()=>{
  if(busy)return;
  busy=true;$('makeRun').disabled=true;$('makeDownload').disabled=true;status('makeStatus','원고를 읽고 PPT를 만드는 중…');
  try{
    let rec=byId($('makeTemplate').value);const rich=await makeInputs.read(CaptionImport.manuscriptRich);
    const project={lines:rich.lines,richLines:rich.richLines,scriptName:rich.name,slides:[],links:[]};
    const opts={title:$('makeTitle').value.trim(),date:$('makeDate').value.trim(),announcements:R.mode(rec)==='spirit'?'':$('makeAnnouncements').value};
    const woven=await MakePptEngine.generate(project,rec,opts);rec=woven.record;const summary=woven.summary||'원고를 자동 인식했습니다.';
    if(rec?.worship&&!byId(rec.id)?.worship){await put(rec);$('mTemplate').value=rec.id;draft=null;dirty=false;}
    // 편집 중 장면 좌표는 유지하고, 다운로드 크기는 공통 엔진의 결과를 따른다.
    deck={...project,announcements:woven.announcements,slides:woven.slides,links:woven.links,deckName:stem(rich.name)+'_자막.pptx',generationTemplate:rec?structuredClone(rec):null,exportSize:woven.exportSize||{width:1920,height:1080}};deckTemplate=rec?.design||null;deckTemplateRec=rec||null;selected=-1;
    renderGrid(deck.slides);$('makeDownload').disabled=false;$('makeToLive').disabled=false;$('makeEditTools').hidden=false;
    status('makeStatus',`${deck.slides.length}장을 만들었습니다${rec?` (템플릿: ${rec.name})`:''}. ${summary}. 확인 후 PPTX 다운로드를 누르세요.`);
  }catch(e){status('makeStatus',e.message||String(e),true);}
  finally{busy=false;$('makeRun').disabled=false;$('makeDownload').disabled=!deck;$('makeToLive').disabled=!deck;}
};
$('makeDownload').onclick=async()=>{
  if(!deck||busy)return;busy=true;$('makeDownload').disabled=true;status('makeStatus','PPTX 파일을 만드는 중…');
  try{const out=structuredClone(deck);CaptionSize.unify(out.slides,deck.exportSize?.width||1920,deck.exportSize?.height||1080);const blob=await CaptionPptx.create(out),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=deck.deckName;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000);status('makeStatus',`${deck.deckName} 를 받았습니다.`);}
  catch(e){status('makeStatus',e.message||String(e),true);}
  finally{busy=false;$('makeDownload').disabled=false;}
};

/* ---------- 예배 PPT(방송용 PPT)로 전환 ----------
   방송용 PPT는 열 때 이 기기 저장소(IndexedDB 'prom-ppt-caption' · projects · 'last')의 작업을 불러온다. 지금 만든 덱(고친 내용 포함)·원고·연결·템플릿을
   그 형식으로 써 넣고 방송용 PPT를 열면 그대로 이어진다. 방송용 PPT에 저장돼 있던 작업이 있으면 먼저 묻고, 덮어쓰기 전에 'beforeMake'로 한 벌 보관한다. */
const LIVE_DB='prom-ppt-caption';
function liveDb(){return new Promise((ok,no)=>{const r=indexedDB.open(LIVE_DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('projects');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});}
function liveReq(db,mode,fn){return new Promise((ok,no)=>{const tx=db.transaction('projects',mode),r=fn(tx.objectStore('projects'));tx.oncomplete=()=>ok(r?.result);tx.onerror=()=>no(tx.error);tx.onabort=()=>no(tx.error);});}
// 방송용 PPT의 저장 방식(같은 그림은 한 번만)과 같게 묶는다
function packLive(value){const p=structuredClone(value),assets={},seen=new Map();for(const slide of p.slides)for(const shape of slide.shapes||[])if(shape.type==='image'&&/^data:image\//.test(shape.src||'')){let key=seen.get(shape.src);if(!key){key='image'+seen.size;seen.set(shape.src,key);assets[key]=shape.src;}shape.src='@prom:'+key;}if(seen.size)p.assets=assets;return p;}
$('makeToLive').onclick=async()=>{
  if(!deck||busy){toast('먼저 PPT를 만드세요.');return;}
  busy=true;$('makeToLive').disabled=true;status('makeStatus','방송용 PPT로 넘기는 중…');
  let db;
  try{
    db=await liveDb();
    const old=await liveReq(db,'readonly',s=>s.get('last'));
    if(old&&(old.slides?.length||old.lines?.length||old.standby)){
      const label=(old.scriptName||old.deckName||'이름 없는 작업')+` · 자막 ${old.slides?.length||0}장`;
      if(!confirm(`방송용 PPT에 이 기기에 저장된 작업이 있습니다(${label}).
지금 만든 PPT로 바꿀까요? 이전 작업은 이 기기에 한 벌 보관해 둡니다.`)){status('makeStatus','넘기기를 취소했습니다.');return;}
      // 백업과 새 작업 저장은 아래의 한 트랜잭션에서 함께 처리한다.
    }
    const project={version:1,lines:deck.lines,richLines:deck.richLines,scriptName:deck.scriptName||'',deckName:deck.deckName||'',slides:structuredClone(deck.slides),links:structuredClone(deck.links),layoutMasters:{},
      generationTemplate:deckTemplateRec?structuredClone(deckTemplateRec):null,announcements:deck.announcements||'',
      exportSize:structuredClone(deck.exportSize||{width:1920,height:1080})};   // 동일 원고 재현은 원본 크기도 유지
    const stamp=crypto.randomUUID(),packed=packLive({...project,makeTransferId:stamp});
    await new Promise((ok,no)=>{const tx=db.transaction('projects','readwrite'),store=tx.objectStore('projects'),r=store.get('last');
      r.onsuccess=()=>{const previous=r.result;if(previous&&(previous.slides?.length||previous.lines?.length||previous.standby))store.put(previous,'beforeMake');store.put(packed,'last');};
      tx.oncomplete=ok;tx.onerror=()=>no(tx.error);tx.onabort=()=>no(tx.error);
    });
    try{localStorage.setItem('prom-ppt-make-transfer',stamp);}catch{}
    status('makeStatus','편집 내용과 원고 연결을 저장했습니다. 방송용 PPT를 엽니다.');
    window.location.assign('../ppt/?from=make');
  }catch(e){status('makeStatus','넘기지 못했습니다: '+(e.message||e)+' (저장 공간이 부족할 수 있습니다)',true);}
  finally{try{db?.close()}catch(_){}busy=false;$('makeToLive').disabled=false;}
};

/* ---------- 지침 수정 창 ---------- */
// 템플릿에 붙은 지침 글(rec.instructions)을 고친다. 사이트 기본 템플릿을 고치면 edited 표시를 남겨 다시 덮어쓰지 않게 한다(마스터 편집 저장과 같은 방식).
let instrId='';
function instrCount(){const n=$('instrText').value.length;$('instrCount').textContent=n.toLocaleString('ko-KR')+'자';}
function openInstructions(id){
  const rec=byId(id);if(!rec){toast('지침을 고칠 템플릿을 고르세요.');return;}
  instrId=id;$('instrTitle').textContent=`"${rec.name}" 지침 수정`;$('instrText').value=rec.instructions||'';$('instrBuiltinNote').hidden=!rec.builtin;instrCount();
  if(!$('instructionsDialog').open)$('instructionsDialog').showModal();$('instrText').focus();
}
$('instrText').addEventListener('input',instrCount);
$('instrClose').onclick=$('instrCancel').onclick=()=>$('instructionsDialog').close();
$('instrSave').onclick=async()=>{const rec=byId(instrId);if(!rec){$('instructionsDialog').close();return;}await put({...rec,instructions:$('instrText').value,...(rec.builtin?{edited:true}:{})});$('instructionsDialog').close();toast('지침을 저장했습니다.');};
$('mInstructions').onclick=()=>openInstructions($('mTemplate').value);

/* ---------- 슬라이드 편집 창 연결 ----------
   방송용 PPT의 편집 창(ppt/editor.js)을 그대로 쓰되, 그 창이 기대하는 작업 공간(CaptionWorkspace)과 템플릿 도우미(CaptionRecipes)를
   만들기 화면의 덱에 맞춰 대신 만들어 준다. 원고 연결 구간·누적 표시처럼 방송용에만 필요한 칸은 화면에서 숨긴다. */
window.CaptionWorkspace={
  snapshot(){if(!deck)throw Error('먼저 PPT를 만드세요.');return structuredClone(deck);},
  apply(slides,links,opts={}){deck={...deck,slides,links,...(opts.deckName?{deckName:opts.deckName}:{})};if(Number.isInteger(opts.selected))selected=Math.max(-1,Math.min(opts.selected,slides.length-1));renderGrid(deck.slides);if(opts.message)toast(opts.message,5000);},
  selected:()=>selected,
  message:text=>toast(String(text).replace(/\s*복제한 자막의 원고 연결 구간을 지정하세요\./,''),5000),   // 방송용 PPT 전용 안내(원고 연결 구간)는 이 화면에 없다
  prepareEdit(){},rememberRich(){},
  rows:()=>deck?CaptionCore.segments(deck.lines,deck.links):[],
  currentRange:()=>null
};
window.CaptionRecipes={sync:async()=>{await B.useTemplate(deckTemplate);},setMode(){},open:async()=>{},remember:async()=>{},withFixed:r=>r};
$('makeEditSelected').onclick=()=>{if(selected<0||!deck?.slides[selected]){toast('편집할 슬라이드를 먼저 누르세요.');return;}CaptionEditor.open(selected);};
$('makeAddCaption').onclick=()=>CaptionEditor.open(-1);

/* ---------- 시작 ---------- */
load().then(()=>$('makeTemplate').onchange()).catch(e=>toast('템플릿 보관함을 열지 못했습니다: '+e.message,6000));
window.PromMake={load,openMaster,get deck(){return deck},get draft(){return draft},records:()=>records.slice(),get:byId,putSynced,toast};
})();
