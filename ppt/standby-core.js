/* Standby is separate from the caption deck and its manuscript cue numbers. */
(function(root){
'use strict';
function valid(slide){return !!slide&&Number.isFinite(slide.width)&&slide.width>0&&slide.width<20000&&Number.isFinite(slide.height)&&slide.height>0&&slide.height<20000&&typeof slide.text==='string'&&Array.isArray(slide.shapes)&&slide.shapes.length<=2000;}
function frame(project,live,forceGreen=false){const caption=live>=0?project.slides[live]:null,standby=valid(project.standby?.slide)?project.standby.slide:null,slide=caption||(!forceGreen?standby:null);return {type:'frame',slide:slide||null,index:caption?live:slide?-2:-1,green:'#00ff00',fallback:standby,label:caption?`${live+1}번 자막 송출`:slide?'기본예배화면':'녹색 대기'};}
function imageSlide(src,width,height){if(!/^data:image\/(png|jpeg|gif|webp|bmp);base64,/.test(src)||!(width>0&&height>0))throw Error('PNG·JPG·GIF·WEBP·BMP 이미지를 선택하세요.');const scale=Math.min(1920/width,1080/height),w=width*scale,h=height*scale;return {renderVersion:2,width:1920,height:1080,text:'',background:'#101722',shapes:[{type:'image',manualGeometry:true,x:(1920-w)/2,y:(1080-h)/2,w,h,src}]};}
const api={valid,frame,imageSlide};if(typeof module==='object'&&module.exports)module.exports=api;else root.CaptionStandbyCore=api;
})(typeof window==='object'?window:globalThis);
