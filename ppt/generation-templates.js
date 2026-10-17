/* Named generation recipes retain options, complete instructions, layouts and theme. */
window.CaptionRecipes=(()=>{
  'use strict';
  const $=id=>document.getElementById(id),B=CaptionBuilder,W=CaptionWorkspace;
  const defaultInstructions='파랑: 하단 자막. 초록: 말씀·성구. 빨강: 해당 구간의 부분 강조. 검정: 설교 전문에만 표시.\n전체 화면 말씀의 첫 두 줄에 성령님·하나님·성자(예수님)·선생님이 나오면 해당 화자 배경 사용. 선생님은 인물 없는 배경. 성경 구절은 성구 레이아웃 유지.\n원본 템플릿의 글꼴·글자 크기·위치·여백 사용. 줄간격 1.3배. 글자 수 고정 제한 없이 실제 글꼴 너비로 줄바꿈. 하단 자막은 900px 글상자 폭에서 두 줄씩 분할.\n누적 공개는 새로 추가된 문장별로 원고와 연결. 이전 문장이 끝난 시점에 다음 연결 자막 표시. 자막은 부드럽게 나타나고 사라짐. 설교 전문과 스크롤 슬라이드쇼는 부드럽게 이동.\n요약·내용 재작성 없이 원고 그대로 생성. 생성 뒤 미리보기·원고 연결 확인.';
  const defaults={title:'',date:'',greenLayout:'word',cumulative:true,allText:false};
  let database,selected='',records=[],working=null,loading=false,pair=null,pendingPair=null;
  function db(){return database||(database=new Promise((resolve,reject)=>{const r=indexedDB.open('prom-ppt-generation-templates',1);r.onupgradeneeded=()=>r.result.createObjectStore('templates',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}));}
  async function store(mode,operation){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('templates',mode);let value;const request=operation(tx.objectStore('templates'));request.onsuccess=()=>{value=request.result;};tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error||Error('템플릿을 저장하지 못했습니다.'));tx.onabort=()=>reject(tx.error||Error('템플릿 저장이 취소되었습니다.'));});}
  function readOptions(){return {title:$('generateTitle').value,date:$('generateDate').value,greenLayout:$('generateGreen').value,cumulative:$('generateCumulative').checked,allText:$('generateAll').checked};}
  function writeOptions(value={}){const o={...defaults,...value};$('generateTitle').value=o.title;$('generateDate').value=o.date;$('generateGreen').value=o.greenLayout;$('generateCumulative').checked=o.cumulative;$('generateAll').checked=o.allText;}
  function refreshList(){const select=$('generationTemplate');select.replaceChildren();const add=(id,name)=>{const option=document.createElement('option');option.value=id;option.textContent=name;select.appendChild(option);};add('','기본 제작 지침 · 원본 디자인');for(const record of records)add(record.id,record.name);if(working&&!records.some(r=>r.id===working.id))add(working.id,working.name+' · 작업에 포함');select.value=selected;}
  async function apply(record){await B.useTemplate(record?.design||null);working=record||null;pair=structuredClone(record?.pair||null);pendingPair=null;$('pairTemplateReview').replaceChildren();$('applyTemplatePair').hidden=true;$('pairTemplateStatus').textContent=pair?'두 원본 파일과 비교 지침이 이 템플릿에 포함되어 있습니다.':'';selected=record?.id||'';writeOptions(record?.options);$('generationInstructions').value=record?.instructions??defaultInstructions;$('generationTemplateName').value=record?.name||'';refreshList();}
  async function open(){loading=true;$('generateRun').disabled=true;try{let warning='';try{records=await store('readonly',s=>s.getAll());}catch(e){records=[];warning='이 기기의 템플릿 보관함을 읽지 못했습니다. ';}const saved=W.generationTemplate();await apply(saved||working);$('generationTemplateStatus').textContent=warning+'선택값·제작 지침·배경과 글꼴 서식을 함께 저장합니다.';}catch(e){$('generationTemplateStatus').textContent=e.message||'템플릿 보관함을 열지 못했습니다.';}finally{loading=false;$('generateRun').disabled=false;}}
  async function capture(){if(pendingPair)throw Error('비교 결과에서 지침·디자인 추가를 먼저 누르세요.');const name=$('generationTemplateName').value.trim();if(pair&&!name)throw Error('템플릿 이름을 입력하세요.');const design=await B.snapshotTemplate();if(pair)for(const c of pair.evidence.candidates)if(design.layoutMasters)delete design.layoutMasters[c.layout];return {version:1,id:selected||crypto.randomUUID(),name:$('generationTemplateName').value.trim()||'현재 제작 설정',instructions:$('generationInstructions').value,options:readOptions(),pair:structuredClone(pair),design};}
  $('generationTemplate').onchange=async()=>{if(loading)return;loading=true;$('generateRun').disabled=true;try{const record=records.find(r=>r.id===$('generationTemplate').value)||null;await apply(record);W.generationTemplate(record);$('generationTemplateStatus').textContent=record?'저장된 모든 설정과 제작 지침을 불러왔습니다.':'기본 제작 지침을 불러왔습니다.';}catch(e){$('generationTemplateStatus').textContent=e.message;}finally{loading=false;$('generateRun').disabled=false;}};
  $('saveGenerationTemplate').onclick=async()=>{if(loading)return;loading=true;const button=$('saveGenerationTemplate');button.disabled=true;$('generateRun').disabled=true;try{if(!$('generationTemplateName').value.trim())throw Error('템플릿 이름을 입력하세요.');const record=await capture();if(!selected||working?.name!==record.name)record.id=crypto.randomUUID();await store('readwrite',s=>s.put(record));records=await store('readonly',s=>s.getAll());working=record;selected=record.id;W.generationTemplate(record);refreshList();$('generationTemplateStatus').textContent='템플릿을 저장했습니다. 다음 제작에서도 선택할 수 있습니다.';}catch(e){$('generationTemplateStatus').textContent='저장 실패: '+e.message;}finally{loading=false;button.disabled=false;$('generateRun').disabled=false;}};

  $('registerTemplatePair').onclick=async()=>{if(loading)return;$('generateSummary').textContent='원고와 완성 PPT를 등록해 다음 제작에 재사용할 템플릿을 만듭니다.';$('generateDialog').showModal();await open();};
  const pairStatus=message=>{$('pairTemplateStatus').textContent=message;};
  const sourceData=file=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve({name:file.name,data:r.result});r.onerror=()=>reject(Error('비교 원본을 보관하지 못했습니다.'));r.readAsDataURL(file);});
  async function referenceFile(input,source,label){const file=$(input).files[0];if(file){if(file.size>50*1024*1024)throw Error(label+'는 50MB 이하로 선택하세요.');return {file,source:await sourceData(file)};}if(!source?.data)throw Error(label+' 파일을 선택하세요.');const blob=await (await fetch(source.data)).blob();return {file:new File([blob],source.name),source};}
  function pairBusy(value){loading=value;for(const id of ['analyzeTemplatePair','applyTemplatePair','saveGenerationTemplate','generateRun','generationTemplate','pairScriptFile','pairDeckFile'])$(id).disabled=value;}
  function clearReview(){pendingPair=null;$('pairTemplateReview').replaceChildren();$('applyTemplatePair').hidden=true;pairStatus('파일 선택을 바꿨습니다. 두 파일을 다시 비교하세요.');}
  $('pairScriptFile').onchange=clearReview;$('pairDeckFile').onchange=clearReview;
  $('analyzeTemplatePair').onclick=async()=>{if(loading)return;pairBusy(true);pendingPair=null;$('pairTemplateReview').replaceChildren();$('applyTemplatePair').hidden=true;pairStatus('두 원본 파일을 읽고 원고 연결·글꼴·배치를 비교하는 중…');try{
    let project={};try{project=W.snapshot();}catch{}const manuscript=await referenceFile('pairScriptFile',project.sources?.script,'한글 원고'),deck=await referenceFile('pairDeckFile',project.sources?.deck,'완성 PPT');
    const rich=await CaptionImport.manuscriptRich(manuscript.file),parsed=await CaptionImport.deck(deck.file);rich.name=manuscript.file.name;parsed.name=deck.file.name;
    const analysis=CaptionPairTemplate.analyze(rich,parsed);pendingPair={analysis,slides:parsed.slides,sources:{script:manuscript.source,deck:deck.source}};
    const table=document.createElement('table'),caption=document.createElement('caption');caption.textContent='정확히 연결된 본문 · 레이아웃 확인 (제외 가능)';table.appendChild(caption);
    for(const c of analysis.candidates){const row=document.createElement('tr'),example=document.createElement('td'),field=document.createElement('td'),select=document.createElement('select');example.textContent=`${c.slideIndex+1}번 · ${c.text.slice(0,65)} · ${c.font} ${c.size.toFixed(1)}px`;select.setAttribute('aria-label',`${c.slideIndex+1}번 레이아웃`);for(const [value,label] of [['','학습에서 제외'],...Object.entries(CaptionPairTemplate.choices)]){const option=document.createElement('option');option.value=value;option.textContent=label;select.appendChild(option);}select.value=c.layout;select.onchange=()=>{c.layout=select.value;};field.appendChild(select);row.append(example,field);table.appendChild(row);}
    $('pairTemplateReview').appendChild(table);$('applyTemplatePair').hidden=false;
    pairStatus(`전체 ${analysis.totalSlides}장 중 ${analysis.matchedSlides}장 연결. 레이아웃 분류는 추정이므로 확인 후 추가하세요. 미연결·중복·유사 문장은 제외합니다. ${analysis.warnings.join(' ')}`);
  }catch(e){pairStatus(e.message||'파일 비교 실패');}finally{pairBusy(false);}};
  $('applyTemplatePair').onclick=async()=>{if(loading||!pendingPair)return;pairBusy(true);try{
    const baseline=await B.snapshotTemplate(),result=CaptionPairTemplate.build(pendingPair.analysis,pendingPair.slides,baseline);
    await B.useTemplate(result.design);
    const common=$('generationInstructions').value||defaultInstructions,previous=pair?.extractedInstructions;
    // Replace only the previous extracted block; preserve all common/user instructions.
    const instructions=previous&&common.includes(previous)?common.replace(previous,result.instructions):common+'\n\n'+result.instructions;
    $('generationInstructions').value=instructions;
    const stem=pendingPair.analysis.scriptName.replace(/\.[^.]+$/,'');
    if(!$('generationTemplateName').value.trim()||pair)$('generationTemplateName').value=(stem+' · 원고-PPT 학습').slice(0,80);
    if(result.options.cumulative)$('generateCumulative').checked=true;
    pair={version:1,sources:pendingPair.sources,evidence:result.evidence,extractedInstructions:result.instructions};
    // A newly analyzed pair always starts a new recipe, keeping the selected recipe intact.
    selected='';working=null;refreshList();pendingPair=null;$('applyTemplatePair').hidden=true;
    pairStatus('공통지침 뒤에 파일별 지침·확인한 디자인을 추가했습니다. 이름과 전체 제작 지침을 확인하고 템플릿 저장을 누르세요. 예전 글자는 비워지며 배경 이미지 속 글자는 직접 확인하세요.');
  }catch(e){pairStatus(e.message||'지침 추가 실패');}finally{pairBusy(false);}};
  async function remember(){if(loading)throw Error('템플릿을 불러오는 중입니다.');const record=await capture();working=record;W.generationTemplate(record);return record;}
  return {open,remember,defaultInstructions};
})();

