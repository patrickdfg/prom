const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync('index.html','utf8');
const fit=html.slice(html.indexOf('function fit(){'),html.indexOf('// 글꼴에 없어서'));
function measure(w,h,lines,mobile,mfs,cue){
 const node=()=>({style:{setProperty(k,v){this[k]=v}},classList:{toggle(){},remove(){}}});
 const nodes={stage:{clientWidth:w,clientHeight:h},page:node(),lines:node()};
 vm.runInNewContext(fit+';fit()',{ $:id=>nodes[id],MOBILE:mobile,MFS:mfs,MAXW:17.5,LINES:lines,nextCueLine:()=>cue,innerWidth:w,innerHeight:h });
 return {font:parseFloat(nodes.page.style.fontSize),pitch:parseFloat(nodes.lines.style['--lh'])};
}
for(const [w,h,mobile,size] of [[390,700,true,40],[390,400,true,70],[1920,1080,false,40],[800,1100,false,40]])for(const rows of [5,6,7]){
 const off=measure(w,h,rows,mobile,size,false),on=measure(w,h,rows,mobile,size,true);
 assert.equal(on.font,off.font,`font retained ${w}x${h} / ${rows}`);
 assert(on.pitch>=on.font*1.2,'readable minimum row pitch');
 assert(on.pitch<=off.pitch,'spacing compressed before font');
}
const source=fs.readFileSync('audience.js','utf8');
const audienceFit=source.slice(source.indexOf('  function fit(){'),source.indexOf('  const receive='));
for(const rows of [5,6,7]){
 const display={style:{},clientHeight:885.6,querySelectorAll:()=>[]};
 const current={lines:rows,pages:Array(rows),nextCue:null};
 const context={PromSlideLayout:require('../slide-layout.js'),display,current,innerHeight:1080,innerWidth:1920};
 vm.runInNewContext(audienceFit+'fit()',context);const original=display.style.fontSize;
 current.nextCue='다음 쪽 첫 줄';vm.runInNewContext(audienceFit+'fit()',context);
 assert.equal(display.style.fontSize,original);
}
console.log('PASS cue preserves body font at 5/6/7 rows, compresses spacing, maintains minimum row pitch in portrait and slideshow');
