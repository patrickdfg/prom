const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const L=require('../../make/template-layouts.js'),Pair=require('../pair-template.js');
const defaults={caption:'하단 자막',word:'말씀',wordSpirit:'성령 말씀',cover:'표지'};
const scene=(name,text='',y=20)=>({width:960,height:540,sourceLayoutName:name,bodyIndex:0,background:'#ffffff',shapes:[{type:'text',x:20,y,w:900,h:300,paragraphs:[{runs:[{text,size:32,font:'Arial'}]}]}]});
const design={themeXml:'theme',layouts:{caption:scene('빈 화면'),word:scene('말씀 디자인'),wordSpirit:scene('성령 전용'),cover:scene('표지')}};
const old={id:'a',name:'수요말씀',design,pair:{evidence:{candidates:[{layout:'wordSpirit'},{layout:'wordSpirit'},{layout:'word'},{layout:'missing'}]}}};
const original=JSON.stringify(old),a=L.prepare(old,defaults);
assert.deepEqual(a.layoutCatalog,[{key:'wordSpirit',name:'성령 전용 · 성령 말씀'},{key:'word',name:'말씀 디자인 · 말씀'}]);
assert.equal(a.design.layouts.wordSpirit.layoutName,'수요말씀 · 성령 전용 · 성령 말씀');
assert.equal(JSON.stringify(old),original,'migration does not mutate saved/original records');
assert(a.design.layouts.caption,'unobserved defaults remain available to manuscript generation');
assert.equal(L.catalog({name:'blank',design},defaults).length,4,'blank/builtin designs own all of their layouts');
const b=L.prepare({...a,id:'b',name:'주일말씀'},defaults);
assert.equal(b.design.layouts.wordSpirit.layoutName,'주일말씀 · 성령 전용 · 성령 말씀');
assert.equal(a.design.layouts.wordSpirit.layoutName,'수요말씀 · 성령 전용 · 성령 말씀');
assert.equal(L.prepare(b,defaults).design.layouts.wordSpirit.layoutName,b.design.layouts.wordSpirit.layoutName,'no repeated prefixes on save/load');
const customized=L.prepare({...a,layoutCatalog:[{key:'word',name:'큰 말씀'},{key:'word',name:'duplicate key'},{key:'missing',name:'stale'},{key:'wordSpirit',name:'큰 말씀'}]},defaults);
assert.deepEqual(customized.layoutCatalog,[{key:'word',name:'큰 말씀'},{key:'wordSpirit',name:'큰 말씀 2'}]);
assert.equal(L.catalog({...a,layoutCatalog:[{key:'missing',name:'stale'}]},defaults).length,4);
const native=scene('금장 말씀','오늘은 감사하며 서로 사랑하는 날입니다.');
const analysis=Pair.analyze({lines:['오늘은 감사하며 서로 사랑하는 날입니다.']},{slides:[native]});
const learned=L.prepare({name:'새 템플릿',pair:{evidence:analysis},design:Pair.build(analysis,[native],design).design},defaults);
assert.equal(learned.layoutCatalog.length,1);assert.match(learned.design.layouts.word.layoutName,/새 템플릿 · 금장 말씀/);
// Builder snapshots/scenes must retain scoped names without changing semantic generation keys.
(async()=>{
 const context={window:{},CaptionCore:{},structuredClone,crypto:require('node:crypto').webcrypto,URL,document:{currentScript:{src:'http://localhost/ppt/builder.js'}},fetch:async()=>({ok:true,json:async()=>({themeXml:'theme',layouts:design.layouts,assets:{}})})};
 vm.runInNewContext(fs.readFileSync(require.resolve('../builder.js'),'utf8'),context);const B=context.window.CaptionBuilder;
 // Builder requires every standard layout; use the real bundled design for validation.
 const full=JSON.parse(fs.readFileSync(require.resolve('../template-data.json'),'utf8'));
 const rec=L.prepare({name:'수요',design:full},B.layouts);await B.useTemplate(rec.design);
 const out=await B.scene('wordSpirit','새 말씀');assert.equal(out.layoutName,'수요 · 성령 말씀');assert.equal(out.editor.layout,'wordSpirit');
 assert.equal((await B.snapshotTemplate(false)).layouts.wordSpirit.layoutName,'수요 · 성령 말씀');
 // Same visual decoration must not merge differently named PowerPoint layouts.
 class Zip{constructor(){this.files={}}file(path,data){this.files[path]=data;return this}async generateAsync(){return this.files}}
 const node={style:{},querySelectorAll:()=>[],remove(){}};
 const ex={window:{CaptionBuilder:B},JSZip:Zip,structuredClone,document:{createElement:()=>node,body:{append(){}},fonts:{ready:Promise.resolve()}},CaptionBuilder:{theme:async()=>null},CaptionCore:{index:()=>({text:''})},CaptionSize:{unify(){},backgroundBox:s=>s},CaptionRender:{show(){},release(){}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../pptx-export.js'),'utf8'),ex);
 const one={...scene('', '새 원고',410),layoutName:'수요 · 하단 & 자막',editor:{layout:'caption'}},two={...scene('', '말씀',20),layoutName:'수요 · 말씀',editor:{layout:'word'}};
 const files=await ex.window.CaptionPptx.create({slides:[one,two,structuredClone(one)],lines:[],links:[]});
 const paths=Object.keys(files).filter(p=>/^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(p));assert.equal(paths.length,2);
 assert.match(files[paths[0]],/name="수요 · 하단 &amp; 자막"/);assert.match(files[paths[1]],/name="수요 · 말씀"/);
 assert.equal(JSON.parse(files['prom/cues.json']).editors[0].layoutName,one.layoutName);
 console.log('PASS template-specific names, learned-only lists, legacy migration, source names, duplicate/rename isolation, builder preservation and named PPT export');
})().catch(e=>{console.error(e);process.exitCode=1});
