/* Canonical Make engine, shared by Make and the PPT workspace. UI adapters only supply manuscripts, templates and overrides. */
window.MakePptEngine=(()=>{
 'use strict';
 const B=CaptionBuilder,R=CaptionContentRules,P=CaptionPairTemplate,L=MakeTemplateLayouts;
 function policy(record){
  if(record?.id==='builtin-sunday')return {full:false,sermonOnly:true};
  const full=record?.options?.serviceExtras===true||R.mode(record)==='worship'||/주일\s*예배\s*(?:전체|전반)/.test(record?.name||'');
  return {full,sermonOnly:!full&&[record?.id,record?.copiedFrom].includes('builtin-sunday')};
 }
 const slideText=s=>(s.shapes||[]).filter(sh=>sh.type==='text').flatMap(sh=>(sh.paragraphs||[]).flatMap(p=>(p.runs||[]).map(r=>r.text||''))).join('\n');
 const readingSlide=s=>s.servicePart==='responsiveReading'||/^\s*(?:교독문|성시\s*교독|인도자\s*[:：]|회중\s*[:：])/m.test(slideText(s));
 const adSlide=s=>/^\s*(?:교회\s*광고|예배\s*광고|광고\s*[:：]?\s*$)/m.test(slideText(s));
 async function serviceExtras(result,record,options){
  const readingTemplate=result.slides.find(readingSlide),adTemplate=result.slides.find(adSlide),hasAdBindings=!!record?.announcementTemplate?.slots?.length;
  const readingAt=Math.max(0,result.slides.findIndex(readingSlide));
  const keep=result.slides.map((s,i)=>readingSlide(s)||!hasAdBindings&&adSlide(s)?-1:i).filter(i=>i>=0);
  result={...result,slides:keep.map(i=>result.slides[i]),links:keep.map(i=>result.links[i])};
  const reading=String(options.responsiveReading||'').trim();
  if(reading){
   const formatted=readingTemplate?MakeAnnouncements.format(readingTemplate,reading):await (async()=>{
    const rows=reading.split(/\r?\n/).filter(s=>s.trim()).flatMap(line=>B.wrapForLayout(line,'word')),slides=[];
    for(const chunk of B.meaningfulPageSplit(rows.map(text=>({text})),6))slides.push(await B.scene('word',chunk.map(r=>r.text).join('\n')));
    return slides;
   })();
   let at=Math.min(readingAt,result.slides.length);
   for(const slide of formatted){
    slide.servicePart='responsiveReading';slide.layoutName=record.name+' · 교독문';
    result.slides.splice(at,0,slide);result.links.splice(at++,0,{status:'unlinked',start:null,end:null,score:0,reason:'responsive-reading'});
   }
  }
  const ads=String(options.announcements||'').trim(),fallbackSlide=ads?(adTemplate||await B.scene('word','교회 광고')):null;
  result=MakeAnnouncements.replace(result,record,ads,{omitEmpty:true,fallbackSlide});
  if(!result.slides.length)throw Error('만들 자료가 없습니다. 말씀 원고·교독문·광고 중 하나 이상을 넣어 주세요.');
  if(result.slides.length>500)throw Error('생성된 화면이 500장을 넘습니다. 자료를 나누어 넣어 주세요.');
  return {...result,responsiveReading:reading,summary:(result.summary||'입력 자료로 제작')+' · 교독문 '+(reading?'포함':'생략')+' · 광고 '+(ads?'포함':'생략')};
 }
 // Plain-text 성령말씀 workflow. No numbered list or font-color markers required.
 async function generateSpirit(project,record,options={}){
  const raw=(project.lines||[]).map(v=>String(v??'').trim());
  // A sermon title belongs to the cover once, not the cumulative body.
  const titlePattern=/(20\d{2}\s*년\s*성령\s*(?:말씀|사연)\s*\d+)/;
  let extractedTitle='';
  for(let i=0;i<raw.length;i++){
    const match=raw[i].match(titlePattern);
    if(match){
      extractedTitle=match[1].replace(/성령\s+말씀/,'성령말씀').replace(/성령\s+사연/,'성령사연').replace(/\s+/g,' ').trim();
      raw[i]=(raw[i].slice(0,match.index)+raw[i].slice(match.index+match[0].length)).trim();
      break;
    }
  }
  const blocks=[];let active=[];
  for(const line of raw){if(!line){if(active.length){blocks.push(active);active=[];}continue;}active.push(line);}
  if(active.length)blocks.push(active);
  if(!blocks.length)throw Error('성령말씀 원고가 비어 있습니다. 글을 붙여넣어 주세요.');
  const title=options.title||extractedTitle||'성령말씀';
  await B.useTemplate(record.design);
  const slides=[],links=[];
  const cover=await B.scene('cover',title);slides.push(cover);links.push({status:'unlinked',start:null,end:null,score:0,reason:'cover'});
  // Reuse PROM's font-width measurement, Korean phrasing penalties and balanced wrapping.
  // No character-count heuristic: widths come from the selected word layout.
  const sentences=text=>String(text).match(/[^.!?。]+(?:[.!?。]+[”’"'）)]*|$)/g)?.map(s=>s.trim()).filter(Boolean)||[text.trim()];
  const wrapSentence=s=>B.wrapForLayout(s,'word');
  let groupCount=0;
  const source=CaptionCore.index(project.lines||[]).text;
  const normalize=CaptionCore.normalize;
  let sourceCursor=0;
  // 완성 그룹의 줄 수를 먼저 정한 뒤, 모든 단계에 같은 빈 줄을 패딩합니다.
  // 가운데 정렬을 유지하되 실제 첫 줄의 세로 좌표는 전 단계에서 고정됩니다.
  // Keep the user's background untouched. Generated body text must sit above
  // any image/overlay shapes and contrast with the light botanical paper.
  function readableSpiritText(slide){
   const index=slide.bodyIndex;
   const body=slide.shapes?.[index];
   if(!body||body.type!=='text')return slide;
   for(const paragraph of body.paragraphs||[])for(const run of paragraph.runs||[]){
    if(String(run.text||'').trim())run.color='#193B54';
   }
   if(index<slide.shapes.length-1){
    slide.shapes.splice(index,1);
    slide.shapes.push(body);
    slide.bodyIndex=slide.shapes.length-1;
   }
   return slide;
  }
  async function emitGroup(sentencesInGroup){
   if(!sentencesInGroup.length)return;
   const finalLineCount=sentencesInGroup.reduce((n,rows)=>n+rows.length,0);
   const gid='spirit-cumulative-'+(++groupCount);
   const reveal=options.spiritReveal!==false;
   const fullLines=sentencesInGroup.flat();
   const steps=reveal?fullLines.map((_,i)=>i+1):[fullLines.length];
   // Bind each generated slide to the exact original manuscript range.
   const needle=normalize(fullLines.join(''));
   const groupStart=needle?source.indexOf(needle,sourceCursor):-1;
   let previousEnd=groupStart;
   if(groupStart>=0)sourceCursor=groupStart+needle.length;
   for(const count of steps){
    const sc=readableSpiritText(await B.scene('word',fullLines.slice(0,count).join('\n'),{padToLines:finalLineCount}));
    sc.editor.group=gid;sc.editor.cumulative=reveal;sc.editor.step=reveal?count:1;
    slides.push(sc);
    const end=groupStart>=0?groupStart+normalize(fullLines.slice(0,count).join('')).length:-1;
    const linked=groupStart>=0&&end>previousEnd;
    links.push(linked?{status:'exact',start:previousEnd,end,score:1,reason:reveal?'cumulative':'spirit-text'}:{status:'unlinked',start:null,end:null,score:0,reason:'spirit-text'});
    if(linked)previousEnd=end;
    if(slides.length>1000)throw Error('생성된 자막이 너무 많습니다. 원고를 나누어 넣어 주세요.');
   }
  }
  // Page breaks: prefer completed sentences, then commas/connective endings,
  // while penalizing unbalanced page lengths. Existing B.wrapForLayout already
  // balances visual line widths and Korean phrase boundaries within sentences.
  const splitBalancedPages=rows=>B.meaningfulPageSplit(rows,6);
  for(const paragraph of blocks){
   const rows=[];let sentenceId=0;
   for(const line of paragraph){
    if(line===title||/^20\d{2}\s*년\s*성령\s*(?:말씀|사연)\s*\d+$/.test(line))continue;
    for(const sentence of sentences(line)){
     const wrapped=wrapSentence(sentence);
     for(const text of wrapped)rows.push({text,sentence:sentenceId});
     sentenceId++;
    }
   }
   for(const chunk of splitBalancedPages(rows)){
    const lines=B.spreadShortText(chunk.map(row=>row.text),'word');
    await emitGroup(lines.map(text=>[text]));
   }
  }
    if(slides.length===1)throw Error('표지 이외의 본문이 없습니다. 원고 내용을 확인해 주세요.');
  slides.push(structuredClone(slides.at(-1)));links.push({status:'unlinked',start:null,end:null,score:0,reason:'spirit-final-repeat'});
  return {slides,links,record,summary:options.spiritReveal===false?'성령말씀을 완성 페이지 단위로 만들었습니다. (마지막 장 2회 표시)':'성령말씀을 문장별 누적 자막으로 만들었습니다. (마지막 장 2회 표시)',exportSize:{width:1920,height:1080}};
 }
 async function generate(project,template,options={}){
  let record=template?L.prepare(window.MakeAnnouncements?MakeAnnouncements.upgrade(structuredClone(template)):structuredClone(template),B.layouts):null;
  if(record?.id==='builtin-spirit-word'||record?.options?.sourceMode==='spirit')return generateSpirit(project,record,options);
  await B.useTemplate(record?.design||null);
  const service=policy(record);
  const run=async()=>{
   if(service.full&&!(project.lines||[]).some(s=>String(s).trim()))return {slides:[],links:[],record,exportSize:{width:1920,height:1080}};
   if(R.mode(record)==='worship'&&record?.pair?.sources?.deck?.data){
    const result=R.generateWorship(project,record,await R.sourceDeck(record,CaptionImport.deck),options);
    record=L.prepare(result.record,B.layouts);await B.useTemplate(record.design);
    return {...result,record,worship:true,exportSize:{width:1920,height:1080}};
   }
   const original=service.sermonOnly?null:await P.generate(project,record,CaptionImport.deck,CaptionImport.manuscriptRich,options);
   if(original)return {...original,record:L.prepare(original.record,B.layouts)};
   let generated;
   if(service.full){
    let h;try{h=R.header(project);}catch{};
    generated=R.automatic(project).blocks.length?await B.generate(project,{...options,title:h?'':options.title}):{slides:[],links:[]};
    if(h){const heads=[await B.scene('cover',options.title||h.title,{date:options.date})];for(const p of h.passages)heads.push(await B.scene('verse',p.ref+'\n'+p.text));generated.slides.unshift(...heads);generated.links.unshift(...[h.titleRange,...h.passages].map(range=>({status:'exact',start:range.start,end:range.end,score:1,reason:'service-heading'})));}
   }else generated=await B.generate(project,options);
   const woven=P.weave(service.sermonOnly?[]:record?.fixedSlides||[],generated.slides,generated.links);
   return {...generated,...woven,record,exportSize:{width:1920,height:1080}};
  };
  // A previously open PPT must not add its project-specific master overrides to a different selected template.
  const result=await (window.CaptionMasters?.withRecords?CaptionMasters.withRecords({},run):run());
  if(service.sermonOnly)return {...result,announcements:'',responsiveReading:''};
  if(service.full)return serviceExtras(result,result.record,options);
  return options.announcements?.trim()?MakeAnnouncements.replace(result,result.record,options.announcements):{...result,announcements:'',responsiveReading:''};
 }
 return {generate,policy};
})();
