/* Scripture-specific forward recovery. A passage is optional only after matching actual spoken words. */
(function(root){
'use strict';
const normalize=s=>String(s||'').toLowerCase().replace(/[^가-힣a-z0-9]/g,'');
const names='창세기 출애굽기 레위기 민수기 신명기 여호수아 사사기 룻기 사무엘상 사무엘하 열왕기상 열왕기하 역대상 역대하 에스라 느헤미야 에스더 욥기 시편 잠언 전도서 아가 이사야 예레미야 예레미야애가 에스겔 다니엘 호세아 요엘 아모스 오바댜 요나 미가 나훔 하박국 스바냐 학개 스가랴 말라기 마태복음 마가복음 누가복음 요한복음 사도행전 로마서 고린도전서 고린도후서 갈라디아서 에베소서 빌립보서 골로새서 데살로니가전서 데살로니가후서 디모데전서 디모데후서 디도서 빌레몬서 히브리서 야고보서 베드로전서 베드로후서 요한일서 요한이서 요한삼서 유다서 요한계시록 창 출 레 민 신 수 삿 룻 삼상 삼하 왕상 왕하 대상 대하 스 느 에 욥 시 잠 전 아 사 렘 애 겔 단 호 욜 암 옵 욘 미 나 합 습 학 슥 말 마 막 눅 요 행 롬 고전 고후 갈 엡 빌 골 살전 살후 딤전 딤후 딛 몬 히 약 벧전 벧후 요일 요이 요삼 유 계'.split(' ');
const books=names.sort((a,b)=>b.length-a.length).map(s=>Array.from(s).join('\\s*')).join('|');
const pattern=new RegExp('(^|[^가-힣a-zA-Z0-9])('+books+')\\s*([0-9０-９]{1,3})\\s*(?:[:：]\\s*[0-9０-９]{1,3}|장(?:\\s*[0-9０-９]{1,3}\\s*절?)?)','g');
function build(raw,norm=normalize){
 const value=String(raw||''),offsets=[0];for(const ch of value.split(''))offsets.push(offsets.at(-1)+norm(ch).length);
 const text=norm(value),references=[];for(const m of value.matchAll(new RegExp(pattern.source,'g'))){const start=m.index+m[1].length,end=m.index+m[0].length;references.push({start:offsets[start],end:offsets[end],label:m[0].slice(m[1].length)});}
 return {text,references,pending:null};
}
function match(heard,index,cursor,now=Date.now()){
 if(!index?.references?.length)return null;
 const sample=String(heard||'').slice(-160);if(sample.length<16)return null;
 if(index.pending&&(index.pending.cursor!==cursor||now-index.pending.time>12000))index.pending=null;
 // Only a nearby/current reference opens a longer search; ordinary prose keeps its normal limits.
 const reference=[...index.references].reverse().find(r=>r.start<=cursor+64&&cursor<=r.end+6000);if(!reference)return null;
 const from=Math.max(reference.end,cursor-64),end=Math.min(index.text.length,reference.end+6000),target=index.text.slice(from,end);
 for(const length of [96,80,64,48,36,28,24,20,16]){
  if(sample.length<length)continue;const phrase=sample.slice(-length),at=target.indexOf(phrase);if(at<0)continue;
  const global=index.text.indexOf(phrase);if(global<0||index.text.indexOf(phrase,global+1)>=0)continue;
  const start=from+at,pos=start+length;if(pos<=cursor)continue;
  // A long unique phrase supplies its own context. Short distant fragments need a second advancing result.
  if(length>=28||pos-cursor<=160){index.pending=null;return {pos,score:1,scripture:true};}
  const previous=index.pending;if(previous&&previous.cursor===cursor&&previous.sample!==sample&&pos>=previous.pos+4&&pos<=previous.pos+140&&now-previous.time<=12000){index.pending=null;return {pos,score:1,scripture:true};}
  if(!previous||previous.cursor!==cursor||pos<previous.pos||pos>previous.pos+140)index.pending={cursor,pos,time:now,sample};
  return null;
 }
 return null;
}
const api={build,match};if(typeof module==='object'&&module.exports)module.exports=api;else root.PromScriptureSpeech=api;
})(typeof window==='object'?window:globalThis);
