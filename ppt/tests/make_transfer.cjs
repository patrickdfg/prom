const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('make/make.js','utf8').split("const LIVE_DB='prom-ppt-caption';")[1].split('/* ---------- 지침 수정 창 ---------- */')[0];
async function run({old,accept=true,fail=false}={}){
 const data=new Map(old?[['last',structuredClone(old)]]:[]),elements=new Map(),messages=[],navigation=[];
 const $=id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id)};
 const database={close(){},transaction(name,mode){const next=new Map(data),tx={error:null,objectStore(){return {get(key){const r={};queueMicrotask(()=>{r.result=structuredClone(next.get(key));r.onsuccess?.()});return r},put(value,key){if(fail&&key==='last'){tx.error=Error('quota');return {}}next.set(key,structuredClone(value));return {}}}}};setImmediate(()=>{if(tx.error){tx.onabort?.();return;}if(mode==='readwrite'){data.clear();for(const pair of next)data.set(...pair)}tx.oncomplete?.()});return tx}};
 const image='data:image/png;base64,AA==',deck={lines:['원고'],richLines:[{text:'원고'}],scriptName:'원고.txt',deckName:'편집본.pptx',slides:[{width:960,height:540,text:'고친 글',shapes:[{type:'image',src:image},{type:'image',src:image}]}],links:[{status:'manual',start:0,end:2}]};
 const rec={id:'test',version:1,design:{layouts:{}}},before=JSON.stringify(deck);
 const context={$ ,deck,deckTemplateRec:rec,busy:false,structuredClone,Map,Promise,crypto:require('node:crypto').webcrypto,confirm:()=>accept,status:(...m)=>messages.push(m),toast:()=>{},localStorage:{setItem(){}},window:{location:{assign:url=>navigation.push(url)}},indexedDB:{open(){const r={result:database};queueMicrotask(()=>r.onsuccess());return r}}};
 vm.runInNewContext("const LIVE_DB='prom-ppt-caption';"+source,context);await $('makeToLive').onclick();
 assert.equal(JSON.stringify(deck),before,'source deck unchanged');assert.equal(context.busy,false);assert.equal($('makeToLive').disabled,false);
 return {data,messages,navigation};
}
(async()=>{
 const old={version:1,lines:['이전 작업'],slides:[],standby:{name:'기본화면'}};
 let r=await run({old});assert.deepEqual(r.data.get('beforeMake'),old);const p=r.data.get('last');assert.deepEqual(p.links,[{status:'manual',start:0,end:2}]);assert.deepEqual(p.exportSize,{width:1920,height:1080});assert.equal(p.slides[0].width,960);assert.equal(p.slides[0].text,'고친 글');assert.equal(p.generationTemplate.id,'test');assert.equal(Object.keys(p.assets).length,1);assert.equal(p.slides[0].shapes[0].src,p.slides[0].shapes[1].src);assert.deepEqual(r.navigation,['../ppt/?from=make']);
 r=await run({old,accept:false});assert.deepEqual(r.data.get('last'),old);assert.equal(r.data.has('beforeMake'),false);assert.equal(r.navigation.length,0);
 r=await run({old,fail:true});assert.deepEqual(r.data.get('last'),old);assert.equal(r.data.has('beforeMake'),false,'backup+replace rollback together');assert.equal(r.navigation.length,0);
 r=await run();assert.equal(r.data.has('beforeMake'),false);assert.equal(r.navigation.length,1);
 console.log('PASS Make transfer: edited content, original dimensions, links, template, image dedup, backup, cancel, atomic quota rollback, same-tab navigation');
})();
