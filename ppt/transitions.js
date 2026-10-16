/* Immediate fade-in, with the outgoing frame retained only for its short fade-out. */
window.CaptionTransition=class {
  constructor(host){this.host=host;this.current=null;this.key=null;this.old=new Set();}
  clear(){for(const layer of this.host.children){CaptionRender.release(layer);}this.host.replaceChildren();this.current=null;this.key=null;for(const id of this.old)clearTimeout(id);this.old=new Set();}
  show(slide,index,green='#00ff00',immediate=false){
    const key=JSON.stringify([index,slide]);if(key===this.key&&!immediate)return;
    if(immediate||matchMedia('(prefers-reduced-motion: reduce)').matches){this.clear();}
    this.key=key;this.host.style.background=green;
    const previous=this.current;
    if(previous){previous.style.opacity='0';const remove=()=>{CaptionRender.release(previous);previous.remove();};let timer=setTimeout(()=>{remove();this.old.delete(timer);},240);this.old.add(timer);}
    this.current=null;
    if(!slide)return;
    const layer=document.createElement('div');layer.className='slide-host caption-frame';layer.dataset.fill='screen';
    layer.style.opacity=immediate?'1':'0';this.host.appendChild(layer);this.current=layer;
    CaptionRender.show(layer,slide,green);
    // Start at this frame, without waiting for the outgoing slide to disappear.
    void layer.offsetWidth;layer.style.opacity='1';
    if(this.host.children.length>3){for(const item of [...this.host.children].slice(0,-3)){CaptionRender.release(item);item.remove();}}
  }
};
