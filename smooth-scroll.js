/* Retarget one animation instead of restarting native smooth scroll on every speech result. */
window.PromSmoothScroll=(()=>{
  const states=new WeakMap();
  function cancel(host){const s=states.get(host);if(s?.frame)cancelAnimationFrame(s.frame);if(s){s.frame=0;s.last=0;}}
  function to(host,top,options={}){
    let s=states.get(host);
    if(!s){s={frame:0,last:0,target:0};states.set(host,s);for(const event of ['wheel','touchstart','pointerdown','keydown'])host.addEventListener(event,()=>cancel(host),{passive:true});}
    s.maxSpeed=Number(options.maxSpeed)>0?Number(options.maxSpeed):Infinity;
    s.target=Math.max(0,Math.min(Number(top)||0,Math.max(0,host.scrollHeight-host.clientHeight)));
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){cancel(host);host.scrollTop=s.target;return;}
    if(s.frame)return;
    const step=now=>{
      s.frame=0;if(!host.isConnected){s.last=0;return;}
      const dt=s.last?Math.min(64,Math.max(0,now-s.last)):16;s.last=now;
      const delta=s.target-host.scrollTop;
      if(Math.abs(delta)<.5){host.scrollTop=s.target;s.last=0;return;}
      const eased=delta*(1-Math.exp(-dt/150)),limit=s.maxSpeed*dt/1000;
      host.scrollTop+=Math.sign(eased)*Math.min(Math.abs(eased),limit);s.frame=requestAnimationFrame(step);
    };
    s.frame=requestAnimationFrame(step);
  }
  return {to,cancel};
})();
