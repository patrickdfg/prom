// 크기가 섞인 슬라이드를 한 크기(기본 1920×1080)로 비율에 맞춰 맞추는지 확인한다.
const assert=require('node:assert/strict');
const S=require('../slide-size.js');
const mk=(w,h)=>({width:w,height:h,background:'#00ff00',shapes:[
  {type:'image',x:0,y:0,w:w,h:h,rotate:0,src:'data:image/png;base64,AA=='},
  {type:'text',x:100,y:200,w:400,h:80,padding:[4,8,4,8],anchor:'ctr',lineReduction:.1,paragraphs:[
    {defaultSize:30,indent:12,marginLeft:6,marginRight:6,tabSize:20,lineSpacing:{unit:'px',value:40},spaceBefore:{unit:'px',value:6},spaceAfter:{unit:'pct',value:1.2},
     runs:[{text:'가나다',size:32,spacing:1.5,kerning:12,baseline:30,bold:true,color:'#111111'}]}]},
  {type:'rect',x:50,y:60,w:200,h:100,color:'#112233',line:{width:3,color:'#ffffff'}}],
  editor:{layout:'caption',x:100,y:200,w:400,h:80,size:32,step:1,padToLines:3,lineSpacing:{unit:'px',value:40}}});
// 960×540 → 1920×1080: 정확히 2배
const a=S.fit(mk(960,540));
assert.equal(a.width,1920);assert.equal(a.height,1080);
assert.deepEqual([a.shapes[0].x,a.shapes[0].y,a.shapes[0].w,a.shapes[0].h],[0,0,1920,1080],'배경 그림은 화면 전체');
const t=a.shapes[1];assert.deepEqual([t.x,t.y,t.w,t.h],[200,400,800,160]);assert.deepEqual(t.padding,[8,16,8,16]);
const p=t.paragraphs[0],r=p.runs[0];
assert.deepEqual([p.defaultSize,p.indent,p.marginLeft,p.marginRight,p.tabSize],[60,24,12,12,40]);
assert.equal(p.lineSpacing.value,80,'px 줄 간격은 곱함');assert.equal(p.spaceBefore.value,12);assert.equal(p.spaceAfter.value,1.2,'비율(pct) 간격은 그대로');
assert.deepEqual([r.size,r.spacing,r.kerning],[64,3,24]);assert.equal(r.baseline,30,'baseline(%)·굵기·색은 그대로');assert.equal(r.bold,true);assert.equal(r.color,'#111111');
assert.equal(t.lineReduction,.1,'비율 값은 그대로');assert.equal(a.shapes[2].line.width,6,'테두리 두께');
assert.deepEqual([a.editor.x,a.editor.y,a.editor.w,a.editor.h,a.editor.size],[200,400,800,160,64]);assert.equal(a.editor.step,1);assert.equal(a.editor.padToLines,3,'개수는 그대로');assert.equal(a.editor.lineSpacing.value,80);
// 1280×720 → 1920×1080: 1.5배
const b=S.fit(mk(1280,720));assert.equal(b.shapes[1].x,150);assert.equal(b.shapes[1].paragraphs[0].runs[0].size,48);assert.equal(b.shapes[0].w,1920);
// 이미 같은 크기면 그대로
const c=mk(1920,1080),before=JSON.stringify(c);S.fit(c);assert.equal(JSON.stringify(c),before,'같은 크기는 건드리지 않음');
// 비율이 다르면(4:3) 작은 쪽에 맞추고 가운데에 둔다
const d=S.fit(mk(1024,768));assert.equal(d.width,1920);assert.equal(d.height,1080);const k=1080/768;assert.ok(Math.abs(d.shapes[0].w-1024*k)<1e-9);assert.ok(Math.abs(d.shapes[0].x-(1920-1024*k)/2)<1e-9,'가운데 정렬');
// 섞인 덱 한꺼번에
const deck=[mk(1280,720),mk(960,540),mk(1920,1080),mk(960,540)];S.unify(deck);assert.ok(deck.every(s=>s.width===1920&&s.height===1080));
// 첫 슬라이드 크기에 맞추기(내보내기 보호)
const e=[mk(1280,720),mk(960,540)];S.toFirst(e);assert.ok(e.every(s=>s.width===1280&&s.height===720));assert.equal(e[1].shapes[1].x,100*(1280/960),'960→1280은 4/3배');
// 이상한 값(크기 없음)은 던지지 않고 기본 크기로
const f={shapes:[]};S.fit(f);assert.equal(f.width,1920);
console.log('PASS slide size: 960·1280·4:3 → 1920×1080, 길이 값만 곱하고 비율·개수·색은 유지');
