/* 선택형 한국어 정렬. 표시 원고는 바꾸지 않고 음성 비교용 문자와 원고 위치를 연결한다. */
(function(root){
  'use strict';
  const books={창:'창세기',출:'출애굽기',레:'레위기',민:'민수기',신:'신명기',수:'여호수아',삿:'사사기',룻:'룻기',삼상:'사무엘상',삼하:'사무엘하',왕상:'열왕기상',왕하:'열왕기하',대상:'역대상',대하:'역대하',스:'에스라',느:'느헤미야',에:'에스더',욥:'욥기',시:'시편',잠:'잠언',전:'전도서',아:'아가',사:'이사야',렘:'예레미야',애:'예레미야애가',겔:'에스겔',단:'다니엘',호:'호세아',욜:'요엘',암:'아모스',옵:'오바댜',욘:'요나',미:'미가',나:'나훔',합:'하박국',습:'스바냐',학:'학개',슥:'스가랴',말:'말라기',마:'마태복음',막:'마가복음',눅:'누가복음',요:'요한복음',행:'사도행전',롬:'로마서',고전:'고린도전서',고후:'고린도후서',갈:'갈라디아서',엡:'에베소서',빌:'빌립보서',골:'골로새서',살전:'데살로니가전서',살후:'데살로니가후서',딤전:'디모데전서',딤후:'디모데후서',딛:'디도서',몬:'빌레몬서',히:'히브리서',약:'야고보서',벧전:'베드로전서',벧후:'베드로후서',요일:'요한일서',요이:'요한이서',요삼:'요한삼서',유:'유다서',계:'요한계시록'};
  const ref=new RegExp('(^|[^가-힣a-zA-Z0-9])('+Object.keys(books).sort((a,b)=>b.length-a.length).join('|')+')\\s*(\\d{1,3})\\s*(?::|장\\s*)\\s*(\\d{1,3})\\s*절?','g');
  const keep=c=>/[가-힣a-zA-Z0-9]/.test(c);
  function number(s){
    if(s.length>5||/^0\d/.test(s))return [...s].map(x=>'영일이삼사오육칠팔구'[+x]).join('');
    let n=Number(s);if(!n)return '영';let out='';
    if(n>=10000){out+=(Math.floor(n/10000)===1?'':'영일이삼사오육칠팔구'[Math.floor(n/10000)])+'만';n%=10000;}
    for(const [v,u]of [[1000,'천'],[100,'백'],[10,'십'],[1,'']]){const d=Math.floor(n/v);if(d)out+=(d===1&&v>1?'':'영일이삼사오육칠팔구'[d])+u;n%=v;}return out;
  }
  const native={'열아홉':'십구','열여덟':'십팔','열일곱':'십칠','열여섯':'십육','열다섯':'십오','열넷':'십사','열네':'십사','열셋':'십삼','열세':'십삼','열둘':'십이','열두':'십이','열하나':'십일','열한':'십일','스무':'이십','스물':'이십','아홉':'구','여덟':'팔','일곱':'칠','여섯':'육','다섯':'오','넷':'사','네':'사','셋':'삼','세':'삼','둘':'이','두':'이','하나':'일','한':'일','열':'십'};
  const nativeRE=new RegExp('('+Object.keys(native).sort((a,b)=>b.length-a.length).join('|')+')(?=\\s*(?:장|절|명|개|번|살)(?:[^가-힣]|$))','g');
  function mapped(raw,start=0){
    const offsets=[start];for(const c of raw.split(''))offsets.push(offsets[offsets.length-1]+(keep(c)?1:0));
    let units=raw.split('').map((c,i)=>({c,p:offsets[i+1]}));
    function replace(re,convert){
      const text=units.map(x=>x.c).join('');let out=[],at=0;
      for(const m of text.matchAll(re)){out.push(...units.slice(at,m.index));const p=units[m.index+m[0].length-1]?.p??start;out.push(...[...convert(m)].map(c=>({c,p})));at=m.index+m[0].length;}
      out.push(...units.slice(at));units=out;
    }
    replace(ref,m=>m[1]+books[m[2]]+number(m[3])+'장'+number(m[4])+'절');
    replace(/\d+/g,m=>number(m[0]));replace(nativeRE,m=>native[m[1]]);
    units=units.filter(x=>keep(x.c));return {text:units.map(x=>x.c.toLowerCase()).join(''),map:units.map(x=>x.p)};
  }
  function letterCost(a,b){
    if(a===b)return 0;
    const x=a.charCodeAt(0)-44032,y=b.charCodeAt(0)-44032;
    if(x<0||x>=11172||y<0||y>=11172)return 1;
    const diff=Number(Math.floor(x/588)!==Math.floor(y/588))+Number(Math.floor(x%588/28)!==Math.floor(y%588/28))+Number(x%28!==y%28);
    return diff===1?0.55:1;
  }
  function match(heard,target,map,cursor){
    const tail=heard.slice(-22);if(tail.length<9||!target)return null;
    let prev=Array(target.length+1).fill(0);
    for(let i=1;i<=tail.length;i++){const next=[i];for(let j=1;j<=target.length;j++)next[j]=Math.min(prev[j]+1,next[j-1]+1,prev[j-1]+letterCost(tail[i-1],target[j-1]));prev=next;}
    const limit=Math.min(2.2,tail.length*0.16),hits=[];
    for(let j=1;j<=target.length;j++){const pos=map[j-1];if(pos<cursor-12||prev[j]>limit)continue;hits.push({pos,d:prev[j],j,score:prev[j]+Math.abs(pos-cursor)*0.002});}
    hits.sort((a,b)=>a.score-b.score);if(!hits.length)return null;
    const best=hits[0];if(hits.some(h=>Math.abs(h.pos-best.pos)>18&&Math.abs(h.d-best.d)<0.3))return null;
    return {...best,length:tail.length};
  }
  const api={mapped,number,match};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PromVoiceLab=api;
})(globalThis);
