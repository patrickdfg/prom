const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function setup(query){
 const ids={};
 for(const id of ['editFont','editorFonts','editFontList','loadLocalFonts','editFontStatus'])ids[id]={value:'original',children:[],append(x){this.children.push(x)},replaceChildren(){this.children=[]},dispatchEvent(e){this.event=e}};
 const context={window:query?{queryLocalFonts:query}:{},document:{getElementById:id=>ids[id],createElement:()=>({})},Event:class{constructor(type){this.type=type}}};
 vm.runInNewContext(fs.readFileSync('ppt/font-picker.js','utf8'),context);return ids;
}
(async()=>{
 let calls=0;const el=setup(async()=>{calls++;return [{family:'Test Font'},{family:'Test Font'},{family:'다른 글꼴'}]});
 assert.equal(calls,0,'no font permission prompt on startup');assert.equal(el.editFont.value,'original','keep current imported font');
 await el.loadLocalFonts.onclick();assert.equal(calls,1);assert.equal(el.editorFonts.children.filter(x=>x.value==='Test Font').length,1,'deduplicate font weights');
 el.editFontList.value='Test Font';el.editFontList.onchange();assert.equal(el.editFont.value,'Test Font');assert.equal(el.editFont.event.type,'input','trigger existing preview and save pipeline');assert.equal(el.editFontList.value,'');
 const denied=setup(async()=>{const e=Error();e.name='NotAllowedError';throw e});await denied.loadLocalFonts.onclick();assert.equal(denied.loadLocalFonts.disabled,false);assert(denied.editFontStatus.textContent.includes('허용되지'));
 const empty=setup(async()=>[]);await empty.loadLocalFonts.onclick();assert(empty.editFontStatus.textContent.includes('없습니다'));
 const unsupported=setup();await unsupported.loadLocalFonts.onclick();assert(unsupported.editFontStatus.textContent.includes('직접 입력'));
 console.log('PASS optional permission, family deduplication, existing font preservation, preview input, denied/empty/unsupported fallback');
})();
