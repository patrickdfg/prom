/* PPTX original-slide viewer: reads slide images, shapes and positioned text locally.
 * Text is kept separately in PROM's P[][] data for speech recognition and editing.
 * Advanced Office-only effects (animations, SmartArt, charts, unsupported custom geometry) are not rasterized.
 */
window.PromPptxOriginal = (() => {
  'use strict';
  const A='http://schemas.openxmlformats.org/drawingml/2006/main';
  const P='http://schemas.openxmlformats.org/presentationml/2006/main';
  const R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const RP='http://schemas.openxmlformats.org/package/2006/relationships';
  const EMU=914400, PT=12700;
  const MAX_SLIDES=300, MAX_MEDIA_BYTES=60*1024*1024;
  let active=null,revision=0;
  const by=(node,ns,name)=>node?.getElementsByTagNameNS(ns,name)?.[0]||null;
  const direct=(node,ns,name)=>[...(node?.children||[])].find(x=>x.namespaceURI===ns&&x.localName===name)||null;
  const kids=(node,ns,name)=>[...(node?.children||[])].filter(x=>x.namespaceURI===ns&&x.localName===name);
  const numeric=(v,defaultValue=0)=>Number.isFinite(Number(v))?Number(v):defaultValue;
  const xml=s=>new DOMParser().parseFromString(s,'application/xml');
  const validHex=v=>/^[A-Fa-f0-9]{6}$/.test(v||'')?'#'+v:'';
  function resolve(from,target){
    if(!target||/^[a-z]+:/i.test(target)||target.startsWith('//'))return '';
    const parts=target.startsWith('/')?[]:from.split('/').slice(0,-1);
    for(const token of target.split('/')){
      if(!token||token==='.')continue;
      if(token==='..')parts.pop();else parts.push(token);
    }
    return parts.join('/');
  }
  async function readXml(zip,path){const f=zip.file(path);return f?xml(await f.async('string')):null;}
  async function relationships(zip,sourcePath){
    const parts=sourcePath.split('/'),filename=parts.pop();
    const relDoc=await readXml(zip,parts.join('/')+'/_rels/'+filename+'.rels');
    const out={};
    for(const el of relDoc?.getElementsByTagNameNS(RP,'Relationship')||[]){
      if(el.getAttribute('TargetMode')==='External')continue;
      out[el.getAttribute('Id')]=resolve(sourcePath,el.getAttribute('Target'));
    }
    return out;
  }
  function color(el,fallback=''){
    if(!el)return fallback;
    const v=direct(el,A,'solidFill')||el;
    const rgb=direct(v,A,'srgbClr');
    const scheme=direct(v,A,'schemeClr');
    if(rgb)return validHex(rgb.getAttribute('val'))||fallback;
    const shades={dk1:'#000000',tx1:'#000000',lt1:'#FFFFFF',bg1:'#FFFFFF',accent1:'#4472C4',accent2:'#ED7D31',accent3:'#A5A5A5',accent4:'#FFC000',accent5:'#5B9BD5',accent6:'#70AD47'};
    return scheme?(shades[scheme.getAttribute('val')]||fallback):fallback;
  }
  function geometry(node,w,h){
    const xf=direct(node,A,'xfrm');
    const off=direct(xf,A,'off'),ext=direct(xf,A,'ext');
    return {
      x:numeric(off?.getAttribute('x'))/w,y:numeric(off?.getAttribute('y'))/h,
      w:numeric(ext?.getAttribute('cx'))/w,h:numeric(ext?.getAttribute('cy'))/h,
      rot:numeric(xf?.getAttribute('rot'))/60000,
      flipH:xf?.getAttribute('flipH')==='1',flipV:xf?.getAttribute('flipV')==='1'
    };
  }
  function parseRun(node,defaultSize=28){
    const rPr=direct(node,A,'rPr');
    const t=direct(node,A,'t');
    const sz=numeric(rPr?.getAttribute('sz'),defaultSize*100)/100;
    const font=direct(rPr,A,'ea')?.getAttribute('typeface')||direct(rPr,A,'latin')?.getAttribute('typeface')||'';
    return {t:t?.textContent||'',color:color(rPr,''),size:sz,
      bold:rPr?.getAttribute('b')==='1',italic:rPr?.getAttribute('i')==='1',
      underline:!!rPr?.getAttribute('u')&&rPr.getAttribute('u')!=='none',font};
  }
  function paragraphs(txBody){
    const out=[];
    for(const par of kids(txBody,A,'p')){
      const ppr=direct(par,A,'pPr');
      const ending=direct(par,A,'endParaRPr');
      const defaultSize=numeric(ending?.getAttribute('sz'),2800)/100;
      const lineNode=direct(direct(ppr,A,'lnSpc'),A,'spcPts');
      const linePts=lineNode?numeric(lineNode.getAttribute('val'))/100:null;
      let current=[];
      const save=()=>{const text=current.map(r=>r.t).join('');out.push({runs:current,text,align:ppr?.getAttribute('algn')||'l',linePts});current=[];};
      for(const item of par.children){
        if(item.namespaceURI!==A)continue;
        if(item.localName==='r'||item.localName==='fld')current.push(parseRun(item,defaultSize));
        if(item.localName==='br')save();
      }
      save();
    }
    return out;
  }
  const num=(n)=>Math.max(0,Math.min(1.5,numeric(n)));
  function drawingShape(el,dim){
    const spPr=direct(el,P,'spPr');
    const g=geometry(spPr,dim.w,dim.h);
    const tx=direct(el,P,'txBody');
    const body=direct(tx,A,'bodyPr');
    const preset=direct(spPr,A,'prstGeom')?.getAttribute('prst')||'rect';
    return {
      kind:'shape',...g,geom:preset,
      fill:color(spPr,''),border:color(direct(spPr,A,'ln'),''),
      borderW:numeric(direct(spPr,A,'ln')?.getAttribute('w'))/dim.w,
      margin:{
        l:numeric(body?.getAttribute('lIns'),91440)/dim.w,
        r:numeric(body?.getAttribute('rIns'),91440)/dim.w,
        t:numeric(body?.getAttribute('tIns'),45720)/dim.w,
        b:numeric(body?.getAttribute('bIns'),45720)/dim.w
      },
      vertical:body?.getAttribute('anchor')||'t',
      wrap:body?.getAttribute('wrap')!=='none',
      paragraphs:tx?paragraphs(tx):[]
    };
  }
  function drawingPicture(el,dim,relationships){
    const spPr=direct(el,P,'spPr'),g=geometry(spPr,dim.w,dim.h);
    const blip=by(direct(el,P,'blipFill'),A,'blip');
    const rel=blip?.getAttributeNS(R,'embed');
    return {kind:'image',...g,imagePath:relationships[rel]||''};
  }
  function slideBackground(sld){
    const bg=direct(direct(sld,P,'cSld'),P,'bg');
    const pr=direct(bg,P,'bgPr');
    return color(pr,'');
  }
  function mime(path){
    const ext=(path.split('.').pop()||'').toLowerCase();
    return ({png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',svg:'image/svg+xml'})[ext]||'';
  }
  async function parse(buf){
    if(!window.JSZip)throw new Error('PPTX 읽기 도구가 없습니다.');
    if(buf.byteLength>MAX_MEDIA_BYTES*2)throw new Error('PPTX 파일이 너무 큽니다. 120MB 이하로 줄여 주세요.');
    const zip=await JSZip.loadAsync(buf);
    const presentation=await readXml(zip,'ppt/presentation.xml');
    if(!presentation)throw new Error('올바른 PPTX 발표 파일이 아닙니다.');
    const size=by(presentation,P,'sldSz');
    const dim={w:numeric(size?.getAttribute('cx'),12192000),h:numeric(size?.getAttribute('cy'),6858000)};
    if(!dim.w||!dim.h)throw new Error('PPT 슬라이드 크기를 읽지 못했습니다.');
    const presRel=await relationships(zip,'ppt/presentation.xml');
    let paths=[...presentation.getElementsByTagNameNS(P,'sldId')]
      .map(el=>presRel[el.getAttributeNS(R,'id')]).filter(Boolean);
    if(!paths.length)paths=Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a,b)=>numeric(a.match(/\d+/)?.[0])-numeric(b.match(/\d+/)?.[0]));
    if(!paths.length)throw new Error('PPTX에 슬라이드가 없습니다.');
    if(paths.length>MAX_SLIDES)throw new Error('최대 300장까지 한 번에 불러올 수 있습니다.');
    const imageCache={},scenes=[],pages=[];
    let usedMedia=0;
    async function image(path){
      if(!path||!mime(path)||!zip.file(path))return '';
      if(imageCache[path])return imageCache[path];
      const file=zip.file(path),content=await file.async('uint8array');
      usedMedia+=content.length;
      if(usedMedia>MAX_MEDIA_BYTES)throw new Error('PPT 그림 데이터가 60MB를 넘습니다. 그림을 압축해 주세요.');
      let str='';
      // Limit stack size: chunk binary data before encoding.
      for(let i=0;i<content.length;i+=0x8000)str+=String.fromCharCode(...content.subarray(i,i+0x8000));
      return imageCache[path]='data:'+mime(path)+';base64,'+btoa(str);
    }
    for(const path of paths){
      const doc=await readXml(zip,path);if(!doc)continue;
      const rels=await relationships(zip,path);
      const layoutPath=Object.values(rels).find(v=>/^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(v));
      const layoutDoc=layoutPath?await readXml(zip,layoutPath):null;
      const layoutRels=layoutPath?await relationships(zip,layoutPath):{};
      const masterPath=Object.values(layoutRels).find(v=>/^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(v));
      const masterDoc=masterPath?await readXml(zip,masterPath):null;
      const masterRels=masterPath?await relationships(zip,masterPath):{};
      // Master and layout artwork belongs behind the slide. Their placeholders are hidden.
      const layers=[[masterDoc,masterRels,true],[layoutDoc,layoutRels,true],[doc,rels,false]];
      const objects=[];
      for(const [part,partRels,inherited] of layers){
        if(!part)continue;
        const tree=direct(direct(part.documentElement,P,'cSld'),P,'spTree');
        for(const node of tree?.children||[]){
          if(node.namespaceURI!==P)continue;
          if(inherited&&by(node,P,'ph'))continue;
          if(node.localName==='sp'){
            const shape=drawingShape(node,dim);
            if(inherited)for(const par of shape.paragraphs)par.rowIndex=-1;
            objects.push(shape);
          }
          if(node.localName==='pic')objects.push(drawingPicture(node,dim,partRels));
        }
      }
      for(const pic of objects.filter(x=>x.kind==='image'))pic.src=await image(pic.imagePath);
      let bg='',bgImage='';
      for(const [part,partRels] of [...layers].reverse()){
        if(!part)continue;
        const bgNode=direct(direct(part.documentElement,P,'cSld'),P,'bg');
        if(!bgNode)continue;
        bg=slideBackground(part.documentElement);
        const bgBlip=by(bgNode,A,'blip');
        bgImage=await image(partRels[bgBlip?.getAttributeNS(R,'embed')]||'');
        break; // A slide background takes precedence over its layout/master.
      }
      const lines=[];
      const textObjects=objects.filter(x=>x.kind==='shape'&&x.paragraphs.some(par=>par.rowIndex!==-1))
        .sort((a,b)=>Math.abs(a.y-b.y)>0.01?a.y-b.y:a.x-b.x);
      for(const obj of textObjects)for(const par of obj.paragraphs){
        par.rowIndex=lines.length;
        lines.push(par.runs.filter(r=>r.t).map(r=>({t:r.t,c:'k'})));
      }
      scenes.push({background:bg||'#FFFFFF',backgroundImage:bgImage,objects,aspect:dim.w/dim.h,slideWidth:dim.w});
      pages.push(lines);
    }
    if(!scenes.length)throw new Error('PPTX 슬라이드 내용을 읽지 못했습니다.');
    // Image-only slides are valid; voice recognition needs actual editable PPT text.
    return {pages,original:{slides:scenes,aspect:dim.w/dim.h}};
  }
  function installStyle(){
    if(document.getElementById('prom-pptx-style'))return;
    const style=document.createElement('style');style.id='prom-pptx-style';
    style.textContent='.prom-pptx-layer{position:absolute;inset:0;overflow:hidden;container-type:inline-size;pointer-events:none;z-index:1}' +
      '.prom-pptx-shape{position:absolute;box-sizing:border-box;overflow:hidden;display:flex;flex-direction:column;min-width:0;min-height:0}' +
      '.prom-pptx-text{display:flex;flex-direction:column;min-height:0;width:100%;box-sizing:border-box}' +
      '.prom-pptx-par{min-height:0;white-space:pre-wrap;overflow-wrap:anywhere}' +
      '.prom-pptx-par.read{opacity:.42}' +
      '.prom-pptx-picture{position:absolute;object-fit:fill}' +
      '#page.prom-pptx-mode #lines{visibility:hidden;pointer-events:none}' +
      '#page.prom-pptx-mode #nextCue{visibility:hidden}';
    document.head.appendChild(style);
  }
  const percent=n=>(num(n)*100)+'%';
  const units=(points,aspectW)=>((points*PT/aspectW)*100)+'cqw';
  function renderSlide(host,scene,rows=[],ranges=[],cursor=0,dim=false){
    installStyle();
    host.replaceChildren();
    if(!scene)return;
    host.classList.add('prom-pptx-layer');
    host.style.backgroundColor=scene.background||'#FFFFFF';
    host.style.color='#000000';
    host.style.backgroundImage=scene.backgroundImage?'url("'+scene.backgroundImage+'")':'';
    host.style.backgroundSize='100% 100%';
    const sw=scene.slideWidth||12192000;
    const remaining=[];
    const covered=new Set();
    for(const obj of scene.objects){
      if(obj.kind==='image'){
        if(!obj.src)continue;
        const el=document.createElement('img');el.className='prom-pptx-picture';
        el.src=obj.src;el.alt='';el.style.left=percent(obj.x);el.style.top=percent(obj.y);
        el.style.width=percent(obj.w);el.style.height=percent(obj.h);
        if(obj.rot)el.style.transform='rotate('+obj.rot+'deg)';
        host.appendChild(el);continue;
      }
      if(obj.kind!=='shape')continue;
      const shape=document.createElement('div');shape.className='prom-pptx-shape';
      shape.style.left=percent(obj.x);shape.style.top=percent(obj.y);
      shape.style.width=percent(obj.w);shape.style.height=percent(obj.h);
      if(obj.geom==='ellipse')shape.style.borderRadius='50%';
      else if(obj.geom==='roundRect')shape.style.borderRadius='8%';
      if(obj.fill)shape.style.backgroundColor=obj.fill;
      if(obj.border){shape.style.borderStyle='solid';shape.style.borderColor=obj.border;shape.style.borderWidth=(obj.borderW*100)+'cqw';}
      const transforms=[];if(obj.rot)transforms.push('rotate('+obj.rot+'deg)');if(obj.flipH)transforms.push('scaleX(-1)');if(obj.flipV)transforms.push('scaleY(-1)');
      if(transforms.length)shape.style.transform=transforms.join(' ');
      if(obj.paragraphs.length){
        const tx=document.createElement('div');tx.className='prom-pptx-text';
        tx.style.justifyContent=obj.vertical==='ctr'?'center':obj.vertical==='b'?'flex-end':'flex-start';
        tx.style.padding=[units(obj.margin.t*sw/PT,sw),units(obj.margin.r*sw/PT,sw),units(obj.margin.b*sw/PT,sw),units(obj.margin.l*sw/PT,sw)].join(' ');
        for(const par of obj.paragraphs){
          const row=document.createElement('div');row.className='prom-pptx-par';row.dataset.pptRow=String(par.rowIndex);
          row.style.textAlign=({ctr:'center',r:'right',just:'justify'})[par.align]||'left';
          const replacement=rows[par.rowIndex]||[];
          const newText=replacement.map(r=>r.t).join('');
          const useOriginal=par.rowIndex<0||par.text===newText;
          const visibleRuns=useOriginal?par.runs:replacement.map(r=>({...par.runs[0],t:r.t,color:r.c==='b'?'#FFFF00':r.c==='r'?'#FF0000':par.runs[0]?.color}));
          for(const run of visibleRuns){
            const span=document.createElement('span');span.textContent=run.t;
            span.style.fontSize=units(run.size||28,sw);
            span.style.fontFamily=run.font?run.font+', "Malgun Gothic",sans-serif':'"Malgun Gothic",sans-serif';
            if(run.color)span.style.color=run.color;
            span.style.fontWeight=run.bold?'700':'400';
            if(run.italic)span.style.fontStyle='italic';
            if(run.underline)span.style.textDecoration='underline';
            row.appendChild(span);
          }
          if(par.linePts)row.style.lineHeight=units(par.linePts,sw);
          const r=ranges?.[par.rowIndex];
          if(dim&&r&&r[1]>r[0]&&cursor>=r[1])row.classList.add('read');
          tx.appendChild(row);covered.add(par.rowIndex);
        }
        shape.appendChild(tx);
      }
      host.appendChild(shape);
    }
    for(let i=0;i<rows.length;i++)if(!covered.has(i)&&rows[i]?.some(r=>r.t.trim()))remaining.push(rows[i].map(r=>r.t).join(''));
    if(remaining.length){
      const extra=document.createElement('div');
      extra.style.cssText='position:absolute;bottom:1%;left:2%;right:2%;padding:1%;border-radius:6px;background:rgba(0,0,0,.75);color:white;text-align:center;font-size:2.6cqw;white-space:pre-wrap;';
      extra.textContent=remaining.join('\n');host.appendChild(extra);
    }
  }
  function activate(data){
    active=data?.slides?.length?data:null;
    revision++;
    installStyle();
    return !!active;
  }
  function clear(){active=null;revision++;document.getElementById('pptxOriginalLayer')?.remove();document.getElementById('page')?.classList.remove('prom-pptx-mode');}
  function isActive(){return !!active;}
  function aspect(){return active?.aspect||null;}
  function slide(i){return active?.slides?.[i]||null;}
  function key(i){return active?'ppt-'+revision+'-'+i:null;}
  function syncPages(pages){
    if(!active)return;
    while(active.slides.length<pages.length)active.slides.push({background:'#FFFFFF',objects:[],aspect:active.aspect,slideWidth:active.slides[0]?.slideWidth||12192000});
    if(active.slides.length>pages.length)active.slides.length=pages.length;
    revision++;
  }
  function show(i,rows,ranges,cursor,dim,editing=false){
    const page=document.getElementById('page');if(!page)return;
    if(!active){page.classList.remove('prom-pptx-mode');document.getElementById('pptxOriginalLayer')?.remove();return;}
    let el=document.getElementById('pptxOriginalLayer');
    if(editing){page.classList.remove('prom-pptx-mode');if(el)el.hidden=true;return;}
    page.classList.add('prom-pptx-mode');
    if(!el){el=document.createElement('div');el.id='pptxOriginalLayer';page.appendChild(el);}
    el.hidden=false;
    const renderKey=key(i)+':'+JSON.stringify(rows||[]);
    if(el.dataset.renderKey!==renderKey){
      renderSlide(el,slide(i),rows,ranges,cursor,dim);
      el.dataset.renderKey=renderKey;
    }
    for(const row of el.querySelectorAll('[data-ppt-row]')){
      const r=ranges?.[Number(row.dataset.pptRow)];
      row.classList.toggle('read',!!dim&&!!r&&r[1]>r[0]&&cursor>=r[1]);
    }
  }
  return {parse,activate,clear,isActive,aspect,slide,key,syncPages,show,renderSlide};
})();