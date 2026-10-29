(()=>{
'use strict';const $=id=>document.getElementById(id),C=CaptionCore;
let project={version:1,lines:[],slides:[],links:[],scriptName:'',deckName:''},ix=C.index([]),rows=[],cursor=0,displayCursor=0,line=0,selected=-1,live=-1,auto=true,output=null,channel=null,channelId='',lastOutputSeen=0,outputFullscreen=false,forceGreen=false,optionalSpeech=null,scriptureSpeech=null;
let listening=false,recognition=null,restart=null,retry=0,session=0,lastHit=0,carry='',greenTimer=null,saveTimer=null,busy=false,dbPromise;
let recentHeard='';
// PPT 자막도 일반 프롬프터와 동일하게 큰 음성 점프를 막고 가까운 문장만 확인해 복구한다.
const safeFollow=window.PromSafeFollow?.create();
const status=s=>{$('status').textContent=s;$('status').title=s;};
const fullscreenButton=$('controlFullscreen');
function syncControlFullscreen(){const active=!!(document.fullscreenElement||document.webkitFullscreenElement);fullscreenButton.textContent=active?'전체화면 종료':'전체화면';fullscreenButton.setAttribute('aria-pressed',String(active));fullscreenButton.title=active?'조작화면 전체화면 종료 (Esc)':'조작화면 전체화면';}
fullscreenButton.onclick=async()=>{try{if(document.fullscreenElement||document.webkitFullscreenElement){const exit=document.exitFullscreen||document.webkitExitFullscreen;if(exit)await exit.call(document);}else{const root=document.documentElement,enter=root.requestFullscreen||root.webkitRequestFullscreen;if(!enter){status('이 브라우저에서는 전체화면을 지원하지 않습니다. PC에서는 F11을 사용할 수 있습니다.');return;}await enter.call(root);}syncControlFullscreen();}catch{status('전체화면으로 전환하지 못했습니다. 버튼을 다시 누르거나 PC에서 F11을 사용하세요.');}};
document.addEventListener('fullscreenchange',syncControlFullscreen);document.addEventListener('webkitfullscreenchange',syncControlFullscreen);

function db(){return dbPromise||(dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open('prom-ppt-caption',1);r.onupgradeneeded=()=>r.result.createObjectStore('projects');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}));}
function packProject(value){const p=structuredClone(value),assets={},seen=new Map();for(const slide of p.slides)for(const shape of slide.shapes||[])if(shape.type==='image'&&/^data:image\//.test(shape.src||'')){let key=seen.get(shape.src);if(!key){key='image'+seen.size;seen.set(shape.src,key);assets[key]=shape.src;}shape.src='@prom:'+key;}if(seen.size)p.assets=assets;return p;}
function unpackProject(p){if(p?.assets&&Array.isArray(p.slides)){for(const slide of p.slides)for(const shape of slide.shapes||[])if(shape.type==='image'&&shape.src?.startsWith('@prom:')){const src=p.assets[shape.src.slice(6)];if(typeof src!=='string'||!/^data:image\/(png|jpeg|gif|webp|bmp|svg\+xml);base64,/.test(src))throw Error('작업 파일의 배경 그림을 읽지 못했습니다.');shape.src=src;}delete p.assets;}return p;}
let transferStamp='';try{transferStamp=localStorage.getItem('prom-ppt-make-transfer')||'';}catch{}let projectStamp=transferStamp;
function transferredElsewhere(){try{return transferStamp!==(localStorage.getItem('prom-ppt-make-transfer')||'');}catch{return false;}}
function pauseOldTab(){clearTimeout(saveTimer);stopMic();$('saveState').textContent='다른 탭에서 Make 작업을 열었습니다 · 이 탭 자동 저장 중지';status('새 Make 작업은 새로 열린 화면에서 이어 하세요. 이 탭의 작업은 저장 버튼으로 파일에 보관할 수 있습니다.');}
addEventListener('storage',e=>{if(e.key==='prom-ppt-make-transfer'&&transferredElsewhere())pauseOldTab();});
function save(){clearTimeout(saveTimer);saveTimer=setTimeout(async()=>{try{if(transferredElsewhere()){pauseOldTab();return;}const database=await db();if(transferredElsewhere()){pauseOldTab();return;}const tx=database.transaction('projects','readwrite'),store=tx.objectStore('projects'),r=store.get('last');let paused=false;r.onsuccess=()=>{if(r.result?.makeTransferId&&r.result.makeTransferId!==projectStamp){paused=true;pauseOldTab();return;}store.put(packProject({...project,makeTransferId:projectStamp}),'last');};tx.oncomplete=()=>{if(!paused)$('saveState').textContent='이 기기에 저장됨';};tx.onerror=()=>{$('saveState').textContent='저장 공간 부족 · 작업 저장 버튼으로 보관하세요';};}catch{$('saveState').textContent='자동 저장 불가 · 작업 저장 버튼으로 보관하세요';}},300);}
function frame(){return CaptionStandbyCore.frame(project,live,forceGreen);}
function publish(){channel?.postMessage(frame());}
function showLive(at,green=false){clearTimeout(greenTimer);live=at;forceGreen=green;publish();const current=frame();CaptionRender.show($('livePreview'),current.slide);$('liveLabel').textContent=current.label;$('showStandby').setAttribute('aria-pressed',String(at<0&&!green&&!!project.standby));for(const [i,el] of [...$('slideList').children].entries()){el.classList.toggle('live',i===at);if(i===at)el.setAttribute('aria-current','true');else el.removeAttribute('aria-current');}if(at>=0){select(at);$('slideList').children[at]?.scrollIntoView({block:'nearest',behavior:'smooth'});}previews();}
// 자막 첫 문장의 일부가 실제로 읽힌 뒤에만 송출하고, 짧은 원고 위치 흔들림으로 인한 녹색 깜빡임을 막는다.
// 앞 문단 끝을 확인하면 다음 자막을 송출한다. 생략한 문단은 새 자막 첫 구절을 확인한 뒤 넘어간다.
function syncAuto(immediate=false){
 if(!auto)return;
 const at=C.active(project.links,cursor);
 if(at===live){clearTimeout(greenTimer);greenTimer=null;return;}
 // 강조를 위해 직전 문장을 다시 읽어도 자동 자막은 뒤로 돌아가지 않는다.
 if(!immediate&&at>=0&&live>=0&&at<live)return;
 if(!immediate&&at>=0){
  const link=project.links[at];
  const previous=ix.text.slice(Math.max(0,link.start-12),link.start);
  const ending=previous.slice(-8),nearSpeech=recentHeard.slice(-40);
  const next=ix.text.slice(link.start,Math.min(ix.text.length,link.start+15)).replace(/^\d+/,'');
  const opening=next.slice(0,8);
  const previousDone=ending.length>=6&&nearSpeech.includes(ending);
  const nextStarted=opening.length>=6&&nearSpeech.includes(opening);
  if(!previousDone&&!nextStarted)return;
 }
 if(!immediate&&at<0&&live>=0){
  if(!greenTimer)greenTimer=setTimeout(()=>{greenTimer=null;if(auto&&C.active(project.links,cursor)<0)showLive(-1);},750);
  return;
 }
 clearTimeout(greenTimer);greenTimer=null;
 showLive(at);
}
function setAuto(value){if(value)pendingManualTarget=-1;auto=value;$('automatic').checked=value;$('mode').textContent=value?'자동 송출':'수동 유지';if(value)showLive(C.active(project.links,cursor));}
function followRow(item){if(!item)return;const host=$('manuscript'),top=item.getBoundingClientRect().top-host.getBoundingClientRect().top+host.scrollTop-(host.clientHeight-item.offsetHeight)*.35;window.PromSmoothScroll.to(host,top);}
function seek(pos,manual=false,speech=false){cursor=Math.max(0,Math.min(ix.text.length,pos));displayCursor=speech?Math.max(0,cursor-1):cursor;line=Math.max(0,rows.findIndex(r=>r.end>displayCursor));if(cursor===ix.text.length)line=Math.max(0,rows.length-1);const items=$('manuscript').querySelectorAll('.script-line');items.forEach((el,i)=>{el.classList.toggle('current',i===line);el.classList.toggle('past',i<line);});if(manual){safeFollow?.reset(cursor);recentHeard='';carry='';lastHit=Date.now();if(listening){const keepAuto=auto;stopMic();startMic();setAuto(keepAuto);}}if($('follow').checked)followRow(items[line]);syncAuto(manual);}
function previews(){
 const center=live>=0?live:selected;
 for(const [id,n] of [['previousPreview',center-1],['nextPreview',center+1]]){CaptionRender.show($(id),project.slides[n]);$(id+'Label').textContent=n>=0&&n<project.slides.length?`${n+1}번`:'없음';}
}
function select(at){selected=at;previews();[...$('slideList').children].forEach((el,i)=>el.classList.toggle('selected',i===at));const link=project.links[at];$('selectedLabel').textContent=at<0?'자막을 선택하세요':`${at+1}번 자막 연결`;
 const start=link&&Number.isFinite(link.start)?rows.findIndex(r=>r.end>link.start):-1,end=link&&Number.isFinite(link.end)?rows.findIndex(r=>r.end>=link.end):-1;
 $('rangeStart').value=start<0?'':start+1;$('rangeEnd').value=end<0?'':end+1;
 $('linkHint').textContent=!link?'자막을 선택하세요.':link.status==='exact'?(link.reason==='cumulative'?'누적 자막입니다. 새로 추가된 문장을 읽을 때 이 장으로 전환합니다.':'문장 일치로 연결했습니다. 자막 구간을 확인하세요.'):link.status==='manual'?'지정한 줄 구간에서 자동 송출합니다.':link.status==='review'?'유사 문장 또는 반복 구절입니다. 구간을 확인하고 연결 저장을 눌러야 자동 송출합니다.':'전문에서 해당 구간을 고르고 시작·끝 줄을 지정하세요. 미연결 자막은 수동 송출할 수 있습니다.';
}
function renderLines(){const host=$('manuscript');window.PromSmoothScroll.cancel(host);host.replaceChildren();rows=C.segments(project.lines,project.links);$('rangeStart').max=$('rangeEnd').max=rows.length;rows.forEach(({text},i)=>{const btn=document.createElement('button');btn.className='script-line';const r=rows[i];btn.classList.toggle('linked',project.links.some(l=>['exact','manual'].includes(l.status)&&l.start<r.end&&l.end>r.start));const n=document.createElement('span');n.className='number';n.textContent=i+1;const body=document.createElement('span');body.textContent=text;btn.append(n,body);btn.onclick=()=>seek(r.start,true);host.appendChild(btn);});$('lineCount').textContent=`${rows.length}줄`;}
function renderSlides(){const host=$('slideList');CaptionRender.release(host);host.replaceChildren();project.slides.forEach((slide,i)=>{const card=document.createElement('div');card.className='slide-card';card.tabIndex=0;card.setAttribute('role','group');card.setAttribute('aria-label',`${i+1}번 자막으로 이동`);const thumb=document.createElement('div');thumb.className='thumb slide-host';card.appendChild(thumb);const row=document.createElement('div');row.className='card-info';const n=document.createElement('strong');n.textContent=`${i+1}번`;const badge=document.createElement('span');badge.className=project.links[i]?.status||'unlinked';badge.textContent=({exact:'자동 연결',manual:'수동 연결',review:'확인 필요',unlinked:'미연결'})[badge.className];badge.title=badge.textContent;row.append(n,badge);card.appendChild(row);const liveBadge=document.createElement('span');liveBadge.className='card-live';liveBadge.textContent='송출 중';row.appendChild(liveBadge);const edit=document.createElement('button');edit.className='card-edit';edit.textContent='편집';edit.setAttribute('aria-label',`${i+1}번 자막 편집`);edit.onclick=e=>{e.stopPropagation();window.CaptionEditor?.open(i);};edit.ondblclick=e=>e.stopPropagation();row.appendChild(edit);const text=document.createElement('div');text.className='card-text';text.textContent=slide.text||'텍스트 없는 슬라이드';card.appendChild(text);card.onclick=()=>activateSlide(i);card.onkeydown=e=>{if(e.target===card&&e.key==='Enter'){e.preventDefault();activateSlide(i);}};card.ondblclick=()=>setView(false);host.appendChild(card);CaptionRender.show(thumb,slide);});const linked=project.links.filter(l=>['exact','manual'].includes(l.status)).length;$('linkSummary').textContent=`자막 ${project.slides.length}장 · 연결 ${linked} · 확인/미연결 ${project.slides.length-linked}`;}
function rebuild(){for(const slide of project.slides)slide.uid=slide.uid||crypto.randomUUID();ix=C.index(project.lines);optionalSpeech=PromOptionalSpeech.build(project.lines.join('\n').normalize('NFKC'),C.normalize);scriptureSpeech=PromScriptureSpeech.build(project.lines.join('\n').normalize('NFKC'),C.normalize);$('scriptName').textContent=project.scriptName||'HWP · HWPX · DOCX · TXT';$('deckName').textContent=project.deckName||'PPTX';$('rangeStart').max=$('rangeEnd').max=project.lines.length;renderLines();renderSlides();select(project.slides.length?0:-1);cursor=0;safeFollow?.reset(0);recentHeard='';showLive(-1);if(project.lines.length)seek(0);save();}
function align(){project.links=C.align(project.lines,project.slides);}
async function load(file,kind){if(!file||busy)return;busy=true;stopMic();showLive(-1);status(`${file.name} 읽는 중…`);$('scriptFile').disabled=$('deckFile').disabled=true;
 try{if(file.size>50*1024*1024)throw Error('원본 파일은 50MB 이하로 선택하세요.');const source=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve({name:file.name,data:reader.result});reader.onerror=()=>reject(Error('원본 파일을 보관하지 못했습니다.'));reader.readAsDataURL(file);});let preserveLinks=false;if(kind==='script'){const rich=await CaptionImport.manuscriptRich(file);project.lines=rich.lines;project.richLines=rich.richLines;project.scriptName=file.name;}else{const result=await CaptionImport.deck(file);preserveLinks=project.links.length===result.slides.length&&project.slides.length===result.slides.length&&result.slides.every((slide,i)=>slide.text===project.slides[i].text);if(result.cues?.normalizedText===C.index(project.lines).text&&result.cues.links?.length===result.slides.length){try{validate({...project,slides:result.slides,links:result.cues.links});project.links=result.cues.links;preserveLinks=true;}catch{}}if(result.cues?.standby&&CaptionStandbyCore.valid(result.cues.standby.slide))project.standby=result.cues.standby;if(result.cues?.generationTemplate?.version===1)project.generationTemplate=result.cues.generationTemplate;project.layoutMasters=structuredClone(result.cues?.layoutMasters||{});project.announcements=String(result.cues?.announcements||'');project.responsiveReading=String(result.cues?.responsiveReading||'');project.slides=result.slides;project.deckName=file.name;project.warnings=result.warnings;}
 project.sources=project.sources||{};project.sources[kind]=source;if(!preserveLinks)align();rebuild();status(`불러왔습니다. 원고 ${project.lines.length}줄 · 자막 ${project.slides.length}장. 연결 구간을 확인하세요.${project.warnings?.length?' '+project.warnings.join(' '):''}`);
 }catch(e){status(e.message||'파일을 읽지 못했습니다.');}finally{busy=false;$('scriptFile').disabled=$('deckFile').disabled=false;}}
$('scriptFile').onchange=e=>{load(e.target.files[0],'script');e.target.value='';};$('deckFile').onchange=e=>{load(e.target.files[0],'deck');e.target.value='';};
const outputScreens=window.CaptionOutputScreens=PromDisplayScreens.create({automatic:true,onMessage:status});let openingOutput=false;
async function openOutput(){
 if(openingOutput)return;
 if(!('BroadcastChannel'in window)){status('이 브라우저는 두 창 송출을 지원하지 않습니다. 최신 Chrome 또는 Edge를 사용하세요.');return;}
 if(!channel){channelId=crypto.randomUUID();channel=new BroadcastChannel('prom-ppt-'+channelId);channel.onmessage=e=>{if(e.data?.type==='fullscreen-state'){outputFullscreen=!!e.data.active;status(outputFullscreen?'송출창 전체화면 시작 · 조작창은 그대로 유지됩니다.':'송출창에서 전체화면 버튼을 한 번 클릭해 주세요.');}if(e.data?.type==='ready'){lastOutputSeen=Date.now();publish();outputScreens.place(output,'captionFullscreen');}if(e.data?.type==='alive')lastOutputSeen=Date.now();if(e.data?.type==='navigate')manualNavigate(e.data.action);};}
 openingOutput=true;status('송출창을 여는 중… 모니터 접근 권한 창이 뜨면 허용해 주세요.');
 try{
  // 모니터 권한 확인과 팝업 열기를 클릭 직후에 시작한다. 권한 응답을 기다린 뒤 팝업을 열면 차단될 수 있다.
  const preparation=outputScreens.prepare(),fresh=!output||output.closed;
  if(fresh){output=window.open('about:blank','promPptOutput',outputScreens.features());if(!output){status('팝업을 허용한 뒤 송출창 열기를 다시 눌러 주세요.');return;}}
  const popup=output;await preparation;if(popup.closed)return;
  await outputScreens.place(popup,'captionFullscreen');
  if(fresh){popup.location.replace('output.html#'+channelId);}
  else publish();
  status(outputScreens.message()||'송출창을 자동 배치했습니다. 전체화면이 제한되면 송출 화면을 한 번 클릭하세요.');
 }catch{status('송출창을 열지 못했습니다. 송출창 열기를 다시 눌러 주세요.');}
 finally{openingOutput=false;}
}
$('openOutput').onclick=openOutput;
setInterval(()=>{if(channel&&output&&!output.closed)channel.postMessage({type:'heartbeat'});$('connection').textContent=output&&!output.closed?(Date.now()-lastOutputSeen<8000?(outputFullscreen?'송출창 전체화면':'송출창 클릭 · 전체화면 필요'):'송출창 연결 확인 중'):'송출창 닫힘';if(auto&&listening&&lastHit&&Date.now()-lastHit>8000&&live>=0){showLive(-1);status('원고 추적 대기 · '+frame().label+'. 원고를 이어 읽거나 왼쪽에서 위치를 선택하세요.');}},2000);
function activateSlide(at){const link=project.links[at];if(auto&&link&&['exact','manual'].includes(link.status)){select(at);seek(link.start,true);status(`${at+1}번 자막으로 이동 · 자동 송출 유지`);}else manualSlide(at);}
function setView(multiple){document.querySelector('.slides-pane').classList.toggle('single-view',!multiple);document.querySelector('.preview-trio').hidden=multiple;$('slideList').hidden=!multiple;$('viewMultiple').setAttribute('aria-pressed',String(multiple));$('viewSingle').setAttribute('aria-pressed',String(!multiple));document.querySelector('.slides-pane h2').textContent=multiple?'자막 여러 장 보기':'송출 화면';}
$('viewMultiple').onclick=()=>setView(true);$('viewSingle').onclick=()=>setView(false);
$('findLive').onclick=()=>{setView(true);const at=live>=0?live:selected;$('slideList').children[at]?.scrollIntoView({block:'center',behavior:'smooth'});};
let cardZoom=100;
function fitGrid(){const list=$('slideList');if(list.hidden||!list.clientWidth||!list.clientHeight)return;const style=getComputedStyle(list),gap=parseFloat(style.columnGap)||16,usable=list.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),height=list.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom),rowHeight=(height-gap*2)/3,base=Math.max(120,(rowHeight-64)*16/9+18),baseColumns=Math.max(1,Math.ceil((usable+gap)/(base+gap))),baseWidth=(usable-gap*(baseColumns-1))/baseColumns,width=Math.min(usable,baseWidth*cardZoom/100),columns=Math.max(1,Math.floor((usable+gap)/(width+gap)+.001));list.style.setProperty('--card-columns',columns);list.style.setProperty('--card-width',width+'px');}
function setZoom(value){cardZoom=Math.max(60,Math.min(180,Number(value)||100));$('cardZoom').value=cardZoom;$('cardZoomNumber').value=cardZoom;$('cardZoomValue').textContent=cardZoom+'%';fitGrid();try{localStorage.setItem('prom-ppt-card-zoom',cardZoom);}catch{}}
$('cardZoom').oninput=e=>setZoom(e.target.value);$('cardZoomNumber').onchange=e=>setZoom(e.target.value);$('fitThreeRows').onclick=()=>setZoom(100);
try{setZoom(localStorage.getItem('prom-ppt-card-zoom'));}catch{setZoom(100);}new ResizeObserver(fitGrid).observe($('slideList'));
$('mappingToggle').onclick=()=>{const open=$('mappingSettings').hidden;$('mappingSettings').hidden=!open;$('mappingToggle').setAttribute('aria-expanded',String(open));$('mappingToggle').textContent=open?'연결 설정 ▴':'연결 설정 ▾';};
// 수동 송출: 원고에 두 자막 사이 실제 글자가 있을 때만 한 번 녹색 화면을 거친다.
// 광고, 미연결/검토 중인 자막은 원고상 위치를 확정할 수 없으므로 바로 전환한다.
let pendingManualTarget=-1;
const linkedRange=link=>link&&['exact','manual'].includes(link.status)&&Number.isFinite(link.start)&&Number.isFinite(link.end)&&link.end>=link.start;
function needsManuscriptGap(from,to){
 const a=project.links[from],b=project.links[to];
 if(!linkedRange(a)||!linkedRange(b)||a.reason==='announcement'||b.reason==='announcement')return false;
 const gap=to>from?ix.text.slice(a.end,b.start):ix.text.slice(b.end,a.start);
 return gap.length>0;
}
function manualSlide(at){if(at<0||at>=project.slides.length)return;pendingManualTarget=-1;setAuto(false);select(at);showLive(at);}
function manualNavigate(action){
 if(busy||!project.slides.length||document.querySelector('dialog[open]')||!['next','previous','first','last'].includes(action))return false;
 if(pendingManualTarget>=0){
  const target=pendingManualTarget;pendingManualTarget=-1;
  manualSlide(target);status(`${target+1}/${project.slides.length}번 자막 수동 송출`);return true;
 }
 const at=action==='first'?0:action==='last'?project.slides.length-1:live<0?Math.max(0,selected):Math.max(0,Math.min(project.slides.length-1,live+(action==='next'?1:-1)));
 if(live>=0&&at!==live&&needsManuscriptGap(live,at)){
  pendingManualTarget=at;setAuto(false);showLive(-1,true);
  status('원고상 자막 사이에 글자가 있어 녹색 화면을 표시합니다. 한 번 더 누르면 '+(at+1)+'번 자막으로 이동합니다.');return true;
 }
 manualSlide(at);status(`${at+1}/${project.slides.length}번 자막 수동 송출 · 자동 송출을 켜면 원고 추적으로 돌아갑니다.`);return true;
}
$('automatic').onchange=e=>setAuto(e.target.checked);$('green').onclick=()=>{pendingManualTarget=-1;setAuto(false);showLive(-1,true);status('녹색 화면 수동 유지 중 · 자동 송출을 켜면 추적 위치로 복귀합니다.');};$('showSelected').onclick=()=>manualSlide(selected);$('previous').onclick=()=>manualNavigate('previous');$('next').onclick=()=>manualNavigate('next');
$('linkCurrent').onclick=()=>{$('rangeStart').value=$('rangeEnd').value=line+1;};
$('saveLink').onclick=()=>{if(selected<0||!project.lines.length)return;const a=Number($('rangeStart').value)-1,b=Number($('rangeEnd').value)-1;if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<a||b>=rows.length){status('시작·끝 줄 번호를 확인하세요.');return;}const start=rows[a].start,end=rows[b].end;if(project.links.some((l,i)=>i!==selected&&['exact','manual'].includes(l.status)&&l.start<end&&l.end>start)){status('다른 자막 구간과 겹칩니다. 시작·끝 줄을 조정하거나 기존 연결을 해제하세요.');return;}project.links[selected]={start,end,status:'manual',score:1};renderLines();renderSlides();select(selected);seek(cursor);save();status('자막 구간을 저장했습니다.');};
$('unlink').onclick=()=>{if(selected<0)return;project.links[selected]={start:null,end:null,status:'unlinked',score:0};renderLines();renderSlides();select(selected);syncAuto();save();};
$('realign').onclick=()=>{if(!project.lines.length||!project.slides.length)return;if(!confirm('수동 연결을 포함해 원고와 자막을 다시 연결할까요?'))return;align();renderLines();renderSlides();select(selected);syncAuto();save();};
$('goCurrent').onclick=()=>{followRow($('manuscript').querySelectorAll('.script-line')[line]);};$('search').oninput=e=>{const q=C.normalize(e.target.value);let first=null;$('manuscript').querySelectorAll('.script-line').forEach((el,i)=>{const hit=q&&C.normalize(rows[i].text).includes(q);el.classList.toggle('search-hit',!!hit);if(hit&&!first)first=el;});first?.scrollIntoView({block:'center'});};
$('helpButton').onclick=()=>{$('help').hidden=!$('help').hidden;$('helpButton').setAttribute('aria-expanded',String(!$('help').hidden));};
// 인식 기록: 들은 말·위치 판정을 시각과 함께 남기고, '인식 기록 저장'으로 파일로 받는다. 따라오지 못한 때의 원인을 분석하는 데 쓴다.
const VLOG_MAX=60000;let vlog=[];
function vlogAdd(e){e.t=Date.now();vlog.push(e);if(vlog.length>VLOG_MAX)vlog.splice(0,vlog.length-VLOG_MAX);}
function saveVoiceLog(){const z=n=>String(n).padStart(2,'0'),d=new Date(),doc={version:1,app:'ppt',savedAt:d.toISOString(),userAgent:navigator.userAgent,manuscript:{norm:ix.text,rows:rows.length},events:vlog},a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(doc)],{type:'application/json'}));a.download='ppt_voice_log_'+d.getFullYear()+z(d.getMonth()+1)+z(d.getDate())+'_'+z(d.getHours())+z(d.getMinutes())+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);status(`인식 기록 ${vlog.length}건을 저장했습니다.`);}
// 자주 틀리게 받아쓰는 말은 사전으로 원고 말로 바꿔 맞춰 본다(원고 근처에 그 말이 있을 때만). 기록에는 들은 그대로 남긴다.
let lexFrom=0;function lexLearn(){try{if(window.PromLexicon&&vlog.length>lexFrom){PromLexicon.learn(vlog.slice(lexFrom),ix.text);lexFrom=vlog.length;}}catch{}}
function speechText(text){const before=cursor,used=window.PromLexicon?PromLexicon.fix(text,ix.text,cursor):text;speechTextCore(used);vlogAdd({k:'heard',heard:String(text).slice(-120),...(used!==text?{fixed:String(used).slice(-120)}:{}),from:before,to:cursor,line:line+1,rows:rows.length,msg:$('status').textContent});}
function speechTextCore(text){$('heard').textContent=text;recentHeard=C.normalize(text).slice(-100);const body=C.bodyStart?C.bodyStart(project.lines,ix):0;let hit=C.locateSpeech(text,ix.text,cursor,optionalSpeech,scriptureSpeech)||(cursor<body&&C.bodyMatch?C.bodyMatch(text,ix.text,body):null);if(hit&&(hit.pos<cursor-20||hit.pos>cursor+180))hit=null;if(!hit&&safeFollow){const recovered=safeFollow.recover(C.normalize(text),ix.text,cursor);if(recovered!==null)hit={pos:recovered,reacquired:true,safe:true};}if(hit){if(hit.pos>cursor)safeFollow?.progress(hit.pos);else if(hit.pos<cursor)safeFollow?.reset(hit.pos);lastHit=Date.now();seek(hit.pos,false,true);const at=C.active(project.links,cursor);status(auto?`${hit.reacquired?'읽는 위치 다시 찾음 · ':''}원고 ${line+1}/${rows.length}줄 추적 중 · ${at<0?(project.standby?'자막 없는 구간 (기본예배화면)':'자막 없는 구간 (녹색)'):`${at+1}번 자막 자동 송출`}`:`원고 ${line+1}/${rows.length}줄 추적 중 · 수동 유지 (‘자동 송출’을 켜면 전환)`);}else if(C.normalize(text).length>=5){syncAuto();status('말소리 인식 중 · 원고 위치를 찾지 못했습니다. 조금 더 이어 읽으면 위치를 다시 찾습니다. 원고를 눌러 직접 이동할 수도 있습니다.');}}
function stopMic(){lexLearn();document.body.classList.remove('mic-on');listening=false;session++;clearTimeout(restart);restart=null;try{recognition?.abort();}catch{}recognition=null;$('mic').textContent='● 마이크 켜기';$('mic').classList.remove('active');}
function startMic(){safeFollow?.reset(cursor);recentHeard='';lexFrom=vlog.length;if(!project.lines.length){status('먼저 설교 원고를 불러오세요.');return;}const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Recognition){status('이 브라우저는 음성 인식을 지원하지 않습니다. Chrome/Edge에서 열거나 수동 조작을 사용하세요.');return;}setAuto(true);listening=true;document.body.classList.add('mic-on');const mySession=++session;lastHit=Date.now();carry='';retry=0;$('mic').textContent='■ 마이크 끄기';$('mic').classList.add('active');
 function begin(){if(!listening||session!==mySession)return;const rec=recognition=new Recognition();rec.lang='ko-KR';rec.continuous=true;rec.interimResults=true;rec.onstart=()=>{if(!listening||session!==mySession||recognition!==rec)return;retry=0;recAt=Date.now();status(auto?'마이크 연결됨 · 자동 송출 켜짐 · 원고를 읽어 주세요.':'마이크 연결됨 · 원고 추적 중 · 자막 수동 유지');};rec.onresult=e=>{if(!listening||session!==mySession||recognition!==rec)return;recAt=Date.now();let text='';for(let i=Math.max(0,e.results.length-3);i<e.results.length;i++)text+=e.results[i][0].transcript+' ';speechText(text);};rec.onerror=e=>{vlogAdd({k:'error',v:e.error});if(!listening||session!==mySession||recognition!==rec)return;if(e.error==='no-speech'){status('마이크에 말소리가 들어오지 않습니다. 입력 장치·마이크 권한을 확인하세요.');return;}// 크롬은 약 5분마다 'network'로 끊고 바로 다시 잇는다. 방금까지 글자가 들어오던 중이면 안내를 띄우지 않는다.
if(e.error==='network'&&Date.now()-recAt<20000)return;if(['not-allowed','service-not-allowed','audio-capture'].includes(e.error)){stopMic();if(auto)showLive(-1);status('마이크 권한·장치 연결을 확인하세요. 수동 송출은 계속 사용할 수 있습니다.');}else status('음성 인식 재연결 중…');};rec.onend=()=>{vlogAdd({k:'end'});if(listening&&session===mySession){restart=setTimeout(begin,Math.min(8000,400*2**Math.min(retry++,4)));}};try{rec.start();}catch{restart=setTimeout(begin,1000);}}
 begin();}
// 인식이 오류·종료 없이 멈추는 경우(프롬프터 실제 시험에서 58초) 대비: 30초 동안 결과가 없으면 인식기를 다시 켠다.
let recAt=0;setInterval(()=>{if(!listening||!recognition||Date.now()-recAt<30000)return;recAt=Date.now();try{recognition.abort();}catch{}},5000);
$('saveVoiceLog').onclick=saveVoiceLog;
$('mic').onclick=()=>{if(listening){stopMic();if(auto)showLive(-1);status('마이크를 껐습니다.');}else startMic();};
$('saveProject').onclick=()=>{const blob=new Blob([JSON.stringify(packProject(project))],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='설교자막_작업.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);};
function validate(p){p=unpackProject(p);if(p?.standby&&(!CaptionStandbyCore.valid(p.standby.slide)||typeof p.standby.name!=='string'))throw Error('기본예배화면 정보가 올바르지 않습니다.');if(p?.version!==1||!Array.isArray(p.lines)||!p.lines.every(s=>typeof s==='string')||!Array.isArray(p.slides)||p.slides.length>500||!Array.isArray(p.links)||p.links.length!==p.slides.length)throw Error('지원하는 자막 작업 파일이 아닙니다.');const total=C.index(p.lines).text.length;for(const s of p.slides){if(!(s.width>0&&s.width<20000&&s.height>0&&s.height<20000)||!Array.isArray(s.shapes)||typeof s.text!=='string')throw Error('슬라이드 정보가 올바르지 않습니다.');}for(const l of p.links){if(!['exact','manual','review','unlinked'].includes(l.status))throw Error('연결 정보가 올바르지 않습니다.');if(l.status!=='unlinked'&&(!Number.isInteger(l.start)||!Number.isInteger(l.end)||l.start<0||l.end<=l.start||l.end>total))throw Error('원고 연결 범위가 올바르지 않습니다.');}return p;}
$('projectFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{const next=validate(JSON.parse(await f.text()));stopMic();project=next;rebuild();status('작업 파일을 불러왔습니다.');}catch(err){status(err.message);}};
$('demo').onclick=()=>{if((project.lines.length||project.slides.length)&&!confirm('현재 작업을 예시 원고로 바꿀까요? 필요한 작업은 먼저 저장하세요.'))return;stopMic();const texts=['감사는 작은 일에서 시작됩니다.','함께 나누면 기쁨은 더 커집니다.'];project={version:1,scriptName:'예시 원고',deckName:'예시 자막',lines:['오늘은 감사에 대해 이야기하겠습니다.',texts[0],'길을 걷다가 만난 사람에게 건네는 인사도 감사의 표현입니다.',texts[1],'이번 한 주도 감사하며 살아갑시다.'],slides:texts.map(t=>({text:t,background:'#00ff00',width:960,height:540,shapes:[{type:'rect',x:35,y:405,w:890,h:95,color:'#fff8df'},{type:'text',x:45,y:415,w:870,h:75,anchor:'ctr',paragraphs:[{align:'center',runs:[{text:t,font:'Malgun Gothic',size:32,bold:true,color:'#111111'}]}]}]})),links:[]};align();rebuild();status('예시를 준비했습니다. 왼쪽 2·4번째 줄을 누르면 자막, 다른 줄에서는 녹색으로 전환됩니다.');};
addEventListener('keydown',e=>{
 const action=CaptionPresentationKeys.action(e);
 if(action&&project.slides.length&&!busy){e.preventDefault();if(!e.repeat)manualNavigate(action);return;}
 if(e.defaultPrevented||e.isComposing||e.target.isContentEditable||e.target.closest?.('input,textarea,select,[contenteditable]')||document.querySelector('dialog[open]')||e.ctrlKey||e.metaKey||e.altKey)return;
 if(e.key.toLowerCase()==='g')$('green').click();
});
addEventListener('beforeunload',()=>{stopMic();channel?.postMessage({...CaptionStandbyCore.frame(project,-1),immediate:true});});
const divider=$('divider'),layout=document.querySelector('main');
function resizePane(value){const percent=Math.max(22,Math.min(65,value));layout.style.setProperty('--script-width',percent+'%');divider.setAttribute('aria-valuenow',Math.round(percent));try{localStorage.setItem('prom-ppt-pane-width-v2',percent);}catch{}}
try{resizePane(Number(localStorage.getItem('prom-ppt-pane-width-v2'))||50);}catch{resizePane(50);}
divider.onpointerdown=e=>{divider.setPointerCapture(e.pointerId);};
divider.onpointermove=e=>{if(divider.hasPointerCapture(e.pointerId)){const r=layout.getBoundingClientRect();resizePane((e.clientX-r.left)/r.width*100);}};
divider.onpointerup=e=>{if(divider.hasPointerCapture(e.pointerId))divider.releasePointerCapture(e.pointerId);};
divider.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home'].includes(e.key)){e.preventDefault();resizePane(e.key==='Home'?50:Number(divider.getAttribute('aria-valuenow'))+(e.key==='ArrowLeft'?-2:2));}};
window.CaptionWorkspace={
 standby(value){if(arguments.length){if(busy)throw Error('파일 읽기가 끝나면 다시 시도하세요.');if(value&&(!CaptionStandbyCore.valid(value.slide)||typeof value.name!=='string'))throw Error('기본예배화면을 읽지 못했습니다.');project.standby=structuredClone(value);save();if(live<0&&!forceGreen)showLive(-1);}return structuredClone(project.standby||null);},
 showStandby(){if(!project.standby)throw Error('가져오기로 기본예배화면을 먼저 지정하세요.');setAuto(false);showLive(-1);status('기본예배화면 수동 유지 중 · 자동 송출을 켜면 원고 위치에 맞춰 전환합니다.');},
 // 값을 넘기면 이 작업에 임시로 쌓인 레이아웃 마스터 수정을 바꾼다. 템플릿을 바꿀 때 이전 수정이 섞이지 않게 비우는 데 쓴다.
 layoutMasters(value){if(arguments.length){project.layoutMasters=structuredClone(value||{});save();}return structuredClone(project.layoutMasters||{});},
 pack:packProject,
 generationTemplate(value){if(arguments.length){project.generationTemplate=structuredClone(value);save();}return structuredClone(project.generationTemplate||null);},
 rememberRich(rich){if(rich.lines.length!==project.lines.length||rich.lines.some((line,i)=>line!==project.lines[i]))throw Error('원고를 한 번 다시 불러와 주세요.');project.richLines=rich.richLines;save();},
 selected:()=>selected,
 currentRange:()=>rows[line]||null,
 rows:()=>structuredClone(rows),
 prepareEdit(){stopMic();},
 message:status,
 apply(slides,links,options={}){if(busy)throw Error('파일을 읽는 중입니다.');const previous=project.slides[live]?.uid,at=cursor,wasAuto=auto;validate({...project,slides,links});stopMic();project.slides=slides;project.links=links;if(options.layoutMasters)project.layoutMasters=structuredClone(options.layoutMasters);if(options.exportSize)project.exportSize=structuredClone(options.exportSize);if(options.announcements!==undefined)project.announcements=String(options.announcements);if(options.deckName){project.deckName=options.deckName;delete project.sources?.deck;}rebuild();setAuto(wasAuto);seek(at);if(!wasAuto)showLive(previous?slides.findIndex(s=>s.uid===previous):-1);select(Math.min(slides.length-1,Math.max(0,options.selected??selected)));save();status(options.message||'자막 편집을 저장했습니다. 원고 연결과 송출 화면을 확인하세요.');},
 snapshot(){if(busy)throw Error('파일을 읽는 중입니다. 잠시 후 다시 시도하세요.');if(!project.lines.length&&!project.slides.length&&!project.standby)throw Error('먼저 원고나 PPT를 불러오세요.');return structuredClone(project);},
 open(next){if(busy)throw Error('파일을 읽는 중입니다. 잠시 후 다시 시도하세요.');validate(next);stopMic();project=next;rebuild();status('드라이브 작업을 불러왔습니다. 송출 전 연결 구간을 확인하세요.');},
 validate
};
CaptionRender.show($('livePreview'),null);
(async()=>{try{const database=await db(),tx=database.transaction('projects','readonly'),store=tx.objectStore('projects'),r=store.get('last');r.onsuccess=()=>{if(r.result&&!project.lines.length&&!busy){try{project=validate(r.result);projectStamp=project.makeTransferId||transferStamp;rebuild();status(project.slides.some(s=>s.renderVersion!==2)?'저장된 작업을 복원했습니다. 정확한 PPT 서식 적용을 위해 자막 PPT 파일을 한 번 다시 불러와 주세요.':new URLSearchParams(location.search).get('from')==='make'?'Make에서 편집한 PPT와 원고 연결을 불러왔습니다. 저장된 슬라이드 크기로 PPTX를 내려받습니다.':'이 기기에 저장된 작업을 복원했습니다. 송출 전 연결 구간을 확인하세요.');}catch{status('저장된 작업을 읽지 못했습니다. 파일을 다시 불러오세요.');}}};}catch{$('saveState').textContent='작업 저장 버튼으로 파일을 보관하세요';}})();
})();

