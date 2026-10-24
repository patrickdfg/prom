const fs=require('node:fs'),vm=require('node:vm'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const source=fs.readFileSync('index.html','utf8');
const c={TextDecoder,Uint8Array,DataView,localStorage:{getItem(){return null}}};vm.createContext(c);
vm.runInContext([...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)][2][1],c);
vm.runInContext(source.slice(source.indexOf('function parseTagged('),source.indexOf('/* ---------- 워드')),c);
c.inflateRaw=async bytes=>new Uint8Array(zlib.inflateRawSync(bytes));
vm.runInContext(source.slice(source.indexOf('const pw='),source.indexOf('// 프롬프터 대본(쪽)을 모바일용')),c);
const para=(text,extra={})=>({runs:[{t:text,hex:'000000'}],pb:false,...extra});
const text=pg=>pg.map(l=>l.filter(r=>r.c!=='r').map(r=>r.t).join('').replace(/\s*>>$/,'')).filter(Boolean);
const compact=t=>t.replace(/\s/g,'');
const fixtures=[
  [para('첫째 문장을 읽습니다. 이어지는 설명을 읽습니다.'),para(''),para('새 문단은 반드시 새 페이지부터 읽습니다.')],
  [para('1. 첫 번째 내용은 번호와 같은 줄에서 시작합니다.'),para('이어지는 내용입니다.'),para('2. 두 번째 설명도 번호와 분리하지 않습니다.')],
  [para('1) 첫 번째 항목은 괄호 번호를 붙여 읽습니다.'),para('① 원 안의 번호도 내용과 함께 읽습니다.')],
  [para('자동 번호의 첫째 설명입니다.',{num:'1.'}),para('자동 번호의 둘째 설명입니다.',{num:'2.'}),para('자동 번호의 셋째 설명입니다.',{num:'3.'})],
  [para('원고 앞쪽 내용입니다.'),para(''),para('<소제목>'),para(''),para('소제목 다음의 본문을 읽습니다.')],
  [para('앞쪽 문장입니다.'),para('명시적인 쪽 나눔 뒤의 문장입니다.',{pb:true})],
  [para('3.14 값을 확인합니다. 2026.10.24 날짜도 그대로 둡니다.')]
];
function check(paras,K){
  const original=JSON.stringify(paras),units=c.buildUnits(paras),lines=units.flatMap(c.wrapUnit),pages=c.buildPrompter(paras,K);
  const expected=units.flatMap(u=>u.words).map(w=>w.segs.map(s=>s.t).join('')).join('');
  assert.equal(compact(pages.flatMap(text).join('')),compact(expected),'all text and numbering preserved');
  for(const pg of pages){
    assert(pg.length<=K,'page row limit');
    const nonempty=pg.filter(l=>l.some(r=>r.t.trim()&&r.t.trim()!=='>>'));
    assert(nonempty.every((l,i)=>i===0||!l.some(r=>r.paragraphStart)),'a new block must begin on a fresh page');
    assert(text(pg).every(t=>!/^\d+[.)]$/.test(t.trim())),'number must not occupy a separate line');
  }
  assert.equal(JSON.stringify(paras),original,'source formatting, marks and text are immutable');
  return {pages,lines};
}
for(const K of [5,6,7])for(const paras of fixtures)check(paras,K);
const headed=check(fixtures[3],5).pages;
assert(headed.some(pg=>text(pg).some(t=>t.includes('<소제목>'))&&text(pg).some(t=>t.includes('본문'))),'short heading stays with its following paragraph');
const colored=[{runs:[{t:'1.',hex:'FF0000'},{t:' 강조한 첫 단어와 나머지 문장을 읽습니다.',hex:'0000FF'}],marks:[{off:8,page:2}]}];
const coloredPages=check(colored,5).pages;
assert(coloredPages.flat(2).some(r=>r.c==='b'&&r.t.includes('1.')),'number color preserved');
assert(coloredPages.flat(2).some(r=>r.c==='r'&&r.t==='2'),'source page marker preserved');
vm.runInContext('MOBILE=true',c);
const mobile=c.buildPrompter(fixtures[0],10);assert(mobile[0].some(l=>l.length===0),'mobile retains paragraph gap within its scrolling page');
assert(mobile[0].some(l=>l.some(r=>r.paragraphStart)));
vm.runInContext('MOBILE=false',c);
const existing=c.parseTxt('첫째 줄\n둘째 줄\n셋째 줄\n넷째 줄\n다섯째 줄');
assert.equal(existing.length,1);assert.equal(text(existing[0]).join('|'),'첫째 줄|둘째 줄|셋째 줄|넷째 줄|다섯째 줄','preformatted prompter unchanged');
(async()=>{
  if(process.argv[2]){
    const {pages}=await c.parseHwp(fs.readFileSync(process.argv[2]));assert(pages.ms,'actual HWP recognized as manuscript');
    for(const K of [5,6,7])check(pages.ms,K);
    const result=c.buildPrompter(pages.ms,5);
    console.log('PASS actual HWP import, 5/6/7-row paragraph boundaries, numbering, source content and colors; '+result.length+' pages at 5 rows');
  }
  console.log('PASS blank paragraphs, explicit page breaks, heading attachment, typed/automatic numbering, decimals, colors, page marks, mobile and existing prompter');
})().catch(e=>{console.error(e);process.exitCode=1});
