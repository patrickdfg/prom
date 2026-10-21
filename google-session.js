// Shared, expiring Google session for PROM, PPT and Make on this origin.
// Credentials stay in sessionStorage (not persistent localStorage) and never enter URLs.
(()=>{
'use strict';
const clientId=String(window.PROM_GOOGLE_CLIENT_ID||''),key='prom-google-session-v1',listeners=new Set();
let record={time:0,id:'',session:null},timer=0,channel=null;
const clean=value=>value&&value.clientId===clientId&&typeof value.token==='string'&&value.token&&Number.isFinite(value.expires)?{clientId,token:value.token,expires:value.expires,account:typeof value.account==='string'?value.account:''}:null;
try{const saved=JSON.parse(sessionStorage.getItem(key)||'null');if(saved&&Number.isFinite(saved.time)&&typeof saved.id==='string')record={time:saved.time,id:saved.id,session:clean(saved.session)};}catch{}
function persist(){try{sessionStorage.setItem(key,JSON.stringify(record));}catch{}}
function arm(){clearTimeout(timer);if(record.session){const remaining=record.session.expires-Date.now();if(remaining>0)timer=setTimeout(expire,Math.min(remaining,2147483647));else record.session=null;}}
function value(){if(record.session&&record.session.expires<=Date.now())expire();return record.session?{...record.session}:null;}
function notify(){const session=value();for(const listener of listeners)listener(session);}
function publish(type='state'){try{channel?.postMessage({type,clientId,record});}catch{}}
function expire(){if(!record.session||record.session.expires>Date.now()){arm();return;}record.session=null;persist();notify();}
function resetFolders(session){if(record.session?.token===session?.token)return;try{localStorage.removeItem('promDriveFolder');localStorage.removeItem('promMakeDriveFolder');}catch{}}
function replace(session){resetFolders(session);record={time:Math.max(Date.now(),record.time+1),id:crypto.randomUUID(),session};persist();arm();notify();publish();}
function save(session){const next=clean({...session,clientId});if(!next||next.expires<=Date.now())return false;replace(next);return true;}
function clear(expectedToken){if(expectedToken&&record.session?.token!==expectedToken)return false;replace(null);return true;}
function accept(incoming){if(!incoming||!Number.isFinite(incoming.time)||typeof incoming.id!=='string'||incoming.time<record.time||incoming.time===record.time&&incoming.id<=record.id)return;const session=clean(incoming.session);resetFolders(session);record={time:incoming.time,id:incoming.id,session};arm();persist();notify();}
function sync(){try{channel?.postMessage({type:'request',clientId});}catch{}}
if(clientId&&typeof BroadcastChannel==='function'){channel=new BroadcastChannel('prom-google-session-v1');channel.onmessage=event=>{const data=event.data;if(data?.clientId!==clientId)return;if(data.type==='request'){if(record.time)publish();}else if(data.type==='state')accept(data.record);};}
arm();persist();
window.PromGoogleSession={snapshot:value,save,clear,subscribe(listener){listeners.add(listener);listener(value());return ()=>listeners.delete(listener);}};
window.addEventListener('pageshow',()=>{value();sync();});window.addEventListener('focus',()=>{value();sync();});
sync();
})();
