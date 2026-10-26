const assert=require('node:assert/strict'),R=require('../content-rules.js'),C=require('../core.js');
const project=rows=>({lines:rows.map(r=>r.text),richLines:rows}),row=(text,paragraph,hex='000000',source=0)=>({text,paragraph,source,runs:[{text,hex}]});
const chars=b=>b.chars.map(c=>c.ch).join(''),check=(p,r)=>{const original=C.index(p.lines).text;for(const b of r.blocks){const str=b.chars.filter(c=>c.end>c.start).map(c=>c.ch).join(''),start=b.chars.find(c=>c.end>c.start).start,end=b.chars.findLast(c=>c.end>c.start).end;assert.equal(C.normalize(str),original.slice(start,end),'exact original offsets');}};
const marked=project([row('<2026년 10월 21일 수요말씀>',0),row('금식 조건',1),row('본 문 :',2),row('<이사야 55장 6절> “만날 때에 찾으라.”',3),row('설명 본문은 제외합니다.',4),row('행하는 자는 성공합니다.',5,'0000FF'),row('몸부림과 성공입니다.',5,'0000FF'),row('번호 없이도 자막을 만듭니다.',6,'008000'),row('<영상 1> 시작',7)]);
const a=R.automatic(marked);assert.equal(a.kind,'highlighted');assert.equal(a.blocks.length,2);assert.deepEqual(a.blocks.map(b=>b.layout),['caption','word']);assert(chars(a.blocks[0]).includes('몸부림'));assert(!a.blocks.some(b=>/금식 조건|설명 본문|영상/.test(chars(b))));check(marked,a);
const plain=project([row('일반 원고의 첫 문단입니다.',0),row('줄바꿈한 같은 문단입니다.',0),row('다음 문단도 만들어집니다.',1),row('교회 광고',2),row('예배 광고만 있습니다.',3)]),b=R.automatic(plain);assert.equal(b.kind,'unmarked');assert.equal(b.blocks.length,0);assert.equal(R.automatic(project([row('1. 번호가 하나인 검정 문단입니다.',0)])).blocks.length,0);
const numbered=project([row('일반 설명은 제외합니다.',0),row('1. 첫 항목입니다.',1),row('이 항목의 같은 문단입니다.',1),row('2) 다음 항목입니다.',2),row('(3) 괄호 번호입니다.',3),row('④ 원문자를 인식합니다.',4),row('５． 전각 숫자입니다.',5),row('일반 설명입니다.',6)]),n=R.automatic(numbered);assert.equal(n.kind,'numbered');assert.equal(n.blocks.length,5);assert(!n.blocks.some(b=>chars(b).includes('일반 설명')));check(numbered,n);
for(const s of ['1.5배 줄간격','2026.10.21 수요말씀','요한복음 3장 16절'])assert(!R.itemNumber(s),s);
const mixed=project([...numbered.richLines,...marked.richLines.map(r=>({...r,source:1})),...plain.richLines.map(r=>({...r,source:2}))]),m=R.automatic(mixed);assert.equal(m.kind,'mixed');assert.equal(m.blocks.length,7);check(mixed,m);
assert.equal(R.automatic({lines:[]}).blocks.length,0);assert.equal(R.instructions(R.instructions('내 메모','numbered'),'numbered'),R.instructions('내 메모','numbered'));
console.log('PASS automatic numbered/color routing with unmarked sources skipped, full item grouping, header/cue/ad exclusions, numbering variants, exact original offsets, legacy recipe migration');
// HWP may store a connective first line and the rest of one item in adjacent paragraphs.
const continued=project([
 ...Array.from({length:6},(_,i)=>row(`${i+1}. 앞선 완결 항목입니다.`,i)),
 row('7. 일곱째 항목을 보면',6),row('같은 문단의 두 번째 줄입니다.',6),row('같은 문단의 마지막 줄입니다.',6),
 row('8. 여덟째 항목을 제시간에 시작하여',7),
 row('앞선 일을 이어받아 진행합니다.',8),row('다음 줄도 같은 항목입니다.',8),row('마지막 문장까지 포함합니다.',8),
 row('번호가 없는 일반 설교 설명입니다.',9)
]);
const original=JSON.stringify(continued),joined=R.automatic(continued);
assert.equal(joined.blocks.length,8);assert.match(chars(joined.blocks[6]),/같은 문단의 마지막 줄/);
assert.match(chars(joined.blocks[7]),/마지막 문장까지 포함합니다/);assert(!chars(joined.blocks[7]).includes('일반 설교'));
assert.equal(JSON.stringify(continued),original,'original manuscript metadata and text stay unchanged');check(continued,joined);
for(const [label,head,tail] of [
 ['complete sentence',row('2. 두 번째 항목입니다.',1),row('일반 설명입니다.',2)],
 ['blank paragraph',row('2. 두 번째 일을 시작하여',1),row('빈 문단 뒤의 설명입니다.',3)],
 ['another source',row('2. 두 번째 일을 시작하여',1),row('다른 원고의 설명입니다.',2,'000000',1)],
 ['blue caption',row('2. 두 번째 일을 시작하여',1),row('별도 하단 자막입니다.',2,'0000FF')],
 ['green caption',row('2. 두 번째 일을 시작하여',1),row('별도 말씀 자막입니다.',2,'008000')],
 ['media cue',row('2. 두 번째 일을 시작하여',1),row('<영상 1>',2)],
 ['closing cue',row('2. 두 번째 일을 시작하여',1),row('아멘.',2)],
 ['advertisements',row('2. 두 번째 일을 시작하여',1),row('교회 광고',2)]
]){
 const p=project([row('1. 첫 번째 항목입니다.',0),head,tail]),items=R.numbered(p);
 assert(!chars(items.at(-1)).includes(tail.text),label+' remains outside numbered text');
}
const red=project([row('1. 첫 번째 항목입니다.',0),row('2. 다음 일을 시작하여',1),row('강조도 그대로 이어집니다.',2,'FF0000')]);
const redResult=R.automatic(red);assert(redResult.blocks.at(-1).chars.some(c=>c.red));check(red,redResult);
console.log('PASS adjacent unfinished numbered paragraphs, complete item 7/8, source offsets/red emphasis, complete/blank/source/color/media/closing/ad boundaries and manuscript immutability');
