(()=>{
'use strict';
const $=id=>document.getElementById(id),input=$('editFont'),list=$('editorFonts'),select=$('editFontList'),button=$('loadLocalFonts'),status=$('editFontStatus');
const common=['마루 부리OTF 굵은','Malgun Gothic','맑은 고딕','바탕','궁서','돋움','굴림','HY견고딕','HY견명조','나눔고딕','나눔명조','나눔스퀘어','NanumGothic','NanumMyeongjo','Noto Sans KR','Noto Serif KR','Pretendard','Arial','Georgia','Times New Roman','Verdana'];
let installed=[];
function fill(){
 const names=[...new Set([...installed,...common])];
 list.replaceChildren();select.replaceChildren();
 const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='글꼴 목록에서 선택';select.append(placeholder);
 for(const name of names){
  const option=document.createElement('option');option.value=name;option.textContent=name+(installed.includes(name)?' · PC 설치':'');select.append(option);
  const hint=document.createElement('option');hint.value=name;list.append(hint);
 }
}
fill();
select.onchange=()=>{if(!select.value)return;input.value=select.value;input.dispatchEvent(new Event('input',{bubbles:true}));select.value='';};
button.onclick=async()=>{
 if(typeof window.queryLocalFonts!=='function'){status.textContent='이 브라우저는 PC 글꼴 목록을 불러올 수 없습니다. PC용 Chrome·Edge에서 사용하거나 글꼴 이름을 직접 입력하세요.';return;}
 button.disabled=true;status.textContent='PC 글꼴 목록을 불러오는 중…';
 try{
  const fonts=await window.queryLocalFonts();
  installed=[...new Set(fonts.map(f=>f.family).filter(f=>typeof f==='string'&&f.trim()))].sort((a,b)=>a.localeCompare(b,'ko'));
  fill();status.textContent=installed.length?'PC 글꼴 '+installed.length+'종을 추가했습니다. 목록에서 선택하거나 글꼴 칸에 이름을 입력해 찾으세요.':'불러온 글꼴이 없습니다. 브라우저의 글꼴 접근 허용을 확인하거나 이름을 직접 입력하세요.';
 }catch(e){status.textContent=e.name==='NotAllowedError'?'글꼴 접근이 허용되지 않았습니다. 다시 허용하거나 글꼴 이름을 직접 입력하세요.':'글꼴 목록을 불러오지 못했습니다. 글꼴 이름을 직접 입력할 수 있습니다.';}
 finally{button.disabled=false;}
};
})();
