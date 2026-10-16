/* Matching positions are in normalized manuscript characters, never slide numbers. */
(function(root){
'use strict';
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
function candidates(needle,hay,offset=0){const out=new Set();for(const frac of [0,.25,.5,.75,1]){const at=Math.floor(Math.max(0,needle.length-8)*frac),anchor=needle.slice(at,at+8);if(anchor.length<6)continue;let start=0,n=0;while((start=hay.indexOf(anchor,start))>=0&&n++<100){for(let d=-2;d<=2;d++)if(start-at+d>=0)out.add(offset+start-at+d);start++;}}return [...out];}
function align(lines,slides){const ix=index(lines),links=[];let after=0;
 for(const slide of slides){const needle=normalize(slide.text);let hit=-1;if(needle.length>=6)hit=ix.text.indexOf(needle,after);
  if(hit>=0){const another=ix.text.indexOf(needle,hit+1);links.push({start:hit,end:hit+needle.length,status:another<0?'exact':'review',score:1});after=hit+needle.length;continue;}
  let best=null; if(needle.length>=12&&needle.length<1600){const hay=ix.text.slice(after);for(const start of candidates(needle,hay,after)){const end=start+needle.length;const cost=distance(needle,ix.text.slice(start,end),Math.ceil(needle.length*.14));const score=1-cost/needle.length;if(score>=.86&&(!best||score>best.score))best={start,end:Math.min(end,ix.text.length),score,status:'review'};}}
  links.push(best||{start:null,end:null,status:'unlinked',score:0});if(best)after=best.end;
 }
 return links;
}
function active(links,pos){return links.findIndex(l=>['exact','manual'].includes(l.status)&&Number.isFinite(l.start)&&pos>=l.start&&pos<l.end);}
function locateSpeech(raw,text,cursor){const heard=normalize(raw).slice(-64);if(heard.length<8)return null;const begin=Math.max(0,cursor-100),end=Math.min(text.length,cursor+1400),hay=text.slice(begin,end);
 for(const size of [56,40,28,18,12,8]){if(heard.length<size)continue;const tail=heard.slice(-size);let at=hay.indexOf(tail);if(at<0)continue;const next=hay.indexOf(tail,at+1);if(next>=0)return null;const pos=begin+at+tail.length;if(pos>=cursor-3)return {pos:Math.max(cursor,pos),score:1};}
 const tail=heard.slice(-28);if(tail.length<16)return null;let best=null,second=0;
 for(const start of candidates(tail,hay,begin)){const pos=start+tail.length;if(pos<cursor-3)continue;const cost=distance(tail,text.slice(start,pos),3),score=1-cost/tail.length;if(score<.89)continue;if(!best||score>best.score){second=best?.score||0;best={pos,score};}else if(Math.abs(best.pos-pos)>5)second=Math.max(second,score);}
 return best&&best.score-second>=.04?best:null;
}
const api={normalize,index,segments,align,active,locateSpeech,distance};if(typeof module==='object'&&module.exports)module.exports=api;else root.CaptionCore=api;
})(typeof window==='object'?window:globalThis);
