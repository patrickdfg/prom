const assert=require('node:assert/strict'),M=require('../../make/manuscripts.js');
(async()=>{
 const first={name:'첫원고.hwp',size:100},second={name:'둘째원고.txt',size:100},seen=[];
 const marked={lines:['파일의 색상 문장'],richLines:[{text:'파일의 색상 문장',runs:[{text:'파일의 색상 문장',hex:'008000'}]}]},original=JSON.stringify(marked);
 const result=await M.read([first,second],['  붙여넣기 한 줄\r\n다음 줄  ','','추가 원고'],async file=>{seen.push(file.name);return file===first?marked:{lines:['둘째 파일'],richLines:[{text:'둘째 파일',runs:[{text:'둘째 파일',hex:'000000'}]}]}},{pasteColor:'0000FF',plainColor:'0000FF'});
 assert.deepEqual(seen,[first.name,second.name]);assert.deepEqual(result.lines,['파일의 색상 문장','둘째 파일','붙여넣기 한 줄','다음 줄','추가 원고']);assert.equal(result.richLines[0].runs[0].hex,'008000');assert.equal(result.richLines[1].runs[0].hex,'0000FF');assert.equal(result.richLines[2].runs[0].hex,'0000FF');assert.equal(JSON.stringify(marked),original,'input formatting never mutated');assert.equal(result.names.length,4);
 const pasted=await M.read([],['원고 하나\n\n원고 둘'],()=>{});assert.deepEqual(pasted.lines,['원고 하나','원고 둘']);assert.equal(pasted.richLines[0].runs[0].hex,'000000');
 await assert.rejects(()=>M.read([],['  '],()=>{}),/붙여넣/);await assert.rejects(()=>M.read([{name:'large.hwp',size:51*1024*1024}],[],()=>{}),/50MB/);await assert.rejects(()=>M.read([first,second],[],async f=>{if(f===second)throw Error('unreadable');return marked}),/unreadable/);
 console.log('PASS multiple manuscript order, multiple pasted blocks, mixed formatting, per-source plain-text inclusion, source preservation, paste-only, empty/oversize/read-error rejection');
})();
