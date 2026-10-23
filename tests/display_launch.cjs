const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
for(const kind of ['prom','ppt']){
 let opens=0,moves=0,publishes=0,overviews=0,release;const order=[];
 const prepared=new Promise(r=>release=r),target={left:-1920,top:0,width:1920,height:1080};
 const popup={closed:false,location:{replace:url=>order.push(url)}};
 const api={prepare:()=>{order.push('prepare');return prepared},target:()=>target,features:()=> 'popup=yes',place:async()=>{moves++;order.push('place')},message:()=>''};
 const c={window:{BroadcastChannel:true,open:()=>{opens++;order.push('open');return popup}},PromDisplayScreens:{create:o=>{assert.equal(o.automatic,true);return api}},$:()=>({click(){overviews++}}),BroadcastChannel:class{postMessage(){}},crypto:{randomUUID:()=> 'test'},status(){},toast(){},publish(){publishes++},listening:false,channel:null,audience:null,output:null,lastOutputSeen:0,channelId:''};
 vm.createContext(c);const s=fs.readFileSync(kind==='prom'?'workspace.js':'ppt/app.js','utf8');const start=s.indexOf(kind==='prom'?'  let openingAudience=false;':'const outputScreens=');const end=s.indexOf(kind==='prom'?"  $('audience').onclick=":"$('openOutput').onclick=openOutput;",start);assert(start>=0&&end>start);vm.runInContext(s.slice(start,end),c);
 const run=()=>vm.runInContext(kind==='prom'?'openSlideshow()':'openOutput()',c);
 const p=run();assert.equal(opens,1,'popup must open before waiting for permission');assert.equal(moves,0);await run();assert.equal(opens,1,'ignore duplicate click while opening');release();await p;assert.equal(moves,1);assert(order.indexOf('place')<order.findIndex(x=>x.includes('.html')),'position before navigation');await run();assert.equal(opens,1,'reuse output');assert.equal(publishes,kind==='prom'?2:1);if(kind==='prom'){assert.equal(overviews,2,'new and reused slideshow choose overview');}if(kind==='prom'){c.listening=true;await run();assert.equal(opens,1,'microphone mode uses same output window');assert.equal(c.listening,true);}
}
 const main={left:0,top:0,width:1920,height:1080},other={left:-1920,top:0,width:1920,height:1080};let probes=0;
 const c={window:{screen:{...main,isExtended:true},getScreenDetails:async()=>{probes++;return {screens:[main,other],currentScreen:main}}}};vm.createContext(c);vm.runInContext(fs.readFileSync('display-screens.js','utf8'),c);const d=c.window.PromDisplayScreens.create({automatic:true,onMessage(){}});assert.equal(probes,0);await d.prepare();assert.equal(d.target(),other);assert(d.features().includes('left=-1920'));c.window.getScreenDetails=async()=>{throw Error('denied')};await d.prepare();assert.equal(d.target(),null);assert(d.message().includes('권한'));delete c.window.getScreenDetails;await d.prepare();assert.equal(d.target(),null);
 console.log('PASS automatic other-monitor selection, no startup probe, denied/unsupported fallback, popup before permission, duplicate guard, navigation after placement, output reuse, microphone mode preserved in reused output');
})().catch(e=>{console.error(e);process.exitCode=1});
