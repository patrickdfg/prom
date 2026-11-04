const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('workspace.js','utf8'),html=fs.readFileSync('index.html','utf8');
// Current markup removed the experimental option. Its absence must not stop later setup.
assert(!html.includes('id="labNextLine"'));
const setup=source.slice(source.indexOf('  const nextLineOption='),source.indexOf("  const STORAGE ="));
assert.doesNotThrow(()=>vm.runInNewContext(setup,{$:()=>null}));
let renders=0;const option={},saved={};vm.runInNewContext(setup,{$:()=>option,localStorage:{getItem:k=>saved[k]??null,setItem:(k,v)=>saved[k]=v},render:()=>renders++});assert.equal(option.checked,true);option.checked=false;option.onchange();assert.equal(saved.promLabNextLine,'false');assert.equal(renders,1);
assert(html.includes('id="selectedFileName"'));assert(html.includes("pending={...r,name:f.name}"));
console.log('PASS missing experimental option does not abort workspace startup; legacy option still works; selected manuscript filename retained');
