const assert=require('node:assert/strict'),L=require('../image-library.js');
const art={type:'image',src:'data:image/png;base64,art',w:100,h:80},bg={type:'image',src:'data:image/png;base64,bg',w:960,h:540};
const rec={id:'test',name:'내 템플릿',layoutCatalog:[{key:'caption',name:'자막'}],design:{layouts:{caption:{width:960,height:540,shapes:[art,bg,art,{...art,src:'https://example.com/image.png'}]}}}};
const before=JSON.stringify(rec),arts=L.collect([rec,rec],'artwork'),backgrounds=L.collect([rec],'background');
assert.equal(arts.length,1);assert.equal(backgrounds.length,1);assert.equal(arts[0].label,'내 템플릿 · 자막');
arts[0].shape.w=10;assert.equal(JSON.stringify(rec),before,'gallery selections cannot change templates');
assert.equal(L.collect([{...rec,id:'__prom-template-backup__:test'}],'artwork').length,0);
assert.equal(L.collect([{id:'empty'},null].filter(Boolean),'background').length,0);
console.log('PASS shared gallery filtering, deduplication, labels, backup exclusion and source preservation');
