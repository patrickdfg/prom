/* Runs only on allowlisted output URLs, never on a control page. */
function state(active){const apply=()=>{document.documentElement.dataset.promBrowserFullscreen=String(active);document.dispatchEvent(new Event('prom-browser-fullscreen'));};if(document.documentElement)apply();else document.addEventListener('DOMContentLoaded',apply,{once:true});}
chrome.runtime.onMessage.addListener(message=>{if(message?.type==='PROM_OUTPUT_FULLSCREEN_STATE')state(!!message.active);});
chrome.runtime.sendMessage({type:'PROM_FULLSCREEN_OUTPUT'}).then(result=>{if(result?.ok)state(!!result.active);}).catch(()=>{});

document.addEventListener('prom-reposition-output',event=>{const b=event.detail;if(!b)return;chrome.runtime.sendMessage({type:'PROM_FULLSCREEN_OUTPUT',bounds:{left:b.left,top:b.top,width:b.width,height:b.height}}).then(result=>{if(result?.ok)state(!!result.active);}).catch(()=>{});});

let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>chrome.runtime.sendMessage({type:'PROM_QUERY_FULLSCREEN'}).then(result=>{if(result?.ok)state(!!result.active);}).catch(()=>{}),200);});
