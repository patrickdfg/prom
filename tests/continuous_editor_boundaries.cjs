// Regression tests for PROM's continuous-editor page boundary controls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('index.html', 'utf8');

function between(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert(a !== -1 && b > a, 'continuous editor source section exists: ' + start);
  return source.slice(a, b);
}

const ctx = {
  LINES: 5,
  ceReadRuns: row => row?.text ? [{t: row.text, c: 'k'}] : []
};
vm.createContext(ctx);
vm.runInContext(between('function ceHasText(row)', 'function ceFlow(){'), ctx);

function makeCard(contents) {
  const body = {
    children: [],
    get firstElementChild() { return this.children[0] || null; },
    get lastElementChild() { return this.children.at(-1) || null; },
    get firstChild() { return this.firstElementChild; },
    appendChild(row) { row.remove(); this.children.push(row); row.parent = this; },
    insertBefore(row, sibling) {
      row.remove();
      const index = sibling ? this.children.indexOf(sibling) : this.children.length;
      this.children.splice(index, 0, row); row.parent = this;
    }
  };
  for (const text of contents) {
    const row = {
      text, parent: body,
      remove() {
        if (!this.parent) return;
        const rows = this.parent.children, i = rows.indexOf(this);
        if (i !== -1) rows.splice(i, 1);
        this.parent = null;
      }
    };
    body.children.push(row);
  }
  return {body, dirty: false};
}
const texts = card => card.body.children.map(row => row.text);

function move(before, after, direction) {
  const prev = makeCard(before), next = makeCard(after);
  ctx.ceCards = [prev, next];
  ctx.ceState = {textContent: ''};
  ctx.ceMark = card => { card.dirty = true; };
  ctx.ceFlow = () => {};
  const boundary = {dataset: {boundary: '1'}};
  const button = {dataset: {move: direction}, closest: () => boundary};
  ctx.cePages = {addEventListener(type, handler) { if (type === 'click') this.handler = handler; }};
  vm.runInContext(between("cePages.addEventListener('click',e=>{", "\nceDialog.addEventListener('keydown'"), ctx);
  ctx.cePages.handler({target: {closest: () => button}});
  assert(texts(prev).length <= 5 && texts(next).length <= 5, 'page limit enforced');
  return {prev: texts(prev), next: texts(next), changed: prev.dirty && next.dirty, message: ctx.ceState.textContent};
}

{
  const a = move(['첫째', '둘째', '셋째', '넷째', ''], ['', '다섯째', '여섯째'], 'up');
  assert.deepEqual(a.prev, ['첫째', '둘째', '셋째', '넷째', '다섯째'], 'up uses trailing spacer');
  assert.deepEqual(a.next, ['', '여섯째'], 'up preserves next-page leading blank');
  assert(a.changed);
}
{
  const a = move(['', 'A', 'B', 'C', 'D'], ['E', 'F'], 'up');
  assert.deepEqual(a.prev, ['A', 'B', 'C', 'D', 'E'], 'up can use exterior leading spacer');
  assert.deepEqual(a.next, ['F']);
}
{
  const a = move(['A', 'B', '', 'C', 'D'], ['E'], 'up');
  assert.deepEqual(a.prev, ['A', 'B', '', 'C', 'D'], 'internal paragraph break is not erased');
  assert.deepEqual(a.next, ['E'], 'full page does not consume next page');
  assert(!a.changed);
}
{
  const a = move(['A', 'B', 'C', 'D', 'E'], ['F', 'G'], 'down');
  const b = move(a.prev, a.next, 'up');
  assert.deepEqual(b.prev, ['A', 'B', 'C', 'D', 'E'], 'down/up restores previous page');
  assert.deepEqual(b.next, ['F', 'G'], 'down/up restores next page');
}
{
  const hint = {textContent: '', hidden: true};
  const up = {disabled: null, title: ''}, down = {disabled: null};
  const sep = {
    dataset: {boundary: '1'},
    querySelector(selector) {
      return selector.includes('down') ? down : selector.includes('up') ? up : hint;
    }
  };
  const entries = [
    makeCard(['A', 'B', 'C', 'D', '']),
    makeCard(['E', 'F'])
  ];
  for (const entry of entries) {
    const label = {textContent: ''}, amount = {textContent: ''};
    entry.card = {querySelector(selector) { return selector === '.ce-label' ? label : amount; }};
    entry.amount = amount;
    entry.body.setAttribute = () => {};
  }
  ctx.ceCards = entries;
  ctx.cePages = {querySelectorAll: () => [sep]};
  ctx.ceReadPage = card => card.body.children.map(row => [{t: row.text, c: 'k'}]);
  ctx.$ = () => ({textContent: ''});
  vm.runInContext(between('function ceRefresh(){', 'function ceHasText(row)'), ctx);
  ctx.ceRefresh();
  assert.equal(up.disabled, false, 'up is enabled when trailing blank space exists');
  assert.equal(hint.hidden, true);
  assert.match(entries[0].amount.textContent, /글 4줄/, 'actual text lines differ from used slots');
  entries[0] = makeCard(['A', 'B', 'C', 'D', 'E']);
  entries[0].card = {querySelector: selector => ({textContent: ''})};
  entries[0].body.setAttribute = () => {};
  ctx.ceRefresh();
  assert.equal(up.disabled, true, 'truly full page disables up');
  assert.match(hint.textContent, /가득/, 'disabled reason is explained');
}
assert.match(source, /P=pages;page=Math\.min\(page,P\.length-1\);index\(\);cursor=pStart\[page\]/,
  'applying edited pages still rebuilds the voice-recognition index');
console.log('PASS continuous editor: up/down, blank spacers, paragraph gaps, button state, text counts and voice index');
