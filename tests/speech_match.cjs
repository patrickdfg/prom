const assert=require('node:assert/strict'),S=require('../speech-match.js'),O=require('../optional-speech.js');
const norm=s=>s.replace(/[^가-힣a-zA-Z0-9]/g,'').toLowerCase();
const sentence=norm('우리가 살아가면서 만나는 여러 어려움 속에서도 서로 사랑하고 감사하는 마음으로 하루하루를 소중하게 보내며 끝까지 소망을 잃지 않고 함께 걸어가는 사람들이 되기를 바랍니다');
const mutate=(s,at,replacement)=>s.slice(0,at)+replacement+s.slice(at+1);
const target=norm('오늘은 말씀을 함께 생각하겠습니다')+sentence+norm('다음으로는 이웃을 돕는 일을 함께 이야기하겠습니다');const start=target.indexOf(sentence),end=start+sentence.length;
const cases=[sentence,mutate(mutate(mutate(sentence,15,'쟈'),sentence.length-18,'쥬'),sentence.length-5,'뵤'),sentence.slice(0,25)+sentence.slice(27,50)+'어'+sentence.slice(50),sentence.slice(0,-5)+'쟈뵤쥬쀼쨔'];
for(const heard of cases){const hit=S.match(heard,target,start);assert(hit,heard);assert(hit.pos<=end+1,'do not predict past the recognized phrase');assert(hit.pos>=end-10,'follow despite distributed recognition errors or an unreliable ending');}
const shorter=sentence.slice(0,30),bad=mutate(shorter,17,'쟈');assert(S.match(bad,target,start));
assert.equal(S.match('네그렇습니다감사합니다',target,start),null,'short/common speech must not trigger');assert.equal(S.match('오늘은주차장에서자동차열쇠를잃어버려서주변사람에게도움을요청했습니다',target,start),null,'unrelated ad-lib must not trigger');
assert.equal(S.match(mutate(sentence,sentence.length-5,'쟈'),sentence+sentence,0),null,'repeated paragraphs remain ambiguous');
assert.equal(S.match(mutate(sentence,sentence.length-5,'쟈'),target,end),null,'old recognition must not jump ahead');
const duplicated=sentence+norm('여기는다른구간입니다')+mutate(sentence,20,'다');assert.equal(S.match(mutate(sentence,sentence.length-4,'쟈'),duplicated,0),null,'near-identical repetitions remain ambiguous');
const note='참고로 보여 주는 긴 설명입니다 '.repeat(80),raw='우리는 ('+note+') '+sentence,index=O.build(raw);const skip=S.optional(mutate(mutate(norm('우리는')+sentence,sentence.length-8,'쟈'),30,'쥬'),index,0);assert(skip);assert(skip.pos>note.replace(/\s/g,'').length,'skip long optional notes while returning source coordinates');
const map=Array.from({length:target.length},(_,i)=>(i+1)*2),mapped=S.match(cases[1],target,start*2,{map});assert(mapped&&mapped.pos>=end*2-20&&mapped.pos<=end*2+2,'transformed lab text maps to canonical positions');
const early=sentence.slice(0,42),earlyHit=S.match(mutate(early,36,'쟈'),target,start);assert(earlyHit);assert(earlyHit.pos<=start+42,'never extrapolate to the whole sentence from a prefix');
const long=norm('전혀다른앞부분입니다').repeat(40)+sentence;const recovery=S.match(cases[1],long,0);assert(recovery&&recovery.windows>=2,'long bundled results may recover a forward position with multiple windows');
console.log('PASS fast bundled speech, distributed substitutions/deletions/insertions, unreliable tail, partial progress, long notes, mapped positions, long forward recovery and short/ad-lib/repeated/stale guards');
