/* 여러 장 보기: 페이지 내용과 음성 추적은 기존 원고를 사용한다. */
(() => {
  'use strict';
  const view=$('view'), grid=$('slideGrid'), panel=$('overview'), toolbar=$('overviewToolbar');
  let enabled=false, signature='', active=-1, cards=[], zoom=100;
  try{zoom=Math.max(60,Math.min(180,Number(localStorage.getItem('promOverviewZoom'))||100));}catch(_){}
  function size(){
    grid.style.setProperty('--card-width',Math.round(330*zoom/100)+'px');
    $('overviewZoom').value=zoom;$('overviewZoomValue').textContent=zoom+'%';
  }
  function bounds(){
    if(!enabled)return;
    panel.style.bottom=($('bar').getBoundingClientRect().height+8)+'px';
    panel.style.top=(toolbar.offsetTop+toolbar.offsetHeight+8)+'px';
  }
  function setMode(value){
    if(value){if(editing)endEdit();window.PromUI?.finishNote();}
    enabled=value;view.classList.toggle('overview-mode',value);
    panel.hidden=toolbar.hidden=!value;
    $('viewSingle').setAttribute('aria-pressed',String(!value));
    $('viewMultiple').setAttribute('aria-pressed',String(value));
    if(value){update();bounds();}else{fit();render();}
    showBar();
  }
  function build(){
    const dark=$('theme').value==='dark';
    grid.replaceChildren();cards=[];
    const fragment=document.createDocumentFragment();
    P.forEach((pg,pi)=>{
      const card=document.createElement('button');card.type='button';card.className='slide-card';
      card.setAttribute('aria-label',`${pi+1}쪽으로 이동`);
      const paper=document.createElement('div');paper.className='mini-paper'+(dark?' dark':'')+(MOBILE?' mobile':'');
      if(!dark)paper.style.backgroundImage=$('page').style.backgroundImage;
      const lines=document.createElement('div');lines.className='mini-lines';
      const count=Math.max(LINES,pg.length);lines.style.fontSize=(5.38*5/count)+'cqw';
      if(count===6)lines.style.inset='8.82% 2.38%';
      if(count===7)lines.style.inset='13.39% 2.38%';
      for(let i=0;i<count;i++){
        const line=document.createElement('div');line.className='mini-line';
        for(const run of pg[i]||[]){const span=document.createElement('span');span.textContent=run.t;span.className=['b','r','n'].includes(run.c)?run.c:'';line.appendChild(span);}
        lines.appendChild(line);
      }
      paper.appendChild(lines);
      const label=document.createElement('div');label.className='slide-label';
      const number=document.createElement('span');number.textContent=String(pi+1);
      const badge=document.createElement('span');badge.className='slide-live';badge.textContent='현재 원고';
      label.append(number,badge);card.append(paper,label);
      card.onclick=()=>go(pi,true);
      card.ondblclick=()=>setMode(false);
      fragment.appendChild(card);cards.push(card);
    });
    grid.appendChild(fragment);
  }
  function update(){
    if(!enabled)return;
    const next=JSON.stringify([P,LINES,MOBILE,$('theme').value,$('page').style.backgroundImage]);
    const rebuilt=signature!==next;
    if(rebuilt){signature=next;build();}
    cards.forEach((card,pi)=>{
      card.classList.toggle('active',pi===page);
      if(pi===page)card.setAttribute('aria-current','page');else card.removeAttribute('aria-current');
      card.querySelectorAll('.mini-line').forEach((line,i)=>{
        const r=lineRange[pi]?.[i];
        line.classList.toggle('read',pi===page&&$('dim').checked&&!!r&&r[1]>r[0]&&cursor>=r[1]);
      });
    });
    $('overviewCount').textContent=`현재 ${page+1} / ${P.length}쪽`;
    if(rebuilt||active!==page){
      active=page;const card=cards[page];
      if(card){const top=card.offsetTop,bottom=top+card.offsetHeight;if(top<panel.scrollTop||bottom>panel.scrollTop+panel.clientHeight)panel.scrollTop=Math.max(0,top-16);}
    }
    bounds();
  }
  $('viewSingle').onclick=()=>setMode(false);
  $('viewMultiple').onclick=()=>setMode(true);
  $('overviewZoom').oninput=()=>{zoom=Number($('overviewZoom').value);size();try{localStorage.setItem('promOverviewZoom',String(zoom));}catch(_){}};
  $('overviewCurrent').onclick=()=>{cards[page]?.scrollIntoView({block:'center',behavior:'smooth'});};
  $('overviewAudience').onclick=()=>$('audience').click();
  // 메모와 본문 편집은 실제 한 장 화면에서 수행한다.
  $('note').addEventListener('click',()=>{if(enabled)setMode(false);},true);
  const ui=window.PromUI;
  const oldRender=ui.render;ui.render=function(...args){oldRender.apply(this,args);update();};
  const oldEdit=ui.beforeBodyEdit;ui.beforeBodyEdit=function(...args){if(enabled)setMode(false);return oldEdit.apply(this,args);};
  const oldHold=ui.holdControls;ui.holdControls=function(){return enabled||oldHold.call(this);};
  if(window.ResizeObserver)new ResizeObserver(bounds).observe($('bar'));
  addEventListener('resize',bounds);
  size();
})();
