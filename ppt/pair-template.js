/* Evidence-based recipes from a manuscript and its finished presentation. No network/AI call. */
(function(root){
'use strict';
const C=typeof module==='object'&&module.exports?require('./core.js'):root.CaptionCore;
const textOf=shape=>(shape.paragraphs||[]).map(p=>(p.runs||[]).map(r=>r.text||'').join('')).join('\n');
const choices={caption:'하단 자막',word:'말씀',wordGod:'하나님 말씀',wordSon:'성자 말씀',wordSpirit:'성령 말씀',wordTeacher:'선생님 말씀 (인물 없음)',verse:'성경 구절',emphasis:'큰 글씨 강조',proverb:'잠언 항목'};
function analyze(manuscript,deck){
 const ix=C.index(manuscript.lines),slides=deck.slides||[],candidates=[];
 const rows=slides.map((slide,index)=>{
  const bodies=slide.shapes.map((shape,bodyIndex)=>({shape,bodyIndex,text:textOf(shape)})).filter(b=>b.shape.type==='text'&&C.normalize(b.text).length>=6);
  // Only use manuscript text as evidence. Titles, dates and fixed labels must not become body text.
  for(const b of bodies){const needle=C.normalize(b.text);b.hit=ix.text.indexOf(needle);b.length=needle.length;}
  const body=bodies.filter(b=>b.hit>=0).sort((a,b)=>b.length-a.length)[0];
  if(!body)return {text:'',slide,index,bodyIndex:-1};
  return {...body,slide,index};
 });
 const links=C.align(manuscript.lines,rows);
 rows.forEach((row,i)=>{
  if(row.bodyIndex<0||links[i].status!=='exact')return;
  const {slide,shape,text}=row,known=slide.editor?.layout;
  // 번호로 시작하는 전체 화면 장은 잠언 항목이다. 글에 '하나님'이 들어 있어도 말씀 장과 섞지 않는다.
  const numbered=/^\s*\d+\s*[.)]\s*\S/.test(text)&&shape.w/slide.width>=.8&&shape.y/slide.height<.6;
  let layout=Object.hasOwn(choices,known)?known:shape.y/slide.height>=.6?'caption':numbered?'proverb':/[（(]?[가-힣]{1,8}\s*\d+\s*[:장]\s*\d+/.test(text)?'verse':'word';
  if(layout==='word'){const speaker=text.split('\n').filter(s=>s.trim()).slice(0,2).join('\n').match(/성령님?|하나님|성자(?:님)?|예수님?|선생님/);if(speaker)layout=/성령/.test(speaker[0])?'wordSpirit':/하나님/.test(speaker[0])?'wordGod':/선생님/.test(speaker[0])?'wordTeacher':'wordSon';}
  const counts=new Map();for(const p of shape.paragraphs||[])for(const r of p.runs||[]){const key=JSON.stringify([r.font,r.size,r.bold,r.color]);const v=counts.get(key)||{run:r,n:0};v.n+=C.normalize(r.text).length;counts.set(key,v);}
  const base=[...counts.values()].sort((a,b)=>b.n-a.n)[0]?.run||{};
  candidates.push({slideIndex:i,bodyIndex:row.bodyIndex,layout,text,start:links[i].start,end:links[i].end,cumulative:links[i].reason==='cumulative',font:base.font||'',size:base.size||0,style:structuredClone(base),lines:text.split('\n').length});
 });
 // 원고에 연결되지 않은 장은 매주 들어가는 고정 장(표지·찬양·광고·마무리 등)으로 보고 템플릿에 함께 담는다.
 const total=links.filter(l=>l.status==='exact').length,fixed=[];let before=0;
 rows.forEach((row,i)=>{if(links[i].status==='exact'){before++;return;}const t=slides[i].shapes.filter(s=>s.type==='text').map(textOf).join(' ').replace(/\s+/g,' ').trim();fixed.push({slideIndex:i,before,total,status:links[i].status,label:t.slice(0,40),keep:true});});
 if(!candidates.length&&!slides.some(s=>s.shapes.some(sh=>sh.type==='text'&&C.normalize(textOf(sh)).length>=2)))throw Error(`이 PPT는 ${slides.length}장 모두 글자가 그림으로 들어 있어(편집 가능한 글자 0개) 서식을 배울 수 없습니다. 글자를 직접 입력한 원본 PPT(그림·PDF로 내보내지 않은 것)로 다시 시도하거나, 목록의 「기본 주일설교 템플릿」을 쓰세요.`);
 if(!candidates.length)throw Error('원고와 정확히 일치하는 편집 가능한 PPT 본문을 찾지 못했습니다. 같은 원고로 만든 PPT인지 확인하세요. 이미지로 된 글자와 중복·유사 문장은 자동 학습하지 않습니다.');
 return {version:1,scriptName:manuscript.name||'',deckName:deck.name||'',totalSlides:slides.length,matchedSlides:candidates.length,candidates,fixed,warnings:deck.warnings||[]};
}
function build(analysis,slides,design){
 const selected=analysis.candidates.filter(c=>Object.hasOwn(choices,c.layout));
 if(!selected.length)throw Error('저장할 레이아웃을 한 개 이상 선택하세요.');
 const output=structuredClone(design),groups=new Map();
 for(const c of selected){const list=groups.get(c.layout)||[];list.push(c);groups.set(c.layout,list);}
 const notes=[`[원고·완성 PPT에서 추가한 지침]`,`비교 원고: ${analysis.scriptName}`,`완성 PPT: ${analysis.deckName}`,`전체 ${analysis.totalSlides}장 중 정확한 원고 연결 ${analysis.matchedSlides}장. 저장 선택 ${selected.length}장.`, '공통지침은 유지하며 아래 서식은 확인된 레이아웃에만 적용. 미확인 레이아웃은 기존 템플릿 사용.'];
 for(const [layout,list] of groups){
  // Use the last/full build-up slide, retaining geometry and visual objects but no old manuscript text.
  const ref=[...list].sort((a,b)=>C.normalize(b.text).length-C.normalize(a.text).length)[0],scene=structuredClone(slides[ref.slideIndex]);
  scene.bodyIndex=ref.bodyIndex;delete scene.editor;delete scene.uid;delete scene.masterId;scene.text='';
  for(const shape of scene.shapes){delete shape.extraText;delete shape.manualGeometry;if(shape.type!=='text')continue;const p=shape.paragraphs?.[0]||{runs:[]};const runs=(shape.paragraphs||[]).flatMap(p=>p.runs||[]);const base=shape===scene.shapes[scene.bodyIndex]?ref.style:runs[0]||{font:ref.font,size:ref.size};shape.paragraphs=[{...p,runs:[{...base,text:''}]}];}
  output.layouts[layout]=scene;if(output.layoutMasters)delete output.layoutMasters[layout];
  const body=scene.shapes[scene.bodyIndex];
  notes.push(`${choices[layout]}: ${list.length}장 확인. 대표 ${ref.slideIndex+1}번의 배경·글꼴 ${ref.font}·크기 ${ref.size.toFixed(1)}px·위치 (${body.x.toFixed(1)}, ${body.y.toFixed(1)})·글상자 ${body.w.toFixed(1)}×${body.h.toFixed(1)}px 사용. 관찰된 본문 줄 수 ${Math.min(...list.map(c=>c.lines))}~${Math.max(...list.map(c=>c.lines))}줄. 새 원고는 글상자 너비에 맞춰 재분할, 줄간격은 공통지침의 1.3배 적용.`);
 }
 const cumulative=selected.some(c=>c.cumulative);
 notes.push(cumulative?'이전 문구 뒤에 본문이 늘어나는 누적 공개 확인: 누적 공개 옵션 켬.':'누적 공개를 확정할 근거 없음: 기존 누적 공개 선택 유지.','PPT의 예전 본문·날짜·제목은 서식에 고정하지 않고 비워 둠. 새 원고의 글자는 편집 가능한 본문으로 생성.','글자가 이미지에 포함된 배경, 표·차트·그룹의 원본 재현은 별도 확인 필요. 자유 메모는 자동 실행되지 않음.');
 const fixedSlides=(analysis.fixed||[]).filter(f=>f.keep!==false).map(f=>{const slide=structuredClone(slides[f.slideIndex]);delete slide.uid;delete slide.masterId;delete slide.editor;return {before:f.before,total:f.total,label:f.label,slide};});
 if(fixedSlides.length)notes.push(`원고에 연결되지 않은 고정 슬라이드 ${fixedSlides.length}장(${fixedSlides.map(f=>f.label||'그림·장식').slice(0,6).join(' / ')})은 새 원고로 만들 때도 그대로 유지.`);
 return {design:output,fixedSlides,instructions:notes.join('\n'),options:cumulative?{cumulative:true}:{},evidence:{...structuredClone(analysis),candidates:structuredClone(selected)}};
}
// 고정 슬라이드를 새로 만든 자막 사이에 되돌려 넣는다. 맨 앞·맨 뒤는 그대로, 중간은 원래 위치의 비율로 놓고 누적 묶음은 쪼개지 않는다.
function weave(fixed,slides,links){
 if(!fixed?.length)return {slides,links};
 const n=slides.length,out=[],outLinks=[],uid=()=>root.crypto?.randomUUID?.()||String(Math.random()).slice(2);
 const at=fixed.map(f=>{if(f.before<=0)return 0;if(f.before>=f.total)return n;let k=Math.round(f.before/f.total*n);while(k>0&&k<n&&slides[k-1].editor?.group&&slides[k-1].editor.group===slides[k].editor?.group)k++;return k;});
 for(let k=0;k<=n;k++){fixed.forEach((f,i)=>{if(at[i]!==k)return;const s=structuredClone(f.slide);s.uid=uid();out.push(s);outLinks.push({status:'unlinked',start:null,end:null,score:0});});if(k<n){out.push(slides[k]);outLinks.push(links[k]);}}
 return {slides:out,links:outLinks};
}
const api={analyze,build,choices,weave};if(typeof module==='object'&&module.exports)module.exports=api;else root.CaptionPairTemplate=api;
})(typeof window==='object'?window:globalThis);
