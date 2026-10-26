/* Split a selected caption without rebuilding its background or typography. */
(function(root){
'use strict';
const copy=x=>structuredClone(x),text=p=>(p.runs||[]).map(r=>r.text||'').join('');
function bodyIndex(slide){
 if(Number.isInteger(slide.bodyIndex)&&slide.shapes?.[slide.bodyIndex]?.type==='text')return slide.bodyIndex;
 let best=-1,length=0;for(const [i,shape] of (slide.shapes||[]).entries())if(shape.type==='text'){
  const n=(shape.paragraphs||[]).map(text).join('\n').length;if(n>length){best=i;length=n;}
 }return best;
}
function lines(shape){
 const out=[];for(const paragraph of shape.paragraphs||[]){
  let line={...copy(paragraph),runs:[]};
  for(const run of paragraph.runs||[]){const parts=String(run.text||'').split(/\r\n?|\n/);for(let i=0;i<parts.length;i++){
   if(i){out.push(line);line={...copy(paragraph),runs:[]};}
   if(parts[i])line.runs.push({...copy(run),text:parts[i]});
  }}out.push(line);
 }return out.filter(p=>text(p).trim());
}
function split(project,at,core){
 const original=project.slides?.[at],index=original?bodyIndex(original):-1;
 if(index<0)throw Error('분리할 본문 글상자가 없습니다.');
 const paragraphs=lines(original.shapes[index]);
 if(paragraphs.length<2)throw Error('두 줄 이상인 자막을 선택하세요.');
 if(project.slides.length-1+paragraphs.length>500)throw Error('자막은 500장까지 만들 수 있습니다.');
 const oldLink=project.links?.[at],source=core.index(project.lines||[]).text;
 const normalized=paragraphs.map(p=>core.normalize(text(p))),full=normalized.join('');
 const linked=['exact','manual'].includes(oldLink?.status)&&Number.isInteger(oldLink.start)&&Number.isInteger(oldLink.end)&&oldLink.start>=0&&oldLink.end>oldLink.start&&source.slice(oldLink.start,oldLink.end)===full;
 let cursor=oldLink?.start;const group=crypto.randomUUID(),links=[];
 const parts=paragraphs.map((paragraph,i)=>{
  const slide=copy(original);slide.uid=i===0?original.uid:crypto.randomUUID();slide.bodyIndex=index;
  slide.shapes[index].paragraphs=[copy(paragraph)];
  if(slide.editor){
   const markup=paragraph.runs.map(r=>{const kind=root.CaptionBuilder?.colorType(r.color);return kind==='red'?'<r>'+r.text+'</r>':kind==='blue'?'<b>'+r.text+'</b>':r.text;}).join('');
   Object.assign(slide.editor,{text:markup,group,cumulative:false,step:1,padToLines:0});
  }
  const end=cursor+normalized[i].length;
  links.push(linked&&end>cursor?{...copy(oldLink),start:cursor,end,reason:'split-line'}:{status:'unlinked',start:null,end:null,score:0,reason:'split-line'});
  cursor=end;return slide;
 });
 const slides=project.slides.slice(),allLinks=(project.links||[]).slice();
 slides.splice(at,1,...parts);allLinks.splice(at,1,...links);
 return {slides,links:allLinks,count:parts.length};
}
const api={split};if(typeof module==='object'&&module.exports)module.exports=api;else root.MakeSlideSplit=api;
})(typeof window==='object'?window:globalThis);
