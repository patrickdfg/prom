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

/* ---------- ③ 마스터 편집 ---------- */
const textBase=sh=>{const p=sh?.paragraphs?.[0]||{},r=(sh?.paragraphs||[]).flatMap(p=>p.runs||[]).find(r=>r.size)||{};return {p,r};};
function shapeLabel(sh,i,s){if(i===s.bodyIndex)return `본문 글상자 (원고 글자가 들어감)`;if(sh.type==='text')return `글상자 ${i+1}`;if(sh.type==='image')return `그림 ${i+1}`+(sh.background?' (배경)':'');return `도형 ${i+1}`;}
async function openMaster(id){
  if(dirty&&draft&&!confirm('저장하지 않은 변경이 있습니다. 버리고 다른 템플릿을 열까요?')){$('mTemplate').value=draftId;return;}
  draftId=id||'';const rec=byId(draftId);
  if(!rec){draft=null;$('mPreview').replaceChildren();status('mStatus',records.length?'편집할 템플릿을 고르세요.':'먼저 ② 템플릿에서 템플릿을 만드세요.');return;}
  draft=flatten(rec.design);dirty=false;
  const sel=$('mLayout'),keep=sel.value||layoutKey;sel.replaceChildren();
  for(const k of Object.keys(B.layouts))if(draft.layouts[k])sel.append(new Option(B.layouts[k],k));
  sel.value=[...sel.options].some(o=>o.value===keep)?keep:'caption';layoutKey=sel.value;
  shapeIx=draft.layouts[layoutKey].bodyIndex;fillShapes();await preview();status('mStatus','');
}
function fillShapes(){
  const s=draft.layouts[layoutKey],sel=$('mShape');sel.replaceChildren();
  s.shapes.forEach((sh,i)=>sel.append(new Option(shapeLabel(sh,i,s),i)));
  if(!s.shapes[shapeIx])shapeIx=s.bodyIndex;sel.value=shapeIx;fillControls();
}
function fillControls(){
  const sh=draft.layouts[layoutKey].shapes[shapeIx];if(!sh)return;
  $('mX').value=Math.round(sh.x);$('mY').value=Math.round(sh.y);$('mW').value=Math.round(sh.w);$('mH').value=Math.round(sh.h);
  const isText=sh.type==='text';$('mTextTools').hidden=!isText;
  if(isText){const {p,r}=textBase(sh);$('mFont').value=r.font||'';$('mSize').value=+(r.size||32).toFixed(1);$('mBold').checked=!!r.bold;$('mColor').value=/^#[0-9a-f]{6}$/i.test(r.color||'')?r.color:'#ffffff';$('mAlign').value=p.align||'center';$('mLine').value=p.lineSpacing?.unit==='ratio'?+p.lineSpacing.value.toFixed(2):p.lineSpacing?.unit==='px'&&r.size?+(p.lineSpacing.value/r.size).toFixed(2):1.3;}
}
let previewScene=null,previewSeq=0;
async function preview(){
  if(!draft)return;const seq=++previewSeq;
  await B.useTemplate(draft);const s=await B.scene(layoutKey,$('mSample').value||' ');
  if(seq!==previewSeq)return;previewScene=s;CaptionRender.show($('mPreview'),s);outline();
}
function outline(){
  const host=$('mPreview'),s=previewScene;host.querySelector('.pick')?.remove();if(!s)return;
  const sh=draft.layouts[layoutKey].shapes[shapeIx];if(!sh)return;
  const k=Math.min(host.clientWidth/s.width,host.clientHeight/s.height),ox=(host.clientWidth-s.width*k)/2,oy=(host.clientHeight-s.height*k)/2;
  const d=document.createElement('div');d.className='pick';Object.assign(d.style,{left:ox+sh.x*k+'px',top:oy+sh.y*k+'px',width:sh.w*k+'px',height:sh.h*k+'px'});host.append(d);
}
let raf=0;function changed(){dirty=true;cancelAnimationFrame(raf);raf=requestAnimationFrame(preview);}
function applyControls(){
  const sh=draft.layouts[layoutKey].shapes[shapeIx];if(!sh)return;
  for(const [id,k] of [['mX','x'],['mY','y'],['mW','w'],['mH','h']]){const v=parseFloat($(id).value);if(Number.isFinite(v))sh[k]=k==='w'||k==='h'?Math.max(10,v):v;}
  if(sh.type==='text'){
    const {r:old}=textBase(sh),font=$('mFont').value.trim()||old.font,size=Math.max(8,parseFloat($('mSize').value)||old.size||32),bold=$('mBold').checked,color=$('mColor').value,align=$('mAlign').value,line=Math.min(3,Math.max(.8,parseFloat($('mLine').value)||1.3));
    sh.paragraphs=(sh.paragraphs?.length?sh.paragraphs:[{runs:[{text:''}]}]).map(p=>({...p,align,defaultSize:size,lineSpacing:{unit:'ratio',value:line},runs:(p.runs?.length?p.runs:[{text:''}]).map(r=>({...r,font,size,bold,color:(r.color||old.color)===old.color?color:r.color}))}));
    sh.lineReduction=0;
  }
  changed();
}
for(const id of ['mX','mY','mW','mH','mFont','mSize','mLine','mColor','mAlign','mBold'])$(id).addEventListener('input',applyControls);
$('mTemplate').onchange=()=>openMaster($('mTemplate').value);
$('mLayout').onchange=async()=>{layoutKey=$('mLayout').value;shapeIx=draft.layouts[layoutKey].bodyIndex;fillShapes();await preview();};
$('mShape').onchange=()=>{shapeIx=+$('mShape').value;fillControls();outline();};
$('mSample').addEventListener('input',()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(preview);});
$('mSave').onclick=async()=>{const rec=byId(draftId);if(!rec||!draft){toast('편집할 템플릿을 고르세요.');return;}await put({...rec,design:clone(draft)});useForMake(rec.id);dirty=false;status('mStatus',`"${rec.name}" 템플릿에 저장했습니다. 다음 만들기부터 이 디자인으로 나옵니다.`);};
$('mRevert').onclick=()=>{dirty=false;openMaster(draftId);};
addEventListener('resize',outline);

// 미리보기에서 요소를 눌러 고르고 끌어서 옮기기
(()=>{
  const host=$('mPreview');let drag=null;
  const toSlide=e=>{const s=previewScene,rect=host.getBoundingClientRect(),k=Math.min(rect.width/s.width,rect.height/s.height),ox=(rect.width-s.width*k)/2,oy=(rect.height-s.height*k)/2;return {x:(e.clientX-rect.left-ox)/k,y:(e.clientY-rect.top-oy)/k};};
  host.addEventListener('pointerdown',e=>{
    if(!draft||!previewScene)return;const p=toSlide(e),shapes=draft.layouts[layoutKey].shapes;
    let hit=-1;for(let i=shapes.length-1;i>=0;i--){const sh=shapes[i];if(sh.background||sh.rotate)continue;if(sh.type==='image'&&sh.w>=previewScene.width*.9&&sh.h>=previewScene.height*.9)continue;if(p.x>=sh.x&&p.x<=sh.x+sh.w&&p.y>=sh.y&&p.y<=sh.y+sh.h){hit=i;break;}}
    if(hit<0)return;shapeIx=hit;$('mShape').value=hit;fillControls();outline();
    drag={sx:p.x,sy:p.y,x:shapes[hit].x,y:shapes[hit].y};host.setPointerCapture(e.pointerId);e.preventDefault();
  });
  host.addEventListener('pointermove',e=>{if(!drag)return;const p=toSlide(e),sh=draft.layouts[layoutKey].shapes[shapeIx];sh.x=Math.round(drag.x+p.x-drag.sx);sh.y=Math.round(drag.y+p.y-drag.sy);$('mX').value=sh.x;$('mY').value=sh.y;dirty=true;outline();});
  const end=()=>{if(!drag)return;drag=null;changed();};host.addEventListener('pointerup',end);host.addEventListener('pointercancel',end);
})();
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
