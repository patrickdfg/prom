/* Existing prom HWP 5 parser; return manuscript paragraphs without pagination. */
window.CaptionHwp=(()=>{
const paginate=paras=>paras;
async function inflateRaw(u8){
  const reader=new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const parts=[]; let n=0;
  try{ for(;;){const {done,value}=await reader.read(); if(done)break; parts.push(value); n+=value.length} }
  catch(e){ if(!n) throw new Error('hwp 압축을 풀 수 없습니다. 한글에서 hwpx로 저장해 다시 열어 주세요.') }
  const out=new Uint8Array(n); let o=0; for(const p of parts){out.set(p,o);o+=p.length}
  return out;
}
function* hwpRecords(u8){
  const dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength); let i=0;
  while(i+4<=u8.length){
    const h=dv.getUint32(i,true); i+=4;
    let size=h>>>20; if(size===0xfff){size=dv.getUint32(i,true);i+=4}
    yield {tag:h&0x3ff,lvl:(h>>>10)&0x3ff,data:u8.subarray(i,i+size)}; i+=size;
  }
}
// 8글자(16바이트) 자리를 차지하는 제어 문자. 10(줄바꿈)·13(문단 끝)·24~31 은 한 글자
const HWP_EXT=new Set([1,2,3,4,5,6,7,8,9,11,12,14,15,16,17,18,19,20,21,22,23]);
async function parseHwp(buf){
  let ole;
  try{ole=CFB.read(new Uint8Array(buf),{type:'array'})}catch(_){throw new Error('hwp 파일을 열 수 없습니다.')}
  // 경로는 'Root Entry/BodyText/Section0' 꼴이라 끝부분으로 찾는다
  const get=n=>{const i=ole.FullPaths.findIndex(p=>p.toLowerCase().endsWith('/'+n.toLowerCase()));
    const e=i<0?null:ole.FileIndex[i];return e&&e.content&&e.content.length?new Uint8Array(e.content):null};
  const fh=get('FileHeader');
  if(!fh||!new TextDecoder().decode(fh.subarray(0,17)).startsWith('HWP Document File'))
    throw new Error('한글 2002 이후의 hwp 파일이 아닙니다. 한글에서 hwpx로 저장해 주세요.');
  const flags=new DataView(fh.buffer,fh.byteOffset).getUint32(36,true);
  if(flags&2)throw new Error('암호가 걸린 hwp 파일입니다. 암호를 풀고 저장해 주세요.');
  if(flags&4)throw new Error('배포용 hwp 파일이라 읽을 수 없습니다. 한글에서 hwpx로 저장해 주세요.');
  const read=async n=>{const d=get(n);if(!d)return null;return (flags&1)?inflateRaw(d):d};
  const colors=[], numberings=[], pshapes=[];
  for(const r of hwpRecords(await read('DocInfo'))){
    if(r.tag===23){ // 문단 번호 정의: 7수준 × (속성4·너비2·거리2·글자모양4·번호 형식 문자열) 뒤에 시작 번호
      const dv=new DataView(r.data.buffer,r.data.byteOffset,r.data.byteLength), fm=[]; let k=0;
      try{ for(let lv=0;lv<7;lv++){ k+=12; const n=dv.getUint16(k,true); k+=2; fm.push(new TextDecoder('utf-16le').decode(r.data.subarray(k,k+2*n))); k+=2*n }
        const st=[]; for(let lv=0;lv<7;lv++){ const o=k+2+4*lv; st.push(o+4<=r.data.length?dv.getUint32(o,true):1) }
        numberings.push({fm,st}) }catch(_){ numberings.push(null) }
    }
    if(r.tag===25&&r.data.length>=32){ // 문단 모양: 머리 모양(0 없음·1 개요·2 번호·3 글머리표), 수준, 번호 정의 번호(1부터)
      const dv=new DataView(r.data.buffer,r.data.byteOffset,r.data.byteLength), a=dv.getUint32(0,true);
      pshapes.push({head:(a>>>23)&3,lvl:(a>>>25)&7,numId:dv.getUint16(30,true)});
    }
    if(r.tag===21&&r.data.length>=56){ // 글자 모양: 52바이트 위치가 글자색(COLORREF)
      const c=new DataView(r.data.buffer,r.data.byteOffset).getUint32(52,true);
      colors.push([c&255,(c>>8)&255,(c>>16)&255].map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase());
    }
  }
  const paras=[];
  for(let s=0;;s++){
    const sec=await read('BodyText/Section'+s); if(!sec)break;
    let cur=null;
    for(const r of hwpRecords(sec)){
      if(r.tag===66){ // 문단 머리: 11바이트 위치가 나누기 종류(1=구역, 4=쪽)
        if(r.lvl===0){cur={lvl:0,text:null,cs:[],ls:[],psid:r.data.length>=10?new DataView(r.data.buffer,r.data.byteOffset).getUint16(8,true):-1,pb:r.data.length>11&&(r.data[11]&5)!==0};paras.push(cur)} else cur=null;
      }else if(cur&&r.lvl===cur.lvl+1){
        if(r.tag===67)cur.text=r.data;
        else if(r.tag===69){const dv=new DataView(r.data.buffer,r.data.byteOffset,r.data.byteLength); // 줄 배치: 36바이트마다 글자 위치(4)·세로 위치(4)…
          for(let k=0;k+8<=r.data.length;k+=36)cur.ls.push([dv.getUint32(k,true),dv.getInt32(k+4,true)])}
        else if(r.tag===68){const dv=new DataView(r.data.buffer,r.data.byteOffset,r.data.byteLength);
          for(let k=0;k+8<=r.data.length;k+=8)cur.cs.push([dv.getUint32(k,true),dv.getUint32(k+4,true)])}
      }
    }
  }
  // 줄 배치의 세로 위치가 되감기면 원고의 다음 쪽이 시작된 것 (원고 쪽번호용)
  const cnt={};
  for(const pa of paras){      // 자동 문단 번호('1.' 등)는 글자가 아니라 문단 모양에 있으므로 따로 센다
    const ps=pshapes[pa.psid], nd=ps&&ps.numId>0?numberings[ps.numId-1]:null;
    if(!ps||!nd||(ps.head!==1&&ps.head!==2))continue;
    const c=cnt[ps.numId]||(cnt[ps.numId]=[0,0,0,0,0,0,0]), lv=Math.min(ps.lvl,6);
    c[lv]=c[lv]?c[lv]+1:Math.max(1,nd.st[lv]||1); for(let j=lv+1;j<7;j++)c[j]=0;
    pa.num=nd.fm[lv].replace(/\^(\d)/g,(m,d)=>c[+d-1]||0);
  }
  let pageNo=1, prevV=-1;
  for(const pa of paras){
    pa.marks=[];
    for(const [tp,v] of pa.ls){ if(v<prevV){pageNo++;pa.marks.push({pos:tp,page:pageNo})} prevV=v }
  }
  const out=paras.map(pa=>{
    const runs=[], marks=pa.marks; let mi=0, outLen=0;
    if(pa.text){
      const dv=new DataView(pa.text.buffer,pa.text.byteOffset,pa.text.byteLength), n=pa.text.length>>1;
      const colorAt=pos=>{let id=pa.cs.length?pa.cs[0][1]:0;for(const [st,cid] of pa.cs)if(st<=pos)id=cid;return colors[id]||'000000'};
      for(let k=0;k<n;){
        while(mi<marks.length&&marks[mi].pos<=k){marks[mi].off=outLen;mi++}
        const ch=dv.getUint16(k*2,true);
        let t=null;
        if(ch<32){ if(ch===10)t='\n'; else if(ch===9)t=' '; k+=HWP_EXT.has(ch)?8:1; }
        else{ t=String.fromCharCode(ch); k++; }
        if(t===null)continue;
        const hex=colorAt(k-(ch<32&&HWP_EXT.has(ch)?8:1));
        const last=runs[runs.length-1];
        if(last&&last.hex===hex)last.t+=t; else runs.push({t,hex});
        outLen+=t.length;
      }
    }
    while(mi<marks.length){marks[mi].off=outLen;mi++}
    return {runs,pb:pa.pb,marks,num:pa.num};
  });
  return {pages:paginate(out),bg:null};
}


return parseHwp;
})();
