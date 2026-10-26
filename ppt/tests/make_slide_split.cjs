const assert=require('node:assert/strict'),S=require('../../make/slide-split.js'),C=require('../core.js');
global.crypto=require('node:crypto').webcrypto;
const p={lines:['앞문장','첫째 줄둘째 줄셋째 줄','뒷문장'],slides:[{uid:'before'},
 {uid:'selected',width:1920,height:1080,background:'#123456',masterId:'my-layout',bodyIndex:1,editor:{layout:'proverb',text:'옛 본문',cumulative:true,step:3,padToLines:4},shapes:[{type:'image',src:'original-background',x:0,y:0,w:1920,h:1080},{type:'text',x:100,y:120,w:1700,h:800,paragraphs:[{align:'center',lineSpacing:{unit:'ratio',value:1.3},runs:[{text:'첫째 줄',font:'Original',size:48,bold:true,color:'#FF0000'}]},{align:'left',runs:[{text:'둘째 ',size:40},{text:'줄\n\n셋째 줄',size:42,color:'#0000FF'}]}]},{type:'text',extraText:true,paragraphs:[{runs:[{text:'공통 안내'}]}]}]},
 {uid:'after'}],links:[{status:'unlinked'}, {status:'manual',start:3,end:12,score:1}, {status:'unlinked'}],layoutMasters:{'my-layout':{}}};
// Normalize spaces just as manuscript links do.
p.links[1].end=p.links[1].start+C.normalize('첫째 줄둘째 줄셋째 줄').length;
const before=JSON.stringify(p),r=S.split(p,1,C);
assert.equal(JSON.stringify(p),before);assert.equal(r.count,3);assert.equal(r.slides.length,5);
assert.deepEqual(r.slides[0],p.slides[0]);assert.deepEqual(r.slides[4],p.slides[2]);
const parts=r.slides.slice(1,4);assert.equal(new Set(parts.map(s=>s.uid)).size,3);assert.equal(parts[0].uid,'selected');
assert.deepEqual(parts.map(s=>s.shapes[1].paragraphs[0].runs.map(r=>r.text).join('')),['첫째 줄','둘째 줄','셋째 줄']);
assert.equal(parts[0].shapes[1].paragraphs[0].runs[0].color,'#FF0000');assert.equal(parts[2].shapes[1].paragraphs[0].runs[0].size,42);
for(const s of parts){assert.deepEqual(s.shapes[0],p.slides[1].shapes[0]);assert.deepEqual(s.shapes[2],p.slides[1].shapes[2]);assert.equal(s.shapes[1].x,100);assert.equal(s.masterId,'my-layout');assert.equal(s.editor.cumulative,false);}
assert.deepEqual(r.links.slice(1,4).map(l=>[l.start,l.end]),[[3,6],[6,9],[9,12]]);
assert(r.links.slice(1,4).every(l=>l.status==='manual'));
assert.throws(()=>S.split({...p,slides:r.slides,links:r.links},1,C),/두 줄/);
const changed=structuredClone(p);changed.links[1].end--;assert(S.split(changed,1,C).links.slice(1,4).every(l=>l.status==='unlinked'),'edited text never gets an invented source match');
const imported=structuredClone(p);delete imported.slides[1].bodyIndex;delete imported.slides[1].editor;assert.equal(S.split(imported,1,C).count,3);
assert.throws(()=>S.split({slides:[{shapes:[]}],lines:[],links:[]},0,C),/본문/);
console.log('PASS Make line splitting: styles/colors/media/master/geometry retained, blank lines omitted, imported body detection, independent slides, exact link slices, mismatch guard and source immutability');
