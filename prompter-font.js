// 프롬프터 본문 글꼴: 원고마다 저장하고, 새 원고에는 마지막으로 고른 글꼴을 쓴다. 빈 값은 기본 글꼴(PFont = HY견고딕)이다.
(function(root){
  'use strict';
  const STORAGE='promFontPick',LOAD='__load_local_fonts__';
  const COMMON=[['','기본 (HY견고딕)'],['맑은 고딕','맑은 고딕'],['굴림','굴림'],['돋움','돋움'],['바탕','바탕'],['궁서','궁서'],['HY견명조','HY견명조'],['HY헤드라인M','HY헤드라인M'],['나눔고딕','나눔고딕'],['나눔명조','나눔명조'],['나눔스퀘어','나눔스퀘어'],['Noto Sans KR','Noto Sans KR'],['Pretendard','Pretendard']];
  const selects=[];let installed=[];
  // CSS 값 안에 들어가므로 따옴표·괄호 같은 글자는 빼고 길이를 제한한다.
  function clean(name){return typeof name==='string'?name.replace(/["'\\;{}()<>]/g,'').trim().slice(0,80):'';}
  // --prom-font-pick 이 없으면 CSS의 기본 글꼴(PFont, 모바일은 맑은 고딕)을 그대로 쓴다.
  function apply(name,target=document.documentElement){name=clean(name);if(name)target.style.setProperty('--prom-font-pick','"'+name+'"');else target.style.removeProperty('--prom-font-pick');}
  function remembered(){try{return clean(localStorage.getItem(STORAGE)||'');}catch(_){return '';}}
  function remember(name){try{localStorage.setItem(STORAGE,clean(name));}catch(_){}}
  function fill(select,value){
    value=clean(value);const names=new Set(COMMON.map(c=>c[0]));select.replaceChildren();
    const add=(v,label)=>{const o=document.createElement('option');o.value=v;o.textContent=label;select.append(o);};
    for(const [v,label] of COMMON)add(v,label);
    for(const name of installed)if(!names.has(name)){names.add(name);add(name,name+' · PC 설치');}
    if(value&&!names.has(value))add(value,value);
    if(typeof root.queryLocalFonts==='function'&&!installed.length)add(LOAD,'내 PC 글꼴 더 불러오기…');
    select.value=value;select.dataset.value=value;
  }
  async function loadInstalled(){
    try{const fonts=await root.queryLocalFonts();installed=[...new Set(fonts.map(f=>clean(f.family)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));return installed.length>0;}
    catch(_){return false;}
  }
  // onPick(name) 은 사용자가 실제 글꼴을 골랐을 때만 부른다. '더 불러오기'는 목록만 늘리고 원래 선택으로 돌아간다.
  function bind(select,value,onPick){
    selects.push(select);fill(select,value);
    select.addEventListener('change',async()=>{
      if(select.value!==LOAD){select.dataset.value=select.value;onPick(select.value);return;}
      const prev=select.dataset.value||'';select.value=prev;
      if(await loadInstalled())for(const s of selects)fill(s,s.dataset.value||'');
      else root.toast?.('PC 글꼴 목록을 불러오지 못했습니다. 브라우저의 글꼴 접근 허용을 확인하세요.',5000);
    });
  }
  // 굵게: true=700, false=보통. 한 번도 고르지 않은 원고(undefined)는 화면마다 원래 굵기를 그대로 쓴다.
  function applyBold(bold,target=document.documentElement){if(typeof bold==='boolean')target.style.setProperty('--prom-font-weight',bold?'700':'400');else target.style.removeProperty('--prom-font-weight');}
  root.PromFont={clean,apply,remembered,remember,bind,show:fill,applyBold};
})(typeof window!=='undefined'?window:globalThis);
