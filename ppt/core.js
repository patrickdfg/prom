/* Matching positions are in normalized manuscript characters, never slide numbers. */
(function(root){
'use strict';
const Scripture=typeof module==='object'&&module.exports?require('../scripture-speech.js'):root.PromScriptureSpeech;
const Robust=typeof module==='object'&&module.exports?require('../speech-match.js'):root.PromSpeechMatch;
const Optional=typeof module==='object'&&module.exports?require('../optional-speech.js'):root.PromOptionalSpeech;
const Fold=typeof module==='object'&&module.exports?require('../speech-fold.js'):root.PromSpeechFold;
const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^가-힣a-z0-9]/g,'');
function index(lines){let text='';const ranges=lines.map(line=>{const start=text.length;text+=normalize(line);return {start,end:text.length};});return {text,ranges};}
function segments(lines,links){
 const cuts=new Set(links.filter(l=>['exact','manual'].includes(l.status)).flatMap(l=>[l.start,l.end]));
 let offset=0;const rows=[];
 for(const original of lines){
  // Normalize first so compatibility characters and composed Hangul share matching offsets.
  const text=original.normalize('NFKC');let start=offset,rawStart=0;
  for(let i=0;i<text.length;i++){
   const count=normalize(text[i]).length;
   if(count&&offset>start&&cuts.has(offset)){rows.push({text:text.slice(rawStart,i),start,end:offset});rawStart=i;start=offset;}
   offset+=count;
  }
  if(rawStart<text.length)rows.push({text:text.slice(rawStart),start,end:offset});
 }
 return rows;
}
function distance(a,b,limit=Infinity){if(Math.abs(a.length-b.length)>limit)return limit+1;let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const row=[i];let low=i;for(let j=1;j<=b.length;j++){row[j]=Math.min(row[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));low=Math.min(low,row[j]);}if(low>limit)return limit+1;prev=row;}return prev[b.length];}
function candidates(needle,hay,offset=0,width=8){const out=new Set();for(const frac of [0,.25,.5,.75,1]){const at=Math.floor(Math.max(0,needle.length-width)*frac),anchor=needle.slice(at,at+width);if(anchor.length<width)continue;let start=0,n=0;while((start=hay.indexOf(anchor,start))>=0&&n++<100){for(let d=-2;d<=2;d++)if(start-at+d>=0)out.add(offset+start-at+d);start++;}}return [...out];}
function align(lines,slides){const ix=index(lines),links=[],needles=slides.map(s=>normalize(s.text));let after=0,last=null;
 for(let i=0;i<slides.length;i++){const needle=needles[i];
  // Build-up slides repeat the earlier text; only the newly added words trigger the next slide.
  if(last&&needle.length>last.needle.length&&needle.startsWith(last.needle)&&ix.text.startsWith(needle,last.start)){
   const end=last.start+needle.length,status=last.status;links.push({start:last.end,end,status,score:1,reason:'cumulative'});last={needle,start:last.start,end,status};after=end;continue;
  }
  let expanded=needle;for(let j=i+1;j<needles.length&&needles[j].length>expanded.length&&needles[j].startsWith(expanded)&&expanded.length>=6;j++)expanded=needles[j];
  // Use the full build-up as context, so a repeated first line is placed at the right occurrence.
  const contextHit=needle.length>=6&&expanded.length>needle.length?ix.text.indexOf(expanded,after):-1;
  let hit=contextHit;if(hit<0&&needle.length>=6)hit=ix.text.indexOf(needle,after);
  if(hit>=0){const anchor=contextHit>=0?expanded:needle,another=ix.text.indexOf(anchor,hit+1),status=another<0?'exact':'review',end=hit+needle.length;links.push({start:hit,end,status,score:1});last={needle,start:hit,end,status};after=end;continue;}
  let best=null;if(needle.length>=12&&needle.length<1600){const hay=ix.text.slice(after);for(const start of candidates(needle,hay,after)){const end=start+needle.length,cost=distance(needle,ix.text.slice(start,end),Math.ceil(needle.length*.14)),score=1-cost/needle.length;if(score>=.86&&(!best||score>best.score))best={start,end:Math.min(end,ix.text.length),score,status:'review'};}}
  links.push(best||{start:null,end:null,status:'unlinked',score:0});if(best){after=best.end;last={needle,start:best.start,end:best.end,status:'review'};}else last=null;
 }
 return links;
}
function active(links,pos){return links.findIndex(l=>['exact','manual'].includes(l.status)&&Number.isFinite(l.start)&&pos>=l.start&&pos<l.end);}
// Frequent phrases are weak location anchors. Stop counting after five copies.
function frequentAnchor(text,phrase){
 if(!phrase||phrase.length>12)return false;
 let count=0,at=0;
 while((at=text.indexOf(phrase,at))!==-1){if(++count>=5)return true;at++;}
 return false;
}
function locateSpeechBase(raw,text,cursor,optional=null,scripture=null){const passage=Scripture?.match(normalize(raw),scripture,cursor);if(passage)return passage;const skipped=Optional?.match(normalize(raw),optional,cursor);if(skipped!==null&&skipped!==undefined)return {pos:skipped,score:1,optional:true};const heard=normalize(raw).slice(-64);if(heard.length<5)return null;const begin=Math.max(0,cursor-100),end=Math.min(text.length,cursor+1400),hay=text.slice(begin,end);
 // Prefer the longest matching phrase across the manuscript before trying shorter local fragments.
 for(const size of [56,40,28,18,12]){
  if(heard.length<size)continue;const tail=heard.slice(-size),at=hay.indexOf(tail);
  if(at>=0&&hay.indexOf(tail,at+1)<0){
   const pos=begin+at+size,advance=pos-cursor;
   // A 12~18-character phrase cannot jump far merely because it is unique in a local 1400-char window.
   const limit=size<=12?160:size<=18?350:size<=28?750:1400;
   if(pos>=cursor-3&&advance<=limit&&!frequentAnchor(text,tail))return {pos:Math.max(cursor,pos),score:1};
  }
  if(size>=12){const globalAt=text.indexOf(tail);if(globalAt>=0&&text.indexOf(tail,globalAt+1)<0)return {pos:globalAt+size,score:1,reacquired:true};}
 }
 const resilient=Robust?.match(heard,hay,cursor,{offset:begin})||Robust?.optional(heard,optional,cursor);if(resilient)return {...resilient,resilient:true};
 const tail=heard.slice(-28);let best=null,second=0;
 for(const start of tail.length>=16?candidates(tail,hay,begin,4):[]){const pos=start+tail.length;if(pos<cursor-3)continue;const cost=distance(tail,text.slice(start,pos),3),score=1-cost/tail.length;if(score<.89)continue;if(!best||score>best.score){second=best?.score||0;best={pos,score};}else if(Math.abs(best.pos-pos)>5)second=Math.max(second,score);}
 if(best&&best.score-second>=.04)return best;
 // Recover a distant position with small recognition errors only when it clearly beats every other passage.
 const global=[];
 for(const start of tail.length>=24?candidates(tail,text,0,6):[]){const pos=start+tail.length;if(pos>text.length)continue;const cost=distance(tail,text.slice(start,pos),2),score=1-cost/tail.length;if(score>=.92)global.push({pos,score,reacquired:true});}
 global.sort((a,b)=>b.score-a.score);const first=global[0],other=first&&global.find(hit=>Math.abs(hit.pos-first.pos)>8);
 if(first&&(!other||first.score-other.score>=.04))return first;
 // Short fragments may advance only near the current reading position, uniquely.
 const nearBegin=Math.max(0,cursor-40),nearEnd=Math.min(text.length,cursor+90),near=text.slice(nearBegin,nearEnd);
 for(const size of [8,7,6,5]){
  if(heard.length<size)continue;
  const tail=heard.slice(-size);
  // Very common expressions (5+ manuscript occurrences) require a longer phrase/context.
  if(frequentAnchor(text,tail))continue;
  const at=near.indexOf(tail);if(at<0||near.indexOf(tail,at+1)>=0)continue;
  const pos=nearBegin+at+size;
  if(pos>cursor&&pos-cursor<=45)return {pos,score:1};
 }
 return null;
}
// 기존 방식으로 못 찾았을 때만: 숫자·기호를 원고 표기로 바꿔 보고(일곱 번↔7번, 3↔삼, +↔더하기), 그래도 없으면 지금 위치 근처에서 한두 글자 틀린 것을 허용해 찾는다.
function locateSpeech(raw,text,cursor,optional=null,scripture=null){
 const hit=locateSpeechBase(raw,text,cursor,optional,scripture);if(hit||!Fold)return hit;
 const alt=Fold.variants(raw);
 for(const v of alt){const h=locateSpeechBase(v,text,cursor,optional,scripture);if(h)return {...h,folded:true};}
 for(const v of [raw,...alt]){const h=Fold.near(normalize(v),text,cursor);if(h)return h;}
 return null;
}
// 본문이 시작되는 위치: 맨 앞의 <날짜>·제목·'본 문'·<성경 구절> 줄은 읽지 않고 바로 본문으로 들어가는 일이 많다.
// 맨 앞 12줄 안의 머리 묶음(<…>로 시작하는 줄, '본 문' 줄, 20자 미만 짧은 줄) 가운데 마지막 <…>·'본 문' 줄 바로 다음 줄의 시작 위치(없으면 0).
function bodyStart(lines,ix){let last=-1;for(let i=0;i<Math.min(lines.length,12);i++){const s=String(lines[i]||''),tag=/^\s*</.test(s)||/^\s*본\s*문/.test(s);if(tag){last=i;continue;}if(normalize(s).length<20)continue;break;}return last>=0?(ix.ranges[last+1]?.start??0):0;}
// 머리 줄을 건너뛰고 본문을 읽기 시작했는지: 본문 앞부분(600자) 안에서 들은 말 끝 9~24자가 한 곳에만 그대로 있을 때만 그 위치.
// 짧은 말로 본문 쪽으로 잘못 넘어가지 않도록 locateSpeech보다 엄격하게 본다.
function bodyMatch(raw,text,body){const heard=normalize(raw);if(!body||heard.length<9)return null;const end=Math.min(text.length,body+600),win=text.slice(body,end);for(let n=Math.min(24,heard.length);n>=9;n--){const tail=heard.slice(-n),at=win.indexOf(tail);if(at<0||win.indexOf(tail,at+1)>=0||text.slice(0,body).includes(tail))continue;return {pos:body+at+n,score:1,body:true};}return null;}
const api={normalize,index,segments,align,active,locateSpeech,distance,bodyStart,bodyMatch};if(typeof module==='object'&&module.exports)module.exports=api;else root.CaptionCore=api;
})(typeof window==='object'?window:globalThis);

