window.CaptionBuilder=(()=>{
'use strict';
const C=CaptionCore,clone=x=>structuredClone(x);let templatePromise,themeXml,templateBank,defaultBank,defaultTheme,masterOverrides={};const templateUrl=new URL('template-data.json?v=2',document.currentScript.src);
const layouts={caption:'하단 자막',word:'말씀',wordGod:'하나님 말씀',wordSon:'성자 말씀',wordSpirit:'성령 말씀',wordTeacher:'선생님 말씀 (인물 없음)',verse:'성경 구절',emphasis:'큰 글씨 강조',cover:'표지',passage:'본문 성구',proverb:'잠언 항목'};
const layoutFallback={proverb:'wordTeacher'};// 항목 디자인이 없으면 인물 없는 전체 화면을 사용한다.
async function templates(){if(templateBank)return templateBank;return templatePromise||(templatePromise=fetch(templateUrl).then(r=>{if(!r.ok)throw Error('자막 디자인을 불러오지 못했습니다. 인터넷 연결을 확인하세요.');return r.json();}).then(data=>{themeXml=data.themeXml;for(const scene of Object.values(data.layouts))for(const shape of scene.shapes)if(shape.src?.startsWith('@'))shape.src=data.assets[shape.src.slice(1)];templateBank=data.layouts;defaultBank=clone(templateBank);defaultTheme=themeXml;return data.layouts;}).catch(e=>{templatePromise=null;throw e;}));}
async function snapshotTemplate(includeProject=true){await templates();return {layouts:clone(templateBank),themeXml,layoutMasters:window.CaptionMasters&&includeProject?CaptionMasters.merge(masterOverrides,window.CaptionWorkspace?.layoutMasters?.()||{}):clone(masterOverrides)};}
async function useTemplate(data){await templates();if(!data){masterOverrides={};templateBank=clone(defaultBank);themeXml=defaultTheme;return;}for(const key of Object.keys(layouts)){if(key==='proverb'&&!data.layouts?.[key])continue;const s=data.layouts?.[key];if(!s||!Array.isArray(s.shapes)||s.shapes[s.bodyIndex]?.type!=='text'||!(s.width>0&&s.height>0))throw Error('저장된 디자인 템플릿을 읽지 못했습니다.');}if(typeof data.themeXml!=='string')throw Error('저장된 테마가 올바르지 않습니다.');masterOverrides=clone(data.layoutMasters||{});templateBank=clone(data.layouts);themeXml=data.themeXml;}
const plain=s=>String(s||'').replace(/<\/?[rb]>/g,'');
function styledRuns(text,base){let color=base.color||'#111111';const runs=[];for(const t of String(text).split(/(<\/?[rb]>)/g)){if(t==='<r>')color='#ff0000';else if(t==='<b>')color='#2683c6';else if(/^<\/[rb]>$/.test(t))color=base.color||'#111111';else if(t)runs.push({...clone(base),text:t,color});}return runs;}
async function scene(layout,text,options={}){
 const bank=await templates(),result=clone(bank[layout]||bank[layoutFallback[layout]]||bank.caption),bodyIndex=result.bodyIndex,body=result.shapes[bodyIndex],para=body.paragraphs[0]||{runs:[]},base=clone(para.runs.find(r=>r.size)||{size:32,bold:true,font:'마루 부리OTF 굵은',color:'#111111'});
 for(const key of ['font','size','bold','color'])if(options[key]!==undefined)base[key]=options[key];
 Object.assign(body,{x:options.x??body.x,y:options.y??body.y,w:options.w??body.w,h:options.h??body.h,anchor:options.anchor||body.anchor,wrap:true,lineReduction:0});
 let textLines=String(text).split('\n');if(options.padToLines)while(textLines.length<options.padToLines)textLines.push(' ');// 줄 높이를 맞추는 빈 줄. 특수 공백(U+00A0)은 일부 글꼴에서 네모로 보인다.
 body.paragraphs=textLines.map(line=>({...clone(para),align:options.align||para.align||'center',lineSpacing:clone(options.lineSpacing||(para.fixedLineSpacing&&para.lineSpacing)||{unit:'ratio',value:1.3}),runs:styledRuns(line,base),defaultSize:base.size}));
 // The template's empty placeholders stay empty; only body/reference/date fields are populated.
 if((layout==='verse'||layout==='passage')&&options.ref){const refRun={...base,color:layout==='verse'?'#2683c6':'#000000'};if(layout==='passage'){const ref=result.shapes[4],rp=clone(ref.paragraphs[0]),rr=rp.runs.find(r=>r.size)||refRun;ref.paragraphs=[{...rp,runs:styledRuns(options.ref,rr)}];}else body.paragraphs.unshift({...clone(para),align:'left',lineSpacing:clone(options.lineSpacing||{unit:'ratio',value:1.3}),runs:styledRuns(options.ref,refRun)});}
 if(layout==='cover'&&options.date){const date=result.shapes[6],dp=clone(date.paragraphs[0]),dr=dp.runs.find(r=>r.size)||base;date.paragraphs=[{...dp,runs:styledRuns(options.date,dr)}];}
 if(result.worshipReferenceIndex!=null&&options.ref){const sh=result.shapes[result.worshipReferenceIndex],p=clone(sh.paragraphs[0]||{runs:[]}),r=clone(p.runs.find(r=>r.size)||base);sh.paragraphs=[{...p,runs:styledRuns(options.ref,r)}];}
 if(/^worship/.test(layout)&&options.date&&window.CaptionContentRules){const parts=options.date.match(/(20\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);if(parts)for(const sh of result.shapes)for(const p of sh.paragraphs||[])for(const r of p.runs||[])r.text=CaptionContentRules.dateText(r.text,{date:parts.slice(1).map(Number)});}
 result.uid=options.uid||crypto.randomUUID();result.renderVersion=2;result.text=plain(text);result.editor={layout,text,ref:options.ref||'',date:options.date||'',font:base.font,size:base.size,bold:!!base.bold,color:base.color,align:options.align||para.align||'center',lineSpacing:clone(body.paragraphs[0].lineSpacing),x:body.x,y:body.y,w:body.w,h:body.h,anchor:body.anchor,padToLines:options.padToLines||0};return window.CaptionMasters?CaptionMasters.inherit(result,masterOverrides,options):result;
}
function colorType(hex){const h=String(hex||'').replace('#','');if(!/^[a-f\d]{6}$/i.test(h))return 'black';const [r,g,b]=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));if(b>90&&b>r*1.3&&b>g*1.15)return 'blue';if(g>65&&g>r*1.25&&g>b*1.15)return 'green';if(r>130&&r>g*1.5&&r>b*1.5)return 'red';return 'black';}
function trim(chars){let a=0,b=chars.length;while(a<b&&/\s/.test(chars[a].ch))a++;while(b>a&&/\s/.test(chars[b-1].ch))b--;return chars.slice(a,b);}
// 인용문 바로 앞 검정 글씨("성령님 말씀입니다." 등)에서 화자를 찾는다. 이름이 둘 이상이면 판정하지 않는다.
function contextSpeaker(before){const found=new Set();for(const m of String(before||'').slice(-40).matchAll(/성령님?|하나님|예수님?|성자(?:님)?|선생(?:님)?/g))found.add(/성령/.test(m[0])?'wordSpirit':/하나님/.test(m[0])?'wordGod':/선생/.test(m[0])?'wordTeacher':'wordSon');return found.size===1?[...found][0]:'';}
function speakerLayout(text,fallback='word'){
 const head=plain(text).split(/\r?\n/).filter(s=>s.trim()).slice(0,2).join('\n'),match=head.match(/성령님?|하나님|성자(?:님)?|예수님?|선생님/);
 return match?(/성령/.test(match[0])?'wordSpirit':/하나님/.test(match[0])?'wordGod':/선생님/.test(match[0])?'wordTeacher':'wordSon'):fallback;
}
function metrics(layout,bank=templateBank){
 const original=bank?.[layout]||bank?.[layoutFallback[layout]],s=original&&window.CaptionMasters?CaptionMasters.inherit({...original,editor:{layout}},masterOverrides):original,b=s?.shapes[s.bodyIndex],p=b?.paragraphs[0],r=p?.runs.find(r=>r.size)||{size:30.6667,font:'마루 부리OTF 굵은',bold:true},pad=b?.padding||[4.8,9.6,4.8,9.6];
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d'),font=/마루\s*부리|maru\s*buri/i.test(r.font)?'"PROM MaruBuri"':JSON.stringify(r.font||'Malgun Gothic');ctx.font=`${r.bold?700:400} ${r.size}px ${font}, "Malgun Gothic", serif`;
 return {width:(b?.w||900)-pad[1]-pad[3]-2,measure:text=>ctx.measureText(text).width+Math.max(0,text.length-1)*(r.spacing||0),maxLines:Math.max(1,Math.min(layout==='caption'?2:layout==='verse'?8:layout==='proverb'?99:5,Math.floor(((b?.h||406)-pad[0]-pad[2])/(p?.lineSpacing?.unit==='px'?p.lineSpacing.value:r.size*(p?.lineSpacing?.value||1.3)))))};
}
// 줄을 바꾸기 좋은 곳/나쁜 곳. 앞 낱말 끝과 뒤 낱말 앞을 보고 점수를 준다(작을수록 좋음).
// 좋은 곳: 쉼표·마침표 뒤, '~고 ~며 ~면 ~서 ~니 ~지만 ~는데 ~도록 ~여' 같은 이음말 뒤, '~은/는/이/가/을/를' 같은 조사 뒤.
// 나쁜 곳: '그 이 저 각 온 모든 한' 같은 꾸밈말 뒤, '~의' 뒤, '~할/~될/~는' 꾸밈 끝 뒤, '것 수 줄 때 뿐 대로 간에 나름' 같은 매인 이름씨 앞,
// '않 못 있 없 주 보 싶' 같은 보조 용언 앞(앞이 ~지/~고/~어/~게일 때), 숫자와 단위 사이.
const DETERMINER=/^(그|이|저|각|온|모든|한|두|세|네|몇|새|첫|이런|그런|저런|어떤|무슨|여러|온갖|갖은|매|전|총|약|단|그의|나의|너의|우리의|자기의)$/;
const BOUND=/^(것|거|수|줄|때|데|듯|뿐|만큼|대로|중|간에|간|나름|등|바|따름|적|채|김|척|체|양|만|분|번|장|절|년|월|일|시|개|명|가지|및)(?![가-힣]{3})/;
const AUX=/^(않|못하|못한|못할|못합|있|없|주|줘|준|줄|보|봐|본|버리|버린|싶|놓|두었|둔|드리|드립|계시|계신|지|져|진|질|하게|되었|되어|된다|됩니|합니다|했습니다|하십니다|하셨습니다|하였습니다|입니다|이다|이었|같|말았|말고|말아)/;
function breakScore(prev,next){
 const p=prev.replace(/[”’"')）」』\]]+$/,''),q=next.replace(/^[“‘"'(（「『\[]+/,'');
 if(/[.!?。]$/.test(p))return .2;
 if(/[,，:;]$/.test(p))return .35;
 if(/\d$/.test(p)&&/^[가-힣]/.test(q))return 4;                                  // 3 / 장
 if(DETERMINER.test(p))return 5;                                                  // 그 / 보내신
 if(BOUND.test(q))return 4;
 if(/[가-힣]$/.test(p)&&/^\d/.test(q))return 3;                                   // 요한복음 / 5장
 if(/(이|가)$/.test(p)&&/^(되|된|될|됩|됐)/.test(q))return 3;                         // 체질이 / 되어
 if(/(게|케|도록)$/.test(p)&&/^(하|해|했|한|할|함|합|만들|되|된)/.test(q))return 4;      // 자유케 / 하고
 if(/^(통해|통하여|통한|위해|위하여|위한|대해|대하여|대한|따라|따른|향해|향한|인해|인하여|인한|비해|관해|관한|말미암아|의해|의하여|의한)/.test(q))return 4;   // 구원자를 / 통해                                                       // 선악 / 간에, 자기 / 나름대로
 if(/(지|고|어|아|여|게|해)$/.test(p)&&AUX.test(q))return 4;                       // 하지 / 않으면
 if(/의$/.test(p))return 3;                                                       // 하나님의 / 말씀
 if(/(고|며|면|서|니|니까|지만|는데|은데|ㄴ데|도록|면서|므로|여|하여|해서|러|려고|든지|거나|자|다가)$/.test(p))return .5;
 if(/(은|는|이|가|을|를|에게|에서|으로|로|와|과|도|만|까지|부터|에는|에도|께서)$/.test(p))return .8;
 if(/(할|될|갈|올|볼|줄|는|던|운|된|한|인|진|난|신|른)$/.test(p))return 2.2;      // 꾸밈 끝 뒤 (조사 '는'은 위에서 걸러짐)
 return 1.2;
}
// 최소 줄 수는 유지하면서 줄 길이가 고르게, 그리고 뜻이 끊기지 않는 곳에서 나눈다. 마지막 줄에 한두 글자만 남는 것을 막는다.
// 한 장에 maxLines 줄을 넘으면 장이 바뀌는 줄 끝은 더 엄격하게 고른다.
function balance(chars,m,rowCount){
 const words=[];let s=0;for(let i=0;i<=chars.length;i++)if(i===chars.length||/\s/.test(chars[i].ch)){if(i>s)words.push([s,i]);s=i+1;}
 const n=words.length;if(n<rowCount)return null;
 const cache=new Map(),text=(a,b)=>chars.slice(words[a][0],words[b-1][1]).map(c=>c.ch).join('');
 const unit=(m.width*.3)**2,per=m.maxLines||rowCount;
 const cost=(a,b,k)=>{const key=(a*1000+b)*2+(k%per===0&&k<rowCount?1:0);if(cache.has(key))return cache.get(key);const str=text(a,b),w=m.measure(str);let v=w>m.width?Infinity:(m.width-w)**2;
  if(v<Infinity&&b<n){let sc=breakScore(text(b-1,b),text(b,b+1));if(w<m.width*.45&&sc>.4)sc=Math.max(sc,1.2);   // 너무 짧은 줄은 좋은 곳이어도 덤을 주지 않는다
  v=v*Math.min(1,sc)+unit*Math.max(0,sc-.6)*(key%2?2.5:1);}
  cache.set(key,v);return v;};
 const dp=Array.from({length:rowCount+1},()=>Array(n+1).fill(Infinity)),from=Array.from({length:rowCount+1},()=>Array(n+1).fill(0));dp[0][0]=0;
 for(let k=1;k<=rowCount;k++)for(let j=k;j<=n;j++)for(let a=k-1;a<j;a++){if(dp[k-1][a]===Infinity)continue;const v=dp[k-1][a]+cost(a,j,k);if(v<dp[k][j]){dp[k][j]=v;from[k][j]=a;}}
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
// 잠언 한 항목을 한 장으로 만든다. 줄이 넘치면 앞 장은 3줄과 ">>"로 끝내고 남은 글을 다음 장에 이어 넣는다.
// "1." 처럼 번호만 떨어져 나온 첫 문장을 다음 문장에 붙인다.
function glueNumber(chunks){if(chunks.length>1&&/^\d+\s*[.)]$/.test(chunks[0].map(c=>c.ch).join('').trim()))return [[...chunks[0],{ch:' ',red:false,start:chunks[0].at(-1).end,end:chunks[0].at(-1).end},...chunks[1]],...chunks.slice(2)];return chunks;}
function proverbSpecs(block,options){
 let layout=block.layout||'proverb';if(layout==='word'){const text=block.chars.map(c=>c.ch).join('');layout=/[（(]?[가-힣]{1,8}\s*\d+\s*[:장]\s*\d+/.test(text)?'verse':speakerLayout(text,options.greenLayout||'word');}const m=metrics(layout,options.bank),cap=m.maxLines,items=glueNumber(sentences(block.chars)).map(ch=>wrap(ch,m)),pages=[];let rest=items.flat(),queue=items.map(x=>[...x]);
 const take=n=>{const page=[];while(queue.length&&page.length<n){const head=queue[0];if(page.length&&page.length+head.length>n)break;const k=Math.min(n-page.length,head.length);page.push(...head.splice(0,k));if(!head.length)queue.shift();}return page;};
 const total=()=>queue.reduce((a,x)=>a+x.length,0);
 while(total()>cap)pages.push(take(layout==='caption'?cap:Math.max(1,cap-1)));if(total())pages.push(take(cap));
 const group=crypto.randomUUID();
 return pages.map((lines,i)=>{const chars=lines.flat(),start=chars.find(c=>c.end>c.start)?.start,end=[...chars].reverse().find(c=>c.end>c.start)?.end;return {layout,text:lines.map(markup).join('\n')+(layout!=='caption'&&i<pages.length-1?'\n>>':''),start,end,padToLines:0,group:crypto.randomUUID(),cumulative:false,step:1};}).filter(x=>Number.isInteger(x.start)&&x.end>x.start);
}
function analyze(project,options={}){
 const rules=window.CaptionContentRules;if(!rules)throw Error('제작 규칙을 불러오지 못했습니다. 페이지를 새로 열어 주세요.');
 const result=[];for(const block of rules.automatic(project).blocks){result.push(...proverbSpecs(block,options));if(result.length>500)throw Error('자막이 500장을 넘습니다. 원고를 나누어 만들어 주세요.');}return result;
}
async function prepare(){const bank=await templates();await Promise.all(Object.values(bank).map(s=>{const r=s.shapes[s.bodyIndex].paragraphs[0].runs.find(r=>r.size);return /마루\s*부리/i.test(r?.font||'')?document.fonts.load(`${r.bold?700:400} ${r.size}px "PROM MaruBuri"`).catch(()=>{}):Promise.resolve();}));return bank;}
async function generate(project,options={}){const bank=await prepare(),specs=analyze(project,{...options,bank});if(!specs.length)throw Error('자막으로 만들 색상 표시나 여러 번호 항목이 없습니다. 자막을 생성하지 않습니다.');const slides=[],links=[];if(options.title){slides.push(await scene('cover',options.title,{date:options.date}));links.push({status:'unlinked',start:null,end:null,score:0,reason:'cover'});}for(const spec of specs){const slide=await scene(spec.layout,spec.text,{padToLines:spec.padToLines});slide.editor.group=spec.group;slide.editor.cumulative=spec.cumulative;slide.editor.step=spec.step;slides.push(slide);links.push({status:'exact',start:spec.start,end:spec.end,score:1,reason:'source'});}return {slides,links,summary:`${CaptionContentRules.automatic(project).label}을 자동 인식해 자막 ${specs.length}장 (하단 ${specs.filter(s=>s.layout==='caption').length}장 · 전체 화면 ${specs.filter(s=>s.layout!=='caption').length}장)을 만들었습니다.`};}
async function restyle(slides){await prepare();const groups=new Map();for(const s of slides)if(s.editor?.group)groups.set(s.editor.group,s);const out=[];for(const s of slides){if(!s.editor){out.push(s);continue;}const e=s.editor,final=groups.get(e.group)||s,layout=e.layout.startsWith('word')?speakerLayout(final.editor.text,e.layout):e.layout,rebuilt=await scene(layout,e.text,{uid:s.uid,ref:e.ref,date:e.date,padToLines:e.padToLines});for(const key of ['group','cumulative','step'])if(e[key]!==undefined)rebuilt.editor[key]=e[key];if(window.CaptionMedia)CaptionMedia.keep(rebuilt,s);else rebuilt.shapes.push(...s.shapes.filter(sh=>sh.extraText).map(clone));out.push(rebuilt);}return out;}
return {templates,snapshotTemplate,useTemplate,theme:async()=>{await templates();return themeXml;},scene,generate,analyze,restyle,speakerLayout,metrics,plain,styledRuns,colorType,layouts};
})();
