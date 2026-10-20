// PPT 자동 제작 화면: 템플릿 보관(방송용 PPT 앱과 같은 보관함), 원고+완성 PPT로 템플릿 학습, 마스터 레이아웃 편집, 원고로 PPT 만들기
(()=>{
'use strict';
const $=id=>document.getElementById(id),B=CaptionBuilder,clone=x=>structuredClone(x);
const DB='prom-ppt-generation-templates',LAST='promMakeTemplate';
const DEFAULT_OPTIONS={title:'',date:'',greenLayout:'word',cumulative:true,allText:false};
let records=[],busy=false,deck=null,draft=null,draftId='',layoutKey='caption',shapeIx=0,dirty=false;

/* ---------- 공통 ---------- */
let toastTimer;
function toast(msg,ms=3500){const t=$('toast');t.textContent=msg;t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.hidden=true,ms);}
function status(id,msg,error=false){const s=$(id);s.textContent=msg||'';s.classList.toggle('error',!!error);}
const stem=name=>String(name||'').replace(/\.[^.]+$/,'');
function readData(file){return new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok({name:file.name,data:r.result});r.onerror=()=>no(Error('파일을 읽지 못했습니다.'));r.readAsDataURL(file);});}

/* ---------- 템플릿 보관함 (IndexedDB, 방송용 PPT 앱과 공유) ---------- */
let dbp;
function db(){return dbp||(dbp=new Promise((ok,no)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('templates',{keyPath:'id'});r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);}));}
async function store(mode,fn){const d=await db();return new Promise((ok,no)=>{const tx=d.transaction('templates',mode),req=fn(tx.objectStore('templates'));tx.oncomplete=()=>ok(req?.result);tx.onerror=()=>no(tx.error);});}
async function load(){records=(await store('readonly',s=>s.getAll())||[]).sort((a,b)=>String(a.name).localeCompare(String(b.name),'ko'));fillSelects();renderList();}
async function put(rec){await store('readwrite',s=>s.put(rec));await load();}
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
    info.textContent=(ev?`원고-PPT 학습 · 연결 ${ev.matchedSlides}/${ev.totalSlides}장`:'기본 디자인에서 시작')+(r.fixedSlides?.length?` · 고정 슬라이드 ${r.fixedSlides.length}장`:'')+` · 레이아웃 ${Object.keys(r.design?.layouts||{}).length}개`;
    const btn=(label,fn,cls)=>{const b=document.createElement('button');b.textContent=label;if(cls)b.className=cls;b.onclick=fn;return b;};
    row.append(name,
      btn('마스터 편집',()=>{$('mTemplate').value=r.id;openMaster(r.id);showTab('master');}),
      btn('이름 바꾸기',async()=>{const n=prompt('새 이름',r.name);if(!n||!n.trim()||n.trim()===r.name)return;await put({...r,name:n.trim()});toast('이름을 바꿨습니다.');}),
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
function exportTemplate(r){const blob=new Blob([JSON.stringify(r)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=r.name+'_템플릿.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);}

/* ---------- 탭 ---------- */
function showTab(name){for(const b of document.querySelectorAll('.tabs button'))b.setAttribute('aria-selected',String(b.dataset.tab===name));for(const s of document.querySelectorAll('.tab'))s.hidden=s.id!=='tab-'+name;if(name==='master'&&!draft)openMaster($('mTemplate').value);}
for(const b of document.querySelectorAll('.tabs button'))b.onclick=()=>showTab(b.dataset.tab);

/* ---------- ② 템플릿 만들기 ---------- */
$('pairRun').onclick=async()=>{
  if(busy)return;const sf=$('pairScript').files[0],df=$('pairDeck').files[0];
  if(!sf||!df){status('pairStatus','한글 원고와 완성 PPT를 둘 다 고르세요.',true);return;}
  busy=true;$('pairRun').disabled=true;status('pairStatus','두 파일을 읽고 원고와 슬라이드를 맞춰 보는 중…');
  try{
    const rich=await CaptionImport.manuscriptRich(sf),parsed=await CaptionImport.deck(df);rich.name=sf.name;parsed.name=df.name;
    const analysis=CaptionPairTemplate.analyze(rich,parsed);
    if(!analysis.candidates.length)throw Error('원고와 정확히 연결되는 슬라이드를 찾지 못했습니다. 같은 설교의 원고와 PPT인지 확인하세요.');
    const result=CaptionPairTemplate.build(analysis,parsed.slides,await defaultDesign());
    const name=$('pairName').value.trim()||stem(sf.name)+' 템플릿';
    const same=records.find(r=>r.name===name);if(same&&!confirm(`"${name}" 템플릿이 이미 있습니다. 덮어쓸까요?`))throw Error('취소했습니다. 다른 이름을 넣으세요.');
    const rec={version:1,id:same?.id||crypto.randomUUID(),name,instructions:result.instructions,options:{...DEFAULT_OPTIONS,cumulative:result.options?.cumulative??true},
      pair:{version:1,sources:{script:await readData(sf),deck:await readData(df)},evidence:result.evidence,extractedInstructions:result.instructions},fixedSlides:result.fixedSlides||[],design:flatten(result.design)};
    await put(rec);
    const learned=[...new Set(analysis.candidates.map(c=>B.layouts[c.layout]||c.layout))];
    status('pairStatus',`"${name}" 템플릿을 만들었습니다.\n원고와 연결된 슬라이드 ${analysis.matchedSlides}/${analysis.totalSlides}장 · 배운 레이아웃: ${learned.join(', ')}${rec.fixedSlides.length?`\n연결되지 않은 ${rec.fixedSlides.length}장은 고정 슬라이드로 넣었습니다.`:''}\n③ 마스터 편집에서 다듬을 수 있습니다.`);
    useForMake(rec.id);$('mTemplate').value=rec.id;draft=null;
  }catch(e){status('pairStatus',e.message||String(e),true);}
  finally{busy=false;$('pairRun').disabled=false;}
};
$('blankRun').onclick=async()=>{
  const name=$('blankName').value.trim();if(!name){toast('템플릿 이름을 넣으세요.');return;}
  if(records.some(r=>r.name===name)){toast('같은 이름의 템플릿이 있습니다.');return;}
  const rec={version:1,id:crypto.randomUUID(),name,options:{...DEFAULT_OPTIONS},pair:null,fixedSlides:[],design:flatten(await defaultDesign())};
  await put(rec);useForMake(rec.id);$('blankName').value='';$('mTemplate').value=rec.id;openMaster(rec.id);showTab('master');toast(`"${name}" 템플릿을 만들었습니다. 디자인을 고친 뒤 저장하세요.`);
};

/* ---------- ③ 마스터 편집 (파워포인트 기본 편집) ---------- */
const textBase=sh=>{const p=sh?.paragraphs?.[0]||{},r=(sh?.paragraphs||[]).flatMap(p=>p.runs||[]).find(r=>r.size)||{};return {p,r};};
const plainText=sh=>(sh?.paragraphs||[]).map(p=>(p.runs||[]).map(r=>r.text||'').join('')).join('\n');
const scene=()=>draft.layouts[layoutKey],cur=()=>scene()?.shapes[shapeIx];
const isBody=i=>i===scene().bodyIndex;
function shapeLabel(sh,i,s){if(i===s.bodyIndex)return '본문 글상자 (원고 글자가 들어감)';const t=plainText(sh).trim().slice(0,14);if(sh.type==='text')return `글상자 ${i+1}`+(t?` · ${t}`:'');if(sh.type==='image')return `그림 ${i+1}`+(sh.background?' (배경)':'');return ({ellipse:'원',roundRect:'둥근 사각형'}[sh.geom]||'사각형')+` ${i+1}`;}

// 되돌리기·다시 실행: 바꾸기 직전 상태를 쌓는다. 같은 칸을 연달아 고치면 한 번으로 묶는다.
let undoStack=[],redoStack=[],lastMark=0,lastKey='';
function mark(key=''){const now=Date.now();if(key&&key===lastKey&&now-lastMark<800){lastMark=now;return;}undoStack.push(JSON.stringify({layoutKey,shapeIx,layouts:draft.layouts}));if(undoStack.length>100)undoStack.shift();redoStack=[];lastMark=now;lastKey=key;paintHistory();}
function restore(json){const s=JSON.parse(json);draft.layouts=s.layouts;layoutKey=s.layoutKey;shapeIx=s.shapeIx;$('mLayout').value=layoutKey;dirty=true;fillShapes();preview();}
function undo(){if(!undoStack.length)return;redoStack.push(JSON.stringify({layoutKey,shapeIx,layouts:draft.layouts}));restore(undoStack.pop());lastKey='';paintHistory();}
function redo(){if(!redoStack.length)return;undoStack.push(JSON.stringify({layoutKey,shapeIx,layouts:draft.layouts}));restore(redoStack.pop());lastKey='';paintHistory();}
function paintHistory(){$('mUndo').disabled=!undoStack.length;$('mRedo').disabled=!redoStack.length;}

async function openMaster(id){
  if(dirty&&draft&&!confirm('저장하지 않은 변경이 있습니다. 버리고 다른 템플릿을 열까요?')){$('mTemplate').value=draftId;return;}
  draftId=id||'';const rec=byId(draftId);undoStack=[];redoStack=[];paintHistory();
  if(!rec){draft=null;$('mPreview').replaceChildren();status('mStatus',records.length?'편집할 템플릿을 고르세요.':'먼저 ② 템플릿에서 템플릿을 만드세요.');return;}
  draft=flatten(rec.design);dirty=false;
  const sel=$('mLayout'),keep=sel.value||layoutKey;sel.replaceChildren();
  for(const k of Object.keys(B.layouts))if(draft.layouts[k])sel.append(new Option(B.layouts[k],k));
  sel.value=[...sel.options].some(o=>o.value===keep)?keep:'caption';layoutKey=sel.value;
  shapeIx=scene().bodyIndex;fillShapes();await preview();status('mStatus','');
}
function fillShapes(){
  const s=scene(),sel=$('mShape');sel.replaceChildren();
  s.shapes.forEach((sh,i)=>sel.append(new Option(shapeLabel(sh,i,s),i)));
  if(!s.shapes[shapeIx])shapeIx=s.bodyIndex;sel.value=shapeIx;fillControls();
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
    $('mFont').value=r.font||'';$('mSize').value=+(r.size||p.defaultSize||32).toFixed(1);$('mBold').checked=!!r.bold;$('mItalic').checked=!!r.italic;$('mUnder').checked=!!r.underline&&r.underline!=='none';
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
  const s=await B.scene(layoutKey,shown.join('\n'));
  if(seq!==previewSeq)return;previewScene=s;CaptionRender.show($('mPreview'),s,s.background||'#00ff00');outline();
  const body=scene().shapes[scene().bodyIndex],{p,r}=textBase(body),size=r.size||32,lh=size*(p.fixedLineSpacing&&p.lineSpacing?.unit==='ratio'?p.lineSpacing.value:p.fixedLineSpacing&&p.lineSpacing?.unit==='px'?p.lineSpacing.value/size:1.3),pad=body.padding||[0,0,0,0],inner=body.h-pad[0]-pad[2];
  const perLine=Math.max(1,Math.floor(m.width/m.measure('가')));
  $('mFit').textContent=`이 설정이면 한 장에 ${m.maxLines}줄, 한 줄에 약 ${perLine}자 들어갑니다.`+(inner<lh?' ⚠ 글상자 높이가 글자 한 줄보다 낮아서 글자가 작게 줄어 보입니다. 높이를 키우거나 글자 크기를 줄이세요.':'')+(lines.length>m.maxLines?` (예시 문구 ${lines.length}줄 중 ${m.maxLines}줄만 이 장에 들어가고 나머지는 다음 장으로 넘어갑니다.)`:'');
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
  const {r:old}=textBase(sh),font=$('mFont').value.trim()||old.font||'Malgun Gothic',size=Math.max(6,parseFloat($('mSize').value)||old.size||32),line=Math.min(3,Math.max(.5,parseFloat($('mLine').value)||1.3));
  const style={font,size,bold:$('mBold').checked,italic:$('mItalic').checked,underline:$('mUnder').checked?'sng':'none'},color=$('mColor').value,align=$('mAlign').value;
  const lines=isBody(shapeIx)?null:$('mText').value.split('\n');
  const base=sh.paragraphs?.[0]||{runs:[{text:''}]};
  const paras=lines?lines.map((t,i)=>({...clone(sh.paragraphs?.[i]||base),runs:[{...(textBase(sh).r),text:t}]})):(sh.paragraphs?.length?sh.paragraphs:[base]);
  sh.paragraphs=paras.map(p=>({...p,align,defaultSize:size,lineSpacing:{unit:'ratio',value:line},fixedLineSpacing:true,runs:(p.runs?.length?p.runs:[{text:''}]).map(r=>({...r,...style,color:(r.color||old.color)===old.color||lines?color:r.color}))}));
  sh.anchor=$('mAnchor').value;sh.lineReduction=0;sh.wrap=true;
  if(lines)$('mShape').options[shapeIx].text=shapeLabel(sh,shapeIx,scene());
  changed();
}
function applyShape(){const sh=cur();if(!sh||sh.type!=='rect')return;mark('rect');sh.geom=$('mGeom').value;sh.color=$('mNoFill').checked?'':$('mFill').value;const w=Math.max(0,parseFloat($('mLineWidth').value)||0);sh.line=w?{width:w,color:$('mLineColor').value}:null;changed();}
for(const id of ['mX','mY','mW','mH'])$(id).addEventListener('input',applyGeometry);
for(const id of ['mText','mFont','mSize','mLine','mColor','mAlign','mAnchor','mBold','mItalic','mUnder'])$(id).addEventListener('input',applyText);
for(const id of ['mGeom','mFill','mNoFill','mLineColor','mLineWidth'])$(id).addEventListener('input',applyShape);
$('mBg').addEventListener('input',()=>{if(!draft)return;mark('bg');scene().background=$('mBg').value;changed();});
$('mBgGreen').onclick=()=>{if(!draft)return;mark();scene().background='#00ff00';$('mBg').value='#00ff00';changed();};

// 넣기·복제·삭제·순서
function insert(sh){if(!draft)return;mark();const s=scene();s.shapes.push(sh);fillShapes();select(s.shapes.length-1);changed();}
const box=(w,h)=>{const s=scene();return {x:Math.round((s.width-w)/2),y:Math.round((s.height-h)/2),w,h};};
$('mAddText').onclick=()=>{if(!draft)return;const b=box(Math.round(scene().width*.5),90);insert({type:'text',...b,anchor:'ctr',padding:[4,8,4,8],wrap:true,lineReduction:0,paragraphs:[{align:'center',defaultSize:40,lineSpacing:{unit:'ratio',value:1.2},fixedLineSpacing:true,runs:[{text:'글자를 입력하세요',font:'Malgun Gothic',size:40,bold:true,color:'#ffffff'}]}]});$('mText').focus();$('mText').select();};
$('mAddRect').onclick=()=>insert({type:'rect',geom:'rect',...box(300,160),color:'#1f6feb',line:null});
$('mAddRound').onclick=()=>insert({type:'rect',geom:'roundRect',...box(300,160),color:'#ffffff',line:{width:3,color:'#c08080'}});
$('mAddEllipse').onclick=()=>insert({type:'rect',geom:'ellipse',...box(200,200),color:'#ffcc00',line:null});
$('mAddImage').onchange=async()=>{const f=$('mAddImage').files[0];$('mAddImage').value='';if(!f||!draft)return;if(f.size>8*1024*1024){toast('그림은 8MB 이하로 고르세요.');return;}const src=(await readData(f)).data,img=new Image();img.src=src;await img.decode().catch(()=>{});const s=scene(),k=Math.min(1,s.width*.5/(img.naturalWidth||1),s.height*.5/(img.naturalHeight||1)),w=Math.round((img.naturalWidth||400)*k),h=Math.round((img.naturalHeight||300)*k);insert({type:'image',src,...box(w,h),manualGeometry:true});};
function duplicate(){if(!draft||isBody(shapeIx))return;const c=clone(cur());c.x+=20;c.y+=20;insert(c);}
function remove(){if(!draft||isBody(shapeIx))return;if(cur()?.background&&!confirm('배경 그림을 지울까요?'))return;mark();const s=scene(),body=s.shapes[s.bodyIndex];s.shapes.splice(shapeIx,1);s.bodyIndex=s.shapes.indexOf(body);shapeIx=s.bodyIndex;fillShapes();changed();}
function order(to){if(!draft)return;const s=scene(),n=s.shapes.length,from=shapeIx,dest=Math.max(0,Math.min(n-1,to==='front'?n-1:to==='back'?0:from+to));if(dest===from)return;mark();const body=s.shapes[s.bodyIndex],[sh]=s.shapes.splice(from,1);s.shapes.splice(dest,0,sh);s.bodyIndex=s.shapes.indexOf(body);fillShapes();select(dest);changed();}
$('mDup').onclick=duplicate;$('mDel').onclick=remove;
$('mFront').onclick=()=>order('front');$('mBack').onclick=()=>order('back');$('mForward').onclick=()=>order(1);$('mBackward').onclick=()=>order(-1);
$('mUndo').onclick=undo;$('mRedo').onclick=redo;

$('mTemplate').onchange=()=>openMaster($('mTemplate').value);
$('mLayout').onchange=async()=>{layoutKey=$('mLayout').value;shapeIx=scene().bodyIndex;fillShapes();await preview();};
$('mShape').onchange=()=>select(+$('mShape').value);
$('mSample').addEventListener('input',()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(preview);});
$('mSave').onclick=async()=>{const rec=byId(draftId);if(!rec||!draft){toast('편집할 템플릿을 고르세요.');return;}await put({...rec,design:clone(draft)});useForMake(rec.id);dirty=false;status('mStatus',`"${rec.name}" 템플릿에 저장했습니다. 다음 만들기부터 이 디자인으로 나옵니다.`);};
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
$('makeTemplate').onchange=()=>{const rec=byId($('makeTemplate').value);try{localStorage.setItem(LAST,$('makeTemplate').value)}catch{}const o={...DEFAULT_OPTIONS,...(rec?.options||{})};$('makeGreen').value=o.greenLayout;$('makeCumulative').checked=o.cumulative;$('makeAll').checked=o.allText;};
let observer=null;
function renderGrid(slides){
  const grid=$('makeGrid');observer?.disconnect();for(const h of grid.querySelectorAll('.host'))CaptionRender.release?.(h);grid.replaceChildren();
  observer=new IntersectionObserver(entries=>{for(const en of entries)if(en.isIntersecting){const h=en.target;observer.unobserve(h);CaptionRender.show(h,slides[+h.dataset.i]);}},{rootMargin:'300px'});
  slides.forEach((s,i)=>{const t=document.createElement('div');t.className='thumb';const n=document.createElement('small');n.textContent=i+1;const h=document.createElement('div');h.className='host';h.dataset.i=i;t.append(n,h);grid.append(t);observer.observe(h);});
}
$('makeRun').onclick=async()=>{
  if(busy)return;const f=$('makeScript').files[0];if(!f){status('makeStatus','원고 파일을 고르세요.',true);return;}
  busy=true;$('makeRun').disabled=true;$('makeDownload').disabled=true;status('makeStatus','원고를 읽고 PPT를 만드는 중…');
  try{
    const rec=byId($('makeTemplate').value),rich=await CaptionImport.manuscriptRich(f);
    const project={lines:rich.lines,richLines:rich.richLines,scriptName:f.name,slides:[],links:[]};
    await B.useTemplate(rec?.design||null);
    const opts={allText:$('makeAll').checked,cumulative:$('makeCumulative').checked,greenLayout:$('makeGreen').value,title:$('makeTitle').value.trim(),date:$('makeDate').value.trim()};
    let result;
    try{result=await B.generate(project,opts);}
    catch(e){if(!opts.allText&&/찾지 못했습니다/.test(e.message)){result=await B.generate(project,{...opts,allText:true});$('makeAll').checked=true;toast('원고에 색 표시가 없어 원고 전체로 만들었습니다.',5000);}else throw e;}
    const woven=rec?.fixedSlides?.length?CaptionPairTemplate.weave(rec.fixedSlides,result.slides,result.links):result;
    deck={...project,slides:woven.slides,links:woven.links,deckName:stem(f.name)+'_자막.pptx'};
    renderGrid(deck.slides);$('makeDownload').disabled=false;
    status('makeStatus',`${deck.slides.length}장을 만들었습니다${rec?` (템플릿: ${rec.name})`:''}. 확인 후 PPTX 다운로드를 누르세요.`);
  }catch(e){status('makeStatus',e.message||String(e),true);}
  finally{busy=false;$('makeRun').disabled=false;}
};
$('makeDownload').onclick=async()=>{
  if(!deck||busy)return;busy=true;$('makeDownload').disabled=true;status('makeStatus','PPTX 파일을 만드는 중…');
  try{const blob=await CaptionPptx.create(deck),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=deck.deckName;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000);status('makeStatus',`${deck.deckName} 를 받았습니다.`);}
  catch(e){status('makeStatus',e.message||String(e),true);}
  finally{busy=false;$('makeDownload').disabled=false;}
};

/* ---------- 시작 ---------- */
load().then(()=>$('makeTemplate').onchange()).catch(e=>toast('템플릿 보관함을 열지 못했습니다: '+e.message,6000));
window.PromMake={load,openMaster,get deck(){return deck},get draft(){return draft}};
})();
