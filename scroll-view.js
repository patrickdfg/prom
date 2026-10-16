/* 쪽 사이의 빈 공간 없이 실제 원고 줄을 일정한 간격으로 잇는다. */
window.PromScrollView=class {
  constructor(host){this.host=host;this.key='';this.rows=[];this.slides=[];this.position='';this.layout='';}
  currentRow(data){
    const spoken=this.rows.filter(r=>{const range=data.ranges?.[r.pi]?.[r.li];return range&&range[1]>range[0];});
    // The page may advance early; only consumed text determines the scroll position.
    return spoken.find(r=>data.cursor<data.ranges[r.pi][r.li][1])||spoken.at(-1)||this.rows.find(r=>r.pi===data.page)||this.rows[0];
  }
  update(data){
    const key=JSON.stringify([data.lines,data.document||[]]);
    if(key!==this.key){
      this.key=key;this.position='';this.layout='';this.host.replaceChildren();this.rows=[];this.slides=[];
      const content=document.createElement('div');content.className='scroll-content';
      (data.document||[]).forEach((pg,pi)=>{
        const slide=document.createElement('section');slide.className='scroll-page';
        const body=document.createElement('div');body.className='scroll-page-body';slide.appendChild(body);
        const count=pg.length;
        for(let li=0;li<count;li++){
          const row=document.createElement('div');row.className='scroll-line';
          const wrap=document.createElement('span');
          const runs=pg[li]||[];
          // 화면에 그릴 때만 쪽 넘김 기호를 제외한다. 원고와 음성 추적 인덱스는 유지한다.
          let remaining=runs.map(r=>r.t).join('').replace(/\s*>>\s*$/,'').length;
          for(const r of runs){const text=r.t.slice(0,remaining);remaining=Math.max(0,remaining-r.t.length);if(!text)continue;const span=document.createElement('span');span.textContent=text;if(['b','r','n'].includes(r.c))span.className=r.c;wrap.appendChild(span);}
          const range=data.ranges?.[pi]?.[li];
          if(!wrap.textContent.trim()||(range&&range[1]===range[0]))continue;
          row.appendChild(wrap);body.appendChild(row);this.rows.push({el:row,wrap,pi,li});
        }
        content.appendChild(slide);this.slides.push({el:slide,body,count:body.children.length});
      });
      this.host.appendChild(content);
    }
    const height=this.host.clientHeight||innerHeight;
    const layout=`${this.host.clientWidth}:${height}`;
    const relayout=layout!==this.layout;
    if(relayout){
      this.layout=layout;this.position='';
      const metrics=PromSlideLayout.measure(this.host.clientWidth||innerWidth,height,Math.max(1,data.lines));
      this.pitch=metrics.height/Math.max(1,data.lines);
      this.host.firstElementChild.style.paddingTop=(height*.3)+'px';
      this.host.firstElementChild.style.paddingBottom=(height*.7)+'px';
      for(const slide of this.slides){
        slide.el.style.height=(slide.count*this.pitch)+'px';
        slide.body.style.width=metrics.width+'px';slide.body.style.height=(slide.count*this.pitch)+'px';
        slide.el.style.fontSize=metrics.font+'px';
      }
      for(const row of this.rows){row.wrap.style.transform='';const width=row.wrap.scrollWidth,max=row.el.clientWidth;if(width>max&&max>0)row.wrap.style.transform=`scale(${max/width})`;}
    }
    this.host.classList.toggle('scroll-dark',data.dark);
    const current=this.currentRow(data);
    for(const r of this.rows){const range=data.ranges?.[r.pi]?.[r.li];r.el.classList.toggle('scroll-current',r===current);r.el.classList.toggle('scroll-read',!!data.dim&&!!range&&range[1]>range[0]&&range[1]<=data.cursor);}
    const position=current?`${current.pi}:${current.li}`:'';
    if(current&&position!==this.position){this.position=position;requestAnimationFrame(()=>{if(!current.el.isConnected||this.position!==position)return;const top=current.el.getBoundingClientRect().top-this.host.getBoundingClientRect().top+this.host.scrollTop,target=Math.max(0,top-height*.3);if(relayout){window.PromSmoothScroll?.cancel(this.host);this.host.scrollTop=target;}else if(window.PromSmoothScroll)window.PromSmoothScroll.to(this.host,target,{maxSpeed:Math.abs(target-this.host.scrollTop)>height*2?Infinity:this.pitch*2});else this.host.scrollTo({top:target,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});}
  }
};
