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
 for(const para of paras){const chars=[];for(const r of para)for(const ch of r.text)chars.push({ch,hex:r.hex});let row=[];const flush=()=>{while(row.length&&/\s/.test(row[0].ch))row.shift();while(row.length&&/\s/.test(row[row.length-1].ch))row.pop();if(row.length){const runs=[];for(const c of row){const last=runs[runs.length-1];if(last?.hex===c.hex)last.text+=c.ch;else runs.push({text:c.ch,hex:c.hex});}richLines.push({text:row.map(c=>c.ch).join(''),runs});}row=[];};for(const c of chars){if(c.ch==='\n'||c.ch==='\r')flush();else row.push(c);}flush();}
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
  const palette={tx1:'000000',bg1:'FFFFFF',tx2:'FFFFFF',bg2:'000000'};const scheme=first(theme,'clrScheme');for(const item of Array.from(scheme?.children||[])){const c=item.firstElementChild;if(c)palette[item.localName]=c.getAttribute('val')||c.getAttribute('lastClr');}const cm=first(master,'clrMap');for(const key of ['tx1','tx2','bg1','bg2'])if(cm?.getAttribute(key))palette[key]=palette[cm.getAttribute(key)]||palette[key];
  function color(el,fallback){if(!el)return fallback;const sr=first(el,'srgbClr'),sc=first(el,'schemeClr'),sys=first(el,'sysClr');const value=sr?.getAttribute('val')||(sc&&palette[sc.getAttribute('val')])||sys?.getAttribute('lastClr');return /^[a-f\d]{6}$/i.test(value||'')?'#'+value:fallback;}
  const tree=d=>first(d,'spTree'),ph=e=>first(e,'ph');const match=(d,e)=>{const p=ph(e);if(!p)return null;return children(tree(d),'sp').find(s=>{const t=ph(s);return t&&(t.getAttribute('idx')||'0')===(p.getAttribute('idx')||'0')&&(t.getAttribute('type')||'body')===(p.getAttribute('type')||'body');});};
  const shapes=[],text=[];let background='#00ff00',backgroundImage=null;
  for(const [d,source] of [[master,masterPath],[layout,layoutPath],[slide,path]]){const bg=first(d,'bgPr');if(!bg)continue;background=color(direct(bg,'solidFill'),background);const blip=first(direct(bg,'blipFill'),'blip');if(blip&&source){const rel=(await rels(source)).get(blip.getAttributeNS(NS.r,'embed'));backgroundImage=rel?await image(rel.path):null;}else backgroundImage=null;}
  if(backgroundImage)shapes.push({type:'image',background:true,x:0,y:0,w:width,h:height,src:backgroundImage});
  async function renderShape(el,source,inherited=[]){
   if(el.localName==='grpSp'){warnings.add('그룹 개체는 원본과 위치가 다를 수 있습니다.');for(const e of Array.from(el.children))if(['sp','pic'].includes(e.localName))await renderShape(e,source);return;}
   const chain=[el,...inherited].filter(Boolean),x=chain.map(e=>first(direct(e,'spPr'),'xfrm')).find(Boolean);if(!x)return;const off=first(x,'off'),ext=first(x,'ext');if(!off||!ext)return;const rect={x:+off.getAttribute('x')/9525,y:+off.getAttribute('y')/9525,w:+ext.getAttribute('cx')/9525,h:+ext.getAttribute('cy')/9525,rotate:+x.getAttribute('rot')/60000||0};
   if(el.localName==='pic'){const blip=first(el,'blip'),rel=(await rels(source)).get(blip?.getAttributeNS(NS.r,'embed'));const src=rel&&await image(rel.path);if(src)shapes.push({type:'image',...rect,src});return;}
   const props=direct(el,'spPr'),fill=direct(props,'solidFill');if(fill)shapes.push({type:'rect',...rect,color:color(fill,'transparent')});
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
   if(source===path)text.push(paragraphs.map(p=>p.runs.map(r=>r.text).join('')).join('\n'));
   shapes.push({type:'text',...rect,paragraphs,anchor:attr('anchor','t'),wrap:attr('wrap','square')!=='none',lineReduction,padding:[attr('tIns',45720),attr('rIns',91440),attr('bIns',45720),attr('lIns',91440)].map(n=>+n/9525)});
  }
  for(const [d,source] of [[master,masterPath],[layout,layoutPath]]){if(!d)continue;if(slide.documentElement.getAttribute('showMasterSp')==='0')continue;for(const el of Array.from(tree(d)?.children||[]))if(['sp','pic','grpSp'].includes(el.localName)&&!ph(el))await renderShape(el,source);}
  for(const el of Array.from(tree(slide)?.children||[])){if(!['sp','pic','grpSp'].includes(el.localName))continue;const ls=match(layout,el),ms=match(master,ls||el);await renderShape(el,path,[ls,ms]);}
  if(first(slide,'graphicFrame')||first(slide,'oleObj')||first(slide,'videoFile'))warnings.add('표·차트·동영상은 원본 이미지로 바꿔 넣으면 더 정확합니다.');
  slides.push({renderVersion:2,sourceLayoutName:first(layout,'cSld')?.getAttribute('name')||layout?.documentElement.getAttribute('matchingName')||'',text:text.join('\n').trim(),background,width,height,shapes});
 }
 let cues=null;const cuesFile=z.file('prom/cues.json');if(cuesFile){try{cues=JSON.parse(await cuesFile.async('string'));if(cues.version===1&&cues.editors?.length===slides.length)cues.editors.forEach((e,i)=>{slides[i].uid=e.uid;slides[i].layoutName=e.layoutName;slides[i].sourceLayoutName=e.sourceLayoutName||cues.generationTemplate?.layoutCatalog?.find(l=>l.key===e.editor?.layout)?.name||slides[i].sourceLayoutName;slides[i].editor=e.editor;slides[i].bodyIndex=e.bodyIndex;slides[i].masterId=e.masterId;slides[i].backgroundEdited=!!e.backgroundEdited;for(const [key,flag] of [['extraImageShapes','extraImage'],['extraShapeShapes','extraShape'],['editorBackgroundShapes','editorBackground']])for(const at of e[key]||[])if(slides[i].shapes[at])slides[i].shapes[at][flag]=true;for(const at of e.extraTextShapes||[])if(slides[i].shapes[at])slides[i].shapes[at].extraText=true;for(const at of e.manualShapes||[])if(slides[i].shapes[at])slides[i].shapes[at].manualGeometry=true;});}catch{warnings.add('저장된 원고 연결 정보는 읽지 못했습니다.');}}
 return {slides,warnings:[...warnings],cues};
}
return {manuscript,manuscriptRich,deck};
})();
