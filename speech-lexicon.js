// 음성 인식이 자주 틀리게 받아쓰는 말을 원고 말로 바꿔 맞춰 보는 사전 (기본 사전 + 이 기기에서 배운 짝). 프롬프터와 방송용 PPT가 같이 쓴다.
(function(root){
'use strict';
const KEY='promLexiconLearned',MIN_COUNT=2,MAX_ENTRIES=600;
const norm=s=>String(s||'').toLowerCase().replace(/[^0-9a-z가-힣]/g,'');

// 기본 사전: [들린 말, 원고 말]. 실제 크롬 인식 기록(2026-10-04 주일말씀)에서 뽑아 확인한 것.
// 앞뒤 한 글자 문맥을 붙여 두어 엉뚱한 곳에서 바뀌지 않게 했다. 원고 근처에 원고 말이 있을 때만 바꾼다.
const BUILTIN=[
  ['전체능','전지전능'],['와제대어','와일체되어'],['물끄시','물귀신'],['늘별만','늘편만'],
  ['성녀성','성령성'],['에응답받','에연단받'],['며힘을하','며힐문하'],['점새악해','점쇠약해'],['정소다말','정쏟아말'],
  ['을비친하게','을빛이나게'],['우르러','우러러'],['면영세해','면용서해'],['부주는살','부지런히살']
].map(([a,b])=>({heard:norm(a),script:norm(b),builtin:true}));

let learned={};
try{learned=JSON.parse(root.localStorage?.getItem(KEY)||'{}')||{}}catch(_){learned={}}
function persist(){try{root.localStorage?.setItem(KEY,JSON.stringify(learned))}catch(_){}}

// 쓸 짝: 기본 사전 + 서로 다른 원고 자리에서 2번 이상 같은 짝이 나온 배운 짝
function active(){
  const out=[...BUILTIN];
  for(const [k,v] of Object.entries(learned))if((v.pos||[]).length>=MIN_COUNT){const [heard,script]=k.split('|');out.push({heard,script,count:v.pos.length});}
  return out;
}
const reCache=new Map();
function pattern(h){if(!reCache.has(h))reCache.set(h,new RegExp([...h].map(c=>c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('[^0-9a-zA-Z가-힣]*'),'gi'));return reCache.get(h);}

// 들은 글(공백 포함)에서 틀린 말을 원고 말로 바꾼다. 원고의 지금 위치 근처(-120 ~ +700자)에 원고 말이 있을 때만.
function fix(text,manuscript,cursor=0){
  const t=String(text||'');if(t.length<3||!manuscript)return t;
  const win=manuscript.slice(Math.max(0,cursor-120),cursor+700);let out=t;
  for(const e of active()){
    if(e.heard.length<3||!win.includes(e.script))continue;
    const re=pattern(e.heard);re.lastIndex=0;
    if(re.test(out)){re.lastIndex=0;out=out.replace(re,e.script);}
  }
  return out;
}

// 두 글을 글자 단위로 맞대어 바뀐 구간을 찾는다 (편집 거리 역추적).
function diffBlocks(a,b){
  const n=a.length,m=b.length,W=m+1,d=new Uint16Array((n+1)*W);
  for(let i=0;i<=n;i++)d[i*W]=i;   // 원고 쪽 앞부분은 공짜로 건너뛴다 (첫 줄 0)
  for(let i=1;i<=n;i++)for(let j=1;j<=m;j++){const c=a[i-1]===b[j-1]?0:1;d[i*W+j]=Math.min(d[(i-1)*W+j-1]+c,d[(i-1)*W+j]+1,d[i*W+j-1]+1);}
  // 원고 쪽 앞뒤 남는 부분은 공짜로 건너뛰도록, 끝 열에서 가장 작은 곳을 고른다
  let j=0,best=Infinity;for(let k=0;k<=m;k++)if(d[n*W+k]<best){best=d[n*W+k];j=k;}
  let i=n;const ops=[];
  while(i>0&&j>0){const c=a[i-1]===b[j-1]?0:1;if(d[i*W+j]===d[(i-1)*W+j-1]+c){ops.push([c?'x':'=',i-1,j-1]);i--;j--;}else if(d[i*W+j]===d[(i-1)*W+j]+1){ops.push(['a',i-1,j]);i--;}else{ops.push(['b',i,j-1]);j--;}}
  while(i>0){ops.push(['a',i-1,j]);i--;}
  ops.reverse();
  const same=ops.filter(o=>o[0]==='=').length,blocks=[];let cur=null;
  for(const [op,ai,bj] of ops){
    if(op==='='){if(cur){blocks.push(cur);cur=null;}continue;}
    if(!cur)cur={i1:ai,i2:ai,j1:bj,j2:bj};
    if(op!=='b')cur.i2=ai+1;if(op!=='a')cur.j2=bj+1;
  }
  if(cur)blocks.push(cur);
  return {same,blocks};
}

// 인식 기록(heard·to)과 원고를 맞대어 틀린 짝을 배운다. 같은 원고 자리는 한 번만 센다.
function learn(events,manuscript){
  if(!manuscript||!Array.isArray(events))return 0;let added=0,lastTo=-99;
  for(const e of events){
    if(e?.k!=='heard'||!Number.isFinite(e.to))continue;
    if(e.to-lastTo<12)continue;      // 거의 같은 창은 건너뛴다 (임시 결과가 한 글자씩 늘어나는 것)
    const h=norm(e.heard);if(h.length<14)continue;
    const lo=Math.max(0,e.to-h.length-30),seg=manuscript.slice(lo,e.to+30);if(seg.length<10)continue;
    const {same,blocks}=diffBlocks(h,seg);if(same<h.length*.72)continue;
    lastTo=e.to;
    for(const b of blocks){
      if(b.i2-b.i1<1||b.j2-b.j1<1)continue;                  // 바뀐 것만 (빠지거나 더해진 것은 배우지 않음)
      if(b.i1<2||b.i2>h.length-3)continue;                    // 창 가장자리는 덜 들어온 말일 수 있어 버린다
      if(b.i2-b.i1>8||b.j2-b.j1>8)continue;
      const heard=h.slice(b.i1-1,b.i2+1),script=seg.slice(b.j1-1,b.j2+1);
      if(heard.length<3||heard===script)continue;
      const key=heard+'|'+script,at=lo+b.j1,rec=learned[key]||(learned[key]={pos:[],last:0});
      if(!rec.pos.some(p=>Math.abs(p-at)<6)){rec.pos.push(at);if(rec.pos.length>20)rec.pos.shift();added++;}
      rec.last=Date.now();
    }
  }
  // 너무 많아지면 오래되고 적게 나온 것부터 지운다
  const keys=Object.keys(learned);if(keys.length>MAX_ENTRIES){keys.sort((a,b)=>(learned[a].pos.length-learned[b].pos.length)||(learned[a].last-learned[b].last));for(const k of keys.slice(0,keys.length-MAX_ENTRIES))delete learned[k];}
  persist();return added;
}
// 기록 파일에 넣을 배운 짝 (자주 나온 순)
function exportLearned(){return Object.entries(learned).map(([k,v])=>{const [heard,script]=k.split('|');return {heard,script,count:v.pos.length};}).sort((a,b)=>b.count-a.count);}
function clearLearned(){learned={};persist();}

const api={fix,learn,active,exportLearned,clearLearned,norm,diffBlocks,BUILTIN};
if(typeof module==='object'&&module.exports)module.exports=api;
root.PromLexicon=api;
})(typeof window==='object'?window:globalThis);
