window.CaptionImport=(()=>{
'use strict';
const NS={a:'http://schemas.openxmlformats.org/drawingml/2006/main',p:'http://schemas.openxmlformats.org/presentationml/2006/main',r:'http://schemas.openxmlformats.org/officeDocument/2006/relationships'};
const children=(e,name)=>Array.from(e?.children||[]).filter(x=>x.localName===name);
const first=(e,name)=>Array.from(e?.getElementsByTagNameNS('*',name)||[])[0];
const all=(e,name)=>Array.from(e?.getElementsByTagNameNS('*',name)||[]);
const direct=(e,name)=>children(e,name)[0];
function xml(s){const d=new DOMParser().parseFromString(s,'application/xml');if(d.getElementsByTagName('parsererror').length)throw Error('파일 내부 XML을 읽지 못했습니다.');return d;}
function resolve(base,target){if(target.startsWith('/'))return target.slice(1);const parts=base.split('/');parts.pop();for(const part of target.split('/')){if(part==='..')parts.pop();else if(part&&part!=='.')parts.push(part);}return parts.join('/');}
async function manuscript(file){return (await manuscriptRich(file)).lines;}
async function manuscriptRich(file){
 const buf=await file.arrayBuffer(),ext=file.name.split('.').pop().toLowerCase();let paras=[];
 if(ext==='hwp'){const parsed=await CaptionHwp(buf);paras=parsed.pages.map(p=>[...(p.num?[{text:p.num+' ',hex:'000000'}]:[]),...p.runs.map(r=>({text:r.t,hex:r.hex}))]);}
 else if(ext==='hwpx'||ext==='docx'){
  const z=await JSZip.loadAsync(buf),colors=new Map();
  if(ext==='hwpx'){const head=z.file('Contents/header.xml');if(head)for(const c of all(xml(await head.async('string')),'charPr'))colors.set(c.getAttribute('id'),c.getAttribute('textColor')||'#000000');}
  const names=ext==='hwpx'?Object.keys(z.files).filter(n=>/^Contents\/section\d+\.xml$/.test(n)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})):['word/document.xml'];
  for(const name of names){const f=z.file(name);if(!f)continue;const d=xml(await f.async('string'));for(const p of all(d,'p')){const runs=[];for(const r of children(p,ext==='hwpx'?'run':'r')){const color=ext==='hwpx'?colors.get(r.getAttribute('charPrIDRef')):first(r,'color')?.getAttributeNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','val');let text='';for(const t of all(r,'t'))text+=t.textContent;if(text)runs.push({text,hex:(color||'000000').replace('#','').toUpperCase()});}if(runs.length)paras.push(runs);}}
 }else if(ext==='txt')paras=new TextDecoder().decode(buf).split(/\r?\n/).map(text=>[{text,hex:'000000'}]);
 else throw Error('원고는 HWP, HWPX, DOCX, TXT를 선택하세요.');
 const richLines=[];
 for(const [paragraph,para] of paras.entries()){const chars=[];for(const r of para)for(const ch of r.text)chars.push({ch,hex:r.hex});let row=[];const flush=()=>{while(row.length&&/\s/.test(row[0].ch))row.shift();while(row.length&&/\s/.test(row[row.length-1].ch))row.pop();if(row.length){const runs=[];for(const c of row){const last=runs[runs.length-1];if(last?.hex===c.hex)last.text+=c.ch;else runs.push({text:c.ch,hex:c.hex});}richLines.push({text:row.map(c=>c.ch).join(''),runs,paragraph});}row=[];};for(const c of chars){if(c.ch==='\n'||c.ch==='\r')flush();else row.push(c);}flush();}
 if(!richLines.length)throw Error('원고 본문을 찾지 못했습니다.');return {lines:richLines.map(r=>r.text),richLines};
}

async function deck(file){if(!/\.pptx$/i.test(file.name))throw Error('PPTX 파일을 선택하세요. 구형 PPT는 PowerPoint에서 PPTX로 저장해 주세요.');const z=await JSZip.loadAsync(await file.arrayBuffer()),cache=new Map(),media=new Map(),warnings=new Set();
 async function doc(path){if(!cache.has(path)){const f=z.file(path);cache.set(path,f?xml(await f.async('string')):null);}return cache.get(path);}
 async function rels(path){const slash=path.lastIndexOf('/'),d=await doc(path.slice(0,slash+1)+'_rels/'+path.slice(slash+1)+'.rels');return new Map(all(d,'Relationship').filter(r=>r.getAttribute('TargetMode')!=='External').map(r=>[r.getAttribute('Id'),{path:resolve(path,r.getAttribute('Target')),type:r.getAttribute('Type')} ]));}
 async function relation(path,type){return [...(await rels(path)).values()].find(r=>r.type.endsWith('/'+type))?.path;}
 async function image(path){if(media.has(path))return media.get(path);const ext=path?.split('.').pop().toLowerCase(),mime={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',svg:'image/svg+xml',webp:'image/webp',bmp:'image/bmp'}[ext];if(!mime||!z.file(path)){warnings.add('일부 이미지 형식은 표시하지 못했습니다.');return null;}const result='data:'+mime+';base64,'+await z.file(path).async('base64');media.set(path,result);return result;}
 const pres=await doc('ppt/presentation.xml');if(!pres)throw Error('PPTX 프레젠테이션을 찾지 못했습니다.');const size=first(pres,'sldSz'),width=+(size?.getAttribute('cx')||9144000)/9525,height=+(size?.getAttribute('cy')||5143500)/9525,pr=await rels('ppt/presentation.xml');
 const paths=all(pres,'sldId').map(e=>pr.get(e.getAttributeNS(NS.r,'id'))?.path).filter(Boolean);if(!paths.length)throw Error('슬라이드가 없습니다.');if(paths.length>500)throw Error('한 번에 500장까지 불러올 수 있습니다.');
 const slides=[];
 for(const path of paths){const slide=await doc(path),layoutPath=await relation(path,'slideLayout'),layout=await doc(layoutPath||''),masterPath=layoutPath&&await relation(layoutPath,'slideMaster'),master=await doc(masterPath||''),themePath=masterPath&&await relation(masterPath,'theme'),theme=await doc(themePath||'');
  const palette={dk1:'000000',lt1:'FFFFFF',dk2:'1F497D',lt2:'EEECE1'},mapping={bg1:'lt1',tx1:'dk1',bg2:'lt2',tx2:'dk2',accent1:'accent1',accent2:'accent2',accent3:'accent3',accent4:'accent4',accent5:'accent5',accent6:'accent6',hlink:'hlink',folHlink:'folHlink'};
  const scheme=first(theme,'clrScheme');for(const item of Array.from(scheme?.children||[])){const c=item.firstElementChild;if(c)palette[item.localName]=c.localName==='sysClr'?c.getAttribute('lastClr'):c.getAttribute('val');}
  for(const d of [master,layout,slide]){const cm=d===master?first(d,'clrMap'):first(d,'overrideClrMapping');if(cm)for(const attr of Array.from(cm.attributes))mapping[attr.localName]=attr.value;}
  const preset={black:'000000',white:'FFFFFF',red:'FF0000',green:'008000',blue:'0000FF',yellow:'FFFF00',gray:'808080',grey:'808080',ltGray:'D3D3D3',dkGray:'A9A9A9',orange:'FFA500',purple:'800080',transparent:'000000'};
  function color(el,fallback,placeholder){
   if(!el)return fallback;const c=Array.from(el.children||[]).find(e=>['srgbClr','schemeClr','sysClr','prstClr','scrgbClr','hslClr'].includes(e.localName))||el;
   let value=c.localName==='schemeClr'?(c.getAttribute('val')==='phClr'?placeholder:palette[mapping[c.getAttribute('val')]||c.getAttribute('val')]):c.localName==='sysClr'?c.getAttribute('lastClr'):c.localName==='prstClr'?preset[c.getAttribute('val')]:c.getAttribute('val');
   if(c.localName==='scrgbClr')value=['r','g','b'].map(k=>Math.round(Math.max(0,Math.min(1,+c.getAttribute(k)/100000))*255).toString(16).padStart(2,'0')).join('');
   if(!/^[a-f\d]{6}([a-f\d]{2})?$/i.test(value||''))return fallback;
   let rgb=[0,2,4].map(i=>parseInt(value.slice(i,i+2),16)/255),alpha=value.length===8?parseInt(value.slice(6),16)/255:1;
   const toHsl=()=>{const [r,g,b]=rgb,max=Math.max(...rgb),min=Math.min(...rgb),delta=max-min,l=(max+min)/2;return [delta?(max===r?((g-b)/delta+6)%6:max===g?(b-r)/delta+2:(r-g)/delta+4)/6:0,delta?delta/(1-Math.abs(2*l-1)):0,l];};
   const fromHsl=([h,s,l])=>{h=(h%1+1)%1;const a=s*Math.min(l,1-l);return [0,8,4].map(n=>{const k=(n+h*12)%12;return l-a*Math.max(-1,Math.min(k-3,9-k,1));});};
   for(const t of Array.from(c.children||[])){const v=+(t.getAttribute('val')||0)/100000;switch(t.localName){case 'alpha':alpha=v;break;case 'alphaMod':alpha*=v;break;case 'alphaOff':alpha+=v;break;case 'tint':rgb=rgb.map(n=>n+(1-n)*v);break;case 'shade':rgb=rgb.map(n=>n*v);break;case 'lumMod':case 'lumOff':case 'satMod':case 'satOff':{const hsl=toHsl(),at=t.localName.startsWith('lum')?2:1;hsl[at]=Math.max(0,Math.min(1,t.localName.endsWith('Mod')?hsl[at]*v:hsl[at]+v));rgb=fromHsl(hsl);break;}}}
   const hex=rgb.map(n=>Math.round(Math.max(0,Math.min(1,n))*255).toString(16).padStart(2,'0')).join('');return '#'+hex+(alpha<1?Math.round(Math.max(0,Math.min(1,alpha))*255).toString(16).padStart(2,'0'):'');
  }
  function fillStyle(node,placeholder){if(!node)return null;const solid=direct(node,'solidFill');if(solid)return {color:color(solid,'transparent',placeholder)};const grad=direct(node,'gradFill');if(grad){const stops=children(direct(grad,'gsLst'),'gs').map(gs=>({offset:+gs.getAttribute('pos')/100000,color:color(gs,'#ffffff',placeholder)}));return {color:stops[0]?.color||'#ffffff',fill:{type:direct(grad,'path')?'radial':'linear',angle:+(direct(grad,'lin')?.getAttribute('ang')||0)/60000,stops}};}return direct(node,'noFill')?{color:'transparent'}:null;}
  function referencedFill(ref){if(!ref)return null;const idx=+ref.getAttribute('idx'),list=first(theme,idx>=1001?'bgFillStyleLst':'fillStyleLst'),node=list?.children[(idx>=1001?idx-1001:idx-1)];if(!node)return {color:color(ref,'#ffffff')};const wrapper=node.ownerDocument.createElement('fill');wrapper.appendChild(node.cloneNode(true));return fillStyle(wrapper,(color(ref,'#ffffff')||'').replace('#',''));}
  const tree=d=>first(d,'spTree'),ph=e=>first(e,'ph');const match=(d,e)=>{const p=ph(e);if(!p)return null;return children(tree(d),'sp').find(s=>{const t=ph(s);return t&&(t.getAttribute('idx')||'0')===(p.getAttribute('idx')||'0')&&(t.getAttribute('type')||'body')===(p.getAttribute('type')||'body');});};
  const shapes=[],text=[];let background='#ffffff',backgroundImage=null,backgroundFill=null;
  for(const [d,source] of [[master,masterPath],[layout,layoutPath],[slide,path]]){const bg=direct(first(d,'cSld'),'bg');if(!bg)continue;const props=direct(bg,'bgPr'),style=fillStyle(props)||referencedFill(direct(bg,'bgRef'));background=style?.color||'#ffffff';backgroundFill=style?.fill||null;const blip=first(direct(props,'blipFill'),'blip');if(blip&&source){const rel=(await rels(source)).get(blip.getAttributeNS(NS.r,'embed'));backgroundImage=rel?await image(rel.path):null;}else backgroundImage=null;}
  if(backgroundImage)shapes.push({type:'image',background:true,x:0,y:0,w:width,h:height,src:backgroundImage});
  async function renderShape(el,source,inherited=[],group={a:1,b:0,c:0,d:1,tx:0,ty:0}){
   if(el.localName==='grpSp'){
    const x=direct(direct(el,'grpSpPr'),'xfrm'),off=direct(x,'off'),ext=direct(x,'ext'),co=direct(x,'chOff'),ce=direct(x,'chExt'),ox=+(off?.getAttribute('x')||0)/9525,oy=+(off?.getAttribute('y')||0)/9525,w=+(ext?.getAttribute('cx')||9525)/9525,h=+(ext?.getAttribute('cy')||9525)/9525,sx=w/(+(ce?.getAttribute('cx')||9525)/9525),sy=h/(+(ce?.getAttribute('cy')||9525)/9525),angle=+(x?.getAttribute('rot')||0)/60000*Math.PI/180,cs=Math.cos(angle),sn=Math.sin(angle),fx=['1','true'].includes(x?.getAttribute('flipH'))?-1:1,fy=['1','true'].includes(x?.getAttribute('flipV'))?-1:1;
    const a=cs*fx*sx,b=sn*fx*sx,c=-sn*fy*sy,d=cs*fy*sy,cx=+(co?.getAttribute('x')||0)/9525+w/sx/2,cy=+(co?.getAttribute('y')||0)/9525+h/sy/2,tx=ox+w/2-a*cx-c*cy,ty=oy+h/2-b*cx-d*cy,g={a:group.a*a+group.c*b,b:group.b*a+group.d*b,c:group.a*c+group.c*d,d:group.b*c+group.d*d,tx:group.a*tx+group.c*ty+group.tx,ty:group.b*tx+group.d*ty+group.ty};
    for(const e of Array.from(el.children))if(['sp','pic','grpSp'].includes(e.localName))await renderShape(e,source,[],g);return;
   }
   if(['1','true'].includes(first(el,'cNvPr')?.getAttribute('hidden')))return;
   const chain=[el,...inherited].filter(Boolean),transforms=chain.map(e=>direct(direct(e,'spPr'),'xfrm')).filter(Boolean),x=transforms[0],off=transforms.map(e=>direct(e,'off')).find(Boolean),ext=transforms.map(e=>direct(e,'ext')).find(Boolean);if(!off||!ext)return;
   const ox=+off.getAttribute('x')/9525,oy=+off.getAttribute('y')/9525,ow=+ext.getAttribute('cx')/9525,oh=+ext.getAttribute('cy')/9525,sx=Math.hypot(group.a,group.b),sy=Math.hypot(group.c,group.d),cx=group.a*(ox+ow/2)+group.c*(oy+oh/2)+group.tx,cy=group.b*(ox+ow/2)+group.d*(oy+oh/2)+group.ty;
   const rect={x:cx-ow*sx/2,y:cy-oh*sy/2,w:ow*sx,h:oh*sy,rotate:Math.atan2(group.b,group.a)*180/Math.PI+(+x.getAttribute('rot')/60000||0),flipH:['1','true'].includes(x.getAttribute('flipH')),flipV:['1','true'].includes(x.getAttribute('flipV'))!==(group.a*group.d-group.b*group.c<0)};
   if(el.localName==='pic'){
    const fill=direct(el,'blipFill'),blip=direct(fill,'blip'),svg=first(blip,'svgBlip'),relationships=await rels(source),rel=relationships.get((svg||blip)?.getAttributeNS(NS.r,'embed'));const src=rel&&await image(rel.path),crop=direct(fill,'srcRect');
    if(src)shapes.push({type:'image',...rect,src,...(crop?{crop:Object.fromEntries(['l','t','r','b'].map(k=>[k,+(crop.getAttribute(k)||0)/100000]))}:{}),opacity:+(first(blip,'alphaModFix')?.getAttribute('amt')??100000)/100000});return;
   }
   const props=direct(el,'spPr'),paint=fillStyle(props)||referencedFill(direct(direct(el,'style'),'fillRef')),ln=direct(props,'ln'),line=ln&&!direct(ln,'noFill')?{width:+(ln.getAttribute('w')||12700)/9525,color:color(direct(ln,'solidFill'),'#000000')}:null,geom=direct(props,'prstGeom')?.getAttribute('prst')||'rect';
   if(paint&&paint.color!=='transparent'||line)shapes.push({type:'rect',...rect,color:paint?.color||'transparent',...(paint?.fill?{fill:paint.fill}:{}),geom,line});
   const tx=direct(el,'txBody');if(!tx)return;
   const bodies=chain.map(e=>direct(direct(e,'txBody'),'bodyPr')).filter(Boolean);
   const value=(nodes,name,fallback)=>nodes.filter(Boolean).find(e=>e.hasAttribute(name))?.getAttribute(name)??fallback;
   const child=(nodes,name)=>nodes.filter(Boolean).map(e=>direct(e,name)).find(Boolean);
   const attr=(name,fallback)=>value(bodies,name,fallback);
   const fit=bodies.map(e=>Array.from(e.children).find(n=>['normAutofit','noAutofit','spAutoFit'].includes(n.localName))).find(Boolean);
   const fontScale=fit?.localName==='normAutofit'?+(fit.getAttribute('fontScale')||100000)/100000:1;
   const lineReduction=fit?.localName==='normAutofit'?+(fit.getAttribute('lnSpcReduction')||0)/100000:0;
   const type=ph(el)?.getAttribute('type')||'body';
   const style=first(master,['title','ctrTitle'].includes(type)?'titleStyle':ph(el)?'bodyStyle':'otherStyle');
   const fontName=(name,script)=>{if(!name?.startsWith('+'))return name||'Malgun Gothic';const group=first(theme,name.startsWith('+mj')?'majorFont':'minorFont');return children(group,'font').find(n=>n.getAttribute('script')==='Hang')?.getAttribute('typeface')||direct(group,script)?.getAttribute('typeface')||direct(group,'latin')?.getAttribute('typeface')||'Malgun Gothic';};
   const spacing=(nodes,name)=>{const node=child(nodes,name),pct=direct(node,'spcPct'),pts=direct(node,'spcPts');return pct?{unit:'ratio',value:+pct.getAttribute('val')/100000}:pts?{unit:'px',value:+pts.getAttribute('val')/100*96/72}:null;};
   const paragraphs=[];
   for(const p of children(tx,'p')){
    const ppr=direct(p,'pPr'),level=+(ppr?.getAttribute('lvl')||0),levelName='lvl'+(level+1)+'pPr';
    const inheritedStyles=chain.flatMap((e,i)=>[direct(direct(direct(e,'txBody'),'lstStyle'),levelName),...(i?[direct(children(direct(e,'txBody'),'p')[0],'pPr')]:[])]);
    const pchain=[ppr,...inheritedStyles,direct(style,levelName),direct(first(pres,'defaultTextStyle'),levelName)].filter(Boolean);
    const defaults=pchain.map(n=>direct(n,'defRPr')).filter(Boolean),runs=[];
    const makeRun=(rp,text)=>{const rc=[rp,...defaults].filter(Boolean),font=fontName(child(rc,'ea')?.getAttribute('typeface')||child(rc,'latin')?.getAttribute('typeface'),'ea');return {text,size:+value(rc,'sz',2800)/100*96/72*fontScale,bold:['1','true'].includes(value(rc,'b','0')),italic:['1','true'].includes(value(rc,'i','0')),font,color:color(child(rc,'solidFill'),'#000000'),spacing:+value(rc,'spc',0)/100*96/72*fontScale,baseline:+value(rc,'baseline',0)/100000,underline:value(rc,'u','none'),strike:value(rc,'strike','noStrike'),kerning:+value(rc,'kern',0)/100*96/72,capitalization:value(rc,'cap','none')};};
    for(const r of Array.from(p.children)){
     if(r.localName==='br'){runs.push({...makeRun(direct(r,'rPr'),'\n'),break:true});continue;}
     if(r.localName==='tab'){runs.push(makeRun(null,'\t'));continue;}
     if(!['r','fld'].includes(r.localName))continue;
     runs.push(makeRun(direct(r,'rPr'),first(r,'t')?.textContent||''));
    }
    const empty=makeRun(direct(p,'endParaRPr'),'');
    paragraphs.push({align:({ctr:'center',r:'right',just:'justify',dist:'justify'})[value(pchain,'algn','l')]||'left',runs,defaultSize:empty.size,lineSpacing:spacing(pchain,'lnSpc'),spaceBefore:spacing(pchain,'spcBef'),spaceAfter:spacing(pchain,'spcAft'),marginLeft:+value(pchain,'marL',0)/9525,marginRight:+value(pchain,'marR',0)/9525,indent:+value(pchain,'indent',0)/9525,tabSize:+value(pchain,'defTabSz',914400)/9525});
   }
   const fontFactor=Math.sqrt(sx*sy);if(fontFactor!==1)for(const p of paragraphs){p.defaultSize*=fontFactor;for(const k of ['marginLeft','marginRight','indent','tabSize'])p[k]*=sx;for(const spacing of [p.lineSpacing,p.spaceBefore,p.spaceAfter])if(spacing?.unit==='px')spacing.value*=fontFactor;for(const r of p.runs){r.size*=fontFactor;r.spacing*=fontFactor;r.kerning*=fontFactor;}}
   if(source===path)text.push(paragraphs.map(p=>p.runs.map(r=>r.text).join('')).join('\n'));
   shapes.push({type:'text',...rect,pptxText:true,autoFit:fit?.localName||'noAutofit',paragraphs,anchor:attr('anchor','t'),wrap:attr('wrap','square')!=='none',lineReduction,padding:[attr('tIns',45720),attr('rIns',91440),attr('bIns',45720),attr('lIns',91440)].map((n,i)=>+n/9525*(i%2?sx:sy))});
  }
  for(const [d,source] of [[master,masterPath],[layout,layoutPath]]){if(!d)continue;if(slide.documentElement.getAttribute('showMasterSp')==='0'||d===master&&layout?.documentElement.getAttribute('showMasterSp')==='0')continue;for(const el of Array.from(tree(d)?.children||[]))if(['sp','pic','grpSp'].includes(el.localName)&&!ph(el))await renderShape(el,source);}
  for(const el of Array.from(tree(slide)?.children||[])){if(!['sp','pic','grpSp'].includes(el.localName))continue;const ls=match(layout,el),ms=match(master,ls||el);await renderShape(el,path,[ls,ms]);}
  if(first(slide,'graphicFrame')||first(slide,'oleObj')||first(slide,'videoFile'))warnings.add('표·차트·동영상은 원본 이미지로 바꿔 넣으면 더 정확합니다.');
  slides.push({renderVersion:2,sourceLayoutName:first(layout,'cSld')?.getAttribute('name')||layout?.documentElement.getAttribute('matchingName')||'',text:text.join('\n').trim(),background,backgroundFill,preserveGeometry:true,width,height,shapes});
 }
 let cues=null;const cuesFile=z.file('prom/cues.json');if(cuesFile){try{cues=JSON.parse(await cuesFile.async('string'));
 // Template/master images already stored as PPTX media need not be embedded again in the JSON.
 const restored=new Map();async function restoreMedia(value){if(!value||typeof value!=='object')return;if(typeof value.src==='string'&&value.src.startsWith('@prom-pptx-media:')){const name=value.src.slice(17),match=name.match(/^image\d+\.(png|jpeg|gif|bmp|svg|webp)$/);if(!match)throw Error('잘못된 템플릿 그림 참조');if(!restored.has(name)){const asset=z.file('ppt/media/'+name);if(!asset)throw Error('템플릿 그림 누락');restored.set(name,'data:image/'+(match[1]==='svg'?'svg+xml':match[1])+';base64,'+await asset.async('base64'));}value.src=restored.get(name);}for(const child of Object.values(value))if(child&&typeof child==='object')await restoreMedia(child);}await restoreMedia(cues);
 if(cues.version===1&&cues.editors?.length===slides.length)cues.editors.forEach((e,i)=>{slides[i].uid=e.uid;slides[i].layoutName=e.layoutName;slides[i].sourceLayoutName=e.sourceLayoutName||cues.generationTemplate?.layoutCatalog?.find(l=>l.key===e.editor?.layout)?.name||slides[i].sourceLayoutName;slides[i].editor=e.editor;slides[i].bodyIndex=e.bodyIndex;slides[i].masterId=e.masterId;slides[i].backgroundEdited=!!e.backgroundEdited;slides[i].preserveGeometry=e.preserveGeometry??true;(e.masterSlots||[]).forEach((slot,at)=>{if(slot&&slides[i].shapes[at])slides[i].shapes[at].masterSlot=slot;});for(const [key,flag] of [['extraImageShapes','extraImage'],['extraShapeShapes','extraShape'],['editorBackgroundShapes','editorBackground']])for(const at of e[key]||[])if(slides[i].shapes[at])slides[i].shapes[at][flag]=true;for(const at of e.extraTextShapes||[])if(slides[i].shapes[at])slides[i].shapes[at].extraText=true;for(const at of e.manualShapes||[])if(slides[i].shapes[at])slides[i].shapes[at].manualGeometry=true;});}catch{warnings.add('저장된 원고 연결 정보는 읽지 못했습니다.');}}
 return {slides,warnings:[...warnings],cues};
}
return {manuscript,manuscriptRich,deck};
})();
