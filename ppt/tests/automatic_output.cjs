const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('display-screens.js','utf8');
const main={label:'main',left:0,top:0,width:1920,height:1080,availLeft:0,availTop:0,availWidth:1920,availHeight:1040};
const other={label:'other',left:-1920,top:0,width:1920,height:1080,availLeft:-1920,availTop:0,availWidth:1920,availHeight:1040};
function setup(w={}){const context={window:{screen:{...main,isExtended:true},...w},WeakMap,Math,JSON};vm.runInNewContext(source,context);return {api:context.window.PromDisplayScreens,context};}
(async()=>{
 let detail={screens:[main,other],currentScreen:{...main}};
 const {api}=setup({getScreenDetails:async()=>detail});const manager=api.create({automatic:true});
 assert(!manager.button,'no monitor picker');await manager.prepare();assert.equal(manager.target(),other,'other monitor, even when currentScreen is a distinct object');
 const calls=[],popup={closed:false,document:{fullscreenElement:null},moveTo:(...p)=>calls.push(['move',...p]),resizeTo:(...p)=>calls.push(['resize',...p]),captionFullscreen:s=>calls.push(['full',s])};
 await manager.place(popup,'captionFullscreen');assert.deepEqual(calls[0],['move',-1920,0]);assert.deepEqual(calls[1],['resize',1920,1040]);assert.equal(calls[2][1],other);
 detail={screens:[main,other],currentScreen:other};await manager.prepare();assert.equal(manager.target(),main,'follow moved controller');
 detail={screens:[other],currentScreen:other};await manager.prepare();assert.equal(manager.target(),other,'one monitor uses current');
 let asked=false;const single=setup({screen:{...main,isExtended:false},getScreenDetails:async()=>{asked=true;throw Error()}}).api.create({automatic:true});await single.prepare();assert.equal(asked,false,'single screen needs no permission');assert.equal(single.target(),null,'ordinary Screen must not be passed as FullscreenOptions.screen');
 const denied=setup({getScreenDetails:async()=>{throw Error('denied')}}).api.create({automatic:true});await denied.prepare();assert.equal(denied.target(),null);assert(denied.message().includes('권한'));
 const unsupported=setup({getScreenDetails:undefined}).api.create({automatic:true});await unsupported.prepare();assert.equal(unsupported.target(),null);
 // Integration: popup is opened synchronously, before slow screen permission finishes.
 let resolveDetails;const wait=new Promise(r=>resolveDetails=r),log=[],ctx=setup({getScreenDetails:()=>wait}).context;
 const win={closed:false,document:{fullscreenElement:null},moveTo:(...a)=>log.push(['move',...a]),resizeTo(){},location:{replace:url=>log.push(['navigate',url])},addEventListener:(type,fn)=>win.loaded=fn};
 Object.assign(ctx,{PromDisplayScreens:ctx.window.PromDisplayScreens,status:t=>log.push(['status',t]),publish:()=>log.push(['publish']),channel:null,channelId:'',output:null,outputFullscreen:false,lastOutputSeen:0,crypto:{randomUUID:()=> 'test-channel'},BroadcastChannel:class{constructor(){}},Date});
 ctx.window.BroadcastChannel=ctx.BroadcastChannel;ctx.window.open=(...a)=>{log.push(['open',...a]);return win};
 const app=fs.readFileSync('ppt/app.js','utf8'),part=app.slice(app.indexOf('const outputScreens='),app.indexOf("$('openOutput').onclick="));vm.runInNewContext(part,ctx);
 const pending=ctx.openOutput();assert.equal(log.find(x=>x[0]==='open')?.[1],'about:blank');assert.equal(log.some(x=>x[0]==='navigate'),false);resolveDetails({screens:[main,other],currentScreen:main});await pending;assert(log.some(x=>x[0]==='move'&&x[1]===-1920));assert(log.some(x=>x[0]==='navigate'&&x[1]==='output.html#test-channel'));await ctx.openOutput();assert.equal(log.filter(x=>x[0]==='open').length,1,'reuse open output');
 console.log('PASS automatic output: dual/single screens, moved controller, disconnect, negative coordinates, denied/unsupported fallback, no picker, popup before await, separate output, window reuse');
})();
