const assert=require('node:assert/strict'),P=require('../pair-template.js');
const text=s=>s.shapes.filter(x=>x.type==='text').flatMap(x=>x.paragraphs.flatMap(p=>p.runs.map(r=>r.text))).join('');
const make=(t,y=410)=>({width:960,height:540,background:'#00ff00',shapes:[{type:'image',src:'data:image/png;base64,AA',x:0,y:0,w:960,h:540},{type:'text',x:40,y,w:880,h:100,paragraphs:[{align:'center',runs:[{text:t,font:'Malgun Gothic',size:32,bold:true,color:'#111111'}]}]}]});
const a='감사는 작은 일에서 시작됩니다.',b='함께 나누면 기쁨이 더욱 커집니다.',other='원고와 무관한 제목과 날짜입니다.';
const slides=[make(a),make(a+'\n'+b),make(other)],original=structuredClone(slides),design={layouts:{caption:make('기본 본문'),word:make('말씀 기본',30)},themeXml:'theme',layoutMasters:{caption:{size:60},word:{size:45}}};
const report=P.analyze({lines:[a,b],name:'주일 원고.hwpx'},{slides,name:'완성.pptx',warnings:[]});
assert.equal(report.matchedSlides,2);assert.equal(report.candidates[1].cumulative,true);assert.equal(report.candidates[0].layout,'caption');
const result=P.build(report,slides,design);assert.equal(result.options.cumulative,true);assert.match(result.instructions,/주일 원고.hwpx/);assert.equal(text(result.design.layouts.caption),'');assert.equal(result.design.layouts.caption.bodyIndex,1);assert.equal(result.design.layouts.caption.shapes[0].src,slides[0].shapes[0].src);assert.equal(result.design.layoutMasters.caption,undefined);assert.deepEqual(result.design.layouts.word,design.layouts.word);assert.deepEqual(slides,original);assert.equal(text(design.layouts.caption),'기본 본문');
assert.throws(()=>P.analyze({lines:['다른 내용의 원고입니다.']},{slides}),/정확히 일치/);
assert.throws(()=>P.analyze({lines:[a,a]},{slides:[make(a)]}),/정확히 일치/);
report.candidates.forEach(c=>c.layout='');assert.throws(()=>P.build(report,slides,design),/한 개 이상/);
report.candidates[0].layout='wordSpirit';assert.equal(P.build(report,slides,design).design.layouts.wordSpirit.shapes[1].paragraphs[0].runs[0].text,'');
console.log('PASS paired matching, cumulative detection, exclusions, named-layout extraction, original preservation, editable empty text and master isolation');

const colored=make(a);colored.shapes[1].paragraphs[0].runs=[{text:'감사',font:'Arial',size:32,color:'#ff0000'},{text:'는 작은 일에서 시작됩니다.',font:'Arial',size:32,color:'#111111'}];
const coloredReport=P.analyze({lines:[a]},{slides:[colored]});assert.equal(P.build(coloredReport,[colored],design).design.layouts.caption.shapes[1].paragraphs[0].runs[0].color,'#111111','short opening red emphasis must not become the default font color');
// 원고에 연결되지 않은 장은 고정 슬라이드로 담기고, 새 원고로 만든 자막 사이에 되돌아온다.
{
 const mk=(t,y)=>({width:960,height:540,uid:'u'+t,shapes:[{type:'text',x:40,y:y||410,w:880,h:100,paragraphs:[{align:'center',runs:[{text:t,font:'Malgun Gothic',size:32,bold:true,color:'#fff'}]}]}]});
 const a='감사는 작은 일에서 시작됩니다.',b='함께 나누면 기쁨이 더욱 커집니다.';
 const deck=[mk('환영합니다 상문교회 주일예배'),mk(a),mk('찬양 안내 슬라이드 입니다'),mk(b),mk('광고 및 마무리 안내입니다')];
 const r=P.analyze({lines:[a,b],name:'원고'},{slides:deck,name:'완성'});
 assert.deepEqual(r.fixed.map(f=>[f.slideIndex,f.before,f.total]),[[0,0,2],[2,1,2],[4,2,2]]);
 r.fixed[1].keep=false;
 const design={layouts:{caption:mk('기본')},layoutMasters:{}},built=P.build(r,deck,design);
 assert.equal(built.fixedSlides.length,2);assert.equal(built.fixedSlides[0].slide.uid,undefined);assert.match(built.instructions,/고정 슬라이드 2장/);
 const gen=[...'ABCD'].map((c,i)=>({uid:c,shapes:[],width:960,height:540,editor:{group:i<2?'g1':'g2'}})),links=gen.map((_,i)=>({status:'exact',start:i,end:i+1,score:1}));
 const w=P.weave(built.fixedSlides,gen,links);
 assert.equal(w.slides.length,6);assert.equal(w.slides[0].uid===undefined,false);assert.equal(w.links[0].status,'unlinked');assert.equal(w.links[5].status,'unlinked');
 assert.deepEqual(w.slides.slice(1,5).map(s=>s.uid),['A','B','C','D']);assert.equal(new Set(w.slides.map(s=>s.uid)).size,6);
 // 중간 고정 장은 누적 묶음(g1) 안에 끼지 않는다
 const mid=P.weave([{before:1,total:2,slide:mk('중간')}],gen,links);assert.deepEqual(mid.slides.map(s=>s.uid||'M').filter(x=>x.length===1),['A','B','C','D']);assert.equal(mid.slides.findIndex(s=>s.shapes.length>0),2);
 assert.equal(P.weave([],gen,links).slides,gen);
 console.log('PASS 고정 슬라이드 저장·복원');
}
// 번호로 시작하는 전체 화면 장은 '하나님'이 들어 있어도 잠언 항목으로 분류하고, 말씀 장 디자인을 덮어쓰지 않는다.
{
 const full=(t,y)=>({width:960,height:540,shapes:[{type:'image',src:'data:image/png;base64,AA',x:0,y:0,w:960,h:540},{type:'text',x:20,y:y,w:920,h:480,paragraphs:[{align:'center',runs:[{text:t,font:'HY견고딕',size:48,bold:true,color:'#333'}]}]}]});
 const p1='1. 하나님은 항상 이치에 합당하게 말씀하신다.\n그 말씀을 제대로 깨닫고 행하는 것이 깊은 신앙이다.',w1='지금은 하나님의 창조 목적을 이루는 시대요,\n신앙의 신부로서 사랑의 대상이 되어 같이 살아가면서';
 const deck=[full(w1,10),full(p1,10)],r=P.analyze({lines:[w1.replace('\n',''),p1.replace('\n','')],name:'원고'},{slides:deck,name:'완성'});
 assert.deepEqual(r.candidates.map(c=>c.layout),['wordGod','proverb']);
 const b=P.build(r,deck,{layouts:{caption:full('x',410),word:full('y',10)},layoutMasters:{}});
 assert.ok(b.design.layouts.proverb&&b.design.layouts.wordGod&&b.design.layouts.proverb!==b.design.layouts.wordGod);
 console.log('PASS 잠언 항목 분류');
 for(const prefix of ['①','(1)','１．']){
  const value=prefix+' 하나님을 사랑하며 실천하는 잠언의 내용입니다.',s=full(value,10);s.editor={layout:'wordGod'};
  assert.equal(P.analyze({lines:[value]},{slides:[s]}).candidates[0].layout,'proverb','numbered full-screen items override incidental speaker words and old labels');
 }
}
