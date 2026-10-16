window.CaptionBuilder=(()=>{
'use strict';
const C=CaptionCore,clone=x=>structuredClone(x);let templatePromise,themeXml;const templateUrl=new URL('template-data.json?v=1',document.currentScript.src);
const layouts={caption:'하단 자막',word:'말씀',wordSpirit:'성령 말씀',verse:'성경 구절',emphasis:'큰 글씨 강조',cover:'표지',passage:'본문 성구'};
async function templates(){return templatePromise||(templatePromise=fetch(templateUrl).then(r=>{if(!r.ok)throw Error('자막 디자인을 불러오지 못했습니다. 인터넷 연결을 확인하세요.');return r.json();}).then(data=>{themeXml=data.themeXml;for(const scene of Object.values(data.layouts))for(const shape of scene.shapes)if(shape.src?.startsWith('@'))shape.src=data.assets[shape.src.slice(1)];return data.layouts;}).catch(e=>{templatePromise=null;throw e;}));}
const plain=s=>String(s||'').replace(/<\/?[rb]>/g,'');
function styledRuns(text,base){let color=base.color||'#111111';const runs=[];for(const t of String(text).split(/(<\/?[rb]>)/g)){if(t==='<r>')color='#ff0000';else if(t==='<b>')color='#2683c6';else if(/^<\/[rb]>$/.test(t))color=base.color||'#111111';else if(t)runs.push({...clone(base),text:t,color});}return runs;}
async function scene(layout,text,options={}){
 const bank=await templates(),result=clone(bank[layout]||bank.caption),bodyIndex=result.bodyIndex,body=result.shapes[bodyIndex],para=body.paragraphs[0]||{runs:[]},base=clone(para.runs.find(r=>r.size)||{size:32,bold:true,font:'마루 부리OTF 굵은',color:'#111111'});
 for(const key of ['font','size','bold','color'])if(options[key]!==undefined)base[key]=options[key];
 Object.assign(body,{x:options.x??body.x,y:options.y??body.y,w:options.w??Math.min(body.w,result.width-body.x-20),h:options.h??Math.min(body.h,result.height-body.y-12),anchor:options.anchor||body.anchor,wrap:true});
 let textLines=String(text).split('\n');if(options.padToLines)while(textLines.length<options.padToLines)textLines.push('\u00a0');
 body.paragraphs=textLines.map(line=>({...clone(para),align:options.align||para.align||'center',runs:styledRuns(line,base),defaultSize:base.size}));
 // The template's empty placeholders stay empty; only body/reference/date fields are populated.
 if((layout==='verse'||layout==='passage')&&options.ref){const refRun={...base,color:layout==='verse'?'#2683c6':'#000000'};if(layout==='passage'){const ref=result.shapes[4];ref.paragraphs=[{align:'center',runs:styledRuns(options.ref,{...refRun,size:24})}];}else body.paragraphs.unshift({...clone(para),align:'left',runs:styledRuns(options.ref,refRun)});}
 if(layout==='cover'&&options.date){const date=result.shapes[6];date.paragraphs=[{align:'center',runs:styledRuns(options.date,{...base,size:24})}];}
 result.uid=options.uid||crypto.randomUUID();result.renderVersion=2;result.text=plain(text);result.editor={layout,text,ref:options.ref||'',date:options.date||'',font:base.font,size:base.size,bold:!!base.bold,color:base.color,align:options.align||para.align||'center',x:body.x,y:body.y,w:body.w,h:body.h,anchor:body.anchor,padToLines:options.padToLines||0};return result;
}
function colorType(hex){const h=String(hex||'').replace('#','');if(!/^[a-f\d]{6}$/i.test(h))return 'black';const [r,g,b]=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));if(b>90&&b>r*1.3&&b>g*1.15)return 'blue';if(g>65&&g>r*1.25&&g>b*1.15)return 'green';if(r>130&&r>g*1.5&&r>b*1.5)return 'red';return 'black';}
function blocks(project,allText=false){
 const rich=project.richLines?.length===project.lines.length?project.richLines:project.lines.map(text=>({text,runs:[{text,hex:'000000'}]}));const out=[];let offset=0,current=null;
 const flush=()=>{if(current?.chars.some(c=>C.normalize(c.ch)))out.push(current);current=null;};
 for(const row of rich){const runs=row.runs||[{text:row.text,hex:'000000'}],types=runs.map(r=>colorType(r.hex));let pos=offset;for(let i=0;i<runs.length;i++){const r=runs[i],type=allText?'blue':types[i]==='red'?(types.slice(0,i).reverse().find(t=>['blue','green'].includes(t))||types.slice(i+1).find(t=>['blue','green'].includes(t))||'black'):types[i];if(type==='black'){flush();pos+=C.normalize(r.text).length;continue;}const layout=type==='blue'?'caption':'word';if(current?.layout!==layout)flush();if(!current)current={layout,chars:[]};for(const ch of r.text){const n=C.normalize(ch).length;current.chars.push({ch,red:types[i]==='red',start:pos,end:pos+n});pos+=n;}}offset+=C.normalize(row.text).length;if(current)current.chars.push({ch:'\n',red:false,start:offset,end:offset});}
 flush();return out;
}
function trim(chars){let a=0,b=chars.length;while(a<b&&/\s/.test(chars[a].ch))a++;while(b>a&&/\s/.test(chars[b-1].ch))b--;return chars.slice(a,b);}
function wrap(chars,width){const rows=[];let rest=trim(chars);while(rest.length){let end=rest.findIndex(c=>c.ch==='\n');if(end<0||end>width)end=Math.min(rest.length,width);if(end===width&&rest.length>width){let cut=-1;for(let i=Math.floor(width*.55);i<width;i++)if(/[\s,，]/.test(rest[i].ch))cut=i+1;if(cut>0)end=cut;}const row=trim(rest.slice(0,end));if(row.length)rows.push(row);rest=trim(rest.slice(Math.max(1,end)));}return rows;}
function markup(chars){let text='',red=false;for(const c of chars){if(c.red!==red){text+=c.red?'<r>':'</r>';red=c.red;}text+=c.ch;}return text+(red?'</r>':'');}
function analyze(project,options={}){
 const result=[];for(const block of blocks(project,options.allText)){
  const text=block.chars.map(c=>c.ch).join(''),verse=block.layout==='word'&&/[（(]?[가-힣]{1,8}\s*\d+\s*[:장]\s*\d+/.test(text),layout=verse?'verse':block.layout,width=layout==='caption'?30:layout==='word'?25:28,maxLines=layout==='caption'?3:layout==='word'?5:8;
  const chunks=[];let chunk=[];for(let i=0;i<block.chars.length;i++){const c=block.chars[i];chunk.push(c);if(c.ch==='\n'||/[.!?。]/.test(c.ch)&&(!block.chars[i+1]||/[\s”’"']/.test(block.chars[i+1].ch))){const t=trim(chunk);if(t.length)chunks.push(t);chunk=[];}}if(trim(chunk).length)chunks.push(trim(chunk));
  const pages=[];let page=[],count=0;for(const ch of chunks){const lines=wrap(ch,width);for(let start=0;start<lines.length;start+=maxLines){const part=lines.slice(start,start+maxLines);if(count+part.length>maxLines&&page.length){pages.push(page);page=[];count=0;}page.push(part);count+=part.length;}}if(page.length)pages.push(page);
  for(const page of pages){const group=crypto.randomUUID(),finalLines=page.flat().length,cumulative=options.cumulative!==false&&page.length>1;for(let step=cumulative?1:page.length;step<=page.length;step++){
   const shown=page.slice(0,step).flat(),newLines=cumulative?page[step-1]:page.flat(),chars=newLines.flat(),start=chars.find(c=>c.end>c.start)?.start,end=[...chars].reverse().find(c=>c.end>c.start)?.end;if(!Number.isInteger(start)||!(end>start))continue;
   const bodyText=shown.map(markup).join('\n');result.push({layout,text:verse?bodyText.replace(/([（(]?[가-힣]{1,8}\s*\d+\s*[:장]\s*\d+(?:[-~]\d+)?[）)]?)/,'<b>$1</b>'):bodyText,start,end,padToLines:finalLines,group,cumulative,step});if(result.length>500)throw Error('자막이 500장을 넘습니다. 원고를 나누어 만들어 주세요.');
  }}
 }
 return result;
}
async function generate(project,options={}){const specs=analyze(project,options);if(!specs.length)throw Error('파란색·초록색 자막 구간을 찾지 못했습니다. 원고의 색을 확인하거나 전체 원고 만들기를 선택하세요.');const slides=[],links=[];if(options.title){slides.push(await scene('cover',options.title,{date:options.date}));links.push({status:'unlinked',start:null,end:null,score:0,reason:'cover'});}for(const spec of specs){const slide=await scene(spec.layout==='word'?(options.greenLayout||'word'):spec.layout,spec.text,{padToLines:spec.padToLines});slide.editor.group=spec.group;slide.editor.cumulative=spec.cumulative;slide.editor.step=spec.step;slides.push(slide);links.push({status:'exact',start:spec.start,end:spec.end,score:1,reason:'source'});}return {slides,links};}
return {templates,theme:async()=>{await templates();return themeXml;},scene,generate,analyze,plain,styledRuns,colorType,layouts};
})();