window.CaptionRender=(()=>{
const instances=new WeakMap();
function show(host,slide,green='#00ff00'){
 const old=instances.get(host);old?.disconnect();host.replaceChildren();host.style.background=green;
 if(!slide)return;const canvas=document.createElement('div');canvas.className='slide-canvas';canvas.style.width=slide.width+'px';canvas.style.height=slide.height+'px';canvas.style.background=slide.background||green;host.appendChild(canvas);
 for(const shape of slide.shapes||[]){const el=document.createElement('div');el.className='slide-object';Object.assign(el.style,{left:shape.x+'px',top:shape.y+'px',width:shape.w+'px',height:shape.h+'px',transform:shape.rotate?`rotate(${shape.rotate}deg)`:''});
  if(shape.type==='image'){if(!/^data:image\/(png|jpeg|gif|webp|bmp|svg\+xml);base64,/.test(shape.src||''))continue;const img=document.createElement('img');img.src=shape.src;img.alt='';el.appendChild(img);}
  if(shape.type==='rect')el.style.background=shape.color;
  if(shape.type==='text'){el.classList.add('slide-text');el.style.justifyContent=shape.anchor==='ctr'?'center':shape.anchor==='b'?'flex-end':'flex-start';el.style.padding=(shape.padding||[0,0,0,0]).map(n=>n+'px').join(' ');
   el.style.whiteSpace=shape.wrap===false?'pre':'pre-wrap';el.style.fontSynthesis='none';
   for(const para of shape.paragraphs||[]){
    const p=document.createElement('div'),size=Math.max(0,...(para.runs||[]).map(r=>r.size||0))||para.defaultSize||30;
    const pixels=sp=>sp?(sp.unit==='px'?sp.value:sp.value*size):0;
    const line=para.lineSpacing;
    Object.assign(p.style,{textAlign:para.align||'left',fontSize:size+'px',lineHeight:line?(line.unit==='px'?Math.max(1,line.value*(1-(shape.lineReduction||0)))+'px':String(Math.max(.1,line.value-(shape.lineReduction||0)))):'normal',marginTop:pixels(para.spaceBefore)+'px',marginBottom:pixels(para.spaceAfter)+'px',paddingLeft:(para.marginLeft||0)+'px',paddingRight:(para.marginRight||0)+'px',textIndent:(para.indent||0)+'px',tabSize:(para.tabSize||96)+'px'});
    for(const run of para.runs||[]){
     const span=document.createElement('span');span.textContent=run.text;
     const font=String(run.font||'Malgun Gothic').replace(/[%"\\]/g,'');
     // These are separate named faces in PowerPoint, not browser-synthesized bold.
     const maru=/마루\s*부리|maru\s*buri/i.test(font),weight=maru?(/굵은|bold/i.test(font)&&!/semi/i.test(font)?700:/중간|semi/i.test(font)?600:/아주|extra/i.test(font)?200:/가는|light/i.test(font)?300:run.bold?700:400):run.bold?700:400;
     Object.assign(span.style,{fontSize:(run.size||size)+'px',fontWeight:String(weight),fontStyle:run.italic?'italic':'normal',color:run.color||'#000',fontFamily:maru?'"PROM MaruBuri", serif':`"${font}", "Malgun Gothic", "Apple SD Gothic Neo", serif`,letterSpacing:(run.spacing||0)+'px',fontKerning:run.kerning&&(run.size||size)<run.kerning?'none':'normal',textDecoration:[run.underline&&run.underline!=='none'?'underline':'',run.strike&&run.strike!=='noStrike'?'line-through':''].filter(Boolean).join(' ')||'none',textTransform:run.capitalization==='all'?'uppercase':'none',fontVariantCaps:run.capitalization==='small'?'small-caps':'normal'});
     if(run.baseline){span.style.position='relative';span.style.top=-(run.baseline*(run.size||size))+'px';}
     p.appendChild(span);
    }
    if(!p.textContent)p.appendChild(document.createElement('br'));
    el.appendChild(p);
   }
  }canvas.appendChild(el);
 }
 const fit=()=>{const scale=Math.min(host.clientWidth/slide.width,host.clientHeight/slide.height);canvas.style.transform=host.dataset.fill==='screen'?`translate(-50%,-50%) scale(${host.clientWidth/slide.width},${host.clientHeight/slide.height})`:`translate(-50%,-50%) scale(${scale})`;};fit();const observer=new ResizeObserver(fit);observer.observe(host);instances.set(host,observer);
}
function release(host){instances.get(host)?.disconnect();for(const el of host.querySelectorAll('.slide-host'))instances.get(el)?.disconnect();}
return {show,release};
})();
