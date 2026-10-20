/* 인식 결과의 숫자·기호 표기 보정과 가까운 곳 근사 맞춤.
   들은 말만 다른 표기로 바꿔 보고, 원고 위치(번호)는 건드리지 않는다. 먼저 쓰던 위치 찾기가 실패한 뒤에만 쓴다. */
(function(root){
'use strict';
const NATIVE={하나:1,한:1,두:2,세:3,네:4,다섯:5,여섯:6,일곱:7,여덟:8,아홉:9,열:10};
const NAT=['','한','두','세','네','다섯','여섯','일곱','여덟','아홉','열'];
const SINO=['영','일','이','삼','사','오','육','칠','팔','구'];
const COUNT='번째|번|가지|개|명|분|사람|배|째|살|해|달|시간|군데|곳|차례|마리|그루|장|권';
const WORD_NUM=new RegExp('(?<![가-힣])(다섯|여섯|일곱|여덟|아홉|하나|한|두|세|네|열)\\s*(?='+COUNT+')','g');
const DIGIT_NUM=/(?<![0-9])([0-9]{1,2})(?![0-9])/g;
const COUNT_AHEAD=new RegExp('^\\s*(?:'+COUNT+')');
const SYMBOLS=[[/[+＋]/g,'더하기'],[/[×✕]/g,'곱하기']];
function sino(n){if(n===0)return SINO[0];const t=Math.floor(n/10),o=n%10;return (t?(t>1?SINO[t]:'')+'십':'')+(o?SINO[o]:'');}
function symbols(s){let out=s;for(const [re,word] of SYMBOLS)out=out.replace(re,' '+word+' ');return out;}
// 들은 말을 원고에 쓰였을 법한 다른 표기로 바꾼 목록(원문과 같은 것은 뺀다). 숫자·기호가 없으면 빈 목록.
function variants(raw){
 const s=String(raw||'');if(!/[0-9+＋×✕]|다섯|여섯|일곱|여덟|아홉|하나|한|두|세|네|열/.test(s))return [];
 const out=new Set();
 // 일곱 번 → 7번
 out.add(symbols(s.replace(WORD_NUM,(m,w)=>String(NATIVE[w]))));
 // 7번 → 일곱 번 (숫자 뒤에 단위가 올 때), 3 → 삼
 out.add(symbols(s.replace(DIGIT_NUM,(m,d,off,str)=>{const n=+d,tail=str.slice(off+m.length);return n>=1&&n<=10&&COUNT_AHEAD.test(tail)?NAT[n]:m;})));
 out.add(symbols(s.replace(DIGIT_NUM,(m,d)=>sino(+d))));
 out.add(symbols(s));
 out.delete(s);
 return [...out].filter(v=>v&&v.trim());
}
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^가-힣a-z0-9]/g,'');
// 글자 하나가 다를 때의 비용: 받침·모음·자음 중 하나만 다른 같은 소리는 싸게 친다.
function sub(a,b){if(a===b)return 0;const x=a.charCodeAt(0)-44032,y=b.charCodeAt(0)-44032;if(x<0||x>=11172||y<0||y>=11172)return 1;
 const d=+(Math.floor(x/588)!==Math.floor(y/588))+ +(Math.floor(x%588/28)!==Math.floor(y%588/28))+ +(x%28!==y%28);return d===1?.6:1;}
// 들은 말 끝 L자를 지금 위치 근처에서 근사 검색. 한두 글자가 틀려도(볼↔보를, 구상↔구성, 빼기↔빼내기) 따라간다.
// 뒤로 가지 않고, 가까운 앞쪽 하나에만 뚜렷하게 맞을 때만 위치를 돌려 준다.
function near(heard,text,cursor,opt={}){
 const L=opt.length||18,maxCost=opt.maxCost??2,back=opt.back??24,ahead=opt.ahead??120;
 if(!heard||heard.length<14||!text)return null;
 const needle=heard.slice(-L),m=needle.length,begin=Math.max(0,cursor-back),hay=text.slice(begin,Math.min(text.length,cursor+ahead)),n=hay.length;
 if(n<m)return null;
 let prev=new Float64Array(n+1);// 첫 줄 0: 창 안 어디서 시작해도 된다
 for(let i=1;i<=m;i++){const row=new Float64Array(n+1);row[0]=i;
  for(let j=1;j<=n;j++){const d=prev[j-1]+sub(needle[i-1],hay[j-1]),del=prev[j]+1,ins=row[j-1]+1;row[j]=Math.min(d,del,ins);}
  prev=row;}
 const ends=[];for(let j=1;j<=n;j++)if(prev[j]<=maxCost&&prev[j]<=prev[j-1]&&prev[j]<=(j<n?prev[j+1]:Infinity))ends.push({j,cost:prev[j]});
 if(!ends.length)return null;
 ends.sort((a,b)=>a.cost-b.cost||b.j-a.j);const best=ends[0],other=ends.find(e=>Math.abs(e.j-best.j)>8);
 if(other&&other.cost-best.cost<1.5)return null;
 const pos=begin+best.j;if(pos<=cursor)return null;
 return {pos,score:1-best.cost/m,fuzzy:true};
}
const api={variants,near,norm};if(typeof module==='object'&&module.exports)module.exports=api;else root.PromSpeechFold=api;
})(typeof window==='object'?window:globalThis);
