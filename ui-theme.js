// 프롬프터와 방송용 PPT 공통: 화면 전체를 어둡게/밝게 고르는 설정. 같은 사이트라 한쪽에서 고르면 다른 쪽도 따른다.
(()=>{
'use strict';
const KEY='promUiTheme',root=document.documentElement;
const get=()=>{try{return localStorage.getItem(KEY)==='light'?'light':'dark'}catch(_){return 'dark'}};
// 밝게: 조작 화면 전체를 반전하고, 원고·슬라이드·그림처럼 실제 색이 중요한 곳은 다시 반전해 원래 색으로 둔다.
const style=document.createElement('style');
style.textContent=`html[data-ui="light"]{filter:invert(1) hue-rotate(180deg);background:#000}
html[data-ui="light"] :is(#page,#localScroll,.mini-paper,img,video,canvas,picture,svg image,.slide-canvas,iframe){filter:invert(1) hue-rotate(180deg)}
html[data-ui="light"] :is(#page,#localScroll,.slide-canvas) :is(img,video,canvas,.slide-canvas){filter:none}
.ui-theme-toggle{flex-shrink:0;white-space:nowrap;width:32px;height:32px;min-width:0!important;padding:0!important;display:inline-flex;align-items:center;justify-content:center;font-size:16px;line-height:1;border-radius:50%!important}
header.brandrow .app-switch{margin-left:auto}header.brandrow .ui-theme-toggle{margin-left:8px}`;
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
  apply(get());
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',place);else place();
window.PromUiTheme={toggle,get};
})();
