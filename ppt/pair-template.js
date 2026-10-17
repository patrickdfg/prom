/* Evidence-based recipes from a manuscript and its finished presentation. No network/AI call. */
(function(root){
'use strict';
const C=typeof module==='object'&&module.exports?require('./core.js'):root.CaptionCore;
const textOf=shape=>(shape.paragraphs||[]).map(p=>(p.runs||[]).map(r=>r.text||'').join('')).join('\n');
const choices={caption:'하단 자막',word:'말씀',wordGod:'하나님 말씀',wordSon:'성자 말씀',wordSpirit:'성령 말씀',wordTeacher:'선생님 말씀 (인물 없음)',verse:'성경 구절',emphasis:'큰 글씨 강조'};
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
  let layout=Object.hasOwn(choices,known)?known:shape.y/slide.height>=.6?'caption':/[（(]?[가-힣]{1,8}\s*\d+\s*[:장]\s*\d+/.test(text)?'verse':'word';
  if(layout==='word'){const speaker=text.split('\n').filter(s=>s.trim()).slice(0,2).join('\n').match(/성령님?|하나님|성자(?:님)?|예수님?|선생님/);if(speaker)layout=/성령/.test(speaker[0])?'wordSpirit':/하나님/.test(speaker[0])?'wordGod':/선생님/.test(speaker[0])?'wordTeacher':'wordSon';}
  const counts=new Map();for(const p of shape.paragraphs||[])for(const r of p.runs||[]){const key=JSON.stringify([r.font,r.size,r.bold,r.color]);const v=counts.get(key)||{run:r,n:0};v.n+=C.normalize(r.text).length;counts.set(key,v);}
  const base=[...counts.values()].sort((a,b)=>b.n-a.n)[0]?.run||{};
  candidates.push({slideIndex:i,bodyIndex:row.bodyIndex,layout,text,start:links[i].start,end:links[i].end,cumulative:links[i].reason==='cumulative',font:base.font||'',size:base.size||0,style:structuredClone(base),lines:text.split('\n').length});
 });
 if(!candidates.length)throw Error('원고와 정확히 일치하는 편집 가능한 PPT 본문을 찾지 못했습니다. 같은 원고로 만든 PPT인지 확인하세요. 이미지로 된 글자와 중복·유사 문장은 자동 학습하지 않습니다.');
 return {version:1,scriptName:manuscript.name||'',deckName:deck.name||'',totalSlides:slides.length,matchedSlides:candidates.length,candidates,warnings:deck.warnings||[]};
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
 return {design:output,instructions:notes.join('\n'),options:cumulative?{cumulative:true}:{},evidence:{...structuredClone(analysis),candidates:structuredClone(selected)}};
}
const api={analyze,build,choices};if(typeof module==='object'&&module.exports)module.exports=api;else root.CaptionPairTemplate=api;
})(typeof window==='object'?window:globalThis);
