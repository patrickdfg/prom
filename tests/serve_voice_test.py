"""Local-only voice regression harness; no microphone or speech server is used."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import subprocess
from urllib.parse import urlparse, parse_qs

ROOT = Path(__file__).resolve().parents[1]
MOCK = r'''<script>
const isolatedStore=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>isolatedStore.get(k)??null,setItem:(k,v)=>isolatedStore.set(k,String(v)),removeItem:k=>isolatedStore.delete(k)}});
window.SpeechRecognition=class {
  constructor(){window.testRecognition=this;}
  start(){queueMicrotask(()=>this.onstart?.());}
  stop(){queueMicrotask(()=>this.onend?.());}
};
Object.defineProperty(navigator,'mediaDevices',{value:{
  getUserMedia:async()=>({getTracks:()=>[{stop(){}}],getAudioTracks:()=>[{readyState:'live',stop(){}}]}),
  enumerateDevices:async()=>[],addEventListener(){}
}});
</script>'''
CHECK = r'''<div style="position:fixed;right:8px;top:90px;z-index:9999;background:#234;color:white;padding:12px;max-width:450px">
<button onclick="this.parentElement.hidden=true">시험 패널 닫기</button><button id="previewClean">원고 전용 화면 미리보기</button><button id="runVoiceRegression">음성 추적 회귀 시험 실행</button><pre id="testReport" style="white-space:pre-wrap"></pre></div>
<script>
document.getElementById('previewClean').onclick=()=>{document.getElementById('previewClean').parentElement.style.display='none';document.getElementById('demo').click();startMic();};
document.getElementById('runVoiceRegression').onclick=async()=>{
 const report=document.getElementById('testReport');
 const failures=[];const ok=(name,v)=>{report.textContent+=(v?'PASS ':'FAIL ')+name+'\n';if(!v)failures.push(name);};
 try{
  document.querySelector('input[name=lines][value="5"]').checked=true;
  document.getElementById('demo').click();
  const newUI=!!document.getElementById('theme-dark');
  if(newUI){
   ok('불필요한 기능 삭제',['check','timerToggle','timerReset','targetMinutes','pickLine','sessionClock','noteDialog'].every(id=>!document.getElementById(id)));
   ok('화면 선택 상단 배치',document.getElementById('statusbar').contains(document.getElementById('theme')));
   const bodyBefore=JSON.stringify(P),rowsBefore=document.getElementById('lines').getBoundingClientRect().toJSON();
   document.getElementById('note').click();
   const memo=document.querySelector('.note-object.selected .note-text');memo.textContent='잠시 멈추고 회중 보기';memo.dispatchEvent(new Event('input',{bubbles:true}));
   ok('버튼으로 메모 레이어 바로 입력',memo.isContentEditable&&!document.querySelector('dialog[open]'));
   document.getElementById('noteSize').value='40';document.getElementById('noteSize').dispatchEvent(new Event('input'));
   ok('메모 글자 크기 조절',getComputedStyle(memo.parentElement).fontSize==='40px');
   const handle=document.querySelector('.note-move');handle.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:7,clientX:100,clientY:100}));handle.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:7,clientX:180,clientY:160}));handle.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:7}));
   const moved=Object.values(PromUI.metadata().noteLayers).flat()[0];ok('메모 레이어 자유 이동',moved.x>0.08&&moved.y>0.12);
   document.getElementById('noteDone').click();
   await Promise.resolve();ok('메모 빨간색 표시',getComputedStyle(document.querySelector('.note-text')).color==='rgb(255, 52, 52)');
   document.getElementById('note').click();const second=document.querySelector('.note-object.selected .note-text');ok('새 메모는 마지막 글자 크기 사용',getComputedStyle(second.parentElement).fontSize==='40px'&&document.getElementById('noteSize').value==='40');ok('메모 글자 크기 기기 저장',localStorage.getItem('promNoteFontSize')==='40');second.textContent='두 번째 메모';second.dispatchEvent(new Event('input',{bubbles:true}));PromUI.finishNote();await Promise.resolve();
   ok('왼쪽 더하기 버튼 제거',document.querySelectorAll('.note-insert').length===0);
   ok('독립된 메모 레이어 두 개',document.querySelectorAll('.note-object').length===2);
   ok('메모가 원고와 줄 배치에 영향 없음',JSON.stringify(P)===bodyBefore&&Math.abs(document.getElementById('lines').getBoundingClientRect().height-rowsBefore.height)<1);
   const roundTrip=JSON.parse(JSON.stringify(PromUI.metadata()));PromUI.applyMetadata(roundTrip);render();await Promise.resolve();ok('위치와 글자 크기 저장 복구',Object.values(PromUI.metadata().noteLayers).flat()[0].size===40&&Object.values(PromUI.metadata().noteLayers).flat()[0].x===moved.x);
   const key=PromUI.noteKey(P[page]);PromUI.applyMetadata({lineNotes:{[key]:['옛 첫 줄 메모','옛 둘째 줄 메모']}});render();await Promise.resolve();ok('기존 줄 메모 보존',document.querySelectorAll('.note-object').length===2&&Object.values(PromUI.metadata().noteLayers).flat()[1].text==='옛 둘째 줄 메모');
   PromUI.applyMetadata(roundTrip);render();await Promise.resolve();document.querySelector('.note-text').click();document.getElementById('noteDelete').click();ok('선택한 레이어만 삭제',document.querySelectorAll('.note-object').length===1);PromUI.applyMetadata(roundTrip);render();await Promise.resolve();
   document.getElementById('theme-cloud').click();ok('하늘 구름 배경 선택',!document.getElementById('page').classList.contains('dark'));document.getElementById('theme-dark').click();ok('검정 배경 선택',document.getElementById('page').classList.contains('dark'));
   ok('메모 읽어주기 제외',!pageSay(page).includes('잠시 멈추고'));
   ok('메모 저장',Object.values(PromUI.metadata().noteLayers).flat().some(n=>n.text==='잠시 멈추고 회중 보기'));
   go(1,true);go(0,true);await Promise.resolve();
   ok('페이지 이동 후 맨 위부터 시작',cursor===pStart[page]);
  }
  let meterStopped=false;
  if(window.PromUI){
   document.getElementById('setpanel').classList.add('open');
   meter={raf:0,ac:{close(){}},own:true,stream:{getTracks:()=>[{stop(){meterStopped=true;}}]}};
  }
  await startMic();
  if(window.PromUI)ok('점검용 마이크 점유 해제',meterStopped&&!panelOpen()&&meter===null);
  ok('마이크 시작',listening);
  if(newUI){
   const speed=document.getElementById('speedLayer'),r=speed.getBoundingClientRect();
   ok('속도 레이어 기본 크기 100px',getComputedStyle(document.getElementById('speedVal')).fontSize==='100px');
   ok('속도 레이어 오른쪽 배치',Math.abs(innerWidth-r.right-16)<2);
   speed.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:8,button:0,clientX:r.left+10,clientY:r.top+10}));
   speed.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:8,clientX:r.left-40,clientY:r.top+60}));speed.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:8}));
   ok('속도 레이어 독립 이동과 위치 저장',speed.getBoundingClientRect().left<r.left&&!!localStorage.getItem('promSpeedLayerPosition'));
   const opt=document.getElementById('speedOpt');opt.checked=false;opt.dispatchEvent(new Event('change'));ok('속도 표시 끄기',speed.hidden);opt.checked=true;opt.dispatchEvent(new Event('change'));
  }

  if(newUI){
   const hidden=id=>getComputedStyle(document.getElementById(id)).display==='none';
   ok('마이크 중 원고 외 화면 숨김',['statusbar','bar','voiceFeedback','toast'].every(hidden)&&hidden('noteLayer')&&hidden('noteTools'));
   ok('마이크 중 원고가 전체 공간 사용',Math.abs(document.getElementById('stage').getBoundingClientRect().height-innerHeight)<1);
   document.dispatchEvent(new MouseEvent('mousemove',{bubbles:true}));
   ok('화면 가운데에서는 조작부 안 보임',hidden('bar'));
   document.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientY:innerHeight-2}));
   ok('마우스 하단 이동 시 조작부 표시',!hidden('bar'));
   document.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientY:100}));
   await new Promise(r=>setTimeout(r,1000));
   ok('하단에서 벗어나면 다시 숨김',hidden('bar'));
  }
  let transcript='';
  const fixture=Array.from(P,p=>p.map(l=>l.filter(r=>r.c!=='r'&&r.c!=='n').map(r=>r.t).join('')).join(' '));
  const total=P.length;
  for(let pi=0;pi<total;pi++){
   for(const part of fixture[pi].split(/\s+/).filter(Boolean)){
    transcript+=part+' ';
    testRecognition.onresult({results:[[{transcript}]]});
   }
   ok('음성으로 '+(pi+1)+'쪽 읽기',page>=Math.min(pi,total-1));
  }
  ok('마지막 쪽 도착',page===total-1);
  ok('읽은 줄 표시',!!document.querySelector('.ln.read'));
  stopMic();ok('마이크 정지',!listening);if(newUI)ok('정지 후 조작부 복귀',getComputedStyle(document.getElementById('bar')).display!=='none');
  if(window.PromUI){
   const savedMic=PromUI.mic,savedRender=PromUI.render,errors=[];
   const onError=e=>errors.push(e.message);addEventListener('error',onError);
   PromUI.mic=()=>{throw new Error('시험: 상태 표시 실패')};
   PromUI.render=()=>{throw new Error('시험: 저장·부가 화면 실패')};
   try{
    go(0,true);await startMic();transcript='';
    for(const pg of fixture)for(const part of pg.split(/\s+/).filter(Boolean)){
     transcript+=part+' ';testRecognition.onresult({results:[[{transcript}]]});
    }
    await Promise.resolve();
    ok('부가 기능 실패 중에도 음성으로 마지막 쪽 도착',page===total-1);
    ok('음성 이벤트 중단 오류 없음',errors.length===0);
    testRecognition.onerror({error:'no-speech'});
    ok('진단 문구가 발표 화면을 덮지 않음',getComputedStyle(document.getElementById('voiceFeedback')).display==='none');
    stopMic();
   }finally{PromUI.mic=savedMic;PromUI.render=savedRender;removeEventListener('error',onError);}
  }
  report.textContent+='완료: '+(failures.length?'실패 '+failures.length:'모두 통과');
 }catch(e){report.textContent+='ERROR '+e.stack;}
};
</script>'''

class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT),**kwargs)
 def do_GET(self):
  url=urlparse(self.path)
  if url.path!='/__voice_test__':return super().do_GET()
  version=parse_qs(url.query).get('version',['current'])[0]
  if version=='legacy':
   html=subprocess.check_output(['git','show','e4e4164:index.html'],cwd=ROOT).decode('utf-8')
  else:html=(ROOT/'index.html').read_text(encoding='utf-8')
  html=html.replace('<head>','<head><base href="/">'+MOCK,1).replace('</body>',CHECK+'</body>')
  data=html.encode('utf-8');self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)

if __name__=='__main__':ThreadingHTTPServer(('127.0.0.1',8765),Handler).serve_forever()
