/* 쪽 사이의 빈 공간 없이 실제 원고 줄을 일정한 간격으로 잇는다. */
window.PromScrollView=class {
  static getScale(){try{const n=Number(localStorage.getItem('promScrollTextScale'));if(n>=60&&n<=180)return n;}catch(_){}return this.zoom||100;}
  static setScale(value){const n=Math.max(60,Math.min(180,Math.round(Number(value)/10)*10||100));this.zoom=n;try{localStorage.setItem('promScrollTextScale',String(n));}catch(_){}return n;}
  constructor(host){this.host=host;this.key='';this.rows=[];this.gaps=[];this.position='';this.layout='';}
  currentRow(data){
    const spoken=this.rows.filter(r=>{const range=data.ranges?.[r.pi]?.[r.li];return range&&range[1]>range[0];});
    // The page may advance early; only consumed text determines the scroll position.
    return spoken.find(r=>data.cursor<data.ranges[r.pi][r.li][1])||spoken.at(-1)||this.rows.find(r=>r.pi===data.page)||this.rows[0];
  }
  update(data){
    const key=JSON.stringify([data.lines,data.document||[]]);
    if(key!==this.key){
      this.key=key;this.position='';this.layout='';this.host.replaceChildren();this.rows=[];this.gaps=[];
      const content=document.createElement('div');content.className='scroll-content';
      const body=document.createElement('div');body.className='scroll-flow';content.appendChild(body);
      let pendingGap=false;
      (data.document||[]).forEach((pg,pi)=>{
        const nonempty=pg.map((runs,i)=>runs.map(r=>r.t).join('').replace(/\s*>>\s*$/,'').trim()?i:-1).filter(i=>i>=0);
        const first=nonempty[0],last=nonempty.at(-1);
        const count=pg.length;
        for(let li=0;li<count;li++){
          const row=document.createElement('div');row.className='scroll-line';
          const wrap=document.createElement('span');
          const runs=pg[li]||[];
          // 화면에 그릴 때만 쪽 넘김 기호를 제외한다. 원고와 음성 추적 인덱스는 유지한다.
          let remaining=runs.map(r=>r.t).join('').replace(/\s*>>\s*$/,'').length;
          for(const r of runs){const text=r.t.slice(0,remaining);remaining=Math.max(0,remaining-r.t.length);if(!text)continue;const span=document.createElement('span');span.textContent=text;if(['b','r','n'].includes(r.c))span.className=r.c;wrap.appendChild(span);}
          const range=data.ranges?.[pi]?.[li];
          if(!wrap.textContent.trim()){
            // Only an interior blank is source spacing; page edge padding is discarded.
            if(li>first&&li<last)pendingGap=true;
            continue;
          }
          if(range&&range[1]===range[0])continue;
          if(this.rows.length&&(pendingGap||runs.some(r=>r.paragraphStart))){
            const gap=document.createElement('div');gap.className='scroll-paragraph-gap';gap.setAttribute('aria-hidden','true');body.appendChild(gap);this.gaps.push(gap);
          }
          pendingGap=false;
          row.appendChild(wrap);body.appendChild(row);this.rows.push({el:row,wrap,pi,li});
        }
      });
      this.host.appendChild(content);
    }
    const height=this.host.clientHeight||innerHeight;
    const scale=PromScrollView.getScale()/100,anchor=Number.isFinite(data.readingAnchor)?Math.max(0,Math.min(.5,data.readingAnchor)):.3;
    const layout=`${this.host.clientWidth}:${height}:${scale}:${anchor}`;
    const relayout=layout!==this.layout;
    if(relayout){
      this.layout=layout;this.position='';
      const metrics=PromSlideLayout.measure(this.host.clientWidth||innerWidth,height,Math.max(1,data.lines));
      this.pitch=metrics.height/Math.max(1,data.lines)*scale;
      this.host.firstElementChild.style.paddingTop=(height*anchor)+'px';
      this.host.firstElementChild.style.paddingBottom=(height*(1-anchor))+'px';
      const flow=this.host.querySelector('.scroll-flow');
      flow.style.width=metrics.width+'px';flow.style.margin='0 auto';
      flow.style.fontSize=(metrics.font*scale)+'px';
      for(const row of this.rows)row.el.style.height=this.pitch+'px';
      for(const gap of this.gaps)gap.style.height=this.pitch+'px';
      for(const row of this.rows){row.wrap.style.transform='';const width=row.wrap.scrollWidth,max=row.el.clientWidth;if(width>max&&max>0)row.wrap.style.transform=`scale(${max/width})`;}
    }
    this.host.classList.toggle('scroll-dark',data.dark);
    const current=this.currentRow(data);
    for(const r of this.rows){const range=data.ranges?.[r.pi]?.[r.li];r.el.classList.toggle('scroll-current',r===current);r.el.classList.toggle('scroll-read',!!data.dim&&!!range&&range[1]>range[0]&&range[1]<=data.cursor);}
    const position=current?`${current.pi}:${current.li}`:'';
    if(current&&position!==this.position){this.position=position;requestAnimationFrame(()=>{if(!current.el.isConnected||this.position!==position)return;const top=current.el.getBoundingClientRect().top-this.host.getBoundingClientRect().top+this.host.scrollTop,target=Math.max(0,top-height*anchor);if(relayout){window.PromSmoothScroll?.cancel(this.host);this.host.scrollTop=target;}else if(window.PromSmoothScroll)window.PromSmoothScroll.to(this.host,target,{maxSpeed:Math.abs(target-this.host.scrollTop)>height*2?Infinity:this.pitch*2});else this.host.scrollTo({top:target,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});}
  }
};
