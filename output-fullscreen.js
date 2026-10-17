/* Autostart may lack user activation. Keep an explicit, trusted-click retry. */
window.PromOutputFullscreen={
 async enter(target){
  if(document.fullscreenElement)return true;
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
