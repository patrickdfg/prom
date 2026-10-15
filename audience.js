(() => {
  const id=location.hash.slice(1), display=document.getElementById('display');
  if(!/^[a-f0-9-]{36}$/.test(id) || !('BroadcastChannel' in window)){display.textContent='조작 화면의 더보기 → 별도 원고 화면으로 열어 주세요.';return;}
  const channel=new BroadcastChannel('prom-display-'+id); let current=null,lastSeen=Date.now();
  function fit(){
    if(!current)return;
    display.style.fontSize=Math.min(innerHeight*.76/((Math.max(current.lines,current.pages.length)+(current.nextCue?1:0))*1.7),innerWidth*.052)+'px';
    display.querySelectorAll('.ln>span').forEach(s=>{s.style.transform='';const w=s.scrollWidth,max=s.parentElement.clientWidth;if(w>max)s.style.transform=`scale(${max/w})`;});
  }
  const receive=d=>{
    if(d?.type==='heartbeat'){lastSeen=Date.now();if(current)document.body.classList.add('connected');return;}
    if(d?.type!=='frame' || !Array.isArray(d.pages))return;current=d;lastSeen=Date.now();
    document.body.classList.add('connected');display.replaceChildren();
    document.body.style.setProperty('--focus',d.dark?(d.focus==='#b6f36a'?'#b6f36a':'#ffff00'):'#0000ff');
    document.getElementById('paper').style.backgroundColor=d.dark?'#000':'#fff';display.style.color=d.dark?'#fff':'#000';
    document.getElementById('paper').style.backgroundImage=!d.dark && typeof d.bg==='string' && /^(data:image\/|blob:)/.test(d.bg)?`url("${d.bg.replace(/["\\\n\r]/g,'')}")`:'';
    for(let i=0;i<Math.max(d.lines,d.pages.length);i++){
      const row=document.createElement('div'),wrap=document.createElement('span'),r=d.range?.[i];row.className='ln';
      if(r && r[1]>r[0]){if(d.dim && d.cursor>=r[1])row.classList.add('read');else if(d.cursor>=r[0] && d.cursor<r[1])row.classList.add('current');}
      for(const run of d.pages[i]||[]){const s=document.createElement('span');s.textContent=run.t;s.className=['b','r','n'].includes(run.c)?run.c:'';wrap.appendChild(s);}
      row.appendChild(wrap);display.appendChild(row);
    }
    if(d.nextCue){const row=document.createElement('div'),span=document.createElement('span');row.className='ln next-cue';row.style.color=d.dark?'#73d8ff':'#005b78';span.textContent=d.nextCue;row.appendChild(span);display.appendChild(row);}
    document.title=`${d.page+1} / ${d.total} · 설교 원고`;fit();
  };
  channel.onmessage=e=>receive(e.data);
  addEventListener('message',e=>{if(e.origin===location.origin && e.source===window.opener)receive(e.data);});
  channel.postMessage({type:'ready'});window.opener?.postMessage({type:'ready'},location.origin);addEventListener('resize',fit);
  setInterval(()=>{if(Date.now()-lastSeen>10000){document.body.classList.remove('connected');document.getElementById('connection').textContent='조작 화면 연결 확인 · 마지막 원고를 표시하고 있습니다.';}},3000);
  document.getElementById('fullscreen').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();
  let hide;document.addEventListener('pointermove',()=>{const b=document.getElementById('fullscreen');b.hidden=false;clearTimeout(hide);hide=setTimeout(()=>{if(document.activeElement!==b)b.hidden=true;},2500);});
})();
