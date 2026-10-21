/* Browser-independent controller test; storage completes asynchronously like IndexedDB. */
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),Pair=require('../pair-template.js');
const elements=new Map(),memory=new Map();
function el(){return {value:'',textContent:'',disabled:false,checked:false,hidden:false,files:[],children:[],appendChild(x){this.children.push(x);},append(...xs){this.children.push(...xs)},replaceChildren(){this.children=[]},setAttribute(){},showModal(){}};}
const get=id=>{if(!elements.has(id))elements.set(id,el());return elements.get(id)};
const idb={open(){const r={result:{createObjectStore(){},transaction(){const tx={objectStore(){return {getAll(){const q={};setImmediate(()=>{q.result=[...memory.values()].map(v=>structuredClone(v));q.onsuccess();setImmediate(()=>tx.oncomplete());});return q;},put(v){const q={};setImmediate(()=>{memory.set(v.id,structuredClone(v));q.onsuccess();setImmediate(()=>tx.oncomplete());});return q;}}}};return tx;}}};setImmediate(()=>r.onsuccess());return r;}};
const a='감사는 작은 일에서 시작됩니다.',b='함께 나누면 기쁨이 더욱 커집니다.';
const scene=t=>({width:960,height:540,bodyIndex:0,shapes:[{type:'text',x:40,y:410,w:880,h:100,paragraphs:[{runs:[{text:t,font:'Arial',size:32,color:'#000000'}]}]}]});
let bank={layouts:Object.fromEntries(['caption','word'].map(k=>[k,scene('기본')])),themeXml:'theme',layoutMasters:{}},saved=null;
const ctx={window:{},CaptionContentRules:require('../content-rules.js'),CaptionBuilder:{async snapshotTemplate(){return structuredClone(bank)},async useTemplate(d){if(d)bank=structuredClone(d)}},CaptionWorkspace:{layoutMasters(){return {};},snapshot(){return {sources:{script:{name:'주일.hwpx',data:'data:s'},deck:{name:'완성.pptx',data:'data:d'}}}},generationTemplate(v){if(arguments.length)saved=structuredClone(v);return structuredClone(saved)}},CaptionImport:{async manuscriptRich(){return {lines:[a,b]}},async deck(){return {slides:[scene(a),scene(a+'\n'+b)],warnings:[]}}},CaptionPairTemplate:Pair,document:{getElementById:get,createElement:el},indexedDB:idb,structuredClone,crypto:require('node:crypto').webcrypto,File:class{constructor(data,name){this.name=name}},fetch:async()=>({blob:async()=>({})})};
vm.runInNewContext(fs.readFileSync(require.resolve('../generation-templates.js'),'utf8'),ctx);
(async()=>{await ctx.window.CaptionRecipes.open();const common=get('generationInstructions').value;assert(common.includes('[성경 본문 생략·부분 낭독]'));get('generationInstructions').value+='\n사용자 메모 보존';
await get('analyzeTemplatePair').onclick();assert.equal(get('pairTemplateReview').children.length,1);assert.equal(get('applyTemplatePair').hidden,false);
await assert.rejects(()=>ctx.window.CaptionRecipes.remember(),/먼저 누르세요/);
await get('applyTemplatePair').onclick();assert.equal(get('generationTemplateName').value,'주일 · 원고-PPT 학습');assert(get('generationInstructions').value.startsWith(common+'\n사용자 메모 보존'));assert.equal(get('generateCumulative').checked,true);
await get('saveGenerationTemplate').onclick();assert.equal(memory.size,1);assert.equal(saved.pair.sources.deck.name,'완성.pptx');assert.equal(saved.design.layouts.caption.shapes[0].paragraphs[0].runs[0].text,'');
const id=saved.id;get('generationTemplate').value='';await get('generationTemplate').onchange();get('generationTemplate').value=id;await get('generationTemplate').onchange();assert.equal(get('generationTemplateName').value,'주일 · 원고-PPT 학습');assert(get('generationInstructions').value.includes('사용자 메모 보존'));
await get('analyzeTemplatePair').onclick();await get('applyTemplatePair').onclick();assert.equal(get('generationInstructions').value.split('[원고·완성 PPT에서 추가한 지침]').length,2);ctx.window.confirm=()=>false;await get('saveGenerationTemplate').onclick();assert.equal(memory.size,1,'같은 이름은 확인 없이 덮어쓰지 않는다');assert.match(get('generationTemplateStatus').textContent,/취소/);
await ctx.window.CaptionRecipes.open();assert.equal(get('generationTemplateName').value,'주일 · 원고-PPT 학습');assert.equal(get('generationInstructions').value.split('[성경 본문 생략·부분 낭독]').length,2);assert(get('generationInstructions').value.includes('사용자 메모 보존'));
// The broadcasting controller uses the same worship scope and never weaves the old fixed slides twice.
const Rules=ctx.CaptionContentRules,originalSource=Rules.sourceDeck;
const fixedScene=t=>({width:960,height:540,shapes:t.map((text,i)=>({type:'text',x:40,y:i*110,w:800,h:100,paragraphs:[{runs:[{text,size:32,font:'Arial'}]}]}))});
Rules.sourceDeck=async()=>({slides:[fixedScene(['성경봉독','요한복음 3장 16절','예전 성경본문']),fixedScene(['주일말씀 주제','예전 제목'])]});
get('generateScope').value='worship';
try{const result=await ctx.window.CaptionRecipes.generate({lines:['<2026년 10월 18일 주일말씀>','새 말씀 제목','본문:','<요한복음 3장 16절> “새로운 본문 말씀입니다.”','할렐루야!','번호 없는 설교 전문은 제외합니다.']});assert.equal(result.slides.length,2);assert.equal(result.worship,true);assert.equal(ctx.window.CaptionRecipes.withFixed(result),result);assert.equal(saved.options.sourceMode,'worship');assert(saved.worship);}finally{Rules.sourceDeck=originalSource;}
console.log('PASS pair controller, common/custom instructions retained, review gate, automatic name, cumulative option, asynchronous save/restore, raw sources, repeat-analysis deduplication and no overwrite');
})().catch(e=>{console.error(e);process.exitCode=1});
