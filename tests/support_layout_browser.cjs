// Help stays inside the bottom control row after opening and resizing.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium'});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/,r=>r.abort());
  const base=process.env.PROM_BASE||'http://localhost:8765/';
  const checkHelp=async()=>{
   const buttons=page.locator('[data-prom-support] button');
   await buttons.nth(0).click();await page.locator('.prom-support-dialog[open] [data-help]').waitFor({state:'visible'});
   await page.locator('.prom-support-dialog [data-close]').click();
   await buttons.nth(1).click();await page.locator('.prom-support-dialog[open] [data-form]').waitFor({state:'visible'});
   await page.locator('.prom-support-dialog [data-close]').click();
  };
  await page.goto(base);await page.locator('[data-prom-support] button').first().waitFor();await checkHelp();
  await page.click('#demo');await page.evaluate(async()=>{if(document.fullscreenElement)await document.exitFullscreen();});
  for(const [width,height] of [[1366,768],[768,1024],[390,844],[1024,768],[1920,1080],[1366,768]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>showBar());
   await page.waitForFunction(()=>{
    const help=document.querySelector('.prom-support-floating'),bar=document.getElementById('bar'),h=help.getBoundingClientRect(),b=bar.getBoundingClientRect();
    return help.parentNode===bar&&h.top>=b.top&&h.bottom<=b.bottom;
   });
   const geometry=await page.evaluate(()=>{
    const h=document.querySelector('.prom-support-floating'),r=h.getBoundingClientRect(),b=document.querySelector('[data-prom-support] button');
    return {font:getComputedStyle(b).fontSize,height:b.getBoundingClientRect().height,width:r.width,left:r.left,right:r.right};
   });
   assert.equal(geometry.font,'11px');assert(geometry.height<=25);assert(geometry.width<150);assert(geometry.left>=0);
   await checkHelp();
  }
  if(process.env.SUPPORT_SCREENSHOT)await page.screenshot({path:process.env.SUPPORT_SCREENSHOT});
  await page.goto(base+'ppt/');await page.locator('[data-prom-support] button').first().waitFor();await checkHelp();
  assert.deepEqual(errors,[]);
  console.log('PASS compact help, bottom-toolbar placement at six viewport sizes and resize-back, real help/contact clicks, PPT footer dialogs; no feedback sent');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
