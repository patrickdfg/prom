window.CaptionRender=(()=>{
const instances=new WeakMap();
function show(host,slide,green='#00ff00'){
 const old=instances.get(host);old?.disconnect();host.replaceChildren();host.style.background=green;
 if(!slide)return;const textFits=[],canvas=document.createElement('div');canvas.className='slide-canvas';canvas.style.width=slide.width+'px';canvas.style.height=slide.height+'px';canvas.style.background=slide.background||green;host.appendChild(canvas);
 for(const shape of slide.shapes||[]){const el=document.createElement('div');el.className='slide-object';Object.assign(el.style,{left:shape.x+'px',top:shape.y+'px',width:shape.w+'px',height:shape.h+'px',transform:shape.rotate?`rotate(${shape.rotate}deg)`:''});
  if(shape.type==='image'){
   const edgeX=slide.width*.1,edgeY=slide.height*.1;
   // A nearly full-slide background must cover the green canvas at every edge.
   if(!shape.manualGeometry&&(shape.background||(!shape.rotate&&Math.abs(shape.x)<=edgeX&&Math.abs(shape.y)<=edgeY&&Math.abs(slide.width-shape.x-shape.w)<=edgeX&&Math.abs(slide.height-shape.y-shape.h)<=edgeY))){Object.assign(el.style,{left:'0px',top:'0px',width:slide.width+'px',height:slide.height+'px'});el.dataset.fullBleed='true';}
   if(!/^data:image\/(png|jpeg|gif|webp|bmp|svg\+xml);base64,/.test(shape.src||''))continue;const img=document.createElement('img');img.src=shape.src;img.alt='';el.appendChild(img);}
  if(shape.type==='rect'){el.style.background=shape.color||'transparent';if(shape.geom==='ellipse')el.style.borderRadius='50%';else if(shape.geom==='roundRect')el.style.borderRadius=Math.min(shape.w,shape.h)*.1667+'px';if(shape.line?.width>0){el.style.boxSizing='border-box';el.style.border=shape.line.width+'px solid '+(shape.line.color||'#000000');}}
  if(shape.type==='text'){el.classList.add('slide-text');el.style.justifyContent=shape.anchor==='ctr'?'center':shape.anchor==='b'?'flex-end':'flex-start';el.style.padding=(shape.padding||[0,0,0,0]).map(n=>n+'px').join(' ');
   el.style.whiteSpace=shape.wrap===false?'pre':'pre-wrap';el.style.fontSynthesis='none';
   const frame=document.createElement('div'),content=document.createElement('div');frame.className='slide-text-frame';content.className='slide-text-content';frame.appendChild(content);el.appendChild(frame);
   for(const para of shape.paragraphs||[]){
    const p=document.createElement('div'),size=Math.max(0,...(para.runs||[]).map(r=>r.size||0))||para.defaultSize||30;
    const pixels=sp=>sp?(sp.unit==='px'?sp.value:sp.value*size):0;
    const line=para.lineSpacing;
    Object.assign(p.style,{textAlign:para.align||'left',fontSize:size+'px',lineHeight:line?(line.unit==='px'?Math.max(1,line.value*(1-(shape.lineReduction||0)))+'px':String(Math.max(.1,line.value-(shape.lineReduction||0)))):'normal',marginTop:pixels(para.spaceBefore)+'px',marginBottom:pixels(para.spaceAfter)+'px',paddingLeft:(para.marginLeft||0)+'px',paddingRight:(para.marginRight||0)+'px',textIndent:(para.indent||0)+'px',tabSize:(para.tabSize||96)+'px'});
    for(const run of para.runs||[]){
     const span=document.createElement('span');span.textContent=/^\u00a0+$/.test(run.text||'')?' '.repeat(run.text.length):run.text;// 줄 채움용 특수 공백이 글꼴에 없어 네모로 보이는 것을 막는다.
     const font=String(run.font||'Malgun Gothic').replace(/[%"\\]/g,'');
     // These are separate named faces in PowerPoint, not browser-synthesized bold.
     const maru=/마루\s*부리|maru\s*buri/i.test(font),weight=maru?(/굵은|bold/i.test(font)&&!/semi/i.test(font)?700:/중간|semi/i.test(font)?600:/아주|extra/i.test(font)?200:/가는|light/i.test(font)?300:run.bold?700:400):run.bold?700:400;
     Object.assign(span.style,{fontSize:(run.size||size)+'px',fontWeight:String(weight),fontStyle:run.italic?'italic':'normal',color:run.color||'#000',fontFamily:maru?'"PROM MaruBuri", serif':`"${font}", "Malgun Gothic", "Apple SD Gothic Neo", serif`,letterSpacing:(run.spacing||0)+'px',fontKerning:run.kerning&&(run.size||size)<run.kerning?'none':'normal',textDecoration:[run.underline&&run.underline!=='none'?'underline':'',run.strike&&run.strike!=='noStrike'?'line-through':''].filter(Boolean).join(' ')||'none',textTransform:run.capitalization==='all'?'uppercase':'none',fontVariantCaps:run.capitalization==='small'?'small-caps':'normal'});
     if(run.baseline){span.style.position='relative';span.style.top=-(run.baseline*(run.size||size))+'px';}
     p.appendChild(span);
    }
    if(!p.textContent)p.appendChild(document.createElement('br'));
    content.appendChild(p);
   }
   textFits.push(()=>{
    const padding=(shape.padding||[0,0,0,0]),w=Math.max(1,shape.w-padding[1]-padding[3]),h=Math.max(1,shape.h-padding[0]-padding[2]);
    content.style.width=w+'px';content.style.transform='none';content.style.marginLeft='0';frame.style.height='auto';
    const box=content.getBoundingClientRect(),cb=canvas.getBoundingClientRect(),sx=cb.width/slide.width||1,sy=cb.height/slide.height||1;
    let left=0,top=0,right=Math.max(w,content.scrollWidth),bottom=Math.max(content.offsetHeight,content.scrollHeight);
    for(const span of content.querySelectorAll('span'))for(const r of span.getClientRects()){left=Math.min(left,(r.left-box.left)/sx);top=Math.min(top,(r.top-box.top)/sy);right=Math.max(right,(r.right-box.left)/sx);bottom=Math.max(bottom,(r.bottom-box.top)/sy);}
    const width=right-left,height=bottom-top,scale=Math.min(1,w/Math.max(1,width),h/Math.max(1,height));
    frame.dataset.scale=String(scale);
    if(scale<.999){frame.style.height=height*scale+'px';content.style.transform=`translate(${(w-width*scale)/2-left*scale}px,${-top*scale}px) scale(${scale})`;}
   });
  }canvas.appendChild(el);
 }
 const fit=()=>{const scale=Math.min(host.clientWidth/slide.width,host.clientHeight/slide.height);canvas.style.transform=host.dataset.fill==='screen'?`translate(-50%,-50%) scale(${host.clientWidth/slide.width},${host.clientHeight/slide.height})`:`translate(-50%,-50%) scale(${scale})`;for(const fitText of textFits)fitText();};fit();const observer=new ResizeObserver(fit);observer.observe(host);const fontsDone=()=>{if(canvas.parentNode===host&&host.isConnected)fit();};document.fonts?.ready.then(fontsDone);document.fonts?.addEventListener('loadingdone',fontsDone);instances.set(host,{disconnect(){observer.disconnect();document.fonts?.removeEventListener('loadingdone',fontsDone);}});
}
function release(host){instances.get(host)?.disconnect();for(const el of host.querySelectorAll('.slide-host'))instances.get(el)?.disconnect();}
return {show,release};
})();
