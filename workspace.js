/* 프롬프터 준비·탐색·복구. 원고와 메모는 이 브라우저에만 보관한다. */
(() => {
  'use strict';
  const STORAGE = 'promWorkspaceV1';
  let inputTab = 'file', restoring = false, saveTimer, cached = null, background = null;
  let notes = {}, picking = false, elapsed = 0, runningSince = null, target = 30;
  let audience = null, channel = null, channelId = null, lastSent = '';
  const textOf = pg => (pg || []).map(l => l.filter(r => r.c !== 'r' && r.c !== 'n').map(r => r.t).join('')).join('\n').trim();
  // 본문을 키로 삼아 편집·쪽 재배치 후 다른 쪽에 메모가 붙는 것을 막는다.
  const noteKey = pg => textOf(pg);
  const currentElapsed = () => elapsed + (runningSince === null ? 0 : Date.now() - runningSince);
  const clockText = ms => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`; };
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
  $('more').onclick = () => { menu.hidden = !menu.hidden; $('more').setAttribute('aria-expanded',String(!menu.hidden)); showBar(); };
  function showDialog(id) { if(editing)endEdit(); closePanel(); $(id).showModal(); showBar(); }
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
  $('pickLine').onclick = () => {
    if(editing)endEdit(); if(ttsOn)tStop(); picking = !picking;
    $('view').classList.toggle('picking',picking); $('linePickHint').hidden = !picking;
    toast(picking ? '다시 읽을 줄을 누르세요. 취소는 Esc입니다.' : '읽기 위치 지정을 취소했습니다.');
  };
  $('lines').addEventListener('click', e => {
    if(!picking || editing)return;
    const ln = e.target.closest('.ln'); if(!ln)return;
    const i = [...$('lines').children].indexOf(ln), range = lineRange[page]?.[i];
    if(!range || range[0] === range[1])return;
    e.stopPropagation();
    cursor = range[0]; heardCarry=''; sessionText=''; lastTail=''; pend=null;
    picking=false; $('view').classList.remove('picking'); $('linePickHint').hidden=true;
    render(); toast('선택한 줄부터 따라갑니다.');
  },true);
  $('note').onclick = () => { showDialog('noteDialog'); $('noteText').value = notes[noteKey(P[page])] || ''; $('noteText').focus(); };
  $('saveNote').onclick = () => {
    const key = noteKey(P[page]), value = $('noteText').value.trim();
    if(value)notes[key]=value; else delete notes[key]; dirty=true;
    $('noteDialog').close(); render(); saveNow();
  };
  function updateClock() {
    const ms = currentElapsed(), clock = $('sessionClock');
    clock.textContent = `${clockText(ms)} / ${target}분`;
    clock.classList.toggle('soon',target>0 && ms >= Math.max(0,target-5)*60000 && ms < target*60000);
    clock.classList.toggle('over',target>0 && ms >= target*60000);
    $('timerToggle').textContent = runningSince === null ? '시간 시작' : '시간 일시정지';
  }
  $('timerToggle').onclick = () => {
    if(runningSince === null)runningSince=Date.now(); else { elapsed=currentElapsed(); runningSince=null; }
    updateClock(); saveNow();
  };
  $('timerReset').onclick = () => { elapsed=0; runningSince=null; updateClock(); saveNow(); };
  $('targetMinutes').onchange = () => { target=Math.max(1,Math.min(240,Number($('targetMinutes').value)||30)); $('targetMinutes').value=target; updateClock(); saveNow(); };
  $('focusColor').onchange = () => { $('view').style.setProperty('--focus',$('focusColor').value); saveNow(); publish(); };
  $('check').onclick = () => {
    $('checkSupport').textContent = SR ? '음성 따라가기 지원 · 마이크 버튼으로 연결을 확인하세요.' : '이 브라우저는 음성 따라가기를 지원하지 않습니다. 크롬으로 열어 주세요.';
    $('checkSummary').textContent = `${P.length}쪽 · ${MOBILE ? '모바일' : LINES+'줄'} · 방향키 또는 발표 리모컨의 Page Up / Page Down으로 넘길 수 있습니다.`;
    showDialog('checkDialog');
  };
  $('checkMic').onclick = () => { $('checkDialog').close(); if(!panelOpen())$('set').click(); };
  $('checkFull').onclick = () => { $('checkDialog').close(); $('fs').click(); };
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
  function metadata() { return {notes,target,elapsed:currentElapsed(),focus:$('focusColor').value}; }
  function applyMetadata(data={}) {
    notes={};
    if(data.notes && typeof data.notes==='object')for(const [k,v] of Object.entries(data.notes))if(typeof v==='string')notes[k]=v.slice(0,2000);
    target=Math.max(1,Math.min(240,Number(data.target)||30)); elapsed=Number.isFinite(Number(data.elapsed))?Math.max(0,Number(data.elapsed)):0; runningSince=null;
    $('targetMinutes').value=target;
    $('focusColor').value=data.focus==='#b6f36a'?'#b6f36a':'#ffff00';
    $('view').style.setProperty('--focus',$('focusColor').value); updateClock();
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
      page=Math.max(0,Math.min(P.length-1,data.page||0)); cursor=Math.max(pStart[page],Math.min(pEnd[page],Number(data.cursor)||pStart[page]));
      dirty=false; restoring=false; render(); toast('저장한 위치를 복구했습니다. 마이크와 시간은 직접 시작하세요.',5000);
    } catch(_) { restoring=false; toast('최근 원고를 복구하지 못했습니다. 원고 파일을 다시 열어 주세요.',5000); }
  };
  $('lines').addEventListener('input',scheduleSave);
  addEventListener('pagehide',saveNow);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)saveNow();});
  // 검색·시간 입력 중 발표 단축키가 원고를 넘기지 않게 한다.
  addEventListener('keydown',e=>{
    if(e.key==='Escape') {
      if(picking){picking=false;$('view').classList.remove('picking');$('linePickHint').hidden=true;e.stopImmediatePropagation();}
      else if(!menu.hidden && !document.querySelector('dialog[open]')){menu.hidden=true;$('more').setAttribute('aria-expanded','false');e.stopImmediatePropagation();}
    }
    if(document.querySelector('dialog[open]') || ['INPUT','TEXTAREA'].includes(e.target.tagName))e.stopImmediatePropagation();
    if(!editing && !document.querySelector('dialog[open]') && $('view').style.display==='block' && (e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='f') { e.preventDefault(); $('find').click(); }
  },true);
  $('view').addEventListener('pointerdown',showBar);
  $('bar').addEventListener('focusin',showBar);
  window.PromUI = {
    metadata, applyMetadata,
    opened(bg) {
      background=bg||null; if(restoring)return;
      applyMetadata(); picking=false; $('view').classList.remove('picking'); $('linePickHint').hidden=true;
      menu.hidden=true; $('more').setAttribute('aria-expanded','false');
      dirty=false; render(); scheduleSave();
    },
    render() {
      $('sessionTitle').textContent=baseName; $('sessionTitle').title=baseName;
      const note=notes[noteKey(P[page])]||''; $('speakerNote').textContent=note; $('speakerNote').hidden=!note;
      [...$('lines').children].forEach((el,i)=>{const r=lineRange[page]?.[i];el.classList.toggle('current',!editing && !!r && r[1]>r[0] && cursor>=r[0] && cursor<r[1]);});
      updateClock(); publish(); scheduleSave();
    },
    mic(cls) { $('micStatus').textContent=cls==='live'?'듣는 중':cls==='err'?'마이크 연결 확인':listening?'다시 연결 중':'마이크 꺼짐'; },
    holdControls() { return !menu.hidden || !!document.querySelector('dialog[open]') || ($('bar').contains(document.activeElement) && document.activeElement.matches(':focus-visible')) || editing || picking; },
    noteKey
  };
  try { const data=JSON.parse(localStorage.getItem(STORAGE)||'null'); if(data){parseSaved(JSON.stringify(data));cached=data;} }catch(_){}
  refreshResume(); setTab('file'); updateClock();
  if(P.length){background=null;window.PromUI.render();}
  setInterval(updateClock,1000);
  setInterval(()=>{if(runningSince!==null)saveNow();},15000);
  setInterval(()=>{if(channel)channel.postMessage({type:'heartbeat'});if(audience && !audience.closed)audience.postMessage({type:'heartbeat'},location.origin);},3000);
})();
