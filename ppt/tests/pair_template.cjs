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
