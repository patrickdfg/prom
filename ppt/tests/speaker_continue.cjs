// Attribution, source context, quotation transitions and numbered items retain distinct layouts.
const assert=require('node:assert/strict'),fs=require('node:fs');global.window=global;global.CaptionCore=require('../core.js');global.CaptionContentRules=require('../content-rules.js');global.crypto=require('node:crypto').webcrypto;
global.document={currentScript:{src:'http://localhost/ppt/builder.js'},fonts:{load:async()=>{}},createElement:()=>({getContext:()=>({measureText:t=>({width:t.length*22})})})};require('../builder.js');
const B=CaptionBuilder,text='“예수님이 말씀하셨다. 나를 따르라.” “하나님이 말씀하시기를 너희는 내 백성이라 하셨다.”';
for(const page of ['make/index.html','ppt/index.html'])assert.match(fs.readFileSync(page,'utf8').match(/<select id="editLayout"[^>]*>[\s\S]*?<\/select>/)[0],/value="proverb"/,'editing a proverb must retain a selectable proverb layout');
const mixed=B.analyze({lines:[text],richLines:[{text,runs:[{text,hex:'008000'}]}]});
assert.deepEqual(mixed.map(s=>s.layout),['wordSon','wordGod']);
assert.equal(B.speakerLayout('“예수님이 말씀하셨다.”'),'wordSon');assert.equal(B.speakerLayout('“하나님이 말씀하셨다.”'),'wordGod');
assert.equal(B.speakerLayout('하나님께 감사하라고 성령님이 말씀하셨습니다.'),'wordSpirit','actual attributed speaker takes priority over an earlier mention');
assert.equal(B.speakerLayout('성령님과 하나님을 생각하며 행합니다.'),'word','ambiguous mentions do not guess a speaker');
assert.equal(CaptionContentRules.contextSpeaker('예수님은'),'wordSon');assert.equal(CaptionContentRules.contextSpeaker('하나님은'),'wordGod');assert.equal(CaptionContentRules.contextSpeaker('선생이 사명자로서 말합니다.'),'wordTeacher');
assert.equal(B.speakerLayout('하나님께 감사하고\n성령 안에서 행합니다.'),'wordGod','ordinary opening-name fallback is preserved');
const row=(text,hex='000000',paragraph=0)=>({text,runs:[{text,hex}],paragraph}),project=rows=>({lines:rows.map(r=>r.text),richLines:rows});
const input=project([
 row('<성령님 말씀>', '000000',0),row('하나님께 감사하며 살아라.','008000',1),row('작은 일부터 실천하여라.','008000',2),
 row('하나님 말씀입니다.','000000',3),row('서로 사랑하며 살아라.','008000',4),
 row('일반 설명으로 돌아옵니다.','000000',5),row('화자를 따로 지정하지 않은 내용입니다.','008000',6),
 row('<잠언>','000000',7),row('3. 하나님을 사랑하며 행하라.','000000',8)
]);
const original=JSON.stringify(input),out=B.analyze(input);
assert.deepEqual(out.map(s=>s.layout),['wordSpirit','wordSpirit','wordGod','word','proverb']);
assert.equal(JSON.stringify(input),original,'source text, colors and paragraph metadata stay unchanged');
for(const s of [...out,...mixed])assert.equal(CaptionCore.normalize(B.plain(s.text).replace(/\s*>>$/,'')),CaptionCore.index((out.includes(s)?input:{lines:[text]}).lines).text.slice(s.start,s.end),'source links remain exact after speaker split');
const same=project([{text:'성령님 말씀입니다. 하나님께 감사하며 살아라.',paragraph:0,runs:[{text:'성령님 말씀입니다. ',hex:'000000'},{text:'하나님께 감사하며 살아라.',hex:'008000'}]}]);
assert.equal(B.analyze(same)[0].layout,'wordSpirit','black introduction in the same paragraph is used');
assert.equal(B.analyze(project([row('1. 성령님이 말씀하셨습니다.','000000',0),row('2. 하나님을 사랑하라.','000000',1)])).every(s=>s.layout==='proverb'),true,'numbered list wins over speaker mentions');
assert.equal(B.analyze(project([row('3. 번호 하나만 있는 일반 설명입니다.')])).length,0,'unmarked isolated numbers remain excluded');
const otherSource=project([row('성령님 말씀입니다.'),{...row('다른 파일의 화자 없는 말씀입니다.','008000',1),source:1}]);assert.equal(B.analyze(otherSource)[0].layout,'word','speaker context never leaks to another manuscript');
(async()=>{
 const L=require('../../make/template-layouts.js'),sunday=JSON.parse(fs.readFileSync('ppt/templates/sunday.json','utf8')),before=JSON.stringify(sunday),prepared=L.prepare(sunday,B.layouts);
 assert(prepared.design.layouts.proverb);assert(prepared.layoutCatalog.some(e=>e.key==='proverb'));
 assert.equal(prepared.design.layouts.proverb.layoutName,sunday.name+' · 잠언 항목');
 assert.notStrictEqual(prepared.design.layouts.proverb,prepared.design.layouts.wordTeacher);
 assert.equal(JSON.stringify(sunday),before,'missing layout completion does not overwrite a saved template');
 const explicit={...sunday,design:{...sunday.design,layouts:{...sunday.design.layouts,proverb:{...sunday.design.layouts.wordTeacher,background:'#112233'}}}};
 assert.equal(L.prepare(explicit,B.layouts).design.layouts.proverb.background,'#112233','existing proverb artwork always wins');
 global.fetch=async()=>({ok:true,json:async()=>JSON.parse(fs.readFileSync('ppt/template-data.json','utf8'))});await B.useTemplate(prepared.design);
 const generated=await B.generate(input);assert.deepEqual(generated.slides.map(s=>s.editor.layout),out.map(s=>s.layout));
 for(const slide of generated.slides){const key=slide.editor.layout;assert.deepEqual(slide.shapes.filter(sh=>sh.type==='image'),prepared.design.layouts[key].shapes.filter(sh=>sh.type==='image'),'selected speaker/proverb artwork retained');}
 const selected=await B.scene('wordGod','성령님을 생각하며 행합니다.');assert.equal((await B.restyle([selected]))[0].editor.layout,'wordGod','manually selected speaker layout is retained');
 console.log('PASS explicit attribution/context, mixed quotation splitting, continued speaker, ambiguous/reset guards, proverb priority/single labeled item, exact offsets, named independent proverb layout, source artwork, manual selection and immutable templates');
})().catch(e=>{console.error(e);process.exitCode=1});
