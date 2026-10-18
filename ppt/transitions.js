/* 새 자막은 바로 나타나고, 이전 자막은 새 자막이 완전히 덮은 뒤에 지운다. 녹색으로 돌아갈 때만 서서히 사라진다. */
window.CaptionTransition=class {
  constructor(host){this.host=host;this.current=null;this.key=null;this.old=new Set();}
  clear(){for(const layer of this.host.children){CaptionRender.release(layer);}this.host.replaceChildren();this.current=null;this.key=null;for(const id of this.old)clearTimeout(id);this.old=new Set();}
  show(slide,index,green='#00ff00',immediate=false){
    const key=JSON.stringify([index,slide]);if(key===this.key&&!immediate)return;
    if(immediate||matchMedia('(prefers-reduced-motion: reduce)').matches){this.clear();}
    this.key=key;this.host.style.background=green;
    // 녹색으로 돌아갈 때만 화면을 서서히 지운다. 다른 자막으로 이어질 때는 아래 장을 그대로 둔다.
    if(!slide){for(const item of [...this.host.children]){item.style.opacity='0';const remove=()=>{CaptionRender.release(item);item.remove();};let timer=setTimeout(()=>{remove();this.old.delete(timer);},240);this.old.add(timer);}}
    this.current=null;
    if(!slide)return;
    const layer=document.createElement('div');layer.className='slide-host caption-frame';layer.dataset.fill='screen';
    layer.style.opacity=immediate?'1':'0';this.host.appendChild(layer);this.current=layer;
    CaptionRender.show(layer,slide,green);
    // 새 장을 이전 장 위에 덮어 나타낸다. 이전 장도 함께 투명해지면 두 장의 겹친 부분이 반투명이 되어 녹색이 비치고 깜빡이기 때문이다.
    void layer.offsetWidth;layer.style.opacity='1';
    if(!immediate){let timer=setTimeout(()=>{this.old.delete(timer);const at=[...this.host.children].indexOf(layer);if(at<0)return;for(const item of [...this.host.children].slice(0,at)){CaptionRender.release(item);item.remove();}},260);this.old.add(timer);}
    if(this.host.children.length>3){for(const item of [...this.host.children].slice(0,-3)){CaptionRender.release(item);item.remove();}}
  }
};
