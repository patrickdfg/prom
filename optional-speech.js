/* Optional parenthesized speech, mapped to the unchanged canonical manuscript cursor. */
(function(root){
'use strict';
const normal=s=>String(s||'').toLowerCase().replace(/[^가-힣a-z0-9]/g,'');
function build(raw,normalize=normal){
 const chars=Array.from(String(raw||'')),offsets=[0],units=chars.map(ch=>{const text=normalize(ch);offsets.push(offsets.at(-1)+text.length);return text;}),stack=[],pairs=[];
 chars.forEach((ch,i)=>{if(ch==='('||ch==='（')stack.push(i);else if((ch===')'||ch==='）')&&stack.length)pairs.push([stack.pop(),i+1]);});
 // Only complete pairs are optional. An unmatched '(' cannot hide the rest of a manuscript.
 const mask=new Uint8Array(chars.length),groups=[];
 pairs.sort((a,b)=>a[0]-b[0]||b[1]-a[1]);let through=-1;
 for(const [a,b] of pairs){if(a<through)continue;through=b;if(offsets[b]===offsets[a])continue;mask.fill(1,a,b);groups.push({start:offsets[a],end:offsets[b]});}
 let text='';const map=[];units.forEach((unit,i)=>{if(mask[i])return;for(let j=0;j<unit.length;j++){text+=unit[j];map.push(offsets[i]+j+1);}});
 return {text,map,groups,length:offsets.at(-1)};
}
function lower(map,value){let a=0,b=map.length;while(a<b){const m=(a+b)>>>1;if(map[m]<=value)a=m+1;else b=m;}return a;}
function match(heard,index,cursor){
 if(!index?.groups?.length||!index.text)return null;
 const center=lower(index.map,cursor),begin=Math.max(0,center-64),end=Math.min(index.text.length,center+350),target=index.text.slice(begin,end),sample=String(heard||'').slice(-64);
 for(let size=Math.min(64,sample.length);size>=6;size--){
  const tail=sample.slice(-size),at=target.indexOf(tail);if(at<0||target.indexOf(tail,at+1)>=0)continue;
  const start=begin+at,finish=start+size,pos=index.map[finish-1],sourceStart=index.map[start]-1;
  if(pos<=cursor||start>center+45)continue;
  // Require evidence across an actual omission, or immediately after an omitted parenthesis.
  // This is not a general forward search: ordinary passages retain the existing jump guards.
  const crossed=index.groups.some(g=>sourceStart<g.start&&pos>g.end&&index.map.slice(start,finish).filter(p=>p<=g.start).length>=2&&index.map.slice(start,finish).filter(p=>p>g.end).length>=2);
  const skipped=index.groups.some(g=>g.start>=cursor-2&&g.start<pos&&sourceStart>=g.end&&size>=8&&lower(index.map,g.start)-center<=24);
  if(crossed||skipped)return pos;
 }
 return null;
}
const api={build,match};if(typeof module==='object'&&module.exports)module.exports=api;else root.PromOptionalSpeech=api;
})(typeof window==='object'?window:globalThis);
