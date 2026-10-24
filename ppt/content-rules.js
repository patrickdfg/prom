/* Explicit manuscript scope: numbered sermon items, or worship title/scripture slots. */
(function(root){
'use strict';
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^가-힣a-z0-9]/g,''),copy=x=>structuredClone(x);
const text=sh=>(sh?.paragraphs||[]).map(p=>(p.runs||[]).map(r=>r.text||'').join('')).join('\n');
function mode(rec){return ['numbered','worship','spirit'].includes(rec?.options?.sourceMode)?rec.options.sourceMode:/예배\s*(?:전반|전체|순서)|전반\s*예배/.test(rec?.name||'')?'worship':'numbered';}
// Exclude the requested service cues by their heading, so changing Bible passage counts cannot shift the wrong slide out.
function worshipOmit(record){const saved=record?.options?.worshipOmit;if(Array.isArray(saved))return [...new Set(saved.filter(k=>['prayer','music'].includes(k)))];return /주일\s*예배\s*전반/.test(record?.name||'')?['prayer','music']:[];}
function omittedCue(slide,omit){const headings=(slide.shapes||[]).filter(sh=>sh.type==='text').map(sh=>norm(text(sh)));return omit.includes('prayer')&&headings.includes('대표기도')||omit.includes('music')&&headings.some(t=>/^(?:성가대(?:가정국)?(?:특송)?|가정국특송|특송)$/.test(t));}
function rule(value){if(value==='spirit')return '[현재 제작 규칙]\n성령말씀: 색상과 번호 표시 없이 원고의 문장을 생성합니다. 제목은 첫 표지에만 표시합니다. 빈 줄은 새 문단·새 페이지로 구분합니다. 6줄이 넘으면 마침표·물음표·느낌표를 우선하고 쉼표·연결어미·페이지별 줄 수 균형을 고려해 자연스럽게 나눕니다. 한 줄만 덩그러니 남는 분할은 피하며, 한 줄씩 표시 체크 여부에 따라 누적 또는 완성 페이지로 만듭니다.';return value==='worship'?'[현재 제작 규칙]\n예배 전반: 원고 앞부분의 제목과 성경본문만 가져와 원본 PPT의 해당 자리를 교체합니다. 설교 본문은 자막으로 만들지 않습니다.\n교독문·광고는 별도 입력한 것만 포함하고 비워 두면 생략합니다. 기도·찬양 등 나머지 순서는 원본 PPT 내용을 유지하므로 송출 전에 확인합니다.':'[현재 제작 규칙]\n주일·수요·새벽 설교: 원고를 자동 인식합니다. 연속 번호 1→2(→3…) 구간은 번호별 전체 화면으로, 그 이전과 이후는 파랑·초록 색상 자막 규칙으로 함께 생성합니다. 둘 다 없으면 자막을 생성하지 않습니다.\n번호 목록은 전체 화면, 파랑은 하단 2줄, 초록은 말씀·성구 화면으로 만듭니다. 전체 화면 내용이 여러 장이면 문장 종료·쉼표·연결어미와 페이지별 줄 수를 함께 고려하여 균형 있게 나눕니다. 하단 자막은 기존 2줄 기준을 유지하며, 제목·날짜·진행 안내·광고는 본문에 섞지 않습니다.';}
function instructions(value,scope){const lines=String(value||'').split('\n').filter(l=>!/^\[현재 제작 규칙\]|^(?:주일·수요·새벽 설교:|예배 전반: 원고 앞부분|교독문·광고·기도·찬양 등|교독문·광고는 별도 입력|번호 목록은 전체 화면,|한 항목을 템플릿|선택한 각 항목·(?:문단|구간)을)/.test(l)&&!/(?:파랑: 하단 자막|초록: 말씀|검정: 설교 전문|전체 화면 말씀의 첫 두 줄|하단 자막은 .*두 줄|전체 원고.*(?:하단|자막)|누적 공개.*(?:확인|선택|연결|옵션)|번호가 붙은 항목만 자막|원고의 번호 항목을 사용)/.test(l));return rule(scope)+'\n\n'+lines.join('\n').trim();}
function itemNumber(value){const raw=String(value||'').trimStart(),s=raw.normalize('NFKC');return /^[①-⑳㉑-㉟㊱-㊿]/.test(raw)||/^\(\s*\d{1,3}\s*\)/.test(s)||/^\d{1,3}\s*[.)、](?!\d)/.test(s);}
function numbered(project){
 const rows=project.richLines?.length===project.lines.length?project.richLines:project.lines.map(text=>({text})),out=[];let offset=0,current=null,excluded=false,lastSource;
 for(const row of rows){if(row.source!==lastSource){excluded=false;current=null;lastSource=row.source;}const value=row.text||'',start=offset;offset+=norm(value).length;
  if(/(?:예배\s*광고|교회\s*광고|교독문|예배\s*순서)/.test(value)&&!itemNumber(value)){excluded=true;current=null;continue;}
  if(/^\s*(?:<|\[|【)?\s*잠언\s*(?:말씀|항목)?\s*(?:>|\]|】|[:：])?\s*$/.test(value)){excluded=false;current=null;continue;}
  const number=itemNumber(value);
  if(number&&!excluded){current={layout:'proverb',chars:[],paragraph:row.paragraph,source:row.source};out.push(current);}
  else if(!current||row.paragraph==null||row.paragraph!==current.paragraph||row.source!==current.source||/^\s*(?:할렐루야|아멘[.!！]?\s*$|마무리|마지막으로|오늘은 여기|이상으로|기도[\s:：]|찬양[\s:：])/.test(value)){current=null;continue;}
  if(!current)continue;
  const styled=(row.runs||[]).flatMap(r=>{const hex=String(r.hex||'').replace('#',''),red=/^[a-f\d]{6}$/i.test(hex)&&parseInt(hex.slice(0,2),16)>130&&parseInt(hex.slice(0,2),16)>parseInt(hex.slice(2,4),16)*1.5;return Array.from(r.text||'',ch=>({ch,red}));});const chars=styled.map(c=>c.ch).join('')===value?styled:Array.from(value,ch=>({ch,red:false}));let at=start;for(const {ch,red} of chars){const n=norm(ch).length;current.chars.push({ch,red,start:at,end:at+n});at+=n;}current.chars.push({ch:'\n',red:false,start:offset,end:offset});
 }
 return out.filter(b=>b.chars.some(c=>norm(c.ch))&&!/^\s*\d+\s*[.)]\s*$/.test(b.chars.map(c=>c.ch).join('')));
}
// Detect only ordered proverb series, not unrelated dates or isolated numbered lines.
function listSequenceNumber(value){
 const raw=String(value||'').trimStart(),cp=raw.codePointAt(0);
 if(cp>=0x2460&&cp<=0x2473)return cp-0x245f;
 if(cp>=0x3251&&cp<=0x325f)return cp-0x3250;
 if(cp>=0x32b1&&cp<=0x32bf)return cp-0x32a0;
 const m=raw.normalize('NFKC').match(/^(?:\(\s*(\d{1,3})\s*\)|(\d{1,3})\s*[.)、](?!\d))/);
 return m?Number(m[1]||m[2]):null;
}
function sequentialProverbs(blocks){
 const result=[];let run=[];
 const flush=()=>{if(run.length>=2&&listSequenceNumber(run[0].chars.map(c=>c.ch).join(''))===1)result.push(...run);run=[];};
 for(const block of blocks){
  const number=listSequenceNumber(block.chars.map(c=>c.ch).join(''));
  if(number===null)continue;
  if(run.length&&number!==listSequenceNumber(run.at(-1).chars.map(c=>c.ch).join(''))+1)flush();
  if(!run.length&&number!==1)continue;
  run.push(block);
 }
 flush();return result;
}
// Source offsets always use the unchanged manuscript, including text omitted from the slides.
function automatic(project){
 const inputRows=project.richLines?.length===project.lines.length?project.richLines:project.lines.map(text=>({text}));
 const sources=[];for(const row of inputRows){let part=sources.at(-1);if(!part||part.source!==row.source){part={source:row.source,rows:[]};sources.push(part);}part.rows.push(row);}
 if(sources.length>1){let offset=0;const blocks=[],kinds=new Set();for(const part of sources){const result=automatic({lines:part.rows.map(r=>r.text),richLines:part.rows});kinds.add(result.kind);for(const b of result.blocks)blocks.push({...b,chars:b.chars.map(c=>({...c,start:c.start+offset,end:c.end+offset}))});offset+=part.rows.reduce((n,r)=>n+norm(r.text).length,0);}const kind=kinds.size===1?[...kinds][0]:'mixed';return {kind,label:kind==='numbered'?'번호 항목':kind==='highlighted'?'색상 표시 구간':kind==='unmarked'?'자막 표시 없음':'각 원고의 자막 구간',blocks};}
 const numberedBlocks=sequentialProverbs(numbered(project));
 const numberedRanges=[];
 if(numberedBlocks.length){
  let group=null;
  for(const block of numberedBlocks){
   const start=block.chars.find(ch=>ch.end>ch.start)?.start;
   const end=[...block.chars].reverse().find(ch=>ch.end>ch.start)?.end;
   if(!Number.isFinite(start)||!Number.isFinite(end))continue;
   if(group&&listSequenceNumber(block.chars.map(ch=>ch.ch).join(''))===group.last+1){group.end=end;group.last++;}else{group={start,end,last:listSequenceNumber(block.chars.map(ch=>ch.ch).join(''))};numberedRanges.push(group);}
  }
 }
 const outsideNumbered=(start,end)=>!numberedRanges.some(range=>start<range.end&&end>range.start);
 const rows=project.richLines?.length===project.lines.length?project.richLines:project.lines.map(text=>({text})),eligible=[];let offset=0,excluded=false,lastSource;
 let bodyStart=0;try{const h=header(project);bodyStart=Math.max(...h.passages.map(p=>p.end));}catch{}
 for(const row of rows){if(row.source!==lastSource){excluded=false;lastSource=row.source;}const value=row.text||'',start=offset;offset+=norm(value).length;
  if(/^(?:예배\s*광고|교회\s*광고|광고\s*[:：]?\s*$|교독문|예배\s*순서)/.test(value.trim()))excluded=true;
  const cue=/^\s*(?:[<〈\[【]\s*(?:영상|사진|동영상|찬양|기도|묵도)\s*\d*\s*[>〉\]】]|할렐루야[.!！]?\s*$|아멘[.!！]?\s*$|(?:20\d{2}).*(?:말씀|예배)|(?:본\s*문|제목|주제)\s*[:：])/;
  if(!excluded&&offset>bodyStart&&norm(value)&&!cue.test(value))eligible.push({row,start,end:offset});
 }
 const shade=hex=>{const h=String(hex||'').replace('#','');if(!/^[a-f\d]{6}$/i.test(h))return '';const [r,g,b]=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));return b>90&&b>r*1.3&&b>g*1.15?'caption':g>65&&g>r*1.25&&g>b*1.15?'word':r>130&&r>g*1.5&&r>b*1.5?'red':'';};
 const highlighted=eligible.some(({row})=>(row.runs||[]).some(r=>['caption','word'].includes(shade(r.hex))&&norm(r.text)));
 if(!highlighted)return numberedBlocks.length?{kind:'numbered',label:'번호 항목',blocks:numberedBlocks}:{kind:'unmarked',label:'자막 표시 없음',blocks:[]};
 const blocks=[];let current=null;
 for(const {row,start} of eligible){
  const group=row.paragraph==null?Symbol():String(row.source??'')+':'+row.paragraph;if(current?.group!==group)current=null;
  const types=(row.runs||[]).map(r=>shade(r.hex));const runs=row.runs?.map((r,i)=>({text:r.text,red:types[i]==='red',layout:types[i]==='red'?(types.slice(0,i).reverse().find(t=>['caption','word'].includes(t))||types.slice(i+1).find(t=>['caption','word'].includes(t))||current?.layout):types[i]}))||[];
  let at=start;for(const run of runs){if(!run.layout){at+=norm(run.text).length;current=null;continue;}if(current?.layout!==run.layout)current=null;if(!current){current={layout:run.layout,group,chars:[]};blocks.push(current);}for(const ch of run.text||''){const n=norm(ch).length;current.chars.push({ch,red:run.red,start:at,end:at+n});at+=n;}}
  if(current)current.chars.push({ch:'\n',red:false,start:at,end:at});
 }
 const colored=blocks.filter(b=>b.chars.some(c=>norm(c.ch))&&outsideNumbered(b.chars.find(c=>c.end>c.start)?.start??-1,[...b.chars].reverse().find(c=>c.end>c.start)?.end??-1));
 const merged=[...colored,...numberedBlocks].sort((a,b)=>(a.chars.find(c=>c.end>c.start)?.start??0)-(b.chars.find(c=>c.end>c.start)?.start??0));
 return {kind:numberedBlocks.length?'mixed':'highlighted',label:numberedBlocks.length?'색상 자막 및 순차 번호 잠언':'색상 표시 구간',blocks:merged};
}
function header(project){
 const rows=project.lines.map((text,i)=>({text:String(text).trim(),i})),ranges=[];let at=0;for(const row of rows){ranges.push({start:at,end:at+norm(row.text).length});at+=norm(row.text).length;}
 const marker=rows.findIndex((r,i)=>i<45&&/^\s*[<〈\[【]?\s*(?:본\s*문|성경\s*본문|본문\s*성구|성경\s*봉독)\s*[>:：〉\]】]*\s*/.test(r.text));
 if(marker<0)throw Error('원고 앞부분에서 「본문」 표시를 찾지 못했습니다. 제목 다음에 「본문:」과 성경본문을 넣어 주세요. 설교 전문은 대신 사용하지 않습니다.');
 const head=rows.slice(0,marker),dated=head.find(r=>/20\d{2}\s*(?:년|[./-])/.test(r.text)),date=dated?.text.match(/(20\d{2})\s*(?:년|[./-])\s*(\d{1,2})\s*(?:월|[./-])\s*(\d{1,2})\s*일?/)?.slice(1).map(Number);
 const titles=head.filter(r=>r.text&&r!==dated&&!/^(?:주일|수요|새벽)?\s*예배$/.test(r.text));
 const title=titles.map(r=>r.text.replace(/^\s*(?:제목|주제)\s*[:：]\s*/,'')).join('\n');if(!title)throw Error('본문 앞에서 말씀 제목을 찾지 못했습니다. 제목을 확인해 주세요.');
 const passage=[],refPattern=/^\s*[<〈\[【]([^>〉\]】]+)[>〉\]】]\s*(.*)$/;
 for(let i=marker;i<Math.min(rows.length,marker+60);i++){
  const row=rows[i],value=i===marker?row.text.replace(/^\s*[<〈\[【]?\s*(?:본\s*문|성경\s*본문|본문\s*성구|성경\s*봉독)\s*[>:：〉\]】]*\s*/,''):row.text;if(!value)continue;
  const m=value.match(refPattern),bare=value.match(/^([가-힣]{1,12}\s*\d+\s*(?:장|:)\s*\d+(?:\s*[-~]\s*\d+)?\s*절?)\s*[:：]?\s*(.*)$/);
  if((m&&/성경|\d|장|절/.test(m[1]))||bare){const q=m||bare;passage.push({ref:q[1].trim(),text:q[2].trim(),start:ranges[i].start,end:ranges[i].end});continue;}
  const last=passage.at(-1);if(!last)throw Error('「본문」 다음의 성경본문을 읽지 못했습니다. <성경 이름 장 절> 뒤에 본문을 적어 주세요.');
  if(/^[”"’']?[\s.!！]*$/.test(value))continue;
  if(/[”"’']\s*[.。]?\s*$/.test(last.text)||/^(?:할렐루야|아멘|오늘|말씀을|설교|본론|서론|<)/.test(value))break;
  last.text+=(last.text?'\n':'')+value;last.end=ranges[i].end;
 }
 if(!passage.length||passage.some(p=>!norm(p.text)))throw Error('성경본문 글이 비어 있습니다. 본문 표시와 본문 글을 확인해 주세요.');
 return {title,passages:passage,date,heading:dated?.text.replace(/^[<〈\[【]|[>〉\]】]$/g,'')||'',titleRange:{start:ranges[titles[0].i].start,end:ranges[titles.at(-1).i].end}};
}
const isReference=value=>/^(?:시대\s*성경|[가-힣]{1,12}\s*\d+\s*(?:장|:)\s*\d+(?:\s*[-~]\s*\d+)?\s*절?)$/.test(value.replace(/[<>〈〉\[\]【】]/g,'').trim());
function setText(sh,value){const base=copy(sh.paragraphs?.[0]||{runs:[]}),style=copy((sh.paragraphs||[]).flatMap(p=>p.runs||[]).find(r=>r.size)||{});sh.paragraphs=String(value).split('\n').map(t=>({...copy(base),runs:[{...copy(style),text:t}]}));}
function layout(slide,bodies,reference){
 const s=copy(slide);delete s.uid;delete s.editor;delete s.masterId;s.bodyIndex=bodies[0];s.worshipReferenceIndex=reference;
 const shapes=bodies.map(i=>s.shapes[i]),x=Math.min(...shapes.map(s=>s.x)),y=Math.min(...shapes.map(s=>s.y));
 Object.assign(s.shapes[s.bodyIndex],{x,y,w:Math.max(...shapes.map(s=>s.x+s.w))-x,h:Math.max(...shapes.map(s=>s.y+s.h))-y,wrap:true});
 for(const i of bodies)setText(s.shapes[i],'');if(reference!=null)setText(s.shapes[reference],'');return s;
}
function learn(deck){
 const title=[],scripture=[];
 deck.slides.forEach((s,index)=>{const nodes=s.shapes.map((sh,i)=>({i,sh,text:text(sh).trim()})).filter(n=>n.sh.type==='text'&&n.text),label=nodes.find(n=>/(?:말씀|설교)\s*(?:주제|제목)/.test(n.text));
  if(label){const bodies=nodes.filter(n=>n!==label&&n.sh.y>=label.sh.y+label.sh.h*.5&&!/^(?:상문교회|주일예배|수요예배|새벽예배)$/.test(n.text)).sort((a,b)=>a.sh.y-b.sh.y||a.sh.x-b.sh.x);if(bodies.length)title.push({index,scene:layout(s,bodies.map(n=>n.i))});}
  if(nodes.some(n=>/^(?:성경\s*봉독|본문\s*성구|성경\s*본문)$/.test(n.text))){const ref=nodes.find(n=>isReference(n.text)),bodies=nodes.filter(n=>n!==ref&&!/^(?:성경\s*봉독|본문\s*성구|성경\s*본문)$/.test(n.text)).sort((a,b)=>a.sh.y-b.sh.y||a.sh.x-b.sh.x);if(ref&&bodies.length)scripture.push({index,scene:layout(s,bodies.map(n=>n.i),ref.i)});}
 });
 if(!title.length||!scripture.length)throw Error('원본 PPT에서 말씀 제목 또는 성경봉독 자리를 찾지 못했습니다. 제목 장에는 「말씀 주제」, 성경 장에는 「성경봉독」과 장절을 표시해 주세요. 원고 전체 자막으로 전환하지 않습니다.');
 return {title,scripture};
}
function prepareWorship(record,deck){
 const slots=learn(deck),layouts={...record.design.layouts},catalog=[];
 for(const [kind,items] of [['Title',slots.title],['Scripture',slots.scripture]])items.forEach((slot,i)=>{const key='worship'+kind+(i||'');slot.key=key;layouts[key]=record.worship?.version===1&&layouts[key]?layouts[key]:slot.scene;catalog.push({key,name:record.worship?.version===1&&record.layoutCatalog?.find(e=>e.key===key)?.name||(kind==='Title'?'말씀 제목'+(i?' '+(i+1):''):'성경본문 '+(i+1))});});
 return {...record,options:{...record.options,sourceMode:'worship',allText:false,worshipOmit:worshipOmit(record)},worship:{version:1,title:slots.title.map(({index,key})=>({index,key})),scripture:slots.scripture.map(({index,key})=>({index,key}))},layoutCatalog:catalog,design:{...record.design,layouts},instructions:instructions(record.instructions,'worship')};
}
function dateText(value,h){if(!h.date)return value;const [y,m,d]=h.date;return value.replace(/20\d{2}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일/g,`${y}년 ${m}월 ${d}일`).replace(/20\d{2}[./-]\d{1,2}[./-]\d{1,2}/g,`${y}.${String(m).padStart(2,'0')}.${String(d).padStart(2,'0')}`);}
function generateWorship(project,record,deck,options={}){
 const h=header(project);if(options.title)h.title=options.title;
 const rec=prepareWorship(record,deck),slots=rec.worship,titles=new Map(slots.title.map(s=>[s.index,s])),scripts=slots.scripture,first=scripts[0].index,indices=new Set(scripts.map(s=>s.index));const slides=[],links=[],omit=worshipOmit(rec);let omitted=0;
 function add(raw,kind,range,key,value,ref){const s=copy(raw);s.uid=root.crypto?.randomUUID?.()||String(Math.random());for(const sh of s.shapes)if(sh.type==='text')setText(sh,dateText(text(sh),h));
  if(kind){setText(s.shapes[s.bodyIndex],value);if(kind==='scripture')setText(s.shapes[s.worshipReferenceIndex],ref);s.layoutName=record.name+' · '+rec.layoutCatalog.find(e=>e.key===key).name;s.editor={layout:key,text:value,ref:ref||'',date:h.date?`${h.date[0]}년 ${h.date[1]}월 ${h.date[2]}일`:''};}
  slides.push(s);links.push(range?{status:'exact',start:range.start,end:range.end,score:1,reason:'worship-'+kind}:{status:'unlinked',start:null,end:null,score:0});}
 deck.slides.forEach((s,i)=>{if(i===first)h.passages.forEach((p,n)=>{const at=Math.min(n,scripts.length-1),key='worshipScripture'+(at||'');add(rec.design.layouts[key],'scripture',p,key,p.text,p.ref);});if(indices.has(i))return;const t=titles.get(i);if(t)add(rec.design.layouts[t.key],'title',h.titleRange,t.key,h.title);else if(omittedCue(s,omit))omitted++;else add(s);});
 return {slides,links,record:rec,summary:`제목 ${titles.size}장 · 성경본문 ${h.passages.length}장 · 나머지 예배 순서 ${slides.length-titles.size-h.passages.length}장 유지${omitted?` · 대표기도·성가대/특송 ${omitted}장 제외`:''}`};
}
let cachedSource='',cachedDeck=null;
async function sourceDeck(record,importer){const src=record?.pair?.sources?.deck;if(!src?.data)throw Error('예배 전반 템플릿에는 원본 PPT가 필요합니다. 원고와 완성 PPT로 템플릿을 다시 등록해 주세요.');if(src.data!==cachedSource){const blob=await(await fetch(src.data)).blob();cachedDeck=await importer(new File([blob],src.name));cachedSource=src.data;}return cachedDeck;}
const api={mode,worshipOmit,rule,instructions,numbered,automatic,itemNumber,header,learn,prepareWorship,generateWorship,sourceDeck,dateText};if(typeof module==='object'&&module.exports)module.exports=api;else root.CaptionContentRules=api;
})(typeof window==='object'?window:globalThis);
