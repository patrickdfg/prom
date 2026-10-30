// Regression tests for PROM's continuous editor reflow: pushes and pulls stay inside one paragraph block.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('index.html', 'utf8');
const c = {PromLineBreaks: require('../korean-line-breaks.js'), TextDecoder, Uint8Array, DataView, localStorage: {getItem() { return null; }}};
vm.createContext(c);
vm.runInContext([...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)][2][1], c);
vm.runInContext(source.slice(source.indexOf('function parseTagged('), source.indexOf('/* ---------- 워드')), c);
vm.runInContext(source.slice(source.indexOf('const pw='), source.indexOf('// 프롬프터 대본(쪽)을 모바일용')), c);
vm.runInContext(source.slice(source.indexOf('function pageEndsBlock('), source.indexOf('function commitEdit(){')), c);
c.LINES = 5; c.P = [];

const same = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);
const line = (t, extra = {}) => t ? [{t, c: 'k', ...extra}] : [];
const para = t => line(t, {paragraphStart: true});
const text = pg => pg.map(l => l.map(r => r.t).join('').replace(/\s*>>$/, '').trim()).filter(t => t && t !== '>>');
const flat = pages => pages.flatMap(text);
const copy = pg => pg.map(l => l.map(r => ({...r})));

// Block A is one full page (no filler, no >>); block B follows and starts with a paragraphStart line.
const A = [line('가나다.'), line('라마바.'), line('사아자.'), line('차카타.'), line('파하갸.')];
const B = [[], para('둘째 문단 첫 줄.'), line('둘째 문단 둘째 줄.'), [], []];

{ // overflow of a block-ending full page must not be glued onto the next paragraph
  assert.equal(c.pagesEndBlock([A, B], 0), true, 'full page followed by a new paragraph ends its block');
  const edited = copy(A); edited.push(line('넘친 줄.'));
  const r = c.ceReflowBlock([edited, B], 0, {page: 0, row: 5});
  assert.equal(r.start, 0); assert.equal(r.end, 0, 'reflow stops at the end of the block');
  assert(r.pages.length >= 2, 'overflow became a new page');
  assert(r.pages.every(pg => pg.length <= 5), 'page limit');
  same(flat(r.pages), ['가나다.', '라마바.', '사아자.', '차카타.', '파하갸.', '넘친 줄.'], 'all lines kept in order');
  assert(r.caret.page > 0, 'caret follows its line onto the new page');
  same(text([r.pages[r.caret.page - r.start][r.caret.row]]), ['넘친 줄.'], 'caret row is the moved line');
}
{ // a block spanning pages: overflow flows into the next page of the same block and stops at the block end
  const first = [para('하나.'), line('둘.'), line('셋.'), line('넷.'), line('다섯. >>')];
  const second = [[], line('여섯.'), line('일곱.'), [], []];
  const third = [[], para('다른 문단.'), [], [], []];
  assert.equal(c.pagesEndBlock([first, second, third], 0), false, 'a page ending with >> continues');
  assert.equal(c.pagesEndBlock([first, second, third], 1), true);
  const edited = copy(first); edited.splice(1, 0, line('끼운 줄.'));
  const r = c.ceReflowBlock([edited, second, third], 0, null);
  assert.equal(r.end, 1, 'reflow covers the two pages of this block only');
  same(flat(r.pages), ['하나.', '끼운 줄.', '둘.', '셋.', '넷.', '다섯.', '여섯.', '일곱.'], 'text order preserved');
  same(flat([third]), ['다른 문단.'], 'next paragraph is not an input of the reflow');
}
{ // deleting a line pulls the next page of the same block up
  const first = [para('앞 줄.'), line('셋째 줄. >>')];
  const second = [[], line('뒷 쪽 첫 줄.'), line('뒷 쪽 둘째 줄.'), [], []];
  const r = c.ceReflowBlock([first, second], 0, null);
  assert.equal(r.end, 1);
  same(flat(r.pages), ['앞 줄.', '셋째 줄.', '뒷 쪽 첫 줄.', '뒷 쪽 둘째 줄.']);
  assert.equal(r.pages.length, 1, 'freed space is filled from the following page');
}
{ // the protected blank caret row is kept and the internal marker never leaks
  const pg = [[], para('하나.'), line('둘.'), line('')];
  const r = c.ceReflowBlock([pg], 0, {page: 0, row: 3});
  assert(r.caret && r.pages[r.caret.page].length > r.caret.row);
  assert.equal(text([r.pages[r.caret.page][r.caret.row]]).length, 0, 'caret row is the blank row');
  assert(!JSON.stringify(r.pages).includes('"ce"'), 'internal marker removed');
}
{ // Ctrl+Enter: split, with the new page marked as a new paragraph and acting as a hard block boundary
  const [a, b] = c.ceSplitPage([line('가.'), line('나.'), line('다.'), [], []], 2);
  same(text(a), ['가.', '나.']); same(text(b), ['다.']);
  assert.equal(b[0][0].paragraphStart, true);
  assert.equal(c.pagesEndBlock([a, b], 0), true, 'the split page is a hard block boundary');
  const edited = copy(a); edited.push(line('셋.'), line('넷.'), line('다섯.'), line('여섯.'));
  const r = c.ceReflowBlock([edited, b], 0, null);
  assert.equal(r.end, 0, 'overflow after a hard break never enters the next page');
}
{ // old data without paragraphStart or filler: the explicit end flags still keep the next paragraph apart
  const full = [line('가.'), line('나.'), line('다.'), line('라.'), line('마.')];
  const next = [[], line('다음 문단 첫 줄.'), line('다음 문단 둘째 줄.'), [], []];
  const edited = copy(full); edited.push(line('넘친 줄.'));
  const r = c.ceReflowBlock([edited, next], 0, {page: 0, row: 5}, [true, true]);
  assert.equal(r.end, 0, 'explicit end flag stops the reflow');
  assert.equal(r.pages.length, 2); same(r.ends, [false, true], 'only the last page of the block keeps the end flag');
  same(flat([next]), ['다음 문단 첫 줄.', '다음 문단 둘째 줄.']);
  const wrong = c.ceReflowBlock([edited, next], 0, null);
  assert.equal(wrong.end, 1, 'without flags the marker-less full page would continue into the next paragraph');
}
{ // the original single-page editor uses the same block ends
  c.P = [A, B]; assert.equal(vm.runInContext('blockEnd(0)', c), true);
}
console.log('PASS continuous editor flow: block-limited push, pull-up, caret row, hard page break');
