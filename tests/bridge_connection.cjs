const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('workspace.js','utf8'),nodes={obsBridgeConnect:{},obsBridgeStatus:{}};let calls=0,renders=0,ready=false;
const c={$:id=>nodes[id],window:{},AbortSignal,render(){renders++;},fetch:async()=>{calls++;if(!ready)throw Error('closed');return {ok:true,json:async()=>({ready:true,app:'PromWindowBridge'})};}};
vm.createContext(c);vm.runInContext(source.slice(source.indexOf('  let bridgeConnected='),source.indexOf("  $('obsFullscreenSetup').onclick")),c);
(async()=>{assert.equal(calls,0,'initial load must not probe the helper');assert.equal(vm.runInContext('bridgeConnected',c),false);
await c.toggleBridgeConnection();assert.equal(calls,1,'manual connect checks once');assert.equal(vm.runInContext('bridgeConnected',c),false);assert(nodes.obsBridgeStatus.textContent.includes('자동으로 재시도하지'));
ready=true;await c.toggleBridgeConnection();assert.equal(calls,2);assert.equal(vm.runInContext('bridgeConnected',c),true);assert.equal(renders,1);assert(nodes.obsBridgeConnect.textContent.includes('해제'));
await c.toggleBridgeConnection();assert.equal(calls,2,'disconnect performs no checks');assert.equal(vm.runInContext('bridgeConnected',c),false);
console.log('PASS helper opt-in, no startup probe, one manual check, absent helper silence, successful connect and disconnect');})().catch(e=>{console.error(e);process.exitCode=1;});
