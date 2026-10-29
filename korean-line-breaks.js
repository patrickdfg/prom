// 자동 제작에서만 사용한다. 꾸밈말을 붙이려고 더 강한 의미 단위를 새로 끊지 않는다.
(function(root){
'use strict';
const clean=s=>String(s).replace(/^[“‘"'(（「『\[]+|[”’"')）」』\],.!?;:]+$/g,'');
const determiner=/^(그|이|저|각|온|모든|한|두|세|네|몇|새|첫|이런|그런|저런|어떤|무슨|여러|온갖|갖은|매|전|총|약|단|그의|나의|너의|우리의|자기의)$/;
const adverb=/^(아주|매우|정말|참|가장|더|덜|잘|못|안|곧|늘|항상|다시|함께|서로|절대|너무|더욱|제대로|반드시|오직|오래|빨리|천천히|하나하나|갈수록|그렇게도)$/;
const relational=/^(대해|대하여|대한|관해|관하여|관한|통해|통하여|통한|위해|위하여|위한|따라|따른|의해|의하여|의한|비해|비하여|향해|향한|불구하고)(서|서는|서도|선|서만|도|는)?$/;
const bound=/^(것|거|수|줄|때|데|듯|뿐|만큼|대로|바|따름|척|체|채)(은|는|이|가|을|를|의|도|만|에|에는|에도)?$/;
const adnominal=s=>/(할|될|갈|올|볼|줄|던|운|된|한|인|진|난|신|른|없는|있는|좋은|작은|많은|높은|낮은|큰|긴|짧은|같은|하는|되는|오는|가는|보는|듣는|읽는|먹는|쓰는|받는|지키는|따르는|말하는)$/.test(s);
function protectedBreak(prev,next){
 const p=clean(prev),q=clean(next);
 return /^\d+\.?$/.test(p)||/(에|에게|께|로|으로|을|를|와|과)$/.test(p)&&relational.test(q)||adnominal(p)&&bound.test(q)||/(지|고|어|아|여|게|해)$/.test(p)&&/^(않|못하|있|없|주|보|싶|되|하)/.test(q);
}
function modifierBreak(prev,next){
 if(/[.!?,;:][”’"')）」』\]]*$/.test(prev)||protectedBreak(prev,next))return false;
 const p=clean(prev),q=clean(next);
 return !!q&&(determiner.test(p)||adnominal(p)||adverb.test(p)||/[가-힣]{2,}(히|하게|롭게)$/.test(p));
}
// rows는 색상·위치 정보를 보존할 수 있도록 어절 문자열만 받으며, 변경된 줄별 어절 수를 돌려준다.
function refine(rows,measure,maxWidth){
 if(rows.length<2)return null;
 const words=rows.flat(),ends=[];let at=0;
 for(const row of rows){at+=row.length;ends.push(at);}
 const original=new Set(ends.slice(0,-1)),cache=new Map();
 const width=(a,b)=>{const key=a+':'+b;if(!cache.has(key))cache.set(key,measure(words.slice(a,b).join(' ')));return cache.get(key);};
 let changed=false,again=true;
 while(again){
  again=false;
  for(let row=0;row<ends.length-1;row++){
   const cut=ends[row],start=row?ends[row-1]:0,end=ends[row+1];
   if(!modifierBreak(words[cut-1],words[cut]))continue;
   let best=cut,bestCost=Infinity;
   for(let candidate=start+1;candidate<end;candidate++){
    if(modifierBreak(words[candidate-1],words[candidate]))continue;
    if(!original.has(candidate)&&protectedBreak(words[candidate-1],words[candidate]))continue;
    const trial=ends.slice();trial[row]=candidate;const widths=[];let a=0;
    for(const b of trial){widths.push(width(a,b));a=b;}
    const hi=Math.max(...widths),lo=Math.min(...widths);
    if(hi>maxWidth||lo<hi*.75)continue;
    const mean=widths.reduce((sum,w)=>sum+w,0)/widths.length,cost=widths.reduce((sum,w)=>sum+(w-mean)**2,0);
    if(cost<bestCost){best=candidate;bestCost=cost;}
   }
   if(best!==cut){ends[row]=best;changed=again=true;}
  }
 }
 if(!changed)return null;
 return ends.map((end,i)=>end-(i?ends[i-1]:0));
}
const api={refine};
if(typeof module==='object'&&module.exports)module.exports=api;else root.PromLineBreaks=api;
})(globalThis);
