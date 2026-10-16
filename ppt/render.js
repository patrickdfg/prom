window.CaptionRender=(()=>{
const instances=new WeakMap();
function show(host,slide,green='#00ff00'){
 const old=instances.get(host);old?.disconnect();host.replaceChildren();host.style.background=green;
 if(!slide)return;const canvas=document.createElement('div');canvas.className='slide-canvas';canvas.style.width=slide.width+'px';canvas.style.height=slide.height+'px';canvas.style.background=slide.background||green;host.appendChild(canvas);
 for(const shape of slide.shapes||[]){const el=document.createElement('div');el.className='slide-object';Object.assign(el.style,{left:shape.x+'px',top:shape.y+'px',width:shape.w+'px',height:shape.h+'px',transform:shape.rotate?`rotate(${shape.rotate}deg)`:''});
  if(shape.type==='image'){if(!/^data:image\/(png|jpeg|gif|webp|bmp|svg\+xml);base64,/.test(shape.src||''))continue;const img=document.createElement('img');img.src=shape.src;img.alt='';el.appendChild(img);}
  if(shape.type==='rect')el.style.background=shape.color;
  if(shape.type==='text'){el.classList.add('slide-text');el.style.justifyContent=shape.anchor==='ctr'?'center':shape.anchor==='b'?'flex-end':'flex-start';el.style.padding=(shape.padding||[0,0,0,0]).map(n=>n+'px').join(' ');
   for(const para of shape.paragraphs||[]){const p=document.createElement('div');p.style.textAlign=para.align||'left';for(const run of para.runs||[]){const span=document.createElement('span');span.textContent=run.text;Object.assign(span.style,{fontSize:(run.size||30)+'px',fontWeight:run.bold?'700':'400',fontStyle:run.italic?'italic':'normal',color:run.color||'#000',fontFamily:`"${String(run.font||'Malgun Gothic').replace(/["\\]/g,'')}", "Malgun Gothic", "Apple SD Gothic Neo", serif`});p.appendChild(span);}el.appendChild(p);}
  }canvas.appendChild(el);
 }
 const fit=()=>{const scale=Math.min(host.clientWidth/slide.width,host.clientHeight/slide.height);canvas.style.transform=host.dataset.fill==='screen'?`translate(-50%,-50%) scale(${host.clientWidth/slide.width},${host.clientHeight/slide.height})`:`translate(-50%,-50%) scale(${scale})`;};fit();const observer=new ResizeObserver(fit);observer.observe(host);instances.set(host,observer);
}
function release(host){instances.get(host)?.disconnect();for(const el of host.querySelectorAll('.slide-host'))instances.get(el)?.disconnect();}
return {show,release};
})();
