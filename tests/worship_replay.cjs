// All-word baseline replay and private timestamped audit files. No application logic changes.
// node tests/worship_replay.cjs <private manifest.json>
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {create}=require('./recording_replay.cjs');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const stamp=s=>{const n=Math.floor(s);return `${String(Math.floor(n/3600)).padStart(2,'0')}:${String(Math.floor(n/60)%60).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;};
function audit(job){
 const out=job.output,metadata=read(path.join(out,'metadata.json')),
  fixture=read(path.join(out,'fixture.json')),layout=read(path.join(out,'pages.json'));
 for(const [file,expected] of Object.entries(metadata.speechSourceSha256)){
  if(hash(path.join(root,file))!==expected)throw Error('Speech source changed since preparation: '+file);
 }
 const h=create(fixture.pages,false,'baseline'),rows=[];
 fixture.pages.forEach((pg,pi)=>pg.forEach((runs,li)=>{
  const [start,end]=layout.ranges[pi][li];if(end>start)rows.push({start,end,page:pi+1,line:li+1,
   text:runs.filter(r=>r.c!=='r'&&r.c!=='n').map(r=>r.t).join('')});
 }));
 const row=p=>{const i=rows.findIndex(r=>p<=r.end);return i<0?rows.length-1:i;};
 const events=fixture.scenarios[0].events,trace=[];let literalHigh=0;
 for(let i=0;i<events.length;i++){
  const e=events[i],before=h.c.cursor,t=h.feed(e),a=row(t.actual),r=e.expected===null?null:row(e.expected),
   diff=r===null?null:r-a,possibleRepeat=e.expected!==null&&literalHigh>e.expected+3;
  let status='원문 위치 판정 유보';
  if(r!==null){
   if(possibleRepeat&&diff< -1)status='앞선 기준점 · 재독 가능';
   else if(diff>2)status='지연 후보';
   else if(diff< -1)status='앞섬 후보';
   else if(diff===2)status='두 줄 차이';
   else status='기준점 한 줄 이내';
  }
  trace.push({...t,index:i+1,start:e.start,word:e.word,heardTail:(e.carry+e.text).slice(-120),
   probability:e.probability,asrSegment:e.segment,referencePage:r===null?null:rows[r].page,
   referenceLine:r===null?null:rows[r].line,actualReadingPage:rows[a].page,actualLine:rows[a].line,
   before,advance:t.actual-before,rowDifference:diff,possibleRepeat,status,
   referenceText:r===null?'':rows[r].text,actualText:rows[a].text});
  if(e.literalReference!==null)literalHigh=Math.max(literalHigh,e.literalReference);
 }
 const windows=[];let active=null;
 const flush=()=>{if(active){active.duration=+(active.end-active.start).toFixed(3);windows.push(active);active=null;}};
 for(const t of trace){
  if(t.expected===null)continue;
  const kind=t.status==='지연 후보'?'lag':t.status==='앞섬 후보'?'ahead':null;
  if(!kind){flush();continue;}
  if(active&&(active.kind!==kind||t.time-active.end>20))flush();
  if(!active)active={kind,start:t.start,end:t.time,events:0,maxRows:0,firstEvent:t.index,lastEvent:t.index,
   actualPage:t.page,referencePage:t.referencePage};
  active.end=t.time;active.events++;active.lastEvent=t.index;
  active.maxRows=Math.max(active.maxRows,Math.abs(t.rowDifference));
 }
 flush();
 const scored=trace.filter(t=>t.expected!==null),heldRepeats=scored.filter(t=>t.status==='앞선 기준점 · 재독 가능'),
  count=status=>trace.filter(t=>t.status===status).length;
 const summary={id:job.id,test:job.test,sourceCommit:metadata.sourceCommit,
  sourceHashes:metadata.speechSourceSha256,duration:metadata.duration,pages:layout.pages.length,
  normalizedCharacters:layout.text.length,events:trace.length,scoredEvents:scored.length,
  unscoredEvents:trace.length-scored.length,withinOneRow:count('기준점 한 줄 이내'),
  twoRowDifference:count('두 줄 차이'),lagCandidates:count('지연 후보'),aheadCandidates:count('앞섬 후보'),
  repeatCandidates:heldRepeats.length,finalCursor:h.c.cursor,manuscriptEnd:layout.text.length,
  lastClearReference:scored.at(-1)?.expected??null,lastClearReferenceTime:scored.at(-1)?.time??null,
  anchors:fixture.reference.anchorCount,anchorCharacters:fixture.reference.anchorChars,
  candidateWindows:windows,sustainedCandidateWindows:windows.filter(w=>w.events>=3&&w.duration>=3),
  referenceMethod:fixture.reference.method,profile:{view:'PC 5 lines, page mode',lead:3,
   input:'all ASR words in original timestamp order',sessionSeconds:45,carryCharacters:60,
   manualJumps:0,syntheticUtterances:0,logic:'baseline'}};
 fs.writeFileSync(path.join(out,'replay.json'),JSON.stringify({summary,trace},null,1));
 fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,1));
 const columns=['index','start','time','word','heardTail','probability','asrSegment','expected','referencePage',
  'referenceLine','before','actual','advance','page','actualReadingPage','actualLine','rowDifference',
  'possibleRepeat','status','reason','referenceText','actualText'];
 const csv=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 fs.writeFileSync(path.join(out,'timeline.csv'),'\ufeff'+[columns.join(','),...trace.map(t=>columns.map(c=>csv(t[c])).join(','))].join('\r\n'));
 const review=['# 시험결과'+job.test+' · '+job.id,'',
  '원본 음성에서 받아쓴 모든 단어를 시간순으로 입력했습니다. 운영 로직은 수정하지 않았습니다.',
  '크롬 마이크의 실시간 인식 시험이 아니며, 자동으로 위치를 확인할 수 없는 입력은 판정 유보입니다.','',
  `- 녹음: ${stamp(summary.duration)} / 원고: ${summary.pages}쪽`,
  `- 전체 입력: ${summary.events} / 자동 기준점: ${summary.scoredEvents} / 유보: ${summary.unscoredEvents}`,
  `- 한 줄 이내: ${summary.withinOneRow} / 지연 후보: ${summary.lagCandidates} / 앞섬 후보: ${summary.aheadCandidates}`,
  `- 마지막 추적 위치: ${summary.finalCursor} / 원고 끝: ${summary.manuscriptEnd}`,'',
  '자세한 발화·원문·시각·쪽·줄·판정은 timeline.csv와 replay.json에 있습니다. 후보는 확정 오류가 아닙니다.','',
  '| 확인할 구간 | 종류 | 최대 줄 차이 | 기준 쪽 → 표시 쪽 |','|---|---|---:|---|',
  ...summary.sustainedCandidateWindows.map(w=>`| ${stamp(w.start)}–${stamp(w.end)} | ${w.kind} | ${w.maxRows} | ${w.referencePage} → ${w.actualPage} |`)];
 fs.writeFileSync(path.join(out,'기록.md'),review.join('\n')+'\n');
 console.log(JSON.stringify({...summary,candidateWindows:windows.length,sustainedCandidateWindows:summary.sustainedCandidateWindows.length}));
 return summary;
}
if(require.main===module){
 const file=process.argv[2];if(!file)throw Error('Pass a private manifest.json');
 const manifest=read(file);for(const job of manifest.jobs)audit(job);
}
module.exports={audit};
