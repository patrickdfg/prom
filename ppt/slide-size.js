// 슬라이드 크기 맞추기: 한 덱 안에 960×540(앱 기본 레이아웃)과 1280×720(불러온 PPT)처럼 크기가 다른 슬라이드가 섞이면
// PPTX로 내보낼 수 없다. 모든 슬라이드를 한 크기로(기본 1920×1080) 비율에 맞춰 키우거나 줄인다.
// 길이 단위인 값(위치·크기·글자 크기·글자 간격·들여쓰기·여백·테두리 두께, px 단위 줄 간격)만 곱하고, 비율·개수·색은 그대로 둔다.
(function(root){
'use strict';
const DEFAULT_W=1920,DEFAULT_H=1080;
const mul=(o,k,keys)=>{for(const key of keys)if(typeof o[key]==='number')o[key]*=k;};
const px=(v,k)=>{if(v&&typeof v==='object'&&v.unit==='px'&&typeof v.value==='number')v.value*=k;};
// 전체 배경만 늘린다. 하단 자막판·인물·로고와 직접 위치를 고친 그림은 유지한다.
function fullBleed(s,slide){
  if(s.type!=='image'||s.rotate)return false;
  if(s.background)return true;
  if(s.manualGeometry)return false;
  const ex=slide.width*.1,ey=slide.height*.1;
  return Math.abs(s.x)<=ex&&Math.abs(s.y)<=ey&&Math.abs(slide.width-s.x-s.w)<=ex&&Math.abs(slide.height-s.y-s.h)<=ey;
}
function backgroundBox(s,slide){return fullBleed(s,slide)?{x:0,y:0,w:slide.width,h:slide.height}:{};}
// 한 슬라이드를 W×H로 맞춘다(비율이 다르면 작은 쪽에 맞춰 가운데에 둔다). 새 객체를 돌려주지 않고 그 자리에서 고친다.
function fit(slide,W=DEFAULT_W,H=DEFAULT_H){
  const sw=slide.width,sh=slide.height;
  const backgrounds=(slide.shapes||[]).filter(s=>fullBleed(s,slide));
  const fill=()=>{for(const s of backgrounds)Object.assign(s,{x:0,y:0,w:W,h:H});};
  if(!(sw>0&&sh>0)||(sw===W&&sh===H)){slide.width=W;slide.height=H;fill();return slide;}
  const k=Math.min(W/sw,H/sh),ox=(W-sw*k)/2,oy=(H-sh*k)/2;
  for(const s of slide.shapes||[]){
    if(typeof s.x==='number')s.x=ox+s.x*k;if(typeof s.y==='number')s.y=oy+s.y*k;
    mul(s,k,['w','h']);
    if(Array.isArray(s.padding))s.padding=s.padding.map(n=>typeof n==='number'?n*k:n);
    if(s.line&&typeof s.line.width==='number')s.line.width*=k;
    for(const p of s.paragraphs||[]){
      mul(p,k,['defaultSize','indent','marginLeft','marginRight','tabSize']);
      px(p.lineSpacing,k);px(p.spaceBefore,k);px(p.spaceAfter,k);
      for(const r of p.runs||[])mul(r,k,['size','spacing','kerning']);
    }
  }
  const e=slide.editor;
  if(e){
    if(typeof e.x==='number')e.x=ox+e.x*k;if(typeof e.y==='number')e.y=oy+e.y*k;
    mul(e,k,['w','h','size']);px(e.lineSpacing,k);
  }
  slide.width=W;slide.height=H;fill();return slide;
}
// 덱 전체를 W×H로 맞춘다. 크기를 안 주면 기본(1920×1080). 전체 배경은 같은 크기여도 가장자리까지 채운다.
function unify(slides,W=DEFAULT_W,H=DEFAULT_H){for(const s of slides||[])fit(s,W,H);return slides;}
// 내보내기 보호: 덱의 첫 슬라이드 크기에 나머지를 맞춘다.
function toFirst(slides){if(!slides?.length)return slides;return unify(slides,slides[0].width,slides[0].height);}
const api={fit,unify,toFirst,fullBleed,backgroundBox,DEFAULT_W,DEFAULT_H};
if(typeof module==='object'&&module.exports)module.exports=api;else root.CaptionSize=api;
})(typeof window==='object'?window:globalThis);
