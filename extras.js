/* 발표 도구. 기본값은 기존 원고/음성 방식이며 추가 기능은 명시적으로 선택한다. */
(() => {
 'use strict';
 const button=document.createElement('button');button.id='extrasButton';button.textContent='발표 도구';$('more').before(button);
 const dialog=document.createElement('dialog');dialog.id='extrasDialog';dialog.className='tool-dialog';
 dialog.innerHTML=`<div class="dialog-head"><h2>발표 · 연습 도구</h2><button id="extrasClose">닫기</button></div>
 <fieldset><legend>음성 추적 실험실</legend><label><input type="checkbox" id="voiceLab"> 숫자·장절 인식 / 애드리브 복귀 보강</label><p>원고 밖 발화는 대기합니다. 먼 위치로 복귀할 때는 이어지는 문장까지 읽어 주세요. 기기별 실제 인식 결과는 다를 수 있습니다.</p></fieldset>
 <fieldset><legend>원고 보기</legend><label><input type="checkbox" id="continuousView"> 부드러운 연속 스크롤</label><p>읽는 줄을 화면 위쪽 약 30%에 맞춥니다. 여러 장 보기를 누르면 페이지 방식으로 돌아갑니다.</p></fieldset>
 <fieldset><legend>슬라이드쇼 전용</legend><div class="extras-row"><label><input type="checkbox" id="mirrorX"> 좌우 반전</label><label><input type="checkbox" id="mirrorY"> 상하 반전</label></div><p>반사 유리 장비용입니다. 조작창은 반전하지 않습니다.</p><label for="stageMessage">긴급 안내</label><input id="stageMessage" type="text" maxlength="140" placeholder="예: 5분 남았습니다"><div class="extras-row"><button id="sendStageMessage">안내 표시</button><button id="clearStageMessage">안내 지우기</button></div><p id="stageMessageStatus" role="status">슬라이드쇼 창에 표시할 안내를 입력하세요.</p></fieldset>
 <fieldset><legend>읽어주기 구간 반복</legend><div class="extras-row"><label>시작 쪽 <input id="repeatFrom" type="number" min="1" value="1"></label><label>끝 쪽 <input id="repeatTo" type="number" min="1" value="1"></label></div><label><input id="repeatTTS" type="checkbox"> 지정 구간 반복</label><button id="playRepeat">이 구간 읽기</button><p>배속은 읽어주기의 속도 설정(0.5~2배)을 따릅니다.</p></fieldset>
 <fieldset><legend>연습 녹음</legend><p>마이크 권한을 허용한 뒤 직접 녹음합니다. 녹음 파일은 서버로 보내지 않습니다. 안드로이드는 마이크 충돌 방지를 위해 음성 자동 넘김과 녹음을 번갈아 사용합니다.</p><div class="extras-row"><button id="recordStart">녹음 시작</button><button id="recordStop" disabled>녹음 종료</button><span id="recordStatus" role="status">대기</span></div><audio id="recordAudio" controls hidden></audio><a id="recordDownload" hidden>녹음 파일 저장</a><p>종료 후 파일을 저장해 주세요. 저장하지 않고 창을 닫으면 녹음이 사라집니다.</p></fieldset>`;
 document.body.appendChild(dialog);
 const scroll=document.createElement('div');scroll.id='continuousScript';scroll.className='scroll-host';scroll.hidden=true;$('stage').after(scroll);
 const scrollRenderer=new PromScrollView(scroll);
 let emergency='',voiceKey='',voicePages=[],pending=null,lastSample='',lastPage=-1;
 let recorder=null,recordStream=null,recordUrl=null,recordTimer=null,recordAt=0,recordPending=false,unsavedRecording=false;
 for(const id of ['voiceLab','mirrorX','mirrorY'])try{$(id).checked=localStorage.getItem('promExtra:'+id)==='true';}catch(_){}
 const settings=()=>({mirrorX:$('mirrorX').checked,mirrorY:$('mirrorY').checked,message:emergency,continuous:$('continuousView').checked});
 function frame(){return {document:P,ranges:lineRange,page,cursor,dim:$('dim').checked,dark:$('theme').value==='dark'};}
 function refresh(){
   const continuous=$('continuousView').checked&&!editing;
   $('view').classList.toggle('continuous-mode',continuous);scroll.hidden=!continuous;
   if(continuous){scroll.style.backgroundImage=$('theme').value==='dark'?'none':$('page').style.backgroundImage;scroll.style.backgroundSize='cover';scroll.style.bottom=$('view').classList.contains('presenting')?'0px':($('bar').getBoundingClientRect().height+8)+'px';scrollRenderer.update(frame());}
 }
 function change(){refresh();render();}
 button.onclick=()=>{if(editing)endEdit();PromUI.finishNote();$('repeatFrom').max=$('repeatTo').max=P.length;dialog.showModal();};
 $('extrasClose').onclick=()=>dialog.close();
 for(const id of ['voiceLab','mirrorX','mirrorY'])$(id).onchange=()=>{try{localStorage.setItem('promExtra:'+id,String($(id).checked));}catch(_){}pending=null;lastSample='';change();};
 $('continuousView').onchange=()=>{const enabled=$('continuousView').checked;if(enabled)$('viewSingle').click();$('continuousView').checked=enabled;change();};
 for(const id of ['viewMultiple','viewSingle','note'])$(id).addEventListener('click',()=>{$('continuousView').checked=false;refresh();},true);
 $('sendStageMessage').onclick=()=>{emergency=$('stageMessage').value.trim();$('stageMessageStatus').textContent=emergency?(PromUI.hasSlideshow()?'슬라이드쇼에 안내 표시 중':'슬라이드쇼를 열면 안내가 표시됩니다.'):'표시할 안내가 없습니다.';change();};
 $('clearStageMessage').onclick=()=>{emergency='';$('stageMessage').value='';$('stageMessageStatus').textContent='안내를 지웠습니다.';change();};
 function repeatRange(){const a=Number($('repeatFrom').value),b=Number($('repeatTo').value);return Number.isInteger(a)&&Number.isInteger(b)&&a>=1&&b>=a&&b<=P.length?[a-1,b-1]:null;}
 $('repeatTTS').onchange=()=>{if($('repeatTTS').checked&&!repeatRange()){$('repeatTTS').checked=false;toast('반복 시작·끝 쪽을 확인하세요.');}};
 $('playRepeat').onclick=()=>{const range=repeatRange();if(!range){toast('반복 시작·끝 쪽을 확인하세요.');return;}if(!P.slice(range[0],range[1]+1).some((_,i)=>pageSay(i+range[0]).trim())){toast('읽을 본문이 없습니다.');return;}go(range[0],true);dialog.close();tPlay();};
 function ttsPage(i){if(!$('repeatTTS').checked)return i;const range=repeatRange();if(!range){$('repeatTTS').checked=false;return i;}let at=i>range[1]||i<range[0]?range[0]:i;for(let k=0;k<=range[1]-range[0];k++){if(/[가-힣A-Za-z0-9]/.test(pageSay(at)))return at;at=at>=range[1]?range[0]:at+1;}$('repeatTTS').checked=false;return i;}
 function indexVoice(){const key=JSON.stringify(P);if(key===voiceKey)return;voiceKey=key;voicePages=P.map((pg,pi)=>{let text='',map=[];pg.forEach((runs,li)=>{const raw=runs.filter(r=>r.c!=='r'&&r.c!=='n').map(r=>r.t).join('');const result=PromVoiceLab.mapped(raw,lineRange[pi][li][0]);text+=result.text;map.push(...result.map);});return {text,map};});pending=null;lastSample='';}
 addEventListener('resize',()=>{scrollRenderer.position='';refresh();});
 if(window.ResizeObserver)new ResizeObserver(()=>{if($('continuousView').checked)refresh();}).observe($('bar'));
 const originalHeard=onHeard;
 onHeard=function(text){
   if(!$('voiceLab').checked)return originalHeard(text);
   indexVoice();if(lastPage!==page){pending=null;lastSample='';lastPage=page;}
   const sample=PromVoiceLab.mapped(heardCarry+text).text.slice(-22);$('heard').textContent=text.slice(-40);
   if(sample===lastSample)return;lastSample=sample;
   const current=voicePages[page];if(!current)return;
   // 다음 장의 첫 본문 줄까지만 살펴본다. 임의의 먼 장으로는 이동하지 않는다.
   const next=P[page+1]?.findIndex(r=>r.some(x=>x.c!=='r'&&x.c!=='n'&&normStr(x.t)));
   const range=next>=0?lineRange[page+1]?.[next]:null;
   const nextData=voicePages[page+1];const n=range&&nextData?nextData.map.filter(p=>p<=range[1]).length:0;
   const target=current.text+(nextData?.text.slice(0,n)||''),map=current.map.concat(nextData?.map.slice(0,n)||[]);
   const hit=PromVoiceLab.match(sample,target,map,Math.max(cursor,pStart[page]));
   if(!hit){cap('원고 밖 발화 또는 인식 차이 · 원고가 이어지면 다시 따라갑니다.');return;}
   const far=hit.pos-cursor>45;
   if(far){const now=Date.now();if(!pending||now-pending.time>12000||hit.pos<pending.pos+5||hit.pos>pending.pos+70){pending={pos:hit.pos,time:now};cap('복귀 위치 확인 중 · 이어서 읽어 주세요.');return;}}
   pending=null;cursor=Math.max(cursor,hit.pos);let targetPage=page;
   if(range&&cursor>pStart[page+1]){targetPage=page+1;cursor=Math.min(cursor,pEnd[targetPage]-1);}
   else if(cursor>=Math.max(pEnd[page]-Number($('lead').value),lastLine[page]+1)&&page<P.length-1)targetPage=page+1;
   cap('실험실 · 원고 위치 확인');if(targetPage!==page)go(targetPage);else render();
 };
 const ui=window.PromUI,oldRender=ui.render,oldEdit=ui.beforeBodyEdit;
 ui.render=function(...args){oldRender.apply(this,args);refresh();};
 ui.beforeBodyEdit=function(...args){$('continuousView').checked=false;refresh();return oldEdit.apply(this,args);};
 const originalMic=startMic;
 startMic=function(...args){if(ANDROID&&(recordPending||recorder?.state==='recording')){toast('연습 녹음을 종료한 뒤 마이크 자동 넘김을 켜 주세요.');return;}pending=null;lastSample='';lastPage=-1;return originalMic(...args);};
 function recordingUI(active){$('recordStart').disabled=active;$('recordStop').disabled=!active;button.textContent=active?'● 녹음 중 · 발표 도구':'발표 도구';}
 function stopTracks(){recordStream?.getTracks().forEach(t=>t.stop());recordStream=null;}
 $('recordStart').onclick=async()=>{
   if(recordPending||recorder?.state==='recording')return;
   if(!window.MediaRecorder||!navigator.mediaDevices?.getUserMedia){$('recordStatus').textContent='이 브라우저는 녹음을 지원하지 않습니다.';return;}
   if(unsavedRecording&&!confirm('이전 녹음 파일을 저장하셨나요? 새 녹음으로 바꿀까요?'))return;
   if(ANDROID&&listening)stopMic();recordPending=true;$('recordStart').disabled=true;$('recordStatus').textContent='마이크 권한 확인 중';
   try{
     recordStream=await navigator.mediaDevices.getUserMedia({audio:true});
     const type=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
     recorder=new MediaRecorder(recordStream,type?{mimeType:type}:undefined);const chunks=[];
     recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
     recorder.onstop=()=>{
       clearInterval(recordTimer);stopTracks();recordingUI(false);
       if(recordUrl)URL.revokeObjectURL(recordUrl);
       const mime=recorder.mimeType||type||'audio/webm',blob=new Blob(chunks,{type:mime});
       recordUrl=URL.createObjectURL(blob);$('recordAudio').src=recordUrl;$('recordAudio').hidden=false;
       const link=$('recordDownload');link.href=recordUrl;link.download='설교연습_'+new Date().toISOString().replace(/[:.]/g,'-')+(mime.includes('mp4')?'.m4a':mime.includes('ogg')?'.ogg':'.webm');link.hidden=false;unsavedRecording=blob.size>0;
       $('recordStatus').textContent=blob.size?'녹음 완료 · 파일을 저장하세요.':'녹음된 소리가 없습니다.';
     };
     recorder.onerror=()=>{$('recordStatus').textContent='녹음 오류가 발생했습니다.';if(recorder.state!=='inactive')recorder.stop();else{stopTracks();recordingUI(false);}};
     recorder.start(1000);recordAt=Date.now();recordingUI(true);$('recordStatus').textContent='녹음 중 00:00';
     recordTimer=setInterval(()=>{const sec=Math.floor((Date.now()-recordAt)/1000);$('recordStatus').textContent=`녹음 중 ${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;},1000);
   }catch(e){stopTracks();recordingUI(false);$('recordStatus').textContent='녹음을 시작하지 못했습니다. 마이크 권한과 연결을 확인하세요.';}
   finally{recordPending=false;}
 };
 $('recordStop').onclick=()=>{if(recorder?.state==='recording')recorder.stop();};
 $('recordDownload').onclick=()=>{unsavedRecording=false;};
 addEventListener('beforeunload',e=>{if(recordPending||recorder?.state==='recording'||unsavedRecording){e.preventDefault();e.returnValue='';}});
 window.PromExtras={settings,ttsPage,frame};
})();
