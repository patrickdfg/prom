// Replay a private recording fixture through production parsing and speech handlers.
// Manuscripts, transcripts and per-event reference positions stay outside the repository.
// Prepare: node tests/recording_replay.cjs prepare <ole-streams.json> <pages.json>
// Replay:  node tests/recording_replay.cjs replay <fixture.json> <result.json> [baseline|confirm-interim|bounded-recovery|combined]
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function section(start,end){
 const a=html.indexOf(start),b=html.indexOf(end,a);
 if(a<0||b<=a)throw Error('Production section changed: '+start);
 return html.slice(a,b);
}
function create(pages,scroll=false,experiment='baseline'){
 let now=0,lastMessage='',recovery=null;
 const c={PromVideoCues:require('../video-cues.js'),PromOptionalSpeech:require('../optional-speech.js'),
  PromScriptureSpeech:require('../scripture-speech.js'),PromSpeechMatch:require('../speech-match.js'),
  page:0,cursor:0,heardCarry:'',lastTail:'',Date:{now:()=>now},
  $:id=>id==='lead'?{value:'3'}:{textContent:''},cap:m=>{lastMessage=m;},cueMatch:()=>null,
  go:p=>{c.page=p;},render(){}};
 vm.createContext(c);
 vm.runInContext(section('const keep=ch=>','/* ---------- 화면 ---------- */'),c);
 vm.runInContext(section('function onHeard(text){','// 마이크를 한 번'),c);
 c.pages=pages;vm.runInContext('P=pages;index()',c);c.lineRange=vm.runInContext('lineRange',c);
 if(scroll)c.PromUI={visibleRange(){
  const all=c.lineRange.flat().filter(r=>r[1]>r[0]),i=all.findIndex(r=>r[1]>c.cursor);
  return [all[Math.max(0,i-2)]?.[0]||0,all[Math.min(all.length-1,i+9)]?.[1]||0];
 }};
 return {c,feed(e){
  now=e.time*1000;
  if(Number.isFinite(e.reset)){c.cursor=e.reset;c.page=c.pageOf(c.cursor);c.heardCarry='';c.lastTail='';recovery=null;vm.runInContext('pend=null',c);}
  const before=c.cursor,oldPage=c.page,oldPending=vm.runInContext('pend',c);
  c.heardCarry=e.carry||'';c.onHeard(e.text);
  // Experiments are replay-only. They do not change shipped browser behavior.
  if(['confirm-interim','combined'].includes(experiment)&&e.final===false&&c.cursor-before>120){
   c.cursor=before;c.page=oldPage;c.oldPending=oldPending;
   vm.runInContext('lastTail="";pend=oldPending',c);lastMessage=' · 실험: 임시 결과의 큰 이동 대기';
  }
  if(['bounded-recovery','combined'].includes(experiment)&&c.cursor===before&&e.final===true){
   const target=vm.runInContext('norm',c),sample=(e.carry||'')+e.text,
    tail=sample.replace(/[^가-힣a-zA-Z0-9]/g,'').toLowerCase().slice(-48);
   const at=tail.length>=36?target.indexOf(tail):-1,end=at+tail.length;
   if(at>=0&&target.indexOf(tail,at+1)<0&&end>before&&end-before<=1400){
    if(recovery&&now-recovery.time<=12000&&end>=recovery.pos+8&&end<=recovery.pos+100){
     c.cursor=end;c.page=c.pageOf(end);recovery=null;lastMessage=' · 실험: 두 번 확인 후 복귀';
    }else recovery={pos:end,time:now};
   }else recovery=null;
  }
  const reason=lastMessage.includes(' ✓ ')?lastMessage.split(' ✓ ').at(-1):lastMessage.split(' · ').slice(1).join(' · ');
  return {time:e.time,expected:e.expected??null,actual:c.cursor,page:c.page+1,reason};
 }};
}
async function prepare(input,output){
 const streams=JSON.parse(fs.readFileSync(input,'utf8')),keys=Object.keys(streams);
 const c={PromLineBreaks:require('../korean-line-breaks.js'),Uint8Array,DataView,TextDecoder,localStorage:{getItem:()=>null},
  CFB:{read:()=>({FullPaths:keys.map(k=>'Root Entry/'+k),FileIndex:keys.map(k=>({content:Buffer.from(streams[k],'base64')}))})}};
 vm.createContext(c);
 vm.runInContext(section('function parseTagged(line){','// hwpx 문단의 글자'),c);
 vm.runInContext(section('function* hwpRecords(u8){','/* ---------- 워드·파워포인트·PDF 원고 읽기 ---------- */'),c);
 c.inflateRaw=async b=>new Uint8Array(zlib.inflateRawSync(b));
 vm.runInContext(section('const pw=s=>','// 이미 프롬프터로 만든 쪽'),c);
 const parsed=await c.parseHwp(new ArrayBuffer(0));
 const pages=parsed.pages.ms?c.buildPrompter(parsed.pages.ms,5):parsed.pages;
 const data=require('../video-cues.js').build(pages);
 fs.writeFileSync(output,JSON.stringify({pages,text:data.text,ranges:data.ranges,starts:data.starts,ends:data.ends},null,2));
 console.log('Prepared actual HWP layout:',pages.length,'pages,',data.text.length,'normalized characters');
}
function quantile(a,q){const s=a.slice().sort((a,b)=>a-b);return s.length?s[Math.floor((s.length-1)*q)]:null;}
function replay(input,output){
 const fixture=JSON.parse(fs.readFileSync(input,'utf8')),results=[];
 for(const scenario of fixture.scenarios){
  const experiment=process.argv[5]||'baseline',h=create(fixture.pages,scenario.scroll,experiment),trace=[];
  for(const event of scenario.events)trace.push(h.feed(event));
  const scored=trace.filter(t=>t.expected!==null),errors=scored.map(t=>t.expected-t.actual);
  const rowError=scored.map(t=>{
   const rows=h.c.lineRange.flat().filter(r=>r[1]>r[0]);
   const row=p=>{const i=rows.findIndex(r=>r[1]>=p);return i<0?rows.length-1:i;};
   return row(t.expected)-row(t.actual);
  });
  results.push({name:scenario.name,events:trace.length,referenceEvents:scored.length,
   withinOneRow:rowError.filter(n=>Math.abs(n)<=1).length,
   lagOverTwoRows:rowError.filter(n=>n>2).length,aheadOverOneRow:rowError.filter(n=>n< -1).length,
   medianLagChars:quantile(errors,.5),p95LagChars:quantile(errors,.95),finalCursor:h.c.cursor,
   targetEnd:scenario.targetEnd??null,trace});
 }
 fs.writeFileSync(output,JSON.stringify({experiment:process.argv[5]||'baseline',sourceCommit:fixture.sourceCommit,reference:fixture.reference,results},null,2));
 console.table(results.map(({trace,...summary})=>summary));
}
if(require.main===module){
 const [mode,input,output,experiment='baseline']=process.argv.slice(2);
 if(!input||!output||!['prepare','replay'].includes(mode)||!['baseline','confirm-interim','bounded-recovery','combined'].includes(experiment)){
  console.error('Usage: node tests/recording_replay.cjs prepare|replay <input.json> <output.json>');process.exitCode=1;
 }else Promise.resolve(mode==='prepare'?prepare(input,output):replay(input,output)).catch(e=>{console.error(e);process.exitCode=1;});
}
module.exports={create};
