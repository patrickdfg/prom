(() => {
  const id=location.hash.slice(1), display=document.getElementById('display');
  if(!/^[a-f0-9-]{36}$/.test(id) || !('BroadcastChannel' in window)){display.textContent='조작 화면 상단의 슬라이드쇼 버튼으로 열어 주세요.';return;}
  const scrollRenderer=new PromScrollView(display);
  const channel=new BroadcastChannel('prom-display-'+id); let current=null,lastSeen=Date.now();
  let manualScale=100,manualSpacing=100;
  const originalSceneCache=new Map();let displayedOriginalKey='',displayedTextKey='';
  function syncPageNumberFont(){
    const num=document.getElementById('manuscriptPageNumber');
    if(num.hidden||!current)return;
    const content=current.extra?.continuous?display.querySelector('.scroll-flow'):display;
    let size=content?parseFloat(getComputedStyle(content).fontSize):NaN;
    if(current.originalKey){
      // 원본 PPT는 이미지/텍스트 개체가 혼합되어 있으므로 표시 크기의 본문 기준값을 따른다.
      const metrics=PromSlideLayout.measure(innerWidth,innerHeight,Math.max(1,current.lines||5));
      size=metrics.font*manualScale/100;
    }
    if(Number.isFinite(size)&&size>0)num.style.fontSize=Math.round(size*1.45)+'px';
  }
  function fit(){
    if(!current)return;
    if(current.originalKey){
      const ratio=current.originalAspect||16/9;
      let width=innerWidth,height=width/ratio;
      if(height>innerHeight){height=innerHeight;width=height*ratio;}
      display.style.width=width+'px';display.style.height=height+'px';
      display.style.transform='scale('+(manualScale/100)+')';
      display.style.position='relative';display.style.overflow='hidden';
      syncPageNumberFont();
      return;
    }
    display.style.transform='';display.style.position='';display.style.overflow='';
    if(current.extra?.continuous){scrollRenderer.position='';scrollRenderer.layout='';scrollRenderer.update(current);syncPageNumberFont();return;}
    const rows=Math.max(1,current.lines,current.pages.length);
    const metrics=PromSlideLayout.measure(innerWidth,innerHeight,rows);
    display.style.width=metrics.width+'px';display.style.height=metrics.height+'px';
    display.style.fontSize=(metrics.font*manualScale/100)+'px';
    display.style.setProperty('--manual-line-height',String(1.2*manualSpacing/100));
    display.querySelectorAll('.ln>span').forEach(s=>{s.style.transform='';const w=s.scrollWidth,max=s.parentElement.clientWidth;if(w>max)s.style.transform=`scale(${max/w})`;});
    syncPageNumberFont();
  }
  const zoomTools=document.getElementById('scrollTextTools'),toolsToggle=document.getElementById('displayToolsToggle');
  let hideToolsTimer=null;
  function showToolsButton(){
    document.body.classList.remove('controls-idle');
    clearTimeout(hideToolsTimer);
  }
  function scheduleToolsHide(){
    clearTimeout(hideToolsTimer);
    if(!zoomTools.hidden)return;
    hideToolsTimer=setTimeout(()=>{
      if(zoomTools.hidden&&!toolsToggle.matches(':hover')&&!toolsToggle.matches(':focus-visible'))
        document.body.classList.add('controls-idle');
    },3000);
  }
  function toggleTools(force){
    const open=typeof force==='boolean'?force:zoomTools.hidden;
    zoomTools.hidden=!open;
    toolsToggle.setAttribute('aria-expanded',String(open));
    showToolsButton();
    if(!open)scheduleToolsHide();
    zoomLabels();
  }
  toolsToggle.onclick=()=>toggleTools();
  // Keep the control visible while actively adjusting. Otherwise hide after 3 seconds.
  const nearTools=e=>e.clientY<=120&&e.clientX>=innerWidth-240;
  addEventListener('pointermove',e=>{
    if(!zoomTools.hidden)return;
    if(nearTools(e)){showToolsButton();}
    else if(!document.body.classList.contains('controls-idle'))scheduleToolsHide();
  },{passive:true});
  toolsToggle.addEventListener('pointerenter',showToolsButton);
  toolsToggle.addEventListener('pointerleave',scheduleToolsHide);
  toolsToggle.addEventListener('focus',showToolsButton);
  zoomTools.addEventListener('focusin',showToolsButton);
  scheduleToolsHide();
  const readingTools=document.createElement('span');readingTools.innerHTML='<label>읽는 위치 <select id="scrollAnchor" aria-label="읽는 줄 위치"><option value="0.2">위쪽</option><option value="0.35">중간 위</option><option value="0.5">가운데</option></select></label><label>줄간격 <select id="scrollSpacing" aria-label="스크롤 줄간격"><option value="80">좁게</option><option value="100">보통</option><option value="120">넓게</option><option value="140">더 넓게</option></select></label>';zoomTools.appendChild(readingTools);
  document.getElementById('scrollAnchor').onchange=()=>{PromScrollView.setAnchor(document.getElementById('scrollAnchor').value);if(current)current.readingAnchor=PromScrollView.getAnchor();fit();};
  document.getElementById('scrollSpacing').onchange=()=>{const value=Number(document.getElementById('scrollSpacing').value);if(current?.extra?.continuous)PromScrollView.setSpacing(value);else manualSpacing=value;fit();};
  function zoomLabels(){const continuous=!!current?.extra?.continuous;document.getElementById('scrollAnchor').parentElement.hidden=!continuous;document.getElementById('scrollAnchor').value=String(PromScrollView.getAnchor());document.getElementById('scrollSpacing').value=String(continuous?PromScrollView.getSpacing():manualSpacing);const value=continuous?PromScrollView.getScale():manualScale;document.getElementById('scrollTextReset').textContent=value+'%';document.getElementById('scrollTextSmaller').disabled=value<=60;document.getElementById('scrollTextLarger').disabled=value>=180;}
  for(const [id,delta]of [['scrollTextSmaller',-10],['scrollTextReset',0],['scrollTextLarger',10]])document.getElementById(id).onclick=()=>{if(current?.extra?.continuous)PromScrollView.setScale(delta?PromScrollView.getScale()+delta:100);else manualScale=Math.max(60,Math.min(180,delta?manualScale+delta:100));zoomLabels();fit();};
  addEventListener('storage',e=>{if(['promScrollTextScale','promScrollAnchor','promScrollSpacing'].includes(e.key)){if(current)current.readingAnchor=PromScrollView.getAnchor();zoomLabels();fit();}});
  document.getElementById('paper').addEventListener('click',e=>{if(e.target.closest('button,select,label'))return;if(!zoomTools.hidden)toggleTools(false);else{showToolsButton();scheduleToolsHide();}});
  addEventListener('keydown',e=>{if(e.key==='Escape'&&!zoomTools.hidden)toggleTools(false);});
  const receive=d=>{
    if(d?.type==='heartbeat'){lastSeen=Date.now();if(current)document.body.classList.add('connected');return;}
    if(d?.type!=='frame' || !Array.isArray(d.pages))return;
    if(d.extra?.continuous&&d.extra.manualScrollPage&&Array.isArray(d.document))d={...d,readingAnchor:0,cursor:d.ranges?.[d.page]?.find(r=>r[1]>r[0])?.[0]??d.cursor,document:d.document.map((pg,pi)=>pi===d.page?pg:[])};
    current=d;lastSeen=Date.now();
    document.body.classList.add('connected');
    const extra=d.extra||{};
    const pageNumber=document.getElementById('manuscriptPageNumber');
    // 조작창의 [쪽] 체크 여부가 원본 PPT에서도 그대로 적용되도록 한 가지 값만 사용한다.
    const shownPage=d.pageNumber;
    pageNumber.hidden=!Number.isInteger(shownPage)||shownPage<1||shownPage>999;
    pageNumber.textContent=pageNumber.hidden?'':String(shownPage);
    zoomLabels();
    document.getElementById('paper').style.transform=`scale(${extra.mirrorX?-1:1},${extra.mirrorY?-1:1})`;
    const notice=document.getElementById('stageNotice');notice.textContent=typeof extra.message==='string'?extra.message.slice(0,140):'';notice.hidden=!notice.textContent;
    display.classList.toggle('scroll-host',!!extra.continuous);
    if(!extra.continuous){if(!d.originalKey)display.replaceChildren();scrollRenderer.key='';}else {display.style.fontSize='';display.style.width=display.style.height='';}
    document.body.style.setProperty('--focus',d.dark?(d.focus==='#b6f36a'?'#b6f36a':'#ffff00'):'#0000ff');
    document.getElementById('paper').style.backgroundColor=d.dark?'#000':'#fff';display.style.color=d.dark?'#fff':'#000';
    document.getElementById('paper').style.backgroundImage=!d.dark && typeof d.bg==='string' && /^(data:image\/|blob:)/.test(d.bg)?`url("${d.bg.replace(/["\\\n\r]/g,'')}")`:'';
    if(extra.continuous&&Array.isArray(d.document)){scrollRenderer.update(d);syncPageNumberFont();document.title=`${d.page+1} / ${d.total} · 슬라이드쇼`;return;}
    if(d.originalKey){
      if(d.originalSlide){
        originalSceneCache.set(d.originalKey,d.originalSlide);
        if(originalSceneCache.size>20)originalSceneCache.delete(originalSceneCache.keys().next().value);
      }
      const scene=originalSceneCache.get(d.originalKey);
      if(!scene){
        display.textContent='PPT 원본 슬라이드를 받는 중입니다…';
        channel.postMessage({type:'ready'});
        return;
      }
      const textKey=JSON.stringify(d.pages);
      if(displayedOriginalKey!==d.originalKey||displayedTextKey!==textKey){
        display.replaceChildren();
        const layer=document.createElement('div');
        display.appendChild(layer);
        window.PromPptxOriginal.renderSlide(layer,scene,d.pages,d.range,d.cursor,d.dim);
        displayedOriginalKey=d.originalKey;displayedTextKey=textKey;
      }else{
        display.querySelectorAll('[data-ppt-row]').forEach(row=>{
          const range=d.range?.[Number(row.dataset.pptRow)];
          row.classList.toggle('read',!!d.dim&&!!range&&range[1]>range[0]&&d.cursor>=range[1]);
        });
      }
      document.title=`${d.page+1} / ${d.total} · 슬라이드쇼`;
      fit();return;
    }
    displayedOriginalKey='';displayedTextKey='';
    for(let i=0;i<Math.max(d.lines,d.pages.length);i++){
      const row=document.createElement('div'),wrap=document.createElement('span'),r=d.range?.[i];row.className='ln';
      if(r && r[1]>r[0]){if(d.dim && d.cursor>=r[1])row.classList.add('read');/* 한 장 송출 화면에서는 현재 줄 세로바를 표시하지 않는다. */}
      for(const run of d.pages[i]||[]){const s=document.createElement('span');s.textContent=run.t;s.className=['b','r','n'].includes(run.c)?run.c:'';if(/^#[0-9a-f]{6}$/i.test(run.hex||''))s.style.color=run.hex;wrap.appendChild(s);}
      row.appendChild(wrap);display.appendChild(row);
    }
    if(d.nextCue){const row=document.createElement('div'),span=document.createElement('span');row.className='ln next-cue';row.style.color=d.dark?'#73d8ff':'#005b78';span.textContent=d.nextCue;row.appendChild(span);display.appendChild(row);}
    document.title=`${d.page+1} / ${d.total} · 슬라이드쇼`;fit();
  };
  addEventListener('keydown',e=>{
    if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||e.target.isContentEditable||e.ctrlKey||e.metaKey||e.altKey)return;
    if(e.target.tagName==='BUTTON'&&e.key===' ')return;
    const action=['ArrowRight','ArrowDown','PageDown',' '].includes(e.key)?'next':['ArrowLeft','ArrowUp','PageUp'].includes(e.key)?'prev':e.key==='Home'?'home':null;
    if(action){e.preventDefault();channel.postMessage({type:'navigate',action});}
  });
  channel.onmessage=e=>receive(e.data);
  addEventListener('message',e=>{if(e.origin===location.origin && e.source===window.opener)receive(e.data);});
  channel.postMessage({type:'ready'});window.opener?.postMessage({type:'ready'},location.origin);addEventListener('resize',fit);
  setInterval(()=>{if(Date.now()-lastSeen>10000){document.body.classList.remove('connected');document.getElementById('connection').textContent='조작 화면 연결 확인 · 마지막 원고를 표시하고 있습니다.';}},3000);
  // 글꼴 로딩이 끝난 뒤 긴 줄의 폭과 스크롤 위치를 다시 맞춘다.
  document.fonts?.ready.then(fit);
  const fullButton=document.getElementById('fullscreen');
  function syncFullscreen(){const active=!!document.fullscreenElement;fullButton.hidden=active;fullButton.classList.add('fullscreen-start');fullButton.title='송출창만 전체화면으로 전환합니다';fullButton.textContent='전체화면 ⛶';channel.postMessage({type:'fullscreen-state',active});}
  let requestingFullscreen=false;
  async function enterFullscreen(target){
    if(!target||!Number.isFinite(target.left)){try{target=window.opener?.PromAudienceScreens?.target()||null;}catch{target=null;}}
    if(document.fullscreenElement||requestingFullscreen)return;
    requestingFullscreen=true;
    try{await PromOutputFullscreen.enter(target);syncFullscreen();}
    finally{requestingFullscreen=false;}
  }
  window.startSlideshowFullscreen=enterFullscreen;
  fullButton.onclick=enterFullscreen;
  document.addEventListener('fullscreenchange',syncFullscreen);
  syncFullscreen();
  if(new URLSearchParams(location.search).get('fullscreen')==='1')enterFullscreen();
})();

