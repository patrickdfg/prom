// 프롬프터 원고를 쪽마다 슬라이드 한 장인 PPTX로 만든다(16:9, 지금 배경색·강조색 그대로, 글자 수정 가능).
window.PromPptx=(()=>{
'use strict';
const W=12192000,H=6858000;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const x=s=>'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+s;
const NS='xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const tree='<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
function colors(dark){return {bg:dark?'000000':'FFFFFF',k:dark?'FFFFFF':'000000',b:dark?'FFFF00':'0000FF',r:'FF0000',n:'FF0000'};}
function run(r,size,col){const c=col[r.c]||col.k,sz=Math.round((r.c==='n'?size*.6:size)*100);
  return '<a:r><a:rPr lang="ko-KR" sz="'+sz+'" b="1" dirty="0"><a:solidFill><a:srgbClr val="'+c+'"/></a:solidFill><a:latin typeface="Malgun Gothic"/><a:ea typeface="Malgun Gothic"/></a:rPr><a:t>'+esc(r.t)+'</a:t></a:r>';}
function slide(lines,count,dark){
  const col=colors(dark),size=Math.max(18,Math.min(48,Math.floor(400/Math.max(5,count))));      // 7줄이면 57→48pt 상한, 줄이 많으면 작게
  const paras=(lines.length?lines:[[]]).map(l=>{const rs=l.filter(r=>r&&r.t);return '<a:p><a:pPr algn="ctr"><a:lnSpc><a:spcPct val="100000"/></a:lnSpc></a:pPr>'+(rs.length?rs.map(r=>run(r,size,col)).join(''):'')+'<a:endParaRPr lang="ko-KR" sz="'+size*100+'"/></a:p>';}).join('');
  return x('<p:sld '+NS+'><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="'+col.bg+'"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>'+tree+
    '<p:sp><p:nvSpPr><p:cNvPr id="2" name="원고"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="'+Math.round(W*.04)+'" y="'+Math.round(H*.05)+'"/><a:ext cx="'+Math.round(W*.92)+'" cy="'+Math.round(H*.9)+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>'+
    '<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="ctr"><a:normAutofit/></a:bodyPr><a:lstStyle/>'+paras+'</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>');
}
const theme=x('<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="PROM"><a:themeElements><a:clrScheme name="PROM"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F1F1F"/></a:dk2><a:lt2><a:srgbClr val="EEEEEE"/></a:lt2><a:accent1><a:srgbClr val="2683C6"/></a:accent1><a:accent2><a:srgbClr val="008000"/></a:accent2><a:accent3><a:srgbClr val="FF0000"/></a:accent3><a:accent4><a:srgbClr val="FFFF00"/></a:accent4><a:accent5><a:srgbClr val="888888"/></a:accent5><a:accent6><a:srgbClr val="0000FF"/></a:accent6><a:hlink><a:srgbClr val="0000FF"/></a:hlink><a:folHlink><a:srgbClr val="800080"/></a:folHlink></a:clrScheme><a:fontScheme name="PROM"><a:majorFont><a:latin typeface="Malgun Gothic"/><a:ea typeface="Malgun Gothic"/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Malgun Gothic"/><a:ea typeface="Malgun Gothic"/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="PROM"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>');
const master=x('<p:sldMaster '+NS+'><p:cSld><p:spTree>'+tree+'</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>');
const layout=x('<p:sldLayout '+NS+' type="blank" preserve="1"><p:cSld name="빈 화면"><p:spTree>'+tree+'</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>');
const rel=(id,type,target)=>'<Relationship Id="'+id+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/'+type+'" Target="'+target+'"/>';
const rels=list=>x('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+list.join('')+'</Relationships>');
// pages: [쪽][줄][{t,c}] , count: 한 쪽 줄 수, dark: 검정 배경 여부
async function create(pages,{count=5,dark=true,title='프롬프터'}={}){
  if(!window.JSZip)throw new Error('PPT를 만드는 도구를 불러오지 못했습니다.');
  const z=new JSZip(),n=pages.length;
  z.file('[Content_Types].xml',x('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'+pages.map((_,i)=>'<Override PartName="/ppt/slides/slide'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>').join('')+'</Types>'));
  z.file('_rels/.rels',rels([rel('rId1','officeDocument','ppt/presentation.xml'),'<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>']));
  z.file('docProps/core.xml',x('<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>'+esc(title)+'</dc:title><dc:creator>SERMON PROMPTER</dc:creator></cp:coreProperties>'));
  z.file('ppt/presentation.xml',x('<p:presentation '+NS+'><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>'+pages.map((_,i)=>'<p:sldId id="'+(256+i)+'" r:id="rId'+(i+3)+'"/>').join('')+'</p:sldIdLst><p:sldSz cx="'+W+'" cy="'+H+'"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>'));
  z.file('ppt/_rels/presentation.xml.rels',rels([rel('rId1','slideMaster','slideMasters/slideMaster1.xml'),rel('rId2','theme','theme/theme1.xml'),...pages.map((_,i)=>rel('rId'+(i+3),'slide','slides/slide'+(i+1)+'.xml'))]));
  z.file('ppt/theme/theme1.xml',theme);
  z.file('ppt/slideMasters/slideMaster1.xml',master);
  z.file('ppt/slideMasters/_rels/slideMaster1.xml.rels',rels([rel('rId1','slideLayout','../slideLayouts/slideLayout1.xml'),rel('rId2','theme','../theme/theme1.xml')]));
  z.file('ppt/slideLayouts/slideLayout1.xml',layout);
  z.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels',rels([rel('rId1','slideMaster','../slideMasters/slideMaster1.xml')]));
  pages.forEach((pg,i)=>{z.file('ppt/slides/slide'+(i+1)+'.xml',slide(pg,Math.max(count,pg.length),dark));z.file('ppt/slides/_rels/slide'+(i+1)+'.xml.rels',rels([rel('rId1','slideLayout','../slideLayouts/slideLayout1.xml')]));});
  return z.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.presentationml.presentation',compression:'DEFLATE'});
}
return {create};
})();
