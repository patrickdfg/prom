/* 조작창과 슬라이드쇼가 공유하는 연속 원고 표시. */
window.PromScrollView=class {
  constructor(host){this.host=host;this.key='';this.rows=[];this.position='';}
  update(data){
    const key=JSON.stringify(data.document||[]);
    if(key!==this.key){
      this.key=key;this.position='';this.host.replaceChildren();this.rows=[];
      const content=document.createElement('div');content.className='scroll-content';
      (data.document||[]).forEach((pg,pi)=>{
        const mark=document.createElement('div');mark.className='scroll-page-number';mark.textContent=`${pi+1}쪽`;content.appendChild(mark);
        pg.forEach((runs,li)=>{
          const row=document.createElement('div');row.className='scroll-line';
          for(const r of runs){const span=document.createElement('span');span.textContent=r.t;if(['b','r','n'].includes(r.c))span.className=r.c;row.appendChild(span);}
          this.rows.push({el:row,pi,li});content.appendChild(row);
        });
      });
      this.host.appendChild(content);
    }
    this.host.classList.toggle('scroll-dark',data.dark);
    let current=this.rows.find(r=>r.pi===data.page&&data.ranges?.[r.pi]?.[r.li]?.[1]>data.cursor)||this.rows.filter(r=>r.pi===data.page).at(-1);
    for(const r of this.rows){const range=data.ranges?.[r.pi]?.[r.li];r.el.classList.toggle('scroll-current',r===current);r.el.classList.toggle('scroll-read',!!data.dim&&!!range&&range[1]>range[0]&&range[1]<=data.cursor);}
    const position=current?`${current.pi}:${current.li}`:'';
    if(current&&position!==this.position){this.position=position;requestAnimationFrame(()=>{if(!current.el.isConnected)return;this.host.scrollTo({top:Math.max(0,current.el.offsetTop-this.host.clientHeight*.3),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});}
  }
};
