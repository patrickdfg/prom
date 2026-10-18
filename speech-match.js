/* Conservative multi-window speech alignment. Input/output positions remain canonical. */
(function(root){
'use strict';
function substitution(a,b){if(a===b)return 0;const x=a.charCodeAt(0)-44032,y=b.charCodeAt(0)-44032;if(x<0||x>=11172||y<0||y>=11172)return 1;const diff=+(Math.floor(x/588)!==Math.floor(y/588))+ +(Math.floor(x%588/28)!==Math.floor(y%588/28))+ +(x%28!==y%28);return diff===1?.65:1;}
function align(needle,target){
 const m=needle.length,n=target.length,steps=new Uint8Array((m+1)*(n+1));let prev=new Float64Array(n+1);
 for(let i=1;i<=m;i++){const row=new Float64Array(n+1);row[0]=i;steps[i*(n+1)]=2;for(let j=1;j<=n;j++){const diagonal=prev[j-1]+substitution(needle[i-1],target[j-1]),del=prev[j]+1,ins=row[j-1]+1;let cost=diagonal,step=1;if(del<cost){cost=del;step=2;}if(ins<cost){cost=ins;step=3;}row[j]=cost;steps[i*(n+1)+j]=step;}prev=row;}
 const limit=Math.min(7,m*(m>=36?.16:.105)),ends=[];
 for(let j=1;j<=n;j++)if(prev[j]<=limit&&prev[j]<=(prev[j-1]??Infinity)&&prev[j]<=(prev[j+1]??Infinity))ends.push(j);
 const hits=[];for(const end of ends){let i=m,j=end,exact=0,run=0,runs=[];while(i>0){const step=steps[i*(n+1)+j];if(step===1){if(needle[i-1]===target[j-1]){exact++;run++;}else{if(run)runs.push(run);run=0;}i--;j--;}else{if(run)runs.push(run);run=0;if(step===2)i--;else if(step===3)j--;else break;}}if(run)runs.push(run);runs.sort((a,b)=>b-a);if(exact<m*.74||!(runs[0]>=16||runs[0]>=7&&runs[1]>=4))continue;hits.push({start:j,end,cost:prev[end],length:m,exact,quality:1-prev[end]/m});}
 return hits;
}
function match(heard,target,cursor,options={}){
 const sample=String(heard||'').slice(-96);if(sample.length<20||!target)return null;const offset=options.offset||0,map=options.map;
 // Restrict work even when a caller passes an unusually long page.
 let a=0,b=target.length;if(map){while(a<b&&map[a]<=cursor-96)a++;b=a;while(b<target.length&&map[b]<=cursor+1400)b++;}else{a=Math.max(0,cursor-offset-96);b=Math.min(target.length,cursor-offset+1400);}target=target.slice(a,b);const source=i=>map?map[a+i-1]:offset+a+i;
 const windows=[[64,0],[40,0],[24,0],[64,4],[40,4],[64,8]],votes=[];
 for(let w=0;w<windows.length;w++){const [size,trim]=windows[w],end=sample.length-trim;if(end<20)continue;const begin=Math.max(0,end-size),needle=sample.slice(begin,end);if(needle.length<20)continue;
  for(const hit of align(needle,target)){const pos=source(hit.end),start=source(hit.start+1)-1,advance=pos-cursor;if(advance>120&&needle.length<36)continue;votes.push({...hit,pos,sourceStart:start,trim,w,key:begin+':'+end,rank:hit.quality-trim*.001+Math.min(needle.length,64)*.0005});}
 }
 if(!votes.length)return null;
 // Compare endpoints after accounting for deliberately withheld, unreliable trailing characters.
 const clusters=[];for(const hit of votes.sort((a,b)=>b.rank-a.rank)){const projected=hit.pos+hit.trim;let group=clusters.find(g=>Math.abs(g.projected-projected)<=8);if(!group){group={projected,hits:[]};clusters.push(group);}group.hits.push(hit);}
 for(const group of clusters){const best=group.hits[0],windows=new Set(group.hits.map(h=>h.key));group.best=best;group.score=best.rank+Math.min(windows.size,3)*.012;group.support=windows.size;}
 clusters.sort((a,b)=>b.score-a.score);const best=clusters[0],other=clusters.find(g=>Math.abs(g.projected-best.projected)>12);
 if(other&&best.score-other.score<.065)return null;
 const hit=best.best;if(hit.pos<=cursor)return null;
 // Large advances need a long, well-supported phrase, not one fuzzy short fragment.
 if(hit.pos-cursor>120&&(hit.length<36||best.support<2||hit.quality<.88))return null;
 return {pos:hit.pos,score:hit.quality,start:hit.sourceStart,windows:best.support,withheld:hit.trim};
}
function optional(heard,index,cursor){
 if(!index?.groups?.length)return null;const at=index.map.findIndex(p=>p>cursor),center=at<0?index.map.length:at,begin=Math.max(0,center-96),end=Math.min(index.text.length,center+900),map=index.map.slice(begin,end);
 // Long optional notes must not consume the forward-search budget.
 const relative=map.map((_,i)=>i+1),localCursor=center-begin,hit=match(heard,index.text.slice(begin,end),localCursor,{map:relative});if(!hit)return null;
 const pos=map[hit.pos-1],start=map[Math.max(0,hit.start)]-1;
 if(!index.groups.some(g=>g.start<pos&&g.end>Math.min(cursor,start)))return null;
 return {...hit,pos,start,optional:true};
}
const api={match,optional};if(typeof module==='object'&&module.exports)module.exports=api;else root.PromSpeechMatch=api;
})(typeof window==='object'?window:globalThis);
