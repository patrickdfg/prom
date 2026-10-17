(() => {
  const id=location.hash.slice(1), display=document.getElementById('display');
  if(!/^[a-f0-9-]{36}$/.test(id) || !('BroadcastChannel' in window)){display.textContent='조작 화면 상단의 슬라이드쇼 버튼으로 열어 주세요.';return;}
  const scrollRenderer=new PromScrollView(display);
  const channel=new BroadcastChannel('prom-display-'+id); let current=null,lastSeen=Date.now();
  function fit(){
    if(!current)return;
    if(current.extra?.continuous){scrollRenderer.position='';scrollRenderer.layout='';scrollRenderer.update(current);return;}
    const rows=Math.max(1,current.lines,current.pages.length);
    const metrics=PromSlideLayout.measure(innerWidth,innerHeight,rows);
    display.style.width=metrics.width+'px';display.style.height=metrics.height+'px';
    display.style.fontSize=metrics.font+'px';
    display.querySelectorAll('.ln>span').forEach(s=>{s.style.transform='';const w=s.scrollWidth,max=s.parentElement.clientWidth;if(w>max)s.style.transform=`scale(${max/w})`;});
  }
  const zoomTools=document.getElementById('scrollTextTools');let zoomTimer;
  const readingTools=document.createElement('span');readingTools.innerHTML='<label>읽는 위치 <select id="scrollAnchor" aria-label="읽는 줄 위치"><option value="0.2">위쪽</option><option value="0.35">중간 위</option><option value="0.5">가운데</option></select></label><label>줄간격 <select id="scrollSpacing" aria-label="스크롤 줄간격"><option value="80">좁게</option><option value="100">보통</option><option value="120">넓게</option><option value="140">더 넓게</option></select></label>';zoomTools.appendChild(readingTools);
  document.getElementById('scrollAnchor').onchange=()=>{PromScrollView.setAnchor(document.getElementById('scrollAnchor').value);if(current)current.readingAnchor=PromScrollView.getAnchor();fit();};
  document.getElementById('scrollSpacing').onchange=()=>{PromScrollView.setSpacing(document.getElementById('scrollSpacing').value);fit();};
  function zoomLabels(){document.getElementById('scrollAnchor').value=String(PromScrollView.getAnchor());document.getElementById('scrollSpacing').value=String(PromScrollView.getSpacing());const value=PromScrollView.getScale();document.getElementById('scrollTextReset').textContent=value+'%';document.getElementById('scrollTextSmaller').disabled=value<=60;document.getElementById('scrollTextLarger').disabled=value>=180;}
  for(const [id,delta]of [['scrollTextSmaller',-10],['scrollTextReset',0],['scrollTextLarger',10]])document.getElementById(id).onclick=()=>{PromScrollView.setScale(delta?PromScrollView.getScale()+delta:100);zoomLabels();fit();};
  addEventListener('storage',e=>{if(['promScrollTextScale','promScrollAnchor','promScrollSpacing'].includes(e.key)){if(current)current.readingAnchor=PromScrollView.getAnchor();zoomLabels();fit();}});
  addEventListener('mousemove',e=>{if(zoomTools.hidden)return;clearTimeout(zoomTimer);if(e.clientY>=innerHeight-60||zoomTools.contains(e.target))document.body.classList.add('zoom-open');else zoomTimer=setTimeout(()=>document.body.classList.remove('zoom-open'),900);});
  addEventListener('pointerdown',e=>{if(!zoomTools.hidden&&e.clientY>=innerHeight-60)document.body.classList.add('zoom-open');});
  zoomTools.addEventListener('focusin',()=>document.body.classList.add('zoom-open'));
  const receive=d=>{
    if(d?.type==='heartbeat'){lastSeen=Date.now();if(current)document.body.classList.add('connected');return;}
    if(d?.type!=='frame' || !Array.isArray(d.pages))return;current=d;lastSeen=Date.now();
    document.body.classList.add('connected');
    const extra=d.extra||{};zoomTools.hidden=!extra.continuous;zoomLabels();
    document.getElementById('paper').style.transform=`scale(${extra.mirrorX?-1:1},${extra.mirrorY?-1:1})`;
    const notice=document.getElementById('stageNotice');notice.textContent=typeof extra.message==='string'?extra.message.slice(0,140):'';notice.hidden=!notice.textContent;
    display.classList.toggle('scroll-host',!!extra.continuous);
    if(!extra.continuous){display.replaceChildren();scrollRenderer.key='';}else {display.style.fontSize='';display.style.width=display.style.height='';}
    document.body.style.setProperty('--focus',d.dark?(d.focus==='#b6f36a'?'#b6f36a':'#ffff00'):'#0000ff');
    document.getElementById('paper').style.backgroundColor=d.dark?'#000':'#fff';display.style.color=d.dark?'#fff':'#000';
    document.getElementById('paper').style.backgroundImage=!d.dark && typeof d.bg==='string' && /^(data:image\/|blob:)/.test(d.bg)?`url("${d.bg.replace(/["\\\n\r]/g,'')}")`:'';
    if(extra.continuous&&Array.isArray(d.document)){scrollRenderer.update(d);document.title=`${d.page+1} / ${d.total} · 슬라이드쇼`;return;}
    for(let i=0;i<Math.max(d.lines,d.pages.length);i++){
      const row=document.createElement('div'),wrap=document.createElement('span'),r=d.range?.[i];row.className='ln';
      if(r && r[1]>r[0]){if(d.dim && d.cursor>=r[1])row.classList.add('read');else if(d.cursor>=r[0] && d.cursor<r[1])row.classList.add('current');}
      for(const run of d.pages[i]||[]){const s=document.createElement('span');s.textContent=run.t;s.className=['b','r','n'].includes(run.c)?run.c:'';wrap.appendChild(s);}
      row.appendChild(wrap);display.appendChild(row);
    }
    if(d.nextCue){const row=document.createElement('div'),span=document.createElement('span');row.className='ln next-cue';row.style.color=d.dark?'#73d8ff':'#005b78';span.textContent=d.nextCue;row.appendChild(span);display.appendChild(row);}
    document.title=`${d.page+1} / ${d.total} · 슬라이드쇼`;fit();
  };
  channel.onmessage=e=>receive(e.data);
  addEventListener('message',e=>{if(e.origin===location.origin && e.source===window.opener)receive(e.data);});
  channel.postMessage({type:'ready'});window.opener?.postMessage({type:'ready'},location.origin);addEventListener('resize',fit);
  setInterval(()=>{if(Date.now()-lastSeen>10000){document.body.classList.remove('connected');document.getElementById('connection').textContent='조작 화면 연결 확인 · 마지막 원고를 표시하고 있습니다.';}},3000);
  // 글꼴 로딩이 끝난 뒤 긴 줄의 폭과 스크롤 위치를 다시 맞춘다.
  document.fonts?.ready.then(fit);
  const fullButton=document.getElementById('fullscreen');
  function syncFullscreen(){const active=!!document.fullscreenElement;fullButton.hidden=active;fullButton.classList.add('fullscreen-start');fullButton.textContent='여기를 클릭하여 전체화면 시작\n조작창은 기존 모니터에 유지됩니다';channel.postMessage({type:'fullscreen-state',active});}
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
  document.getElementById('paper').addEventListener('click',()=>{if(!document.fullscreenElement)enterFullscreen();});
  document.addEventListener('fullscreenchange',syncFullscreen);
  syncFullscreen();
  if(new URLSearchParams(location.search).get('fullscreen')==='1')enterFullscreen();
})();
