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
<button id="runVoiceRegression">음성 추적 회귀 시험 실행</button><pre id="testReport" style="white-space:pre-wrap"></pre></div>
<script>
document.getElementById('runVoiceRegression').onclick=async()=>{
 const report=document.getElementById('testReport');
 const failures=[];const ok=(name,v)=>{report.textContent+=(v?'PASS ':'FAIL ')+name+'\n';if(!v)failures.push(name);};
 try{
  document.querySelector('input[name=lines][value="5"]').checked=true;
  document.getElementById('demo').click();
  let meterStopped=false;
  if(window.PromUI){
   document.getElementById('setpanel').classList.add('open');
   meter={raf:0,ac:{close(){}},own:true,stream:{getTracks:()=>[{stop(){meterStopped=true;}}]}};
  }
  await startMic();
  if(window.PromUI)ok('점검용 마이크 점유 해제',meterStopped&&!panelOpen()&&meter===null);
  ok('마이크 시작',listening);
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
  stopMic();ok('마이크 정지',!listening);
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
    ok('인식 안 됨 안내 표시',!document.getElementById('voiceFeedback').hidden);
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
