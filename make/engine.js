/* Canonical Make engine, shared by Make and the PPT workspace. UI adapters only supply manuscripts, templates and overrides. */
window.MakePptEngine=(()=>{
 'use strict';
 const B=CaptionBuilder,R=CaptionContentRules,P=CaptionPairTemplate,L=MakeTemplateLayouts;
 // Plain-text 성령말씀 workflow. No numbered list or font-color markers required.
 async function generateSpirit(project,record,options={}){
  const raw=(project.lines||[]).map(v=>String(v??'').trim());
  const blocks=[];let active=[];
  for(const line of raw){if(!line){if(active.length){blocks.push(active);active=[];}continue;}active.push(line);}
  if(active.length)blocks.push(active);
  if(!blocks.length)throw Error('성령말씀 원고가 비어 있습니다. 글을 붙여넣어 주세요.');
  const all=blocks.flat().join(' ');
  const title=options.title||all.match(/20\d{2}\s*년\s*성령\s*사연\s*\d+/)?.[0]||'성령말씀';
  await B.useTemplate(record.design);
  const slides=[],links=[];
  const cover=await B.scene('cover',title);slides.push(cover);links.push({status:'unlinked',start:null,end:null,score:0,reason:'cover'});
  const width=record.design.layouts.word?.width||1920;
  const body=record.design.layouts.word?.shapes?.[record.design.layouts.word.bodyIndex];
  const estimatedLimit=Math.max(24,Math.floor((body?.w||width*.8)/28/1.05));
  const sentences=text=>String(text).match(/[^.!?。]+(?:[.!?。]+[”’"'）)]*|$)/g)?.map(s=>s.trim()).filter(Boolean)||[text.trim()];
  const wrapSentence=s=>{
   const parts=s.split(/\s+/),out=[],row=[];
   for(const part of parts){if(row.length&&(row.join(' ').length+part.length+1)>estimatedLimit){out.push(row.join(' '));row.length=0;}row.push(part);}
   if(row.length)out.push(row.join(' '));return out;
  };
  let sourceAt=0;
  for(const lines of blocks){
   let queue=[];
   // Each paragraph is a semantic block, with a fresh cumulative sequence.
   for(const line of lines){
    if(line===title||/^20\d{2}\s*년\s*성령\s*사연\s*\d+$/.test(line))continue;
    for(const sentence of sentences(line)){
     const wrapped=wrapSentence(sentence);
     if(queue.length&&queue.reduce((n,x)=>n+x.length,0)+wrapped.length>6)queue=[];
     if(wrapped.length>6){
       for(let start=0;start<wrapped.length;start+=6){
         const piece=wrapped.slice(start,start+6);
         const sc=await B.scene('word',piece.join('\n'));sc.editor.group='spirit-'+slides.length;sc.editor.cumulative=false;sc.editor.step=1;
         slides.push(sc);links.push({status:'unlinked',start:null,end:null,score:0,reason:'spirit-text'});
       }
       queue=[];continue;
     }
     queue.push(wrapped);
     const sc=await B.scene('word',queue.flat().join('\n'));
     sc.editor.group='spirit-'+blocks.indexOf(lines)+'-'+sourceAt;sc.editor.cumulative=true;sc.editor.step=queue.length;
     slides.push(sc);links.push({status:'unlinked',start:null,end:null,score:0,reason:'spirit-text'});
     sourceAt++;
     if(slides.length>1000)throw Error('생성된 자막이 너무 많습니다. 원고를 나누어 넣어 주세요.');
    }
   }
  }
  if(slides.length===1)throw Error('표지 이외의 본문이 없습니다. 원고 내용을 확인해 주세요.');
  slides.push(structuredClone(slides.at(-1)));links.push({...links.at(-1)});
  return {slides,links,record,summary:'성령말씀 텍스트 전체를 문장별 누적 자막으로 변환했습니다. (마지막 장 2회 표시)',exportSize:{width:1920,height:1080}};
 }
 async function generate(project,template,options={}){
  let record=template?L.prepare(window.MakeAnnouncements?MakeAnnouncements.upgrade(structuredClone(template)):structuredClone(template),B.layouts):null;
  if(record?.id==='builtin-spirit-word'||record?.options?.sourceMode==='spirit')return generateSpirit(project,record,options);
  await B.useTemplate(record?.design||null);
  const run=async()=>{
   if(R.mode(record)==='worship'){
    const result=R.generateWorship(project,record,await R.sourceDeck(record,CaptionImport.deck),options);
    record=L.prepare(result.record,B.layouts);await B.useTemplate(record.design);
    return {...result,record,worship:true,exportSize:{width:1920,height:1080}};
   }
   const original=await P.generate(project,record,CaptionImport.deck,CaptionImport.manuscriptRich,options);
   if(original)return {...original,record:L.prepare(original.record,B.layouts)};
   const generated=await B.generate(project,options),woven=P.weave(record?.fixedSlides||[],generated.slides,generated.links);
   return {...generated,...woven,record,exportSize:{width:1920,height:1080}};
  };
  // A previously open PPT must not add its project-specific master overrides to a different selected template.
  const result=await (window.CaptionMasters?.withRecords?CaptionMasters.withRecords({},run):run());
  return options.announcements?.trim()||result.record?.announcementTemplate?MakeAnnouncements.replace(result,result.record,options.announcements):{...result,announcements:String(options.announcements||'')};
 }
 return {generate};
})();
