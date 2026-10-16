const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');let stored=null;
const c={window:{},localStorage:{getItem:()=>stored,setItem:(key,value)=>{stored=value;}}};vm.createContext(c);vm.runInContext(fs.readFileSync('scroll-view.js','utf8'),c);const V=c.window.PromScrollView;
assert.equal(V.getScale(),100);assert.equal(V.setScale(120),120);assert.equal(V.getScale(),120);assert.equal(stored,'120');assert.equal(V.setScale(500),180);assert.equal(V.setScale(-10),60);stored='invalid';V.zoom=undefined;assert.equal(V.getScale(),100);V.setScale(100);
console.log('PASS scroll font scale, persistence, default and 60–180% bounds');
