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
   document.getElementById('note').click();
   const memo=document.querySelector('.line-note.edit');memo.textContent='잠시 멈추고 회중 보기';memo.dispatchEvent(new Event('input',{bubbles:true}));
   ok('메모 직접 편집',memo.isContentEditable&&!document.querySelector('dialog[open]'));
   document.getElementById('note').click();
   await Promise.resolve();ok('메모 빨간색 표시',getComputedStyle(document.querySelector('.line-note')).color==='rgb(255, 52, 52)');
   document.querySelectorAll('.note-insert')[1].click();const second=document.querySelector('.line-note.edit');second.textContent='두 번째 줄에서 강조';second.dispatchEvent(new Event('input',{bubbles:true}));PromUI.finishNote();await Promise.resolve();
   ok('모든 줄에 메모 버튼',document.querySelectorAll('.note-insert').length===LINES);
   ok('각 줄 앞에 메모 저장',document.querySelectorAll('.line-note').length===2&&document.querySelectorAll('#lines>.ln')[1].querySelector('.line-note').textContent==='두 번째 줄에서 강조');
   const roundTrip=JSON.parse(JSON.stringify(PromUI.metadata()));PromUI.applyMetadata(roundTrip);render();await Promise.resolve();ok('줄별 메모 저장 파일 복구',document.querySelectorAll('.line-note').length===2);
   document.getElementById('theme-cloud').click();ok('하늘 구름 배경 선택',!document.getElementById('page').classList.contains('dark'));document.getElementById('theme-dark').click();ok('검정 배경 선택',document.getElementById('page').classList.contains('dark'));
   ok('메모 읽어주기 제외',!pageSay(page).includes('잠시 멈추고'));
   ok('메모 저장',Object.values(PromUI.metadata().lineNotes).flat().includes('잠시 멈추고 회중 보기'));
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
   const hidden=id=>getComputedStyle(document.getElementById(id)).display==='none';
   ok('마이크 중 원고 외 화면 숨김',['statusbar','bar','voiceFeedback','toast'].every(hidden)&&!document.querySelector('.line-note,.note-insert'));
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
