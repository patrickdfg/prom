// 프롬프터·PPT 만들기·방송용 PPT 공통: 화면 전체를 어둡게/밝게 고르는 설정(같은 사이트라 한쪽에서 고르면 다른 쪽도 따른다)과,
// 세 곳 오른쪽 맨 위에 같은 모양으로 붙는 「Family 사이트」 이동 메뉴.
(()=>{
'use strict';
const SRC=document.currentScript&&document.currentScript.src;
const KEY='promUiTheme',root=document.documentElement;
const get=()=>{try{return localStorage.getItem(KEY)==='light'?'light':'dark'}catch(_){return 'dark'}};
// 밝게: 조작 화면 전체를 반전하고, 원고·슬라이드·그림처럼 실제 색이 중요한 곳은 다시 반전해 원래 색으로 둔다.
const style=document.createElement('style');
style.textContent=`html[data-ui="light"]{filter:invert(1) hue-rotate(180deg);background:#000}
html[data-ui="light"] :is(#page,#localScroll,.mini-paper,img,video,canvas,picture,svg image,.slide-canvas,iframe){filter:invert(1) hue-rotate(180deg)}
html[data-ui="light"] :is(#page,#localScroll,.slide-canvas) :is(img,video,canvas,.slide-canvas){filter:none}
.ui-theme-toggle{flex-shrink:0;white-space:nowrap;width:32px;height:32px;min-width:0!important;padding:0!important;display:inline-flex;align-items:center;justify-content:center;font-size:16px;line-height:1;border-radius:50%!important}
header.brandrow .app-switch{margin-left:auto}header.brandrow .ui-theme-toggle{margin-left:8px}
.family-btn{flex-shrink:0;white-space:nowrap;height:32px;min-width:0!important;margin-left:8px;padding:0 10px!important;display:inline-flex;align-items:center;gap:4px;font:13px/1 system-ui,'Malgun Gothic','Apple SD Gothic Neo',sans-serif!important;color:#e6edf3!important;background:#161b22!important;border:1px solid #30363d!important;border-radius:8px!important;cursor:pointer}
.family-btn:hover,.family-btn[aria-expanded="true"]{border-color:#58a6ff!important}
#statusbar .theme-choices .family-btn{height:28px;margin-left:0;padding:5px 7px!important;font-size:11px!important;gap:3px}   /* 프롬프터 위 툴바: 이웃 버튼과 같은 크기로 맞춰 폭이 늘지 않게 */
.family-panel{position:fixed;z-index:2147483000;min-width:170px;padding:6px;background:#161b22;border:1px solid #30363d;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.45);font:13px/1.4 system-ui,'Malgun Gothic','Apple SD Gothic Neo',sans-serif}
.family-panel[hidden]{display:none}
.family-panel .family-title{padding:4px 8px 6px;color:#8b98a8;font-size:12px}
.family-panel a{display:flex;justify-content:space-between;gap:12px;padding:8px 10px;border-radius:6px;color:#e6edf3;text-decoration:none}
.family-panel a:hover,.family-panel a:focus-visible{background:#21262d;outline:none}
.family-panel a[aria-current="page"]{color:#58a6ff;cursor:default}
.family-panel a small{color:#8b98a8}`;
(document.head||root).appendChild(style);
function apply(v){root.dataset.ui=v;for(const b of document.querySelectorAll('.ui-theme-toggle')){b.textContent=v==='light'?'\u263E':'\u2600\uFE0E';b.setAttribute('aria-label',v==='light'?'어둡게':'밝게');b.setAttribute('aria-pressed',String(v==='light'));b.title=v==='light'?'화면을 어둡게(다크 모드)':'화면을 밝게(흰색 모드)';}}
function toggle(){const v=get()==='light'?'dark':'light';try{localStorage.setItem(KEY,v)}catch(_){}apply(v);}
apply(get());
// 다른 탭(프롬프터 ↔ 방송용 PPT)에서 바꾸면 따라 바꾼다
addEventListener('storage',e=>{if(e.key===KEY)apply(get())});
function place(){
  for(const sel of (root.dataset.uiToggle||'').split(',').map(s=>s.trim()).filter(Boolean)){
    const host=document.querySelector(sel);if(!host||host.querySelector('.ui-theme-toggle'))continue;
    const b=document.createElement('button');b.type='button';b.className='ui-theme-toggle'+(host.matches('header.brandrow')?' app-switch':'');b.onclick=toggle;host.appendChild(b);
  }
  // 「Family 사이트」: 페이지가 data-family-host로 자리를 지정하면 그 맨 끝에, 아니면 테마 버튼 바로 오른쪽(맨 끝)에 같은 모양으로
  const famHosts=(root.dataset.familyHost||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(famHosts.length){
    for(const sel of famHosts){const host=document.querySelector(sel);if(host&&!host.querySelector('.family-btn'))host.appendChild(familyButton());}
  }else{
    for(const t of document.querySelectorAll('.ui-theme-toggle')){
      if(t.nextElementSibling&&t.nextElementSibling.classList.contains('family-btn'))continue;
      t.after(familyButton(!!t.closest('#statusbar')));
    }
  }
  apply(get());
}
function familyButton(compact){
  const f=document.createElement('button');f.type='button';f.className='family-btn';f.textContent=compact?'Family ▾':'Family 사이트 ▾';f.title='Family 사이트';
  f.setAttribute('aria-haspopup','true');f.setAttribute('aria-expanded','false');f.onclick=e=>{e.stopPropagation();familyToggle(f);};
  return f;
}
// 세 사이트(프롬프터·PPT 만들기·방송용 PPT) 이동 목록. 이 스크립트가 있는 곳을 사이트 맨 위로 보고 주소를 만든다.
const FAMILY=[['prom','프롬프터','./',''],['make','PPT 만들기','./make/',''],['ppt','방송용 PPT','./ppt/','']];
let panel=null,opener=null;
function familyHere(base){const p=location.href;if(base&&p.startsWith(base+'make/'))return 'make';if(base&&p.startsWith(base+'ppt/'))return 'ppt';return 'prom';}
function familyBuild(){
  let base='';try{base=new URL('.',SRC).href.replace(/\/$/,'/');}catch(_){}
  const here=familyHere(base),el=document.createElement('div');el.className='family-panel';el.hidden=true;el.setAttribute('role','menu');
  const title=document.createElement('div');title.className='family-title';title.textContent='Family 사이트';el.append(title);
  for(const [key,name,href] of FAMILY){
    const a=document.createElement('a');a.setAttribute('role','menuitem');a.textContent=name;
    if(key===here){a.setAttribute('aria-current','page');a.href='#';a.onclick=e=>{e.preventDefault();familyClose();};const s=document.createElement('small');s.textContent='현재';a.append(s);}
    else{a.href=new URL(href,base||location.href).href;a.target='_blank';a.rel='noopener';a.onclick=()=>familyClose();}
    el.append(a);
  }
  document.body.append(el);return el;
}
function familyClose(){if(panel)panel.hidden=true;if(opener){opener.setAttribute('aria-expanded','false');opener=null;}}
function familyToggle(btn){
  if(opener===btn){familyClose();return;}
  familyClose();panel=panel||familyBuild();
  const r=btn.getBoundingClientRect();panel.hidden=false;opener=btn;btn.setAttribute('aria-expanded','true');
  panel.style.top=Math.round(r.bottom+6)+'px';panel.style.right=Math.max(8,Math.round(innerWidth-r.right))+'px';panel.style.left='auto';
}
addEventListener('click',e=>{if(panel&&!panel.hidden&&!panel.contains(e.target))familyClose();});
addEventListener('keydown',e=>{if(e.key==='Escape'&&panel&&!panel.hidden){const b=opener;familyClose();b&&b.focus();}});
addEventListener('resize',familyClose);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',place);else place();
window.PromUiTheme={toggle,get};
})();
