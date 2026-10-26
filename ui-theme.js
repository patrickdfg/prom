// 프롬프터·PPT 만들기·방송용 PPT 공통: 화면 전체를 어둡게/밝게 고르는 설정(같은 사이트라 한쪽에서 고르면 다른 쪽도 따른다)과,
// 세 곳 오른쪽 맨 위에 같은 모양으로 붙는 「Family 사이트」 이동 메뉴.
(()=>{
'use strict';
const SRC=document.currentScript&&document.currentScript.src;
const KEY='promUiTheme',root=document.documentElement;
const get=()=>{try{return localStorage.getItem(KEY)==='light'?'light':'dark'}catch(_){return 'dark'}};
// 밝게: 조작 화면의 색만 바꾼다. 페이지/미디어 반전은 원색 손실과 native dialog의 색 반전을 일으키므로 사용하지 않는다.
const style=document.createElement('style');
style.textContent=`html[data-ui="light"]{
 --bg:#f3f5f8;--panel:#ffffff;--card:#ffffff;--line:#c8d2df;--text:#172333;--muted:#52657b;--dim:#52657b;
 --accent:#1765ba;--accent2:#1765ba;--ok:#16824f;--warn:#895900;--bad:#bd2738;--danger:#bd2738;
 background:#f3f5f8;color:#172333;color-scheme:light;
}
html[data-ui="light"] body{background:var(--bg);color:var(--text)}
/* Only UI surfaces are themed. Never target slide objects, media, or reading-page content. */
html[data-ui="light"] :is(.top,header.brandrow,#statusbar,#bar,#fontPanel,#ttsPanel,#setpanel,.control-pane,.manuscript-pane,.slides-pane,.imports,.transport,.mapping,.heard,.drive-bar,.drive-status,.caption-navigation,.overview-toolbar,.pane-heading,footer,#help,#status,.editor-bottom,.family-panel,dialog,.ce-head,.ce-card,.setup-card,.input-tabs,#drop,#resumeCard,#ceState,#toast,.toast){
 background:#ffffff!important;color:#172333!important;border-color:#c8d2df!important;
}
html[data-ui="light"] :where(button,.file-button,.btnlike,select,textarea,input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"])):not(:where(.slide-canvas *,#page *,#localScroll *,.mini-paper *)){
 background:#edf2f8!important;color:#172333!important;border-color:#bbc9d9!important;
}
html[data-ui="light"] :where(button,.file-button,.btnlike):hover:not(:where(.slide-canvas *,#page *,#localScroll *,.mini-paper *)){background:#dce7f4!important}
html[data-ui="light"] :is(input,select,textarea){accent-color:#147b58}
html[data-ui="light"] :is(button.primary,.btn:not(.ghost),#ceDone){background:#1765ba!important;border-color:#1765ba!important;color:#ffffff!important}
html[data-ui="light"] :is(button.primary,.btn:not(.ghost),#ceDone):hover{background:#104c91!important}
html[data-ui="light"] :is(.brand,.brand b,.brand span,.family-title,.editor-heading,.preview-title,.card-info,.card-text,.mapping-fields label,.editor-fields label,.editor-small,#editorHint,.editor-bottom span,.ce-help,.ce-card-head,.ce-break,.file-button small,.drive-bar span,.heard p,.heard span,.pane-heading h2 span,.brandmark,.empty strong,#connection,#liveLabel){
 color:#3c536d!important;
}
html[data-ui="light"] :is(.family-btn,.family-panel a){background:#edf2f8!important;color:#172333!important;border-color:#bbc9d9!important}
html[data-ui="light"] .family-panel a:hover{background:#dce7f4!important}
html[data-ui="light"] :is(.family-panel a[aria-current="page"],.family-panel a small){color:#1765ba!important}
html[data-ui="light"] :is(.hint,.field,.back,.status,.login-account,.login-note,.tpl small,.empty){color:#52657b}
html[data-ui="light"] :is(.editor-fields legend,#editorDialog legend){color:#3c536d!important}
html[data-ui="light"] :is(.editor-fields fieldset,#editorDialog fieldset,.preview-trio section){border-color:#bbc9d9!important}
html[data-ui="light"] :is(.slide-card,.bg-library-item){background:#ffffff!important;border-color:#bbc9d9!important}
html[data-ui="light"] .slide-card.selected{background:#deedf9!important;border-color:#1765ba!important}
html[data-ui="light"] .slide-card.live{border-color:#b96512!important}
html[data-ui="light"] :is(.input-tabs button,.tabs button)[aria-selected="true"]{background:#d2e7fa!important;border-color:#1765ba!important;color:#154f83!important}
html[data-ui="light"] :is(.view-buttons,.view-switch) [aria-pressed="true"]{background:#d2e7fa!important;border-color:#1765ba!important;color:#154f83!important}
html[data-ui="light"] :is(.card-info .exact,.card-info .manual,#mode,.transport #showStandby){color:#08744d!important}
html[data-ui="light"] :is(.card-info .review,.status.error){color:#925113!important}
html[data-ui="light"] :is(.danger,#editorDialog .danger){color:#a91c30!important;border-color:#bd7180!important}
html[data-ui="light"] :is(#mic.active,#mic.on){color:#a91c30!important;background:#ffe5e9!important;border-color:#bd7180!important}
html[data-ui="light"] :is(#tts.on,#tPP,#tClose,#fontPanel #fClose){color:#513900!important;background:#ffe5a3!important}
html[data-ui="light"] .guide-blue{color:#155cba}
html[data-ui="light"] .guide-green{color:#137344}
html[data-ui="light"] #divider{background:#c8d2df}
html[data-ui="light"] .script-line{color:#263c54!important;background:transparent!important}
html[data-ui="light"] .script-line:hover{background:#e9f0f8!important}
html[data-ui="light"] .script-line.linked{color:#684400!important;background:#fff1ca!important}
html[data-ui="light"] .script-line.current{color:#0e513e!important;background:#d2f1e5!important}
html[data-ui="light"] .script-line.linked.current{color:#543600!important;background:#ffe1a0!important}
html[data-ui="light"] .script-line.past{color:#64758a!important}
html[data-ui="light"] .script-line .number{color:#596e86!important}
html[data-ui="light"] #continuousEditor .ce-lines{color:#172333;caret-color:#1765ba}
html[data-ui="light"] #continuousEditor .ce-lines .b{color:#155cba}
html[data-ui="light"] #continuousEditor .ce-lines .r{color:#bd2738}
html[data-ui="light"] #continuousEditor .ce-lines .n{color:#1765ba}
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
