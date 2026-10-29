/* 프롬프터 준비·탐색·복구. 원고와 메모는 이 브라우저에만 보관한다. */
(() => {
  'use strict';
  try{const saved=localStorage.getItem('promLabNextLine'),prev=localStorage.getItem('prompterNextLine');$('labNextLine').checked=saved===null?(prev===null||prev!=='0'):(saved!=='false'&&saved!=='0');}catch(_){}
  $('labNextLine').onchange=()=>{
    try{localStorage.setItem('promLabNextLine',String($('labNextLine').checked));}catch(_){}
    render();
  };
  const STORAGE = 'promWorkspaceV1';
  let inputTab = 'file', restoring = false, saveTimer, cached = null, background = null;
  let notes = {}, noteEditing = false, noteAnchor = null, bodyNoteAnchor = null;
  let audience = null, channel = null, channelId = null, lastSent = '', lastPptxSceneKey = '';
  const textOf = pg => (pg || []).map(l => l.filter(r => r.c !== 'r' && r.c !== 'n').map(r => r.t).join('')).join('\n').trim();
  // 본문을 키로 삼아 편집·쪽 재배치 후 다른 쪽에 메모가 붙는 것을 막는다.
  const noteKey = pg => textOf(pg);
  function setTab(which) {
    inputTab = which;
    $('fileInputPanel').hidden = which !== 'file'; $('pasteInputPanel').hidden = which !== 'paste';
    $('fileTab').setAttribute('aria-selected', String(which === 'file'));
    $('pasteTab').setAttribute('aria-selected', String(which === 'paste'));
    $('start').disabled = which === 'file' ? !pending : !$('paste').value.trim();
    $('fname').textContent = which === 'file' ? (pending ? '원고 준비 완료 · 시작할 수 있습니다.' : '원고를 고른 뒤 시작하세요.') : '빈 줄과 원래 줄바꿈을 유지해서 붙여 넣으세요.';
  }
  $('fileTab').onclick = () => setTab('file'); $('pasteTab').onclick = () => setTab('paste');
  [$('fileTab'),$('pasteTab')].forEach(b => b.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();setTab(inputTab==='file'?'paste':'file');$(inputTab==='file'?'fileTab':'pasteTab').focus();}}));
  $('paste').addEventListener('input', () => { if(inputTab === 'paste') $('start').disabled = !$('paste').value.trim(); });
  $('paste').addEventListener('paste', () => queueMicrotask(() => { if(inputTab === 'paste') $('start').disabled = !$('paste').value.trim(); }));
  $('start').onclick = () => {
    if(inputTab === 'file') { if(pending) startWith(pending.pages,pending.bg,pending.original); }
    else { baseName = '붙여 넣은 원고'; $('usePaste').click(); }
  };
  $('layoutMode').onchange = () => {
    const mobile = $('layoutMode').value === 'mobile';
    const r = document.querySelector(`input[name=lines][value="${mobile ? 'm' : '5'}"]`); if(r) r.checked = true;
    $('desktopLines').hidden = mobile;
  };
  $('layoutMode').value = chosenMode() === 'm' ? 'mobile' : 'desktop';
  $('desktopLines').hidden = chosenMode() === 'm';
  const menu = $('moreTools');
  function syncPresentationMode(){
    const view=$('view'),full=!!document.fullscreenElement,external=!!audience&&!audience.closed;
    const solo=full&&!external&&view.style.display==='block';
    const changed=view.classList.contains('solo-presentation')!==solo;
    view.classList.toggle('solo-presentation',solo);
    view.classList.toggle('operator-mode',external&&(listening||full));
    if(changed){
      hideControls();
      if(solo){view.tabIndex=-1;view.focus({preventScroll:true});}
      if(ttsOn)revealControls();
      fit();render();
    }
  }
  document.addEventListener('fullscreenchange',syncPresentationMode);
  // 조작창 보기와 무관하게 송출창의 페이지/스크롤 방식을 선택한다.
  let outputViewMode='page';
  try{outputViewMode=localStorage.getItem('promOutputViewMode')==='scroll'?'scroll':'page'}catch(_){}
  const outputModeLabel=document.createElement('label');
  outputModeLabel.className='control-group';
  outputModeLabel.textContent='송출 보기 ';
  const outputModeSelect=document.createElement('select');
  outputModeSelect.id='outputViewMode';
  outputModeSelect.setAttribute('aria-label','송출창 보기 방식');
  outputModeSelect.innerHTML='<option value="page">페이지</option><option value="scroll">스크롤</option>';
  outputModeSelect.value=outputViewMode;
  outputModeLabel.appendChild(outputModeSelect);
  $('audience').after(outputModeLabel);
  outputModeSelect.onchange=()=>{
    outputViewMode=outputModeSelect.value;
    try{localStorage.setItem('promOutputViewMode',outputViewMode)}catch(_){}
    publish(true);
  };
  if(!matchMedia('(max-width:700px)').matches)$('viewScroll').hidden=true;
  let localScroll=false;
  const scrollHost=document.createElement('div');scrollHost.id='localScroll';scrollHost.className='scroll-host';scrollHost.hidden=true;scrollHost.setAttribute('aria-label','현재 창 스크롤 슬라이드쇼');$('stage').appendChild(scrollHost);
  const localRenderer=new PromScrollView(scrollHost);
  const scrollTextTools=document.createElement('span');scrollTextTools.id='scrollTextTools';scrollTextTools.className='control-group';scrollTextTools.hidden=true;scrollTextTools.setAttribute('role','group');scrollTextTools.setAttribute('aria-label','스크롤 글자 크기');
  scrollTextTools.innerHTML='<button type="button" id="scrollTextSmaller" aria-label="스크롤 글자 줄이기">−</button><button type="button" id="scrollTextReset" title="기본 글자 크기로 복원" aria-label="스크롤 글자 기본 크기로">100%</button><button type="button" id="scrollTextLarger" aria-label="스크롤 글자 키우기">＋</button>';
  $('viewScroll').parentElement.after(scrollTextTools);
  const scrollReadingTools=document.createElement('span');scrollReadingTools.className='control-group';scrollReadingTools.id='scrollReadingTools';scrollReadingTools.hidden=true;
  scrollReadingTools.innerHTML='<label>읽는 위치 <select id="scrollAnchor" aria-label="읽는 줄 위치"><option value="0.2">위쪽</option><option value="0.35">중간 위</option><option value="0.5">가운데</option></select></label><label>줄간격 <select id="scrollSpacing" aria-label="스크롤 줄간격"><option value="80">좁게</option><option value="100">보통</option><option value="120">넓게</option><option value="140">더 넓게</option></select></label>';
  scrollTextTools.after(scrollReadingTools);
  $('scrollAnchor').value=String(PromScrollView.getAnchor());$('scrollSpacing').value=String(PromScrollView.getSpacing());
  $('scrollAnchor').onchange=()=>{PromScrollView.setAnchor($('scrollAnchor').value);render();};
  $('scrollSpacing').onchange=()=>{PromScrollView.setSpacing($('scrollSpacing').value);render();};
  localRenderer.onSelect=(pi,li)=>{cursor=lineRange[pi][li][0];pend=null;lastTail='';heardCarry='';sessionText='';speechFloor=speechResultCount;window.PromExtras?.resetVoice?.();go(pi);localRenderer.position='';localRenderer.layout='';render();};
  function syncScrollText(){const value=PromScrollView.getScale();scrollTextTools.hidden=!localScroll;scrollReadingTools.hidden=!localScroll;$('scrollTextReset').textContent=value+'%';$('scrollTextSmaller').disabled=value<=60;$('scrollTextLarger').disabled=value>=180;}
  for(const [id,delta]of [['scrollTextSmaller',-10],['scrollTextReset',0],['scrollTextLarger',10]])$(id).onclick=()=>{PromScrollView.setScale(delta?PromScrollView.getScale()+delta:100);syncScrollText();render();};
  addEventListener('storage',e=>{if(['promScrollTextScale','promScrollAnchor','promScrollSpacing'].includes(e.key)){$('scrollAnchor').value=String(PromScrollView.getAnchor());$('scrollSpacing').value=String(PromScrollView.getSpacing());syncScrollText();render();}});
  function captureReadingPosition(){const line=editing?caretLine():-1;return line>=0?(lineRange[page]?.[line]?.[0]??cursor):cursor;}
  function setLocalScroll(value,start=cursor){
    if(value){if(editing)endEdit();finishNote();cursor=Math.max(0,Math.min(norm.length,start));page=pageOf(cursor);localRenderer.position='';localRenderer.layout='';}
    localScroll=value;syncScrollText();$('view').classList.toggle('local-scroll',value);scrollHost.hidden=!value;
    $('viewScroll').setAttribute('aria-pressed',String(value));
    if(value){$('viewSingle').setAttribute('aria-pressed','false');$('viewMultiple').setAttribute('aria-pressed','false');}
    else window.PromSmoothScroll?.cancel(scrollHost);
    render();showBar();
  }
  // ---- 원고 쪽 번호 레이어(빨간 큰 숫자, 글과 별도): 번호는 프롬프터 쪽이 아니라 한글 원고(종이)의 쪽 번호다.
  //      원고 쪽 번호는 글 안에 빨간 숫자로 들어 있다(그 쪽이 시작되기 직전 단어 뒤). 그 번호들을 읽어 현재 원고 쪽을 보여 준다.
  //      쪽 보기: 왼쪽 위에 현재 번호 하나를 고정. 스크롤 보기: 번호가 나오는 줄에 번호가 붙고, 지나가는 쪽 번호는 위에 고정돼 있다가 다음 번호가 올라오면 밀려 올라간다(위 4·아래 5가 함께 보이다 5가 위로).
  const pageNumLayer=document.createElement('div');pageNumLayer.id='pageNumLayer';pageNumLayer.setAttribute('aria-hidden','true');$('view').append(pageNumLayer);
  let showPageNum=true;try{showPageNum=localStorage.getItem('promShowPageNum')!=='0'}catch(_){}
  $('pageNumOpt').checked=showPageNum;
  $('pageNumOpt').onchange=()=>{showPageNum=$('pageNumOpt').checked;try{localStorage.setItem('promShowPageNum',showPageNum?'1':'0')}catch(_){}updatePageNums();publish(true);};
  const PN_TOP=58; // 상단 상태줄 아래 (숫자의 높이는 본문 크기에 맞춰 동적으로 계산)
  function pageNumberFontSize(){
    // 숫자 글리프가 한글보다 작게 보이는 현상을 보정한다.
    // 실제 본문 폰트 크기를 읽어 화면/글자 크기 조절에 맞춰 변경한다.
    const body=localScroll?scrollHost.querySelector('.scroll-flow'):$('page');
    const size=body?parseFloat(getComputedStyle(body).fontSize):NaN;
    return Math.round((Number.isFinite(size)&&size>0?size:72)*1.45);
  }
  // 글 속 원고 쪽 번호 찾기: 빨간색 숫자만 있는 덩어리가 2, 3, 4…처럼 이어질 때만 쪽 번호로 본다(그냥 빨간 숫자는 거른다)
  function manuscriptMarks(){
    const out=[];let last=0;
    for(let pi=0;pi<P.length;pi++)for(let li=0;li<P[pi].length;li++)for(const r of P[pi][li]){
      if(r.c!=='r'||!/^\s*\d{1,3}\s*$/.test(r.t))continue;
      const n=+r.t;
      if(out.length?(n>last&&n-last<=3):(n>=2&&n<=40)){out.push({n,pi,li});last=n;}
    }
    return out;
  }
  function manualPageNumber(){
    if(!showPageNum||!P.length)return null;
    const marks=manuscriptMarks();if(!marks.length)return page+1;
    let number=Math.max(1,marks[0].n-1);
    for(const mark of marks){
      const range=lineRange?.[mark.pi]?.[mark.li];
      const reached=listening?(range&&cursor>=range[0]):mark.pi<page;
      if(reached)number=mark.n;
      else if(!listening||range)break;
    }
    return number;
  }
  function pnLabel(i){let el=pageNumLayer.children[i];if(!el){el=document.createElement('div');el.className='pn';pageNumLayer.append(el);}return el;}
  function pnShow(list){const n=Math.max(list.length,pageNumLayer.children.length);for(let i=0;i<n;i++){const el=pnLabel(i);if(list[i]){el.hidden=false;if(el.textContent!==String(list[i][0]))el.textContent=String(list[i][0]);el.style.top=Math.round(list[i][1])+'px';}else el.hidden=true;}}
  function updatePageNums(){
    const v=$('view');
    if(!showPageNum||!P.length||v.style.display!=='block'||v.classList.contains('overview-mode')){pageNumLayer.hidden=true;return;}
    const fontSize=pageNumberFontSize();
    pageNumLayer.style.setProperty('--prom-page-number-size',fontSize+'px');
    const PN_H=Math.ceil(fontSize*1.15);
    const marks=manuscriptMarks();
    pageNumLayer.hidden=false;
    if(!marks.length){
      // 일반 텍스트/슬라이드에도 쪽 체크를 켜면 프롬프터 쪽 번호가 표시된다.
      // 스크롤 모드에서는 현재 화면에 보이는 문단의 쪽을 사용한다.
      const top=scrollHost.getBoundingClientRect().top+PN_TOP;
      const visible=localScroll?localRenderer.rows.find(r=>r.el.getBoundingClientRect().bottom>top):null;
      pnShow([[(visible?.pi??page)+1,PN_TOP]]);
      return;
    }
    const first=Math.max(1,marks[0].n-1);                                // 첫 번호 앞은 그 앞 쪽
    if(!localScroll){                                                    // 쪽 보기: 이 쪽이 시작될 때의 원고 쪽 번호 하나
      let n=first;for(const m of marks)if(m.pi<page)n=m.n;else break;
      pnShow([[n,PN_TOP]]);return;
    }
    const base=pageNumLayer.getBoundingClientRect().top,H=pageNumLayer.clientHeight,rows=localRenderer.rows;
    if(!rows.length){pageNumLayer.hidden=true;return;}
    const byKey=new Map(rows.map(r=>[r.pi+':'+r.li,r.el])),anchors=[[first,rows[0].el]];
    for(const m of marks){const el=byKey.get(m.pi+':'+m.li);if(el)anchors.push([m.n,el]);}
    const tops=anchors.map(a=>a[1].getBoundingClientRect().top-base),out=[];
    for(let k=0;k<anchors.length;k++){
      if(tops[k]>H)break;                                              // 화면 아래 번호는 아직 안 보임
      const next=k+1<tops.length?tops[k+1]:Infinity;
      if(next<=0)continue;                                             // 이미 다 지나감(다음 번호 줄이 화면 위로 나감)
      out.push([anchors[k][0],Math.min(Math.max(tops[k],PN_TOP),next-PN_H)]);   // 번호 줄에서 시작해 위에 고정, 다음 번호가 올라오면 밀려 올라감
    }
    pnShow(out);
  }
  let pnRaf=0;scrollHost.addEventListener('scroll',()=>{if(pnRaf)return;pnRaf=requestAnimationFrame(()=>{pnRaf=0;updatePageNums();});},{passive:true});
  function updateLocalScroll(){
    syncScrollText();if(!localScroll)return;
    const data={...payload(),document:P,ranges:lineRange,readingAnchor:PromScrollView.getAnchor()};
    scrollHost.style.backgroundColor=data.dark?'#000':'#fff';
    scrollHost.style.backgroundImage=data.dark||$('theme').value==='white'?'none':$('page').style.backgroundImage;
    localRenderer.update(data);
    scrollHost.style.setProperty('--focus',data.dark?data.focus:'#0000ff');
  }
  $('viewScroll').onclick=()=>{const start=captureReadingPosition();$('viewSingle').click();setLocalScroll(true,start);};
  for(const id of ['viewSingle','viewMultiple'])$(id).addEventListener('click',()=>{if(localScroll)setLocalScroll(false);},true);
  $('note').addEventListener('click',()=>{if(localScroll){setLocalScroll(false);$('viewSingle').click();}},true);
  function immersiveControls(){return listening||$('view').classList.contains('solo-presentation');}
  let controlsTimer;
  function hideControls(){clearTimeout(controlsTimer);controlsTimer=null;$('view').classList.remove('controls-open');}
  function revealControls(){clearTimeout(controlsTimer);controlsTimer=null;$('view').classList.add('controls-open');}
  addEventListener('mousemove',e=>{
    if(!immersiveControls()){hideControls();return;}
    const showing=$('view').classList.contains('controls-open');
    if(e.clientY>=innerHeight-24 || (showing && ($('bar').contains(e.target)||$('statusbar').contains(e.target))))revealControls();
    else if(showing&&!controlsTimer)controlsTimer=setTimeout(()=>{controlsTimer=null;if(!window.PromUI?.holdControls())hideControls();},900);
  });
  $('bar').addEventListener('focusin',()=>{if(immersiveControls())revealControls();});
  $('view').addEventListener('pointerdown',e=>{if(immersiveControls()&&e.clientY>=innerHeight-28)revealControls();});
  $('more').onclick = () => { menu.hidden = !menu.hidden; $('more').setAttribute('aria-expanded',String(!menu.hidden)); showBar(); };
  let bridgeConnected=false,bridgeGeneration=0;
  function setBridgeConnected(value,message){
    bridgeConnected=value;bridgeGeneration++;
    $('obsBridgeConnect').textContent=value?'보조 프로그램 연결 해제':'보조 프로그램 연결';
    $('obsBridgeStatus').textContent=message||(value?'연결됨 · 영상 표식에 따라 화면을 전환합니다.':'연결 안 함 · 영상이 없는 날은 연결하지 않아도 됩니다.');
  }
  async function toggleBridgeConnection(){
    if(bridgeConnected){setBridgeConnected(false);return;}
    const button=$('obsBridgeConnect');button.disabled=true;$('obsBridgeStatus').textContent='실행 중인 보조 프로그램에 연결하는 중…';
    try{
      const response=await fetch('http://127.0.0.1:17986/health',{mode:'cors',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(1500)});
      if(!response.ok)throw Error('unavailable');const data=await response.json();
      if(data.ready!==true||data.app!=='PromWindowBridge')throw Error('unavailable');
      window.__promObsCue=null;window.__promObsRetryAt=0;setBridgeConnected(true);render();
    }catch(_){setBridgeConnected(false,'프로그램을 실행한 뒤 연결을 다시 눌러 주세요. 자동으로 재시도하지 않습니다.');}
    finally{button.disabled=false;}
  }
  $('obsBridgeConnect').onclick=toggleBridgeConnection;
  setBridgeConnected(false);
  $('obsFullscreenSetup').onclick = () => showDialog('obsFullscreenDialog');
  function showDialog(id) { finishNote(); if(editing)endEdit(); closePanel(); $(id).showModal(); showBar(); }
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => $(b.dataset.close).close());
  document.querySelectorAll('.tool-dialog').forEach(d => d.addEventListener('close',showBar));
  $('find').onclick = () => { showDialog('searchDialog'); search(); $('searchQuery').focus(); };
  function search() {
    const q = $('searchQuery').value.trim().replace(/\s+/g,' ').toLocaleLowerCase(), list = $('searchResults');
    list.replaceChildren(); let count = 0;
    P.forEach((pg,pi) => {
      const original = textOf(pg), text = original.replace(/\s+/g,' '), at = text.toLocaleLowerCase().indexOf(q);
      if(q && at < 0)return; count++;
      const b = document.createElement('button'), label = document.createElement('small');
      label.textContent = `${pi + 1}쪽${pi === page ? ' · 현재' : ''}`;
      const preview = document.createElement('span');
      preview.textContent = q ? `${at > 24 ? '…' : ''}${text.slice(Math.max(0,at-24),at+q.length+70)}${at+q.length+70<text.length?'…':''}` : original.split('\n').find(Boolean) || '빈 쪽';
      b.append(label,preview); b.onclick = () => { go(pi,true); $('searchDialog').close(); toast('이 쪽부터 음성을 따라갑니다.'); };
      list.appendChild(b);
    });
    $('searchCount').textContent = q ? `${count}개 쪽에서 찾았습니다.` : `전체 ${P.length}쪽 · 쪽을 누르면 이동합니다.`;
  }
  $('searchQuery').oninput = search;
  let noteBox=null, activeNote=null, drag=null;
  const NOTE_SIZE_STORAGE='promNoteFontSize';
  let lastNoteSize=null;
  try{const saved=Number(localStorage.getItem(NOTE_SIZE_STORAGE));if(Number.isFinite(saved)&&saved>=12&&saved<=96)lastNoteSize=saved;}catch(_){}
  const noteLayer=document.createElement('div');noteLayer.id='noteLayer';$('stage').append(noteLayer);
  const noteTools=document.createElement('div');noteTools.id='noteTools';noteTools.hidden=true;
  noteTools.setAttribute('role','toolbar');noteTools.setAttribute('aria-label','발표 메모 편집');
  noteTools.innerHTML='<span>메모 글자</span><button type="button" id="noteSmaller" aria-label="메모 글자 줄이기">−</button><input id="noteSize" type="number" min="12" max="96" step="1" value="90" aria-label="메모 글자 크기"><span>px</span><button type="button" id="noteLarger" aria-label="메모 글자 키우기">＋</button><button type="button" id="noteDelete">삭제</button><button type="button" id="noteDone">완료</button>';
  $('view').append(noteTools);
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  function storeNote() {
    if(!activeNote||!noteBox)return;
    activeNote.text=noteBox.innerText.replace(/\r/g,'').slice(0,2000);
  }
  function finishNote() {
    if(!noteEditing)return;
    storeNote();
    if(activeNote&&!activeNote.text.trim())notes[noteAnchor]=(notes[noteAnchor]||[]).filter(n=>n!==activeNote);
    noteEditing=false;noteAnchor=null;activeNote=null;drag=null;noteBox?.blur();noteBox=null;
    noteTools.hidden=true;dirty=true;showNote();saveNow();
  }
  function placeObject(el,n){
    el.style.left=(n.x*100)+'%';el.style.top=(n.y*100)+'%';
    el.style.fontSize=n.size+'px';el.style.maxWidth=((1-n.x)*100)+'%';
  }
  function showNote() {
    const visible=!listening&&!ttsOn&&!editing;
    noteLayer.hidden=!visible;noteTools.hidden=!visible||!noteEditing;
    if(noteEditing&&noteBox?.isConnected){placeObject(noteBox.parentElement,activeNote);return;}
    noteLayer.replaceChildren();
    if(!visible)return;
    (notes[noteKey(P[page])]||[]).forEach((n,i)=>{
      const object=document.createElement('div');object.className='note-object';object.dataset.note=i;placeObject(object,n);
      const box=document.createElement('div');box.className='note-text';box.textContent=n.text;box.contentEditable='false';
      box.setAttribute('role','textbox');box.setAttribute('aria-label',`발표 메모 ${i+1}`);box.setAttribute('aria-multiline','true');
      object.append(box);noteLayer.append(object);
    });
  }
  function selectNote(n){
    finishNote();noteAnchor=noteKey(P[page]);activeNote=n;noteEditing=true;
    showNote();
    const i=notes[noteAnchor].indexOf(n),object=noteLayer.children[i];
    object.classList.add('selected');noteBox=object.querySelector('.note-text');noteBox.contentEditable='true';noteBox.dataset.placeholder='여기에 메모 입력';
    const handle=document.createElement('button');handle.type='button';handle.className='note-move';handle.textContent='이동';handle.setAttribute('aria-label','메모 레이어 이동');handle.title='끌어서 이동 · 방향키로 미세 이동';object.prepend(handle);
    $('noteSize').value=n.size;noteTools.hidden=false;noteBox.focus();
    const range=document.createRange();range.selectNodeContents(noteBox);range.collapse(false);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
  }
  $('note').onclick=()=>{
    finishNote();if(editing)endEdit();if(listening)stopMic();if(ttsOn)tStop();
    const key=noteKey(P[page]),items=notes[key]||(notes[key]=[]);
    const offset=(items.length%6)*0.04,n={text:'',x:0.08+offset,y:0.12+offset,size:lastNoteSize??90};items.push(n);
    menu.hidden=true;$('more').setAttribute('aria-expanded','false');selectNote(n);
  };
  noteLayer.addEventListener('click',e=>{e.stopPropagation();const object=e.target.closest('.note-object');if(object&&!object.classList.contains('selected'))selectNote(notes[noteKey(P[page])][+object.dataset.note]);});
  noteLayer.addEventListener('input',e=>{if(e.target===noteBox){storeNote();dirty=true;scheduleSave();}});
  noteLayer.addEventListener('paste',e=>{if(e.target===noteBox){e.preventDefault();document.execCommand('insertText',false,(e.clipboardData.getData('text/plain')||'').slice(0,2000));}});
  function moveNote(x,y){
    if(!activeNote||!noteBox)return;
    const bounds=noteLayer.getBoundingClientRect(),object=noteBox.parentElement;
    activeNote.x=clamp(x,0,Math.max(0,1-Math.min(object.offsetWidth,bounds.width)/bounds.width));
    activeNote.y=clamp(y,0.04,Math.max(0.04,1-Math.min(object.offsetHeight,bounds.height)/bounds.height));
    placeObject(object,activeNote);dirty=true;scheduleSave();
  }
  noteLayer.addEventListener('pointerdown',e=>{
    if(!e.target.closest('.note-move'))return;e.preventDefault();
    const rect=noteLayer.getBoundingClientRect();drag={id:e.pointerId,cx:e.clientX,cy:e.clientY,x:activeNote.x,y:activeNote.y,w:rect.width,h:rect.height};
    try{e.target.setPointerCapture(e.pointerId)}catch(_){}
  });
  noteLayer.addEventListener('pointermove',e=>{if(drag&&drag.id===e.pointerId)moveNote(drag.x+(e.clientX-drag.cx)/drag.w,drag.y+(e.clientY-drag.cy)/drag.h);});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])noteLayer.addEventListener(event,()=>{if(drag){drag=null;saveNow();}});
  noteLayer.addEventListener('keydown',e=>{
    if(!e.target.closest('.note-move')||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
    e.preventDefault();e.stopPropagation();const step=e.shiftKey?10:1,rect=noteLayer.getBoundingClientRect();
    moveNote(activeNote.x+({'ArrowLeft':-step,'ArrowRight':step}[e.key]||0)/rect.width,activeNote.y+({'ArrowUp':-step,'ArrowDown':step}[e.key]||0)/rect.height);
  });
  function resizeNote(value){
    if(!activeNote)return;
    activeNote.size=clamp(Number(value)||90,12,96);lastNoteSize=activeNote.size;
    try{localStorage.setItem(NOTE_SIZE_STORAGE,String(lastNoteSize));}catch(_){}
    $('noteSize').value=activeNote.size;placeObject(noteBox.parentElement,activeNote);dirty=true;scheduleSave();
  }
  $('noteSize').oninput=e=>resizeNote(e.target.value);
  $('noteSmaller').onclick=()=>resizeNote(activeNote.size-2);$('noteLarger').onclick=()=>resizeNote(activeNote.size+2);
  $('noteDone').onclick=finishNote;
  $('noteDelete').onclick=()=>{if(!activeNote)return;notes[noteAnchor]=notes[noteAnchor].filter(n=>n!==activeNote);activeNote=null;finishNote();};
  const speedLayer=$('speedLayer'),SPEED_POSITION_STORAGE='promSpeedLayerPosition';
  let speedPosition=null,speedDrag=null;
  try{const p=JSON.parse(localStorage.getItem(SPEED_POSITION_STORAGE));if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y))speedPosition={x:clamp(p.x,0,1),y:clamp(p.y,0,1)};}catch(_){}
  function placeSpeed(){
    if(!speedPosition||speedLayer.hidden)return;
    const box=speedLayer.getBoundingClientRect();
    speedLayer.style.left=clamp(speedPosition.x*innerWidth,0,Math.max(0,innerWidth-box.width))+'px';
    speedLayer.style.top=clamp(speedPosition.y*innerHeight,0,Math.max(0,innerHeight-box.height))+'px';speedLayer.style.right='auto';
  }
  function saveSpeedPosition(){try{localStorage.setItem(SPEED_POSITION_STORAGE,JSON.stringify(speedPosition));}catch(_){} }
  function moveSpeed(x,y){speedPosition={x:clamp(x/innerWidth,0,1),y:clamp(y/innerHeight,0,1)};placeSpeed();}
  speedLayer.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;e.preventDefault();e.stopPropagation();const r=speedLayer.getBoundingClientRect();
    speedDrag={id:e.pointerId,x:e.clientX-r.left,y:e.clientY-r.top};try{speedLayer.setPointerCapture(e.pointerId)}catch(_){}
  });
  speedLayer.addEventListener('pointermove',e=>{if(speedDrag&&speedDrag.id===e.pointerId)moveSpeed(e.clientX-speedDrag.x,e.clientY-speedDrag.y);});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])speedLayer.addEventListener(event,()=>{if(speedDrag){speedDrag=null;saveSpeedPosition();}});
  speedLayer.addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();const step=e.shiftKey?10:1,r=speedLayer.getBoundingClientRect();
    moveSpeed(r.left+({'ArrowLeft':-step,'ArrowRight':step}[e.key]||0),r.top+({'ArrowUp':-step,'ArrowDown':step}[e.key]||0));saveSpeedPosition();
  });
  addEventListener('resize',placeSpeed);
  $('focusColor').onchange = () => { $('view').style.setProperty('--focus',$('focusColor').value); saveNow(); publish(); };
  function syncTheme(){for(const value of ['dark','cloud','white'])$('theme-'+value).setAttribute('aria-pressed',String($('theme').value===value));}
  for(const value of ['dark','cloud','white'])$('theme-'+value).onclick=()=>{$('theme').value=value;$('theme').dispatchEvent(new Event('change'));};
  $('theme').addEventListener('change',()=>{syncTheme();publish();saveNow();});syncTheme();
  function payload() {
    const original=window.PromPptxOriginal?.isActive();
    const extra={...(window.PromExtras?.settings()||{}),continuous:outputViewMode==='scroll'&&!original};
    const originalKey=original?window.PromPptxOriginal.key(page):null;
    return {type:'frame',extra,originalKey,originalAspect:original?window.PromPptxOriginal.aspect():null,originalSlide:original?window.PromPptxOriginal.slide(page):null,pageNumber:manualPageNumber(),...(extra.continuous?{document:P,ranges:lineRange}:{}),nextCue:nextCueLine()?.text||'',pages:P[page],page,total:P.length,lines:LINES,cursor,readingAnchor:PromScrollView.getAnchor(),range:lineRange[page],dim:$('dim').checked,focus:$('focusColor').value,dark:$('theme').value==='dark',bg:$('theme').value==='dark'?null:background||BG_DEFAULT};
  }
  function publish(force=false) {
    if(!channel && !audience)return;
    const data=payload();
    if(data.originalKey){
      if(!force&&data.originalKey===lastPptxSceneKey)delete data.originalSlide;
      else lastPptxSceneKey=data.originalKey;
    }else lastPptxSceneKey='';
    const json=JSON.stringify(data);
    if(force || json!==lastSent) { channel?.postMessage(data); if(audience && !audience.closed)audience.postMessage(data,location.origin); lastSent=json; }
  }
  function navigateAudience(action){
    if(!audience||audience.closed||!['next','prev','home'].includes(action))return false;
    if(listening&&action!=='home'){
      const rows=[];
      lineRange.forEach((pg,pi)=>pg.forEach((r,li)=>{if(r[1]>r[0])rows.push({pi,li,start:r[0],end:r[1]});}));
      if(!rows.length)return true;
      let at=rows.findIndex(r=>cursor<r.end);if(at<0)at=rows.length-1;
      const row=rows[Math.max(0,Math.min(rows.length-1,at+(action==='next'?1:-1)))];
      cursor=row.start;heardCarry='';sessionText='';lastTail='';pend=null;speechFloor=speechResultCount;
      window.PromExtras?.resetVoice?.();go(row.pi);
    }else go(action==='home'?0:page+(action==='next'?1:-1),true);
    showBar();return true;
  }
  let localVoiceMode=false;
  function openLocalSlideshow(){
    $('viewSingle').click();
    if(!document.fullscreenElement)$('fs').click();
  }
  let openingAudience=false;
  const audienceScreens=window.PromAudienceScreens=PromDisplayScreens.create({automatic:true,onMessage:message=>toast(message,6000)});
  async function openSlideshow(){
    if(openingAudience)return;
    if(window.screen?.isExtended===false){if(audience&&!audience.closed)audience.close();audience=null;openLocalSlideshow();return;}
    if(!channel) {
      if(!('BroadcastChannel' in window)){toast('이 브라우저는 슬라이드쇼을 지원하지 않습니다.');return;}
      channelId=crypto.randomUUID(); channel=new BroadcastChannel('prom-display-'+channelId);
      channel.onmessage=e=>{if(e.data?.type==='navigate')navigateAudience(e.data.action);if(e.data?.type==='fullscreen-state'){const active=!!e.data.active;$('audience').title=active?'송출창 전체화면 중':'송출창의 전체화면 시작 버튼을 클릭하세요';if(!active)toast('송출창에서 큰 전체화면 시작 버튼을 한 번 클릭해 주세요.',7000);}if(e.data?.type==='ready'){publish(true);audienceScreens.place(audience,'startSlideshowFullscreen');}};
    }
    openingAudience=true;
    try{
      const preparation=audienceScreens.prepare(),fresh=!audience||audience.closed;
      if(fresh){audience=window.open('about:blank','promAudience',audienceScreens.features());if(!audience){toast('별도 화면이 차단되었습니다. 이 사이트의 팝업을 허용한 뒤 다시 눌러 주세요.',6000);return;}}
      const popup=audience;await preparation;if(popup.closed)return;
      if(fresh&&audienceScreens.single()){popup.close();audience=null;openLocalSlideshow();return;}
      await audienceScreens.place(popup,'startSlideshowFullscreen');
      if(fresh)popup.location.replace('audience.html?fullscreen=1#'+channelId);
      localVoiceMode=false;
      $('viewMultiple').click();
      publish(true);
      toast(audienceScreens.message()||'슬라이드쇼를 자동 배치했습니다. 전체화면이 제한되면 송출 화면을 한 번 클릭하세요.',6000);
    }catch{toast('슬라이드쇼를 열지 못했습니다. 다시 눌러 주세요.',6000);}
    finally{openingAudience=false;}
  };
  $('audience').onclick=openSlideshow;
  addEventListener('message',e=>{if(e.origin===location.origin && e.source===audience && e.data?.type==='ready'){publish(true);audienceScreens.place(audience,'startSlideshowFullscreen');}});
  function metadata() { if(noteEditing)storeNote();return {noteLayers:notes,focus:$('focusColor').value}; }
  function applyMetadata(data={}) {
    notes=Object.create(null);
    const fromLegacy=(text,i=0,count=LINES)=>({text:text.slice(0,2000),x:0.06,y:clamp(0.05+(i+0.3)*0.9/Math.max(1,count),0.04,0.9),size:20});
    if(data.notes&&typeof data.notes==='object')for(const [k,v]of Object.entries(data.notes))if(typeof v==='string'&&v.trim())notes[k]=[fromLegacy(v)];
    if(data.lineNotes&&typeof data.lineNotes==='object')for(const [k,v]of Object.entries(data.lineNotes))if(Array.isArray(v))notes[k]=v.slice(0,500).map((text,i)=>typeof text==='string'&&text.trim()?fromLegacy(text,i):null).filter(Boolean);
    if(data.noteLayers&&typeof data.noteLayers==='object')for(const [k,v]of Object.entries(data.noteLayers))if(Array.isArray(v))notes[k]=v.slice(0,500).filter(n=>n&&typeof n.text==='string').map(n=>({text:n.text.slice(0,2000),x:clamp(Number(n.x)||0,0,0.95),y:clamp(Number(n.y)||0.04,0.04,0.95),size:clamp(Number(n.size)||24,12,96)}));
    $('focusColor').value=data.focus==='#b6f36a'?'#b6f36a':'#ffff00';
    $('view').style.setProperty('--focus',$('focusColor').value);
  }
  function saveNow() {
    clearTimeout(saveTimer); if(!P.length || restoring)return;
    try {
      const data={app:'sermon-prompter',v:1,lines:LINES,mobile:MOBILE?MFS:false,pages:snapshotPages(),name:baseName,page,cursor,bg:background,meta:metadata(),savedAt:Date.now()};
      localStorage.setItem(STORAGE,JSON.stringify(data)); cached=data;
      $('autosaveState').textContent='기기에 저장됨'; refreshResume();
    } catch(_) { $('autosaveState').textContent='자동 저장 안 됨'; toast('기기 저장 공간이 부족하거나 저장이 차단되어 있습니다. 더보기 → 저장으로 원고를 보관하세요.',6000); }
  }
  function scheduleSave() { clearTimeout(saveTimer); saveTimer=setTimeout(saveNow,700); }
  function refreshResume() {
    $('resumeCard').hidden=!cached; if(!cached)return;
    $('resumeTitle').textContent=cached.name || '최근 원고';
    $('resumeInfo').textContent=`${Math.min(cached.pages.length,(cached.page||0)+1)} / ${cached.pages.length}쪽 · ${new Date(cached.savedAt).toLocaleString('ko-KR')} · 이 기기에 저장됨`;
  }
  $('resume').onclick = () => {
    if(!cached)return; const data=cached;
    try {
      const parsed=parseSaved(JSON.stringify(data)); restoring=true;
      if(parsed.mobile)MFS=+parsed.mobile||17; setMode(!!parsed.mobile); LINES=parsed.lines; baseName=data.name||'최근 원고';
      openPrompter(parsed.pages,data.bg); applyMetadata(data.meta); lastSrc={pages:P.map(p=>p.slice()),bg:data.bg};
      page=Math.max(0,Math.min(P.length-1,data.page||0)); cursor=pStart[page]||0;
      dirty=false; restoring=false; render(); toast('저장한 쪽을 열었습니다. 마이크를 켜면 이 쪽의 맨 위부터 따라갑니다.',5000);
    } catch(_) { restoring=false; toast('최근 원고를 복구하지 못했습니다. 원고 파일을 다시 열어 주세요.',5000); }
  };
  $('lines').addEventListener('input',scheduleSave);
  addEventListener('pagehide',saveNow);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)saveNow();});
  // 검색·메모 편집 중 발표 단축키가 원고를 넘기지 않게 한다.
  addEventListener('keydown',e=>{
    if(e.key==='Escape') {
      if(noteEditing){e.preventDefault();finishNote();e.stopImmediatePropagation();return;}
      else if(!listening&&!menu.hidden && !document.querySelector('dialog[open]')){menu.hidden=true;$('more').setAttribute('aria-expanded','false');e.stopImmediatePropagation();}
    }
    const typing=['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||e.target.isContentEditable;
    if(!typing&&!editing&&!noteEditing&&!document.querySelector('dialog[open]')&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&$('view').style.display==='block'){
      const action=['ArrowRight','ArrowDown','PageDown',' '].includes(e.key)?'next':['ArrowLeft','ArrowUp','PageUp'].includes(e.key)?'prev':e.key==='Home'?'home':null;
      if(action&&!(e.target.tagName==='BUTTON'&&e.key===' ')&&navigateAudience(action)){e.preventDefault();e.stopImmediatePropagation();return;}
    }
    if(document.querySelector('dialog[open]') || ['INPUT','TEXTAREA'].includes(e.target.tagName))e.stopImmediatePropagation();
    if(!editing && !noteEditing && !listening && !document.querySelector('dialog[open]') && $('view').style.display==='block' && (e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='f') { e.preventDefault(); $('find').click(); }
  },true);
  $('view').addEventListener('pointerdown',showBar);
  $('bar').addEventListener('focusin',showBar);
  window.PromUI = {
    visibleRange(){return localRenderer.visibleRange(lineRange);},
    metadata, applyMetadata, finishNote, syncPresentationMode,
    hasSlideshow(){return !!audience&&!audience.closed;},
    readingStart(){return (localScroll||(audience&&!audience.closed))?cursor:undefined;},
    speedLayer:placeSpeed,
    presentation(){if(!audience||audience.closed){localVoiceMode=true;$('viewScroll').click();}hideControls();showNote();},
    beforeBodyEdit(){if(localScroll){setLocalScroll(false);$('viewSingle').click();}finishNote();bodyNoteAnchor=noteKey(P[page]);},
    afterBodyEdit(){const key=noteKey(P[page]);if(bodyNoteAnchor&&bodyNoteAnchor!==key&&notes[bodyNoteAnchor]){notes[key]=notes[bodyNoteAnchor];delete notes[bodyNoteAnchor];}bodyNoteAnchor=null;showNote();},
    reading(){finishNote();showNote();if(ttsOn){revealControls();showBar();}else if($('view').classList.contains('solo-presentation'))hideControls();},
    opened(bg) {
      background=bg||null; if(restoring)return;
      applyMetadata();noteEditing=false;noteAnchor=null;noteBox=null;activeNote=null;$('note').textContent='발표 메모';syncTheme();
      menu.hidden=true; $('more').setAttribute('aria-expanded','false');
      dirty=false; render(); scheduleSave();
      if(window.PromPptxOriginal?.isActive())$('viewSingle').click();
      else if(!MOBILE&&localScroll)$('viewSingle').click();   // 데스크톱 조작창은 한 장/여러 장을 사용한다
    },
    render() {
      syncPresentationMode();
      $('sessionTitle').textContent=baseName; $('sessionTitle').title=baseName;
      showNote();
      [...$('lines').children].forEach((el,i)=>{const r=lineRange[page]?.[i];el.classList.toggle('current',!editing && !!r && r[1]>r[0] && cursor>=r[0] && cursor<r[1]);});
      updateLocalScroll();updatePageNums();publish(); scheduleSave();
      // 읽은 위치가 조작 표식에 도달할 때만 OBS 전체화면을 전환한다.
      // 조작창은 그대로 유지하며 Windows 보조 프로그램이 없으면 기능만 비활성.
      if(P.length && !editing && bridgeConnected && videoCues.length){
        const cue=PromVideoCues.active(videoCues,cursor);
        const next=cue?.action||(videoCues.length&&window.__promObsCue==='obs'?'slideshow':null);
        if(next){
          window.__promObsDesired=next;
          if(window.__promObsCue!==next && !window.__promObsPending && Date.now()>=(window.__promObsRetryAt||0)){
            window.__promObsPending=next;const generation=bridgeGeneration;
            Promise.resolve().then(()=>fetch('http://127.0.0.1:17986/'+next,{method:'POST',mode:'cors',credentials:'omit',signal:AbortSignal.timeout(1500)})).then(response=>{
              if(!bridgeConnected||generation!==bridgeGeneration)return;
              if(!response.ok)throw Object.assign(new Error('Window switch failed: '+response.status),{bridgeResponse:true});
              window.__promObsCue=next;window.__promObsWarned=null;window.__promObsRetryAt=0;
            }).catch(error=>{
              if(!bridgeConnected||generation!==bridgeGeneration)return;
              if(!error.bridgeResponse){setBridgeConnected(false,'보조 프로그램 연결이 종료됐습니다. 실행 후 연결을 다시 눌러 주세요.');window.__promObsRetryAt=0;return;}
              window.__promObsRetryAt=Date.now()+3000;
              if(window.__promObsWarned!==next){
                window.__promObsWarned=next;
                toast('창 전환 실패: 전환 보조 프로그램과 슬라이드쇼 창을 확인하세요.',6000);
              }
            }).finally(()=>{
              window.__promObsPending=null;
              if(window.__promObsDesired!==next)window.PromUI?.render();
            });
          }
        }else window.__promObsDesired=null;
      }
    },
    mic(cls) { if(!listening&&localVoiceMode){localVoiceMode=false;$('viewSingle').click();} $('micStatus').textContent=cls==='live'?'듣는 중':cls==='err'?'마이크 연결 확인':listening?'다시 연결 중':'마이크 꺼짐'; },
    holdControls() { return ttsOn || !menu.hidden || !!document.querySelector('dialog[open]') || ($('bar').contains(document.activeElement) && document.activeElement.matches(':focus-visible')) || editing || noteEditing; },
    noteKey
  };
  try { const data=JSON.parse(localStorage.getItem(STORAGE)||'null'); if(data){parseSaved(JSON.stringify(data));cached=data;} }catch(_){}
  refreshResume(); setTab('file');
  if(P.length){background=null;window.PromUI.render();}
  setInterval(()=>{syncPresentationMode();if(channel)channel.postMessage({type:'heartbeat'});if(audience && !audience.closed)audience.postMessage({type:'heartbeat'},location.origin);},3000);
})();
