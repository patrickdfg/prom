/* 일반/스크롤 슬라이드쇼가 공유하는 원고 크기. */
(function(root){
  const api={measure(width,height,lines){
    const count=Math.max(1,Number(lines)||5),ratio=210/118;
    const pageHeight=Math.min(height,width/ratio),pageWidth=pageHeight*ratio;
    const inset=count===7?.1339:count===6?.0882:.0424;
    return {width:pageWidth*.9524,height:pageHeight*(1-2*inset),font:pageHeight*11.29/118*5/count};
  }};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.PromSlideLayout=api;
})(typeof window==='object'?window:globalThis);
