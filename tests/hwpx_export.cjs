// Regression: editable HWPX export, page breaks, XML safety, and login-only Drive save.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const JSZip = require('jszip');
global.JSZip = JSZip;
require('../prompter-hwpx.js');

async function run() {
  const original = [
    [[{t:'하나님 & 말씀 <믿음>',c:'k'},{t:' (요 3:16)',c:'r'}],[{t:'마음, 뜻, 목숨 다해',c:'b'}]],
    [[{t:'둘째 쪽',c:'k'}]],
    [[]]
  ];
  const blob = await global.PromHwpx.create(original,{title:'프롬프터 테스트'});
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  assert.equal(Object.keys(zip.files)[0],'mimetype');
  const archiveBytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(archiveBytes[8],0);assert.equal(archiveBytes[9],0); // first entry is uncompressed
  assert.equal(await zip.file('mimetype').async('string'),'application/hwp+zip');
  const section = await zip.file('Contents/section0.xml').async('string');
  const header = await zip.file('Contents/header.xml').async('string');
  assert.equal((section.match(/pageBreak="1"/g)||[]).length,2);
  assert.equal((section.match(/<hp:p /g)||[]).length,4);
  assert.match(section,/하나님 &amp; 말씀 &lt;믿음&gt;/);
  assert.match(section,/<hp:run charPrIDRef="2"><hp:t> \(요 3:16\)<\/hp:t>/);
  assert.match(section,/<hp:run charPrIDRef="1"><hp:t>마음, 뜻, 목숨 다해<\/hp:t>/);
  assert.match(header,/textColor="#0000FF"/);
  assert.match(header,/textColor="#FF0000"/);
  for(const p of ['version.xml','META-INF/container.xml','Contents/content.hpf','Contents/header.xml','Contents/section0.xml'])
    assert.ok(zip.file(p),p);
  const pages = Array.from({length:143},(_,i)=>[[{t:'설교 원고 '+i,c:'k'}]]);
  const longZip = await JSZip.loadAsync(await (await global.PromHwpx.create(pages)).arrayBuffer());
  const longSection = await longZip.file('Contents/section0.xml').async('string');
  assert.equal((longSection.match(/pageBreak="1"/g)||[]).length,142);

  const index = fs.readFileSync('index.html','utf8');
  assert.match(index,/id="saveHwpx"/);
  assert.match(index,/id="saveDrive"[^>]*hidden/);
  assert.match(index,/PromHwpx\.create\(pages,\{title:baseName\}\)/);
  assert.match(index,/const \{name,body\}=savedDocument\(\)/);
  assert.match(index,/prompter-hwpx\.js\?v=/);
  const sync=fs.readFileSync('drive-sync.js','utf8');
  assert.match(sync,/saveButton\.hidden=!loggedIn\(\)/);
  assert.match(sync,/saveButton\.disabled=busy/);
  assert.match(sync,/window\.PromDrive=\{save,list,loggedIn\}/);
  console.log('PASS HWPX 3-page and 143-page exports, UTF-8/color/page boundaries, Google login-only save button');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
