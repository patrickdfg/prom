// Speaker layouts remain available for manual editing, not unnumbered auto-generation.
const assert=require('node:assert/strict');global.window=global;global.CaptionCore=require('../core.js');global.CaptionContentRules=require('../content-rules.js');global.crypto=require('node:crypto').webcrypto;
global.document={currentScript:{src:'http://localhost/ppt/builder.js'},fonts:{load:async()=>{}},createElement:()=>({getContext:()=>({measureText:t=>({width:t.length*22})})})};require('../builder.js');
const B=CaptionBuilder,text='“예수님이 말씀하셨다. 나를 따르라.” “하나님이 말씀하시기를 너희는 내 백성이라 하셨다.”';
assert.deepEqual(B.analyze({lines:[text],richLines:[{text,runs:[{text,hex:'008000'}]}]}),[]);
assert.equal(B.speakerLayout('“예수님이 말씀하셨다.”'),'wordSon');assert.equal(B.speakerLayout('“하나님이 말씀하셨다.”'),'wordGod');
console.log('PASS unnumbered quotations excluded; manual speaker layout selection retained');
