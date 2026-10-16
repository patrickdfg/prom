window.CaptionImport=(()=>{
'use strict';
const NS={a:'http://schemas.openxmlformats.org/drawingml/2006/main',p:'http://schemas.openxmlformats.org/presentationml/2006/main',r:'http://schemas.openxmlformats.org/officeDocument/2006/relationships'};
const children=(e,name)=>Array.from(e?.children||[]).filter(x=>x.localName===name);
const first=(e,name)=>Array.from(e?.getElementsByTagNameNS('*',name)||[])[0];
const all=(e,name)=>Array.from(e?.getElementsByTagNameNS('*',name)||[]);
const direct=(e,name)=>children(e,name)[0];
function xml(s){const d=new DOMParser().parseFromString(s,'application/xml');if(d.getElementsByTagName('parsererror').length)throw Error('파일 내부 XML을 읽지 못했습니다.');return d;}
function resolve(base,target){if(target.startsWith('/'))return target.slice(1);const parts=base.split('/');parts.pop();for(const part of target.split('/')){if(part==='..')parts.pop();else if(part&&part!=='.')parts.push(part);}return parts.join('/');}
async function manuscript(file){const buf=await file.arrayBuffer(),ext=file.name.split('.').pop().toLowerCase();let lines;
 if(ext==='hwp'){const parsed=await CaptionHwp(buf);lines=parsed.pages.map(p=>(p.num?p.num+' ':'')+p.runs.map(r=>r.t).join(''));}
 else if(ext==='hwpx'||ext==='docx'){const z=await JSZip.loadAsync(buf);const names=ext==='hwpx'?Object.keys(z.files).filter(n=>/^Contents\/section\d+\.xml$/.test(n)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})):['word/document.xml'];lines=[];for(const n of names){const entry=z.file(n);if(!entry)continue;const d=xml(await entry.async('string'));for(const p of all(d,'p')){const texts=all(p,'t').map(t=>t.textContent);if(texts.length)lines.push(texts.join(''));}}}
 else if(ext==='txt')lines=new TextDecoder().decode(buf).split(/\r?\n/);
 else throw Error('원고는 HWP, HWPX, DOCX, TXT를 선택하세요.');
 lines=lines.flatMap(s=>s.split(/\r?\n/)).map(s=>s.trim()).filter(Boolean);if(!lines.length)throw Error('원고 본문을 찾지 못했습니다.');return lines;
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
  const shapes=[],text=[];let background='#00ff00';for(const d of [master,layout,slide]){const bg=first(d,'bgPr');if(bg)background=color(direct(bg,'solidFill'),background);}
  async function renderShape(el,source,inherited=[]){
   if(el.localName==='grpSp'){warnings.add('그룹 개체는 원본과 위치가 다를 수 있습니다.');for(const e of Array.from(el.children))if(['sp','pic'].includes(e.localName))await renderShape(e,source);return;}
   const chain=[el,...inherited].filter(Boolean),x=chain.map(e=>first(direct(e,'spPr'),'xfrm')).find(Boolean);if(!x)return;const off=first(x,'off'),ext=first(x,'ext');if(!off||!ext)return;const rect={x:+off.getAttribute('x')/9525,y:+off.getAttribute('y')/9525,w:+ext.getAttribute('cx')/9525,h:+ext.getAttribute('cy')/9525,rotate:+x.getAttribute('rot')/60000||0};
   if(el.localName==='pic'){const blip=first(el,'blip'),rel=(await rels(source)).get(blip?.getAttributeNS(NS.r,'embed'));const src=rel&&await image(rel.path);if(src)shapes.push({type:'image',...rect,src});return;}
   const props=direct(el,'spPr'),fill=direct(props,'solidFill');if(fill)shapes.push({type:'rect',...rect,color:color(fill,'transparent')});
   const tx=direct(el,'txBody');if(!tx)return;const bodies=chain.map(e=>direct(direct(e,'txBody'),'bodyPr')).filter(Boolean);const attr=(name,fallback)=>bodies.map(e=>e.getAttribute(name)).find(v=>v!==null)??fallback;const paragraphs=[];
   for(const p of children(tx,'p')){const ppr=direct(p,'pPr'),level=+(ppr?.getAttribute('lvl')||0);const def=direct(ppr,'defRPr')||chain.map(e=>first(direct(direct(e,'txBody'),'lstStyle'),'lvl'+(level+1)+'pPr')).map(e=>direct(e,'defRPr')).find(Boolean)||first(first(master,'titleStyle'),'defRPr');const runs=[];
    for(const r of Array.from(p.children)){if(r.localName==='br'){runs.push({text:'\n'});continue;}if(!['r','fld'].includes(r.localName))continue;const rp=direct(r,'rPr'),t=first(r,'t')?.textContent||'';const font=first(rp,'ea')?.getAttribute('typeface')||first(rp,'latin')?.getAttribute('typeface')||first(def,'ea')?.getAttribute('typeface')||'Malgun Gothic';runs.push({text:t,size:+(rp?.getAttribute('sz')||def?.getAttribute('sz')||2800)/100*96/72,bold:(rp?.getAttribute('b')||def?.getAttribute('b'))==='1',italic:rp?.getAttribute('i')==='1',font:font.startsWith('+')?'Malgun Gothic':font,color:color(direct(rp,'solidFill'),color(direct(def,'solidFill'),'#000000'))});}
    paragraphs.push({align:({ctr:'center',r:'right',just:'justify'})[ppr?.getAttribute('algn')]||'left',runs});
   }
   if(source===path)text.push(paragraphs.map(p=>p.runs.map(r=>r.text).join('')).join('\n'));
   shapes.push({type:'text',...rect,paragraphs,anchor:attr('anchor','t'),padding:[attr('tIns',45720),attr('rIns',91440),attr('bIns',45720),attr('lIns',91440)].map(n=>+n/9525)});
  }
  for(const [d,source] of [[master,masterPath],[layout,layoutPath]]){if(!d)continue;if(slide.documentElement.getAttribute('showMasterSp')==='0')continue;for(const el of Array.from(tree(d)?.children||[]))if(['sp','pic','grpSp'].includes(el.localName)&&!ph(el))await renderShape(el,source);}
  for(const el of Array.from(tree(slide)?.children||[])){if(!['sp','pic','grpSp'].includes(el.localName))continue;const ls=match(layout,el),ms=match(master,ls||el);await renderShape(el,path,[ls,ms]);}
  if(first(slide,'graphicFrame')||first(slide,'oleObj')||first(slide,'videoFile'))warnings.add('표·차트·동영상은 원본 이미지로 바꿔 넣으면 더 정확합니다.');
  slides.push({text:text.join('\n').trim(),background,width,height,shapes});
 }
 return {slides,warnings:[...warnings]};
}
return {manuscript,deck};
})();
