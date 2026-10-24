/* Announcement text is independent of the sermon and its source offsets. */
(function(root){
'use strict';
const clone=x=>structuredClone(x),text=sh=>(sh.paragraphs||[]).map(p=>(p.runs||[]).map(r=>r.text||'').join('')).join('\n');
const numbered=/^\d{1,3}\s*[.)](?!\d)\s*\S/;
function parse(value){
 const source=String(value||'').replace(/\r\n?/g,'\n').trim();if(!source)return [];
 if(source.length>100000)throw Error('광고가 너무 깁니다. 10만 자 이하로 나누어 넣어 주세요.');
 const items=[];let current=[];
 for(const raw of source.split('\n')){const line=raw.trim();if(!line||/^(?:교회\s*광고|예배\s*광고|광고)\s*[:：]?$/.test(line))continue;if(numbered.test(line)&&current.length){items.push(current);current=[];}current.push(line);}
 if(current.length)items.push(current);if(items.length>100)throw Error('광고는 한 번에 100개까지 넣어 주세요.');return items;
}
function bodyIndex(s){let best=-1,length=0;for(const [i,sh] of (s.shapes||[]).entries()){const n=text(sh).trim().length;if(sh.type==='text'&&sh.w>s.width*.45&&sh.y<s.height*.65&&n>length){best=i;length=n;}}return best;}
// Hash only local scene data; filenames and labels never establish slide identity.
const hashes=new Map();function hash(value){if(hashes.has(value))return hashes.get(value);let n=2166136261;for(let i=0;i<value.length;i++){n^=value.charCodeAt(i);n=Math.imul(n,16777619);}const h=(n>>>0).toString(36);hashes.set(value,h);return h;}
function frame(s){return JSON.stringify([s.width,s.height,s.background,s.backgroundFill,(s.shapes||[]).map(sh=>sh.type==='text'?[sh.type,sh.x,sh.y,sh.w,sh.h]:[sh.type,sh.x,sh.y,sh.w,sh.h,sh.rotate,sh.color,sh.src?hash(sh.src):'',sh.crop,sh.opacity])]);}
function signature(s){return frame(s)+'|'+JSON.stringify((s.shapes||[]).map(text));}
function discover(record){
 const fixed=record?.fixedSlides||[],rows=fixed.map((f,index)=>{const body=bodyIndex(f.slide);return {index,slide:f.slide,body,content:body<0?'':text(f.slide.shapes[body]).trim(),frame:frame(f.slide)};});
 const seeds=rows.filter(r=>r.body>=0&&(/^(?:교회\s*광고|예배\s*광고)/.test(r.content)||numbered.test(r.content)&&r.content.includes('\n')||/(?:신학|수업|전도행사|예배위원|면담\s*신청|성지봉사|신청해주세요)/.test(r.content)));
 const frames=new Set(seeds.map(r=>r.frame));return rows.filter(r=>r.body>=0&&frames.has(r.frame)).map(r=>({fixedIndex:r.index,bodyIndex:r.body,slide:r.slide,signature:signature(r.slide)}));
}
// Versioned bindings survive edits to artwork, coordinates, wording and shape order.
function learn(record){
 if(!record?.announcementTemplate)return discover(record);
 if(record.announcementTemplate.version!==1)throw Error('이 광고 템플릿은 최신 사이트에서 열어 주세요.');
 return record.announcementTemplate.slots.map(slot=>{const slide=record.fixedSlides?.[slot.fixedIndex]?.slide;if(!slide)throw Error('광고 양식의 고정 화면을 찾지 못했습니다.');const found=slide.shapes.findIndex(sh=>sh.masterSlot===slot.bodySlot),body=found>=0?found:slide.shapes.some(sh=>sh.masterSlot)?-1:slot.bodyIndex;if(!slide.shapes[body]||slide.shapes[body].type!=='text')throw Error('광고 본문 글상자가 삭제되었습니다. 템플릿에서 본문 글상자를 복원해 주세요.');return {...slot,bodyIndex:body,slide,signature:signature(slide)};});
}
function upgrade(record){
 if(!record||record.announcementTemplate)return record;
 const slots=discover(record);if(!slots.length)return record;
 const out=clone(record);out.templateSchemaVersion=2;out.announcementTemplate={version:1,overflow:'continue',extraItems:'last-layout',slots:slots.map((slot,i)=>{
  const slide=out.fixedSlides[slot.fixedIndex].slide,id='announcement'+(i+1);
  return {id,name:'광고 '+(i+1),fixedIndex:slot.fixedIndex,bodyIndex:slot.bodyIndex,bodySlot:slide.shapes[slot.bodyIndex].masterSlot||'base:'+slot.bodyIndex,masterId:'template-ad:'+out.id+':'+id,sourceIdentity:slot.signature};
 })};
 const note='[광고 양식 v2]\n광고 1~'+slots.length+'을 각각 독립된 양식으로 저장. ③ 마스터 편집에서 배경·그림·본문 글꼴·크기·위치를 바꾸고 저장하면 이후 붙여넣은 광고에 적용. 본문 글상자의 연결을 유지하고 긴 내용은 같은 양식의 다음 장으로 이어짐. 광고는 설교 원고와 분리하며 원고 연결은 변경하지 않음.';
 out.instructions=(out.instructions||'')+'\n\n'+note;return out;
}
function expand(record){
 const out=clone(upgrade(record)),slots=learn(out);if(!slots.length)return out;
 out.layoutCatalog=[...(out.layoutCatalog||[])];
 for(const slot of slots){out.design.layouts[slot.id]=clone(slot.slide);out.design.layouts[slot.id].shapes.forEach((sh,i)=>{sh.masterSlot||='base:'+i;});out.design.layouts[slot.id].bodyIndex=slot.bodyIndex;out.design.layouts[slot.id].masterId=slot.masterId;out.layoutCatalog.push({key:slot.id,name:slot.name});}return out;
}
function collapse(record,masters={}){
 if(!record?.announcementTemplate)return record;
 const out=clone(record),ids=new Set(out.announcementTemplate.slots.map(s=>s.id));
 for(const slot of out.announcementTemplate.slots){let slide=out.design.layouts[slot.id]||out.fixedSlides[slot.fixedIndex].slide;const patch=masters[slot.masterId||slide.masterId];if(patch&&root.CaptionMasters)slide=root.CaptionMasters.apply({...slide,bodyIndex:slot.bodyIndex,masterId:slot.masterId},patch);const found=slide.shapes.findIndex(sh=>sh.masterSlot===slot.bodySlot),body=found>=0?found:slide.shapes.some(sh=>sh.masterSlot)?-1:slot.bodyIndex;if(!slide.shapes[body]||slide.shapes[body].type!=='text')throw Error('광고 본문 글상자를 유지해 주세요.');if(out.design.layouts[slot.id]||patch)slide.bodyIndex=body;slot.bodyIndex=body;out.fixedSlides[slot.fixedIndex].slide=slide;const label=out.layoutCatalog?.find(e=>e.key===slot.id)?.name;if(label)slot.name=label;delete out.design.layouts[slot.id];}
 if(out.layoutCatalog)out.layoutCatalog=out.layoutCatalog.filter(e=>!ids.has(e.key));return out;
}
function preview(slide,value){return render({slide,bodyIndex:slide.bodyIndex},String(value||text(slide.shapes[slide.bodyIndex])).split('\n'),1)[0];}
const compact=s=>s.replace(/\s+/g,' ').trim();
function firstRun(p){return (p?.runs||[]).find(r=>r.text?.trim())||p?.runs?.[0]||{};}
function metrics(s,sh){
 const p=sh.paragraphs[0],r=firstRun(p),size=r.size||p.defaultSize||32,pad=sh.padding||[0,0,0,0];let normal=size*1.3,measure=t=>Array.from(t).reduce((n,c)=>n+size*(/[\u0000-\u007f]/.test(c)?.55:1),0);
 if(root.document){const el=root.document.createElement('span');Object.assign(el.style,{position:'fixed',left:'-10000px',fontFamily:JSON.stringify(r.font||'Malgun Gothic'),fontSize:size+'px',fontWeight:r.bold?'700':'400',lineHeight:'normal',whiteSpace:'pre'});el.textContent='가Ag';root.document.body.append(el);normal=el.getBoundingClientRect().height||normal;el.remove();const ctx=root.document.createElement('canvas').getContext('2d');ctx.font=`${r.bold?700:400} ${size}px ${JSON.stringify(r.font||'Malgun Gothic')}`;measure=t=>ctx.measureText(t).width+Math.max(0,Array.from(t).length-1)*(r.spacing||0);}
 const panels=(s.shapes||[]).filter(o=>o!==sh&&o.w>s.width*.65&&o.h>s.height*.35&&o.h<s.height*.95&&o.y<=sh.y&&o.y+o.h>sh.y+sh.h).sort((a,b)=>a.w*a.h-b.w*b.h);
 const bottom=panels[0]?Math.min(s.height-16,panels[0].y+panels[0].h-16):Math.max(sh.y+sh.h,s.height*.86),line=p.lineSpacing,height=(line?.unit==='px'?line.value:normal*(line?.value||1))*(1-(sh.lineReduction||0));
 return {measure,width:sh.w-pad[1]-pad[3],maxLines:Math.max(2,Math.floor((bottom-sh.y-pad[0]-pad[2])/Math.max(1,height)))};
}
function wrap(line,m){
 if(m.measure(line)<=m.width)return [line];const out=[];let current='';for(const token of line.match(/\S+\s*/g)||[]){if(current&&m.measure(current+token.trimEnd())>m.width){out.push(current.trimEnd());current='';}for(const ch of token){if(current&&m.measure(current+ch)>m.width){out.push(current.trimEnd());current='';}current+=ch;}}if(current.trim())out.push(current.trimEnd());return out;
}
function render(slot,lines,number){
 const original=slot.slide,body=original.shapes[slot.bodyIndex];
 if(compact(text(body))===compact(lines.join('\n'))){const s=clone(original);s.uid=root.crypto?.randomUUID?.()||String(Math.random());s.announcement={number};s.masterId=slot.masterId||s.masterId;s.bodyIndex=slot.bodyIndex;return [s];}
 const m=metrics(original,body),wrapped=lines.flatMap(line=>wrap(line,m)),pages=[];let at=0;
 while(at<wrapped.length){const take=wrapped.slice(at,at+m.maxLines);at+=take.length;const s=clone(original),sh=s.shapes[slot.bodyIndex],paras=sh.paragraphs;
  if(paras.length===1){const p=clone(paras[0]),run=clone(firstRun(p));p.runs=[{...run,text:take.join('\n')}];sh.paragraphs=[p];}
  else sh.paragraphs=take.map((line,i)=>{const p=clone(paras[Math.min(i,paras.length-1)]);p.runs=[{...clone(firstRun(p)),text:line}];return p;});
  s.uid=root.crypto?.randomUUID?.()||String(Math.random());s.bodyIndex=slot.bodyIndex;s.text=take.join('\n');s.announcement={number,page:pages.length+1};s.masterId=slot.masterId||s.masterId;delete s.editor;pages.push(s);
 }return pages;
}
function replace(result,record,value,options={}){
 if(!parse(value).length&&options.omitEmpty){
  const bindings=record?.announcementTemplate?.slots||discover(record),keys=new Set();
  for(const slot of bindings){const slide=slot.slide||record.fixedSlides?.[slot.fixedIndex]?.slide;if(slide)keys.add(signature(slide));if(slot.sourceIdentity)keys.add(slot.sourceIdentity);}
  const keep=result.slides.map((s,i)=>keys.has(signature(s))?-1:i).filter(i=>i>=0);
  return {...result,slides:keep.map(i=>result.slides[i]),links:keep.map(i=>result.links[i]),announcements:'',announcementCount:0};
 }
 const items=parse(value);if(!items.length&&!record?.announcementTemplate)return {...result,announcements:String(value||'')};
 let slots;try{slots=learn(record);}catch(e){if(!options.fallbackSlide)throw e;slots=[];}if(!slots.length){
  if(options.fallbackSlide&&items.length){const slide=options.fallbackSlide,body=slide.bodyIndex??bodyIndex(slide),ads=items.flatMap((lines,i)=>render({slide,bodyIndex:body},lines,i+1));return {...result,slides:[...result.slides,...ads],links:[...result.links,...ads.map(()=>({status:'unlinked',start:null,end:null,score:0,reason:'announcement'}))],announcements:String(value),announcementCount:items.length};}
  throw Error('선택한 템플릿에 광고 화면이 없습니다. 광고가 포함된 완성 PPT로 템플릿을 등록해 주세요.');
 }
 const identities=new Map();for(const slot of slots)for(const key of [slot.signature,slot.sourceIdentity].filter(Boolean))identities.set(key,slot);
 const indices=result.slides.map((s,i)=>identities.has(signature(s))?i:-1).filter(i=>i>=0);
 if(!indices.length){
  if(options.fallbackSlide&&items.length){const ads=items.flatMap((lines,i)=>render(slots[Math.min(i,slots.length-1)],lines,i+1));return {...result,slides:[...result.slides,...ads],links:[...result.links,...ads.map(()=>({status:'unlinked',start:null,end:null,score:0,reason:'announcement'}))],announcements:String(value),announcementCount:items.length};}
  throw Error('템플릿의 광고 화면을 결과에서 찾지 못했습니다. 광고 슬라이드를 포함해 템플릿을 다시 저장해 주세요.');
 }
 if(!items.length){const slides=result.slides.map((s,i)=>{if(!indices.includes(i))return s;const slot=identities.get(signature(s));return {...clone(slot.slide),uid:s.uid,bodyIndex:slot.bodyIndex,masterId:slot.masterId||slot.slide.masterId};});return {...result,slides,announcements:String(value||'')};}
 const ads=items.flatMap((lines,i)=>render(slots[Math.min(i,slots.length-1)],lines,i+1)),remove=new Set(indices),slides=[],links=[];
 for(let i=0;i<result.slides.length;i++){if(i===indices[0])for(const s of ads){slides.push(s);links.push({status:'unlinked',start:null,end:null,score:0,reason:'announcement'});}if(!remove.has(i)){slides.push(result.slides[i]);links.push(result.links[i]);}}
 if(slides.length>500)throw Error('자막과 광고가 500장을 넘습니다. 광고를 나누어 넣어 주세요.');
 return {...result,slides,links,announcements:String(value),announcementCount:items.length,summary:(result.summary||'자막 생성')+` · 광고 ${items.length}개를 원본 광고 서식 ${ads.length}장으로 교체`};
}
function format(slide,value){return render({slide,bodyIndex:slide.bodyIndex??bodyIndex(slide)},String(value).split(/\r?\n/),1).map(s=>{delete s.announcement;return s;});}
const api={parse,learn,replace,upgrade,expand,collapse,preview,format};if(typeof module==='object'&&module.exports)module.exports=api;else root.MakeAnnouncements=api;
})(typeof window==='object'?window:globalThis);
