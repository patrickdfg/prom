/* 5·6·7줄 슬라이드를 같은 크기로 세로 연결하는 발표 화면. */
window.PromScrollView=class {
  constructor(host){this.host=host;this.key='';this.rows=[];this.slides=[];this.position='';this.layout='';}
  update(data){
    const key=JSON.stringify([data.lines,data.document||[]]);
    if(key!==this.key){
      this.key=key;this.position='';this.layout='';this.host.replaceChildren();this.rows=[];this.slides=[];
      const content=document.createElement('div');content.className='scroll-content';
      (data.document||[]).forEach((pg,pi)=>{
        const slide=document.createElement('section');slide.className='scroll-page';
        const body=document.createElement('div');body.className='scroll-page-body';slide.appendChild(body);
        const count=Math.max(1,data.lines,pg.length);
        for(let li=0;li<count;li++){
          const row=document.createElement('div');row.className='scroll-line';
          const wrap=document.createElement('span');
          for(const r of pg[li]||[]){const span=document.createElement('span');span.textContent=r.t;if(['b','r','n'].includes(r.c))span.className=r.c;wrap.appendChild(span);}
          row.appendChild(wrap);body.appendChild(row);this.rows.push({el:row,wrap,pi,li});
        }
        const mark=document.createElement('div');mark.className='scroll-page-number';mark.textContent=`${pi+1}쪽`;slide.appendChild(mark);
        content.appendChild(slide);this.slides.push({el:slide,count});
      });
      this.host.appendChild(content);
    }
    const height=this.host.clientHeight||innerHeight;
    const layout=`${innerWidth}:${innerHeight}:${height}`;
    if(layout!==this.layout){
      this.layout=layout;this.position='';
      for(const slide of this.slides){
        slide.el.style.height=height+'px';
        // 일반 슬라이드쇼와 같은 글자 크기 및 82% 본문 영역.
        slide.el.style.fontSize=Math.min(innerHeight*.76/(slide.count*1.7),innerWidth*.052,(height*.82-2)/(slide.count*1.2))+'px';
      }
      for(const row of this.rows){row.wrap.style.transform='';const width=row.wrap.scrollWidth,max=row.el.clientWidth;if(width>max&&max>0)row.wrap.style.transform=`scale(${max/width})`;}
    }
    this.host.classList.toggle('scroll-dark',data.dark);
    const inPage=this.rows.filter(r=>r.pi===data.page);
    const current=inPage.find(r=>data.ranges?.[r.pi]?.[r.li]?.[1]>data.cursor)||inPage.filter(r=>data.ranges?.[r.pi]?.[r.li]).at(-1)||inPage[0];
    for(const r of this.rows){const range=data.ranges?.[r.pi]?.[r.li];r.el.classList.toggle('scroll-current',r===current);r.el.classList.toggle('scroll-read',!!data.dim&&!!range&&range[1]>range[0]&&range[1]<=data.cursor);}
    const position=current?`${current.pi}:${current.li}`:'';
    if(current&&position!==this.position){this.position=position;requestAnimationFrame(()=>{if(!current.el.isConnected)return;const top=current.el.getBoundingClientRect().top-this.host.getBoundingClientRect().top+this.host.scrollTop;this.host.scrollTo({top:Math.max(0,top-height*.3),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});}
  }
};
