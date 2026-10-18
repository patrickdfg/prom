window.CaptionBuilder=(()=>{
'use strict';
const C=CaptionCore,clone=x=>structuredClone(x);let templatePromise,themeXml,templateBank,defaultBank,defaultTheme,masterOverrides={};const templateUrl=new URL('template-data.json?v=2',document.currentScript.src);
const layouts={caption:'하단 자막',word:'말씀',wordGod:'하나님 말씀',wordSon:'성자 말씀',wordSpirit:'성령 말씀',wordTeacher:'선생님 말씀 (인물 없음)',verse:'성경 구절',emphasis:'큰 글씨 강조',cover:'표지',passage:'본문 성구'};
async function templates(){if(templateBank)return templateBank;return templatePromise||(templatePromise=fetch(templateUrl).then(r=>{if(!r.ok)throw Error('자막 디자인을 불러오지 못했습니다. 인터넷 연결을 확인하세요.');return r.json();}).then(data=>{themeXml=data.themeXml;for(const scene of Object.values(data.layouts))for(const shape of scene.shapes)if(shape.src?.startsWith('@'))shape.src=data.assets[shape.src.slice(1)];templateBank=data.layouts;defaultBank=clone(templateBank);defaultTheme=themeXml;return data.layouts;}).catch(e=>{templatePromise=null;throw e;}));}
async function snapshotTemplate(includeProject=true){await templates();return {layouts:clone(templateBank),themeXml,layoutMasters:window.CaptionMasters&&includeProject?CaptionMasters.merge(masterOverrides,window.CaptionWorkspace?.layoutMasters?.()||{}):clone(masterOverrides)};}
async function useTemplate(data){await templates();if(!data){masterOverrides={};templateBank=clone(defaultBank);themeXml=defaultTheme;return;}for(const key of Object.keys(layouts)){const s=data.layouts?.[key];if(!s||!Array.isArray(s.shapes)||s.shapes[s.bodyIndex]?.type!=='text'||!(s.width>0&&s.height>0))throw Error('저장된 디자인 템플릿을 읽지 못했습니다.');}if(typeof data.themeXml!=='string')throw Error('저장된 테마가 올바르지 않습니다.');masterOverrides=clone(data.layoutMasters||{});templateBank=clone(data.layouts);themeXml=data.themeXml;}
const plain=s=>String(s||'').replace(/<\/?[rb]>/g,'');
function styledRuns(text,base){let color=base.color||'#111111';const runs=[];for(const t of String(text).split(/(<\/?[rb]>)/g)){if(t==='<r>')color='#ff0000';else if(t==='<b>')color='#2683c6';else if(/^<\/[rb]>$/.test(t))color=base.color||'#111111';else if(t)runs.push({...clone(base),text:t,color});}return runs;}
async function scene(layout,text,options={}){
 const bank=await templates(),result=clone(bank[layout]||bank.caption),bodyIndex=result.bodyIndex,body=result.shapes[bodyIndex],para=body.paragraphs[0]||{runs:[]},base=clone(para.runs.find(r=>r.size)||{size:32,bold:true,font:'마루 부리OTF 굵은',color:'#111111'});
 for(const key of ['font','size','bold','color'])if(options[key]!==undefined)base[key]=options[key];
 Object.assign(body,{x:options.x??body.x,y:options.y??body.y,w:options.w??body.w,h:options.h??body.h,anchor:options.anchor||body.anchor,wrap:true,lineReduction:0});
 let textLines=String(text).split('\n');if(options.padToLines)while(textLines.length<options.padToLines)textLines.push(' ');// 줄 높이를 맞추는 빈 줄. 특수 공백(U+00A0)은 일부 글꼴에서 네모로 보인다.
 body.paragraphs=textLines.map(line=>({...clone(para),align:options.align||para.align||'center',lineSpacing:clone(options.lineSpacing||{unit:'ratio',value:1.3}),runs:styledRuns(line,base),defaultSize:base.size}));
 // The template's empty placeholders stay empty; only body/reference/date fields are populated.
 if((layout==='verse'||layout==='passage')&&options.ref){const refRun={...base,color:layout==='verse'?'#2683c6':'#000000'};if(layout==='passage'){const ref=result.shapes[4],rp=clone(ref.paragraphs[0]),rr=rp.runs.find(r=>r.size)||refRun;ref.paragraphs=[{...rp,runs:styledRuns(options.ref,rr)}];}else body.paragraphs.unshift({...clone(para),align:'left',lineSpacing:clone(options.lineSpacing||{unit:'ratio',value:1.3}),runs:styledRuns(options.ref,refRun)});}
 if(layout==='cover'&&options.date){const date=result.shapes[6],dp=clone(date.paragraphs[0]),dr=dp.runs.find(r=>r.size)||base;date.paragraphs=[{...dp,runs:styledRuns(options.date,dr)}];}
 result.uid=options.uid||crypto.randomUUID();result.renderVersion=2;result.text=plain(text);result.editor={layout,text,ref:options.ref||'',date:options.date||'',font:base.font,size:base.size,bold:!!base.bold,color:base.color,align:options.align||para.align||'center',lineSpacing:clone(body.paragraphs[0].lineSpacing),x:body.x,y:body.y,w:body.w,h:body.h,anchor:body.anchor,padToLines:options.padToLines||0};return window.CaptionMasters?CaptionMasters.inherit(result,masterOverrides,options):result;
}
function colorType(hex){const h=String(hex||'').replace('#','');if(!/^[a-f\d]{6}$/i.test(h))return 'black';const [r,g,b]=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));if(b>90&&b>r*1.3&&b>g*1.15)return 'blue';if(g>65&&g>r*1.25&&g>b*1.15)return 'green';if(r>130&&r>g*1.5&&r>b*1.5)return 'red';return 'black';}
function blocks(project,allText=false){
 const rich=project.richLines?.length===project.lines.length?project.richLines:project.lines.map(text=>({text,runs:[{text,hex:'000000'}]}));const out=[];let offset=0,current=null,prevBlack='';
 const flush=()=>{if(current?.chars.some(c=>C.normalize(c.ch)))out.push(current);current=null;};
 for(const row of rich){const runs=row.runs||[{text:row.text,hex:'000000'}],types=runs.map(r=>colorType(r.hex));let pos=offset;for(let i=0;i<runs.length;i++){const r=runs[i],type=allText?'blue':types[i]==='red'?(types.slice(0,i).reverse().find(t=>['blue','green'].includes(t))||types.slice(i+1).find(t=>['blue','green'].includes(t))||'black'):types[i];if(type==='black'){flush();prevBlack=(prevBlack+r.text).slice(-60);pos+=C.normalize(r.text).length;continue;}const layout=type==='blue'?'caption':'word';if(current?.layout!==layout)flush();if(!current){current={layout,chars:[],before:prevBlack};prevBlack='';}for(const ch of r.text){const n=C.normalize(ch).length;current.chars.push({ch,red:types[i]==='red',start:pos,end:pos+n});pos+=n;}}offset+=C.normalize(row.text).length;if(current)current.chars.push({ch:'\n',red:false,start:offset,end:offset});}
 flush();return out;
}
function trim(chars){let a=0,b=chars.length;while(a<b&&/\s/.test(chars[a].ch))a++;while(b>a&&/\s/.test(chars[b-1].ch))b--;return chars.slice(a,b);}
// 인용문 바로 앞 검정 글씨("성령님 말씀입니다." 등)에서 화자를 찾는다. 이름이 둘 이상이면 판정하지 않는다.
function contextSpeaker(before){const found=new Set();for(const m of String(before||'').slice(-40).matchAll(/성령님?|하나님|예수님?|성자(?:님)?|선생(?:님)?/g))found.add(/성령/.test(m[0])?'wordSpirit':/하나님/.test(m[0])?'wordGod':/선생/.test(m[0])?'wordTeacher':'wordSon');return found.size===1?[...found][0]:'';}
function speakerLayout(text,fallback='word'){
 const head=plain(text).split(/\r?\n/).filter(s=>s.trim()).slice(0,2).join('\n'),match=head.match(/성령님?|하나님|성자(?:님)?|예수님?|선생님/);
 return match?(/성령/.test(match[0])?'wordSpirit':/하나님/.test(match[0])?'wordGod':/선생님/.test(match[0])?'wordTeacher':'wordSon'):fallback;
}
function metrics(layout,bank=templateBank){
 const original=bank?.[layout],s=original&&window.CaptionMasters?CaptionMasters.inherit({...original,editor:{layout}},masterOverrides):original,b=s?.shapes[s.bodyIndex],p=b?.paragraphs[0],r=p?.runs.find(r=>r.size)||{size:30.6667,font:'마루 부리OTF 굵은',bold:true},pad=b?.padding||[4.8,9.6,4.8,9.6];
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d'),font=/마루\s*부리|maru\s*buri/i.test(r.font)?'"PROM MaruBuri"':JSON.stringify(r.font||'Malgun Gothic');ctx.font=`${r.bold?700:400} ${r.size}px ${font}, "Malgun Gothic", serif`;
 return {width:(b?.w||900)-pad[1]-pad[3]-2,measure:text=>ctx.measureText(text).width+Math.max(0,text.length-1)*(r.spacing||0),maxLines:Math.max(1,Math.min(layout==='caption'?2:layout==='verse'?8:5,Math.floor(((b?.h||406)-pad[0]-pad[2])/(p?.lineSpacing?.unit==='px'?p.lineSpacing.value:r.size*(p?.lineSpacing?.value||1.3)))))};
}
// 최소 줄 수는 유지하면서 줄 길이가 고르게 되도록 단어 경계에서 나눈다. 마지막 줄에 한두 글자만 남는 것을 막는다.
function balance(chars,m,rowCount){
 const words=[];let s=0;for(let i=0;i<=chars.length;i++)if(i===chars.length||/\s/.test(chars[i].ch)){if(i>s)words.push([s,i]);s=i+1;}
 const n=words.length;if(n<rowCount)return null;
 const cache=new Map(),text=(a,b)=>chars.slice(words[a][0],words[b-1][1]).map(c=>c.ch).join('');
 const cost=(a,b)=>{const key=a*1000+b;if(cache.has(key))return cache.get(key);const str=text(a,b),w=m.measure(str);let v=w>m.width?Infinity:(m.width-w)**2*(/[,，]$/.test(str)?.5:1);cache.set(key,v);return v;};
 const dp=Array.from({length:rowCount+1},()=>Array(n+1).fill(Infinity)),from=Array.from({length:rowCount+1},()=>Array(n+1).fill(0));dp[0][0]=0;
 for(let k=1;k<=rowCount;k++)for(let j=k;j<=n;j++)for(let a=k-1;a<j;a++){if(dp[k-1][a]===Infinity)continue;const v=dp[k-1][a]+cost(a,j);if(v<dp[k][j]){dp[k][j]=v;from[k][j]=a;}}
 if(dp[rowCount][n]===Infinity)return null;
 const rows=[];for(let k=rowCount,j=n;k>0;k--){const a=from[k][j];rows.unshift(trim(chars.slice(words[a][0],words[j-1][1])));j=a;}
 return rows.every(r=>r.length)?rows:null;
}
function wrap(chars,m){const greedy=wrapGreedy(chars,m);if(greedy.length<2||chars.some(c=>c.ch==='\n'))return greedy;return balance(trim(chars),m,greedy.length)||greedy;}
function wrapGreedy(chars,m){const rows=[];let rest=trim(chars);while(rest.length){let end=0,text='';while(end<rest.length&&rest[end].ch!=='\n'){const next=text+rest[end].ch;if(end&&m.measure(next)>m.width)break;text=next;end++;}if(end<rest.length&&rest[end].ch!=='\n'){let cut=-1;for(let i=0;i<end;i++)if(/[\s,，]/.test(rest[i].ch)&&m.measure(rest.slice(0,i+1).map(c=>c.ch).join(''))>=m.width*.6)cut=i+1;if(cut>0)end=cut;}const row=trim(rest.slice(0,end));if(row.length)rows.push(row);rest=trim(rest.slice(Math.max(1,end)));}return rows;}
function markup(chars){let text='',red=false;for(const c of chars){if(c.red!==red){text+=c.red?'<r>':'</r>';red=c.red;}text+=c.ch;}return text+(red?'</r>':'');}
// 문장 단위로 자른다. 닫는 따옴표·괄호는 앞 문장에 붙이고, 문장 중간의 원고 줄바꿈은 공백으로 잇는다.
function sentences(chars){
 const closeQ=/[”’"'）)\]」』]/,sentEnd=/[.!?。]/,out=[];let chunk=[],hold=false;
 const cut=()=>{const t=trim(chunk);if(t.length)out.push(t);chunk=[];hold=false;};
 const endsSentence=()=>{let k=chunk.length-1;while(k>=0&&/\s/.test(chunk[k].ch))k--;while(k>=0&&closeQ.test(chunk[k].ch))k--;return k>=0&&sentEnd.test(chunk[k].ch);};
 for(let i=0;i<chars.length;i++){const c=chars[i];
  if(c.ch==='\n'){if(!hold&&endsSentence())cut();else if(chunk.length)chunk.push({...c,ch:' '});hold=false;continue;}
  chunk.push(c);if(!sentEnd.test(c.ch))continue;
  let j=i;while(chars[j+1]&&closeQ.test(chars[j+1].ch))j++;
  const nx=chars[j+1],prev=chars[i-1];
  const boundary=!nx||/\s/.test(nx.ch)||((/[가-힣]/.test(nx.ch)||/[“‘"'(（]/.test(nx.ch))&&!(prev&&/\d/.test(prev.ch)));
  if(!boundary)continue;
  for(let k=i+1;k<=j;k++)chunk.push(chars[k]);
  const closed=j>i&&chars[j].ch==='’';i=j;
  if(closed&&nx){const s=chunk.map(x=>x.ch).join('');if(s.indexOf('‘')>0&&(s.match(/’/g)||[]).length<=(s.match(/‘/g)||[]).length){hold=true;continue;}}
  cut();
 }
 if(trim(chunk).length)out.push(trim(chunk));
 return out;
}
function analyze(project,options={}){
 const result=[];for(const block of blocks(project,options.allText)){
  const text=block.chars.map(c=>c.ch).join(''),verse=block.layout==='word'&&/[（(]?[가-힣]{1,8}\s*\d+\s*[:장]\s*\d+/.test(text);let layout=verse?'verse':block.layout==='word'?speakerLayout(text,contextSpeaker(block.before)||options.greenLayout||'word'):block.layout;
  const chunks=sentences(block.chars);
  const pages=[];let page=[],count=0;const flush=()=>{if(page.length)pages.push({page,layout});page=[];count=0;};for(const ch of chunks){const next=block.layout==='word'&&!verse?speakerLayout(ch.map(c=>c.ch).join(''),layout):layout;if(next!==layout){flush();layout=next;}const m=metrics(layout,options.bank),maxLines=m.maxLines,lines=wrap(ch,m);for(let start=0;start<lines.length;start+=maxLines){const part=lines.slice(start,start+maxLines);if(count+part.length>maxLines&&page.length)flush();page.push(part);count+=part.length;}}flush();
  for(const item of pages){const {page,layout}=item,group=crypto.randomUUID(),finalLines=page.flat().length,cumulative=options.cumulative!==false&&page.length>1;for(let step=cumulative?1:page.length;step<=page.length;step++){
   const shown=page.slice(0,step).flat(),newLines=cumulative?page[step-1]:page.flat(),chars=newLines.flat(),start=chars.find(c=>c.end>c.start)?.start,end=[...chars].reverse().find(c=>c.end>c.start)?.end;if(!Number.isInteger(start)||!(end>start))continue;
   const bodyText=shown.map(markup).join('\n');result.push({layout,text:verse?bodyText.replace(/([（(]?[가-힣]{1,8}\s*\d+\s*[:장]\s*\d+(?:[-~]\d+)?[）)]?)/,'<b>$1</b>'):bodyText,start,end,padToLines:finalLines,group,cumulative,step});if(result.length>500)throw Error('자막이 500장을 넘습니다. 원고를 나누어 만들어 주세요.');
  }}
 }
 return result;
}
async function prepare(){const bank=await templates();await Promise.all(Object.values(bank).map(s=>{const r=s.shapes[s.bodyIndex].paragraphs[0].runs.find(r=>r.size);return /마루\s*부리/i.test(r?.font||'')?document.fonts.load(`${r.bold?700:400} ${r.size}px "PROM MaruBuri"`):Promise.resolve();}));return bank;}
async function generate(project,options={}){const bank=await prepare(),specs=analyze(project,{...options,bank});if(!specs.length)throw Error('파란색·초록색 자막 구간을 찾지 못했습니다. 원고의 색을 확인하거나 전체 원고 만들기를 선택하세요.');const slides=[],links=[];if(options.title){slides.push(await scene('cover',options.title,{date:options.date}));links.push({status:'unlinked',start:null,end:null,score:0,reason:'cover'});}for(const spec of specs){const slide=await scene(spec.layout,spec.text,{padToLines:spec.padToLines});slide.editor.group=spec.group;slide.editor.cumulative=spec.cumulative;slide.editor.step=spec.step;slides.push(slide);links.push({status:'exact',start:spec.start,end:spec.end,score:1,reason:'source'});}return {slides,links};}
async function restyle(slides){await prepare();const groups=new Map();for(const s of slides)if(s.editor?.group)groups.set(s.editor.group,s);const out=[];for(const s of slides){if(!s.editor){out.push(s);continue;}const e=s.editor,final=groups.get(e.group)||s,layout=e.layout.startsWith('word')?speakerLayout(final.editor.text,e.layout):e.layout,rebuilt=await scene(layout,e.text,{uid:s.uid,ref:e.ref,date:e.date,padToLines:e.padToLines});for(const key of ['group','cumulative','step'])if(e[key]!==undefined)rebuilt.editor[key]=e[key];rebuilt.shapes.push(...s.shapes.filter(sh=>sh.extraText).map(clone));out.push(rebuilt);}return out;}
return {templates,snapshotTemplate,useTemplate,theme:async()=>{await templates();return themeXml;},scene,generate,analyze,restyle,speakerLayout,metrics,plain,styledRuns,colorType,layouts};
})();
