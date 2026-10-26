/* Both editors read the same template artwork without changing stored templates. */
(function(root){
'use strict';
const catalogUrl=typeof document==='object'?new URL('images/library/catalog.json?v=7',document.currentScript.src):null;
// 그림 보관함에서만 제외한다. 사용 중인 PPT·템플릿의 원본 그림은 지우지 않는다.
const excludedArtwork=new Set([
 // 주일예배전반의 꽃·나뭇잎 원본 (복제·이름 변경을 해도 같은 그림은 다시 나오지 않는다).
 '07352752c712fa29addc93c0626e62bcc1446235d5bc871496021d7250ddd271',
 '08ca8c1a4097d7ecbc0ac3c969d88f44b9617c2fbaf2e1fda1455b82595caabc',
 '0f79649d196d5afa7f47196121792c5a1819b3a53d5d3b053f056ac92324d56d',
 '1f6f645178eb391f843b67992c036b7877d839b69ebb9cdce9e105222c2efdc1',
 '267b8f0fd9b0ba616cd28d65539a71e5496978103cd6c00650e782b1c95da510',
 '2e0d51b7a0f8eafda260c9b51efaae26960426376df155128d394112805bb6ea',
 '2efa83fcf1c8bedb4f8af65a42dcb3826106497dadb36b1b72a94adbaa1233da',
 '32ce4722b96371086d3eee22fca3bf7fa51a4ce982081a9f7ae85fc92db93c2e',
 '34c1dd3734246291b302a4a5ea9795d2942acc165bf74ff7380af571f2e94e85',
 '358e2a3ebf4ef2a69444103c44782bb9ea596e15bac94a4bbce8f25cf30860e9',
 '38e910bb47acd0f0e8d681f8ef0821fd205861e9b1f36b9d6e581d4e3a5206ce',
 '39455a675f7c3d621fcced63652c3ce0f08844a685ccb81154d201c64e21842a',
 '4971bb8a11bf20b18e647805f65f9eb2f7d8cf4444d418f8d4e053d939ff31b6',
 '4a4df3e0262b367e1162b2e68b52743978df837b77621e6c3a11471e43008ed3',
 '514de49beeed5bf090adf54b54f4e852acc877cc2505ef28c06579c51803c4e8',
 '55134e381618d6f69b455764a67ac1d97896cf2d082e5ccab44772b62168d952',
 '5804667116e06044cb060438c904470f1c4012665a04001b0c9c2ff9dfd4d47f',
 '5a43821571664fc2a26f4cbfa8df0fe81c0c24910323b6988a653974eb7dcbaa',
 '5a6702ae53860016e02df033aadf09b1d532a2823002b02c0d7cc4c8f310960b',
 '5afac4ff349482fe44e132cabcb24fecb5cb8d58a3691b95667815de7f9c88d5',
 '5ec86e95df6ccac3f36cfdf384ddb496b0878b8703e37f99142559724064673e',
 '6552e09d36db0a7e64c7dd0b2ec5f4de6c4a0c368ba1a748b881940f7b689d44',
 '71a0ce0a2009e4ef1573c13d022bf32971976a4c8d222eddfcbbeac710a24cf0',
 '72b0f8885dc6f38e89e760006261402a7f9fbb1248c3ec008b325f49c1ecd901',
 '743c0cea96c9dcc05615854616f8161c348a39f8583aaa797501f48bd93221d0',
 '748e1392d163f92e98a650f787e657c0491e8c913b8dea0e5af30f84e21fd77a',
 '77e10a23926e0a46579043397d1a88feab6b755ebda0533fbe7795ef27378636',
 '8103d00785e8e07b8eabd3890192c3f65d46fedc861a42355aaba2b070273e9d',
 '8e0b8a0c15d79556d8e95560b0c0cff1743b6a794160a24637a4c4b5f08412a3',
 '8f0686a7a659223ae3671954907b2ffacc337c899756bdb09fea8edff9f707ac',
 '94f86b5ef398108b787fd1fe77ccf6e298e2af462b8289643f87981c08bda45e',
 '96e16f8eae2d6eeaca1c717c31af6f1f2ffc29e8d9b48329004f77c83d6a0ace',
 'ab3105c31cb430b147273af80b0f27d532f7551e9219f0868581309a78742087',
 'b3765966d3d6ccd2c50ee99e202d2fb3bcdce76839260a639b5c892218160520',
 'b7a3d720a4d133cb4b8d9d445d5b3d49cf0d7e63ce86119212fc93abc0fcf4ed',
 'b876b44e1f6d8b49a1f269adb40b136092d11b6445251e3485a1c162fdef73e1',
 'bac86c871af3d3d0450891f041b80ebcb89144103a59a1d13531a3421823a5e6',
 'bb7761f816f7d441593281e8ee1bee2867750a6c4ae4d0beea7309dbebd84c07',
 'bbf6951fd1c2a75359e202a352eafc7dd69b4c4f3ffdb359eff7cb9854560f2e',
 'c756707d5de0041c46e356e7a4ffcce9030f17a6128f9060f9399502be514fe6',
 'cca575cd95f34a754bf067aba991ed531890453cc5949ff46704dd73a20acf6b',
 'ccdef4d48682dccf98ab2a66f7149ea3d621cdec0759664ab0fbab6d2f6a65b4',
 'ce838d35059ab4e0a5fe10f949873140cbafe5cea9beed53d1c21b281b77a00d',
 'cf0482d09b7e77b732b46af463199d00eba7fdf46934f45f3afe747a41642411',
 'd5ffd01135d50a18736b57b84b84ce974d2d8a1bdb73696b6c9cbd1231b6a16c',
 'dc1f4b09a1c0494ae54c0f2d793f5079dff34d785617242feda8fd3b77c2677b',
 'e1ea150483642c12a0f008a016aa147c6fb7282eecf3599591ea2f3885f45b86',
 'e32bc0cc564d80eb0d60aeefd24ae10c305278c51a88567fdb7f7f31d9d7c63a',
 'e3aa47d268b138695e82f3743917fd3fd2392d4b2a93ee9e298c9abc5ede65bf',
 'e5618a9415ff04205b686a1467c34733ae4d03c7a07104c9101934f1599da141',
 'ea43f709bac5c2b771ca52984879bd7ab1e0483e63182bf14fc4c078b8ac0d57',
 'f491de8050a3d3b352e5ec29f93e3452903c26b78bc2c0cc3634b0999b4b6e03',
 'f4ab0c6e2a68aad9e75fa5bfbbc9adb7be91ecc7a1182ad758aef243fcd44aae',
 'f851f76941e69b7bd28a7396420a63b898411e5973261c8feff7fb7c546f9dea',
 'fb68142bcd5ac34d34a8485ddb89ee7907ebb50dac6ce6f04ba20fc27fb61f41',
 // 새벽설교 본문 성구의 초록 물결 장식.
 '6bd82d9f7187be431b840915211f667ca3b02ffa8f81af59574c36a7e791130a'
]);
const artworkVisibility=new Map(),inspectingArtwork=new Map();
let builtinItems=[],loading;
function ready(){
 if(!catalogUrl)return Promise.resolve();
 return loading||(loading=(async()=>{
  const response=await fetch(catalogUrl);if(!response.ok)throw Error('기본 그림 목록을 불러오지 못했습니다.');
  const catalog=await response.json();
  const items=await Promise.allSettled(catalog.items.map(async item=>{
   const asset=await fetch(new URL(item.file,catalogUrl));if(!asset.ok)throw Error(item.label+' 그림을 불러오지 못했습니다.');
   const blob=await asset.blob();
   const src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('그림을 읽지 못했습니다.'));reader.readAsDataURL(blob);});
   return {id:item.id,kind:item.kind,label:item.label,src,shape:{type:'image',src,w:item.width,h:item.height}};
  }));
  builtinItems=items.filter(item=>item.status==='fulfilled').map(item=>item.value);
  // Retry missing built-ins next time without hiding healthy or saved pictures.
  if(builtinItems.length<catalog.items.length)loading=null;
 })().catch(e=>{loading=null;throw e;}));
}
async function inspectArtwork(src){
 if(artworkVisibility.has(src))return artworkVisibility.get(src);
 if(inspectingArtwork.has(src))return inspectingArtwork.get(src);
 const pending=(async()=>{
  try{
   const bytes=Uint8Array.from(atob(src.slice(src.indexOf(',')+1)),c=>c.charCodeAt(0));
   const digest=await crypto.subtle.digest('SHA-256',bytes),hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
   if(excludedArtwork.has(hash))return false;
   const image=new Image();image.src=src;await image.decode();
   const scale=Math.min(1,512/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
   const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0,canvas.width,canvas.height);
   const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;let transparent=false,visible=false;
   for(let i=3;i<pixels.length;i+=4){transparent ||= pixels[i]<255;visible ||= pixels[i]>0;if(transparent&&visible)return true;}
   return false;
  }catch(_){return false;}
 })();
 inspectingArtwork.set(src,pending);
 const visible=await pending;artworkVisibility.set(src,visible);inspectingArtwork.delete(src);return visible;
}
async function prepare(records){
 const items=collect(records,'artwork');let next=0;
 await Promise.all(Array.from({length:Math.min(4,items.length)},async()=>{while(next<items.length)await inspectArtwork(items[next++].src);}));
}
function collect(records,kind){
 const background=kind==='background',seen=new Set(),items=[];
 for(const item of builtinItems)if(item.kind===kind&&(background||artworkVisibility.get(item.src)!==false)){seen.add(item.src);items.push(structuredClone(item));}
 for(const record of records||[]){
  if(String(record.id||'').startsWith('__prom-template-backup__:'))continue;
  for(const [key,layout] of Object.entries(record.design?.layouts||{}))for(const shape of layout.shapes||[]){
   if(shape.type!=='image'||!/^data:image\//.test(shape.src||'')||!(shape.w>0&&shape.h>0))continue;
   const full=shape.background||(shape.w>=(layout.width||960)*.85&&shape.h>=(layout.height||540)*.85);
   if(background!==!!full||seen.has(shape.src)||!background&&artworkVisibility.get(shape.src)===false)continue;
   seen.add(shape.src);
   items.push({src:shape.src,shape:structuredClone(shape),label:record.name+' · '+(record.layoutCatalog?.find(x=>x.key===key)?.name||key)});
  }
 }
 return items;
}
async function records(){
 await ready().catch(()=>{});
 await root.PromBuiltinTemplates?.ready;
 const database=await new Promise((resolve,reject)=>{
  const request=indexedDB.open('prom-ppt-generation-templates',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('templates',{keyPath:'id'});
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 });
 try{const records=await new Promise((resolve,reject)=>{
  const transaction=database.transaction('templates','readonly'),request=transaction.objectStore('templates').getAll();
  transaction.oncomplete=()=>resolve(request.result);
  transaction.onerror=transaction.onabort=()=>reject(transaction.error||Error('그림 보관함을 읽지 못했습니다.'));
 });await prepare(records);return records;}finally{database.close();}
}
const api={collect,records,ready,prepare};
if(typeof module==='object'&&module.exports)module.exports=api;else root.CaptionImageLibrary=api;
})(typeof window==='object'?window:globalThis);
