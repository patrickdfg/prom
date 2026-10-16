const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let now=0,next=0,reduced=false;const frames=new Map();
const c={window:{},WeakMap,Math,Number,matchMedia:()=>({matches:reduced}),requestAnimationFrame:fn=>{frames.set(++next,fn);return next;},cancelAnimationFrame:id=>frames.delete(id)};
vm.createContext(c);vm.runInContext(fs.readFileSync('smooth-scroll.js','utf8'),c);
const S=c.window.PromSmoothScroll;
function host(){return {scrollHeight:4000,clientHeight:800,scrollTop:0,isConnected:true,listeners:{},addEventListener(name,fn){this.listeners[name]=fn;}};}
function tick(ms=16){now+=ms;const pending=[...frames.values()];frames.clear();for(const fn of pending)fn(now);}
let h=host();S.to(h,1000);tick();assert(h.scrollTop>0&&h.scrollTop<1000,'first frame must interpolate');
const before=h.scrollTop;S.to(h,2000);assert.equal(frames.size,1,'retargeting must reuse one animation');tick();assert(h.scrollTop>before&&h.scrollTop<2000);
for(let i=0;i<140;i++)tick();assert.equal(h.scrollTop,2000);assert.equal(frames.size,0);
S.to(h,1000);h.listeners.wheel();tick();assert.equal(h.scrollTop,2000,'manual input cancels follow movement');
reduced=true;S.to(h,99999);assert.equal(h.scrollTop,3200,'reduced motion and bounds must snap safely');assert.equal(frames.size,0);
reduced=false;S.to(h,0);h.isConnected=false;tick();assert.equal(frames.size,0,'detached nodes must stop');
console.log('PASS interpolated scrolling, rapid retarget, convergence, user cancellation, reduced motion, bounds, detached node');

const limited=host();S.to(limited,600,{maxSpeed:200});let last=0;
for(let i=0;i<30;i++){tick();assert(limited.scrollTop-last<=3.201,'batched recognition must not exceed two rows per second');last=limited.scrollTop;}
assert(limited.scrollTop>0&&limited.scrollTop<100);S.to(limited,800,{maxSpeed:200});tick();assert(limited.scrollTop-last<=3.201,'retarget must retain speed limit');
limited.listeners.wheel();console.log('PASS bounded line-follow speed and rapid retarget');
