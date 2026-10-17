/* Autostart may lack user activation. Keep an explicit, trusted-click retry. */
window.PromOutputFullscreen={
 reposition(s){document.dispatchEvent(new CustomEvent("prom-reposition-output",{detail:{left:s.availLeft??s.left,top:s.availTop??s.top,width:s.availWidth??s.width,height:s.availHeight??s.height}}));},
 async enter(target){
  if(document.fullscreenElement||document.documentElement.dataset.promBrowserFullscreen==='true')return true;
  const root=document.documentElement,request=root.requestFullscreen||root.webkitRequestFullscreen;
  if(!request)return false;
  try{await request.call(root,target?{screen:target,navigationUI:'hide'}:{navigationUI:'hide'});return true;}
  catch(error){
   // The window is already on the chosen display. Fall back to ordinary
   // fullscreen if the screen option is rejected during an actual click.
   if(target&&navigator.userActivation?.isActive){try{await request.call(root,{navigationUI:'hide'});return true;}catch{}}
   return false;
  }
 }
};
