/* 프롬프터 준비·탐색·복구. 원고와 메모는 이 브라우저에만 보관한다. */
(() => {
  'use strict';
  const STORAGE = 'promWorkspaceV1';
  let inputTab = 'file', restoring = false, saveTimer, cached = null, background = null;
  let notes = {}, noteEditing = false, noteAnchor = null, bodyNoteAnchor = null;
  let audience = null, channel = null, channelId = null, lastSent = '';
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
    if(inputTab === 'file') { if(pending) startWith(pending.pages,pending.bg); }
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
  let controlsTimer;
  function hideControls(){clearTimeout(controlsTimer);controlsTimer=null;$('view').classList.remove('controls-open');}
  function revealControls(){clearTimeout(controlsTimer);controlsTimer=null;$('view').classList.add('controls-open');}
  addEventListener('mousemove',e=>{
    if(!listening){hideControls();return;}
    const showing=$('view').classList.contains('controls-open');
    if(e.clientY>=innerHeight-24 || (showing && ($('bar').contains(e.target)||$('statusbar').contains(e.target))))revealControls();
    else if(showing&&!controlsTimer)controlsTimer=setTimeout(()=>{controlsTimer=null;hideControls();},900);
  });
  $('view').addEventListener('pointerdown',e=>{if(listening&&e.clientY>=innerHeight-28)revealControls();});
  $('more').onclick = () => { menu.hidden = !menu.hidden; $('more').setAttribute('aria-expanded',String(!menu.hidden)); showBar(); };
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
  let noteBox=null, noteLine=0;
  function storeNote() {
    if(noteAnchor === null || !noteBox)return;
    const value=noteBox.innerText.replace(/\r/g,'').slice(0,2000).trim();
    const rows=notes[noteAnchor]||(notes[noteAnchor]=[]); rows[noteLine]=value;
    if(!rows.some(Boolean))delete notes[noteAnchor];
  }
  function finishNote(repaint=true) {
    if(!noteEditing)return;
    storeNote(); noteEditing=false; noteAnchor=null;
    noteBox.contentEditable='false'; noteBox.classList.remove('edit');noteBox.blur();
    noteBox=null;$('note').textContent='발표 메모';dirty=true;if(repaint)render();saveNow();
  }
  function showNote() {
    const visible=!listening&&!ttsOn&&!editing;
    $('lines').classList.toggle('notes-visible',visible);
    const values=notes[noteKey(P[page])]||[];
    [...$('lines').children].forEach((row,i)=>{
      row.querySelectorAll('.note-insert,.line-note').forEach(el=>{if(el!==noteBox)el.remove();});
      row.classList.toggle('notes-available',visible);
      row.classList.toggle('has-line-note',visible&&!!(values[i]||(noteEditing&&noteLine===i)));
      if(!visible)return;
      const button=document.createElement('button');button.className='note-insert';button.textContent='+';
      button.type='button';button.dataset.line=i;button.setAttribute('aria-label',`${i+1}번째 줄 발표 메모`);button.title='이 줄 앞에 발표 메모 넣기';
      row.prepend(button);
      if(values[i]||(noteEditing&&noteLine===i)){
        let box=noteEditing&&noteLine===i?noteBox:null;
        if(!box){box=document.createElement('div');box.className='line-note';box.textContent=values[i]||'';}
        box.dataset.line=i;box.setAttribute('role','textbox');box.setAttribute('aria-label',`${i+1}번째 줄 메모 내용`);
        box.setAttribute('aria-multiline','true');box.dataset.placeholder='발표 메모 입력 · Esc로 저장';
        row.insertBefore(box,row.querySelector('span'));
      }
      const body=row.querySelector(':scope > span');
      if(body){body.style.transform='';const w=body.getBoundingClientRect().width,max=row.clientWidth-36;if(w>max&&max>0)body.style.transform=`scale(${max/w})`;}
    });
  }
  function beginNote(line) {
    finishNote(false);
    if(editing)endEdit();if(listening)stopMic();if(ttsOn)tStop();
    noteAnchor=noteKey(P[page]);noteLine=line;noteEditing=true;
    noteBox=document.createElement('div');noteBox.className='line-note';noteBox.textContent=notes[noteAnchor]?.[line]||'';
    noteBox.contentEditable='true';noteBox.classList.add('edit');
    $('note').textContent='메모 끝내기 (Esc)';showNote();noteBox.focus();
    const range=document.createRange();range.selectNodeContents(noteBox);range.collapse(false);
    const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
  }
  $('note').onclick=()=>noteEditing?finishNote():beginNote(0);
  $('lines').addEventListener('click',e=>{const target=e.target.closest('.note-insert,.line-note');if(target&&target!==noteBox){e.stopPropagation();beginNote(+target.dataset.line);}});
  $('lines').addEventListener('input',e=>{if(e.target===noteBox){storeNote();dirty=true;scheduleSave();}});
  $('lines').addEventListener('paste',e=>{if(e.target===noteBox){e.preventDefault();document.execCommand('insertText',false,(e.clipboardData.getData('text/plain')||'').slice(0,2000));}});
  $('focusColor').onchange = () => { $('view').style.setProperty('--focus',$('focusColor').value); saveNow(); publish(); };
  function syncTheme(){for(const value of ['dark','cloud'])$('theme-'+value).setAttribute('aria-pressed',String($('theme').value===value));}
  for(const value of ['dark','cloud'])$('theme-'+value).onclick=()=>{$('theme').value=value;$('theme').dispatchEvent(new Event('change'));};
  $('theme').addEventListener('change',()=>{syncTheme();publish();saveNow();});syncTheme();
  function payload() {
    return {type:'frame',pages:P[page],page,total:P.length,lines:LINES,cursor,range:lineRange[page],dim:$('dim').checked,focus:$('focusColor').value,dark:$('theme').value==='dark',bg:$('theme').value==='dark'?null:background||BG_DEFAULT};
  }
  function publish(force=false) {
    if(!channel && !audience)return; const data=payload(), json=JSON.stringify(data);
    if(force || json!==lastSent) { channel?.postMessage(data); if(audience && !audience.closed)audience.postMessage(data,location.origin); lastSent=json; }
  }
  $('audience').onclick = () => {
    if(!channel) {
      if(!('BroadcastChannel' in window)){toast('이 브라우저는 별도 원고 화면을 지원하지 않습니다.');return;}
      channelId=crypto.randomUUID(); channel=new BroadcastChannel('prom-display-'+channelId);
      channel.onmessage=e=>{ if(e.data?.type==='ready')publish(true); };
    }
    audience=window.open('audience.html#'+channelId,'promAudience');
    if(!audience){toast('별도 화면이 차단되었습니다. 이 사이트의 팝업을 허용한 뒤 다시 눌러 주세요.',6000);return;}
    toast('새 원고 창을 외부 모니터로 옮겨 전체화면으로 보세요.',6000);
  };
  addEventListener('message',e=>{if(e.origin===location.origin && e.source===audience && e.data?.type==='ready')publish(true);});
  function metadata() { if(noteEditing)storeNote();return {lineNotes:notes,focus:$('focusColor').value}; }
  function applyMetadata(data={}) {
    notes=Object.create(null);
    if(data.notes && typeof data.notes==='object')for(const [k,v] of Object.entries(data.notes))if(typeof v==='string')notes[k]=[v.slice(0,2000)];
    if(data.lineNotes && typeof data.lineNotes==='object')for(const [k,v] of Object.entries(data.lineNotes))if(Array.isArray(v))notes[k]=v.slice(0,500).map(s=>typeof s==='string'?s.slice(0,2000):'');
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
    if(document.querySelector('dialog[open]') || ['INPUT','TEXTAREA'].includes(e.target.tagName))e.stopImmediatePropagation();
    if(!editing && !noteEditing && !listening && !document.querySelector('dialog[open]') && $('view').style.display==='block' && (e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='f') { e.preventDefault(); $('find').click(); }
  },true);
  $('view').addEventListener('pointerdown',showBar);
  $('bar').addEventListener('focusin',showBar);
  window.PromUI = {
    metadata, applyMetadata, finishNote,
    presentation(){hideControls();showNote();},
    beforeBodyEdit(){finishNote();bodyNoteAnchor=noteKey(P[page]);},
    afterBodyEdit(){const key=noteKey(P[page]);if(bodyNoteAnchor&&bodyNoteAnchor!==key&&notes[bodyNoteAnchor]){notes[key]=notes[bodyNoteAnchor];delete notes[bodyNoteAnchor];}bodyNoteAnchor=null;showNote();},
    reading(){finishNote();showNote();},
    opened(bg) {
      background=bg||null; if(restoring)return;
      applyMetadata();noteEditing=false;noteAnchor=null;noteBox=null;$('note').textContent='발표 메모';syncTheme();
      menu.hidden=true; $('more').setAttribute('aria-expanded','false');
      dirty=false; render(); scheduleSave();
    },
    render() {
      $('sessionTitle').textContent=baseName; $('sessionTitle').title=baseName;
      showNote();
      [...$('lines').children].forEach((el,i)=>{const r=lineRange[page]?.[i];el.classList.toggle('current',!editing && !!r && r[1]>r[0] && cursor>=r[0] && cursor<r[1]);});
      publish(); scheduleSave();
    },
    mic(cls) { $('micStatus').textContent=cls==='live'?'듣는 중':cls==='err'?'마이크 연결 확인':listening?'다시 연결 중':'마이크 꺼짐'; },
    holdControls() { return !menu.hidden || !!document.querySelector('dialog[open]') || ($('bar').contains(document.activeElement) && document.activeElement.matches(':focus-visible')) || editing || noteEditing; },
    noteKey
  };
  try { const data=JSON.parse(localStorage.getItem(STORAGE)||'null'); if(data){parseSaved(JSON.stringify(data));cached=data;} }catch(_){}
  refreshResume(); setTab('file');
  if(P.length){background=null;window.PromUI.render();}
  setInterval(()=>{if(channel)channel.postMessage({type:'heartbeat'});if(audience && !audience.closed)audience.postMessage({type:'heartbeat'},location.origin);},3000);
})();
