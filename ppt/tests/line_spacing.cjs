const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const shape={type:'text',x:0,y:0,w:800,h:200,paragraphs:[{runs:[{text:'',size:32}],lineSpacing:{unit:'ratio',value:1.5}}]};
const c={window:{},CaptionCore:require('../core.js'),structuredClone,URL,crypto:require('node:crypto').webcrypto,document:{currentScript:{src:'http://test/ppt/builder.js'}},fetch:async()=>({ok:true,json:async()=>({layouts:{caption:{width:960,height:540,bodyIndex:0,shapes:[shape]},verse:{width:960,height:540,bodyIndex:0,shapes:[shape]}},assets:{},themeXml:''})})};
vm.createContext(c);vm.runInContext(fs.readFileSync('ppt/builder.js','utf8'),c);
(async()=>{const B=c.window.CaptionBuilder;
for(const spacing of [{unit:'ratio',value:1.7},{unit:'px',value:40*96/72}]){
 const s=await B.scene('caption','첫 줄\n두 번째 줄',{lineSpacing:spacing,padToLines:3});
 assert(s.shapes[0].paragraphs.every(p=>p.lineSpacing.unit===spacing.unit&&p.lineSpacing.value===spacing.value));
 assert.equal(s.editor.lineSpacing.value,spacing.value,'saved editor metadata');
 const again=await B.scene(s.editor.layout,s.editor.text,s.editor);assert.equal(again.shapes[0].paragraphs[0].lineSpacing.value,spacing.value,'rebuilding must retain spacing');
 const verse=await B.scene('verse','말씀',{ref:'요 1:1',lineSpacing:spacing});assert(verse.shapes[0].paragraphs.every(p=>p.lineSpacing.value===spacing.value),'reference spacing');
}
const s=await B.scene('caption','기본');assert.equal(s.shapes[0].paragraphs[0].lineSpacing.value,1.3,'generation default unchanged');
const exportSource=fs.readFileSync('ppt/pptx-export.js','utf8');vm.runInContext(exportSource.slice(exportSource.indexOf('const xml='),exportSource.indexOf('async function create(')),c);
for(const [spacing,xml] of [[{unit:'ratio',value:1.7},'spcPct val="170000"'],[{unit:'px',value:40*96/72},'spcPts val="4000"']]){c.shape={...shape,paragraphs:[{...shape.paragraphs[0],lineSpacing:spacing}]};assert(vm.runInContext('textXml(shape)',c).includes(xml),'PPTX line spacing units');}
console.log('PASS ratio/fixed spacing, saved metadata, rebuild, cumulative padding, reference, default, PPTX export');})().catch(e=>{console.error(e);process.exitCode=1;});
