// Local collector for real Chrome Web Speech events. Never fabricates recognition results.
// node tests/chrome_worship_server.cjs <private recording root> [port]
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {create}=require('./recording_replay.cjs');
const root=path.resolve(process.argv[2]),port=Number(process.argv[3]||8767),origin=`http://127.0.0.1:${port}`;
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8')),runs=new Map();
const jobs=new Map(manifest.jobs.map(j=>[j.id,j]));
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,1));
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
function save(run){write(path.join(run.folder,'state.json'),{id:run.id,date:run.date,mode:run.mode,status:run.status,
 results:run.results,errors:run.errors,sourceTime:run.sourceTime,cursor:run.h.c.cursor,page:run.h.c.page+1,
 manuscriptEnd:run.layout.text.length,pages:run.layout.pages.length,lastEvent:run.lastEvent,updated:new Date().toISOString()});}
function append(run,event){run.lastEvent=event.type;fs.appendFileSync(path.join(run.folder,'events.jsonl'),JSON.stringify(event)+'\n');}
async function body(req){const chunks=[];let bytes=0;for await(const c of req){bytes+=c.length;if(bytes>10*1024*1024)throw Error('Request too large');chunks.push(c);}return Buffer.concat(chunks);}
const server=http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,origin);
  if(req.method==='POST'){
   if(req.headers.origin!==origin)return send(res,403,{error:'Origin mismatch'});
   const raw=await body(req),data=u.pathname.endsWith('/media')?null:JSON.parse(raw.toString('utf8'));
   if(u.pathname==='/api/start'){
    const job=jobs.get(data.date);if(!job||!['mic','track'].includes(data.mode))throw Error('Invalid job');
    const source=JSON.parse(fs.readFileSync(path.join(job.output,'metadata.json'),'utf8'));
    for(const [file,expected]of Object.entries(source.speechSourceSha256)){
     const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'..',file))).digest('hex');
     if(actual!==expected)throw Error('Production speech source changed: '+file);
    }
    const id=`${data.mode}-${data.date}-${Date.now()}`,folder=path.join(root,'chrome-tests',data.mode,data.date,id);
    fs.mkdirSync(folder,{recursive:true});const layout=JSON.parse(fs.readFileSync(path.join(job.output,'pages.json'),'utf8'));
    const run={id,folder,layout,date:data.date,mode:data.mode,h:create(layout.pages),carry:'',sessionText:'',
     status:'starting',results:0,errors:0,sourceTime:0,lastEvent:'start'};
    runs.set(id,run);write(path.join(folder,'metadata.json'),{...source,chromeTest:true,mode:data.mode,
     browser:data.browser,settings:{lang:'ko-KR',continuous:true,interimResults:true,maxAlternatives:1},
     playbackRate:1,probe:!!data.probe,started:new Date().toISOString(),physicalInput:data.device||null});
    save(run);return send(res,200,{id});
   }
   const match=u.pathname.match(/^\/api\/run\/([a-z0-9-]+)\/(event|media)$/),run=match&&runs.get(match[1]);
   if(!run)return send(res,404,{error:'Unknown run'});
   if(match[2]==='media'){
    fs.appendFileSync(path.join(run.folder,'microphone.webm'),raw);return send(res,200,{saved:raw.length});
   }
   data.receivedAt=new Date().toISOString();run.sourceTime=data.audioTime||0;
   if(data.type==='result'){
    run.results++;run.sessionText=data.results.map(r=>r.alternatives[0]?.transcript||'').join('');
    const final=data.results.at(-1)?.isFinal;
    const tracked=run.h.feed({time:data.elapsed,text:run.sessionText,carry:run.carry,final});
    Object.assign(data,{sessionText:run.sessionText,carry:run.carry,tracked});run.status='recognizing';
   }else if(data.type==='end'){
    run.carry=(run.carry+run.sessionText).slice(-60);run.sessionText='';
   }else if(data.type==='error'){run.errors++;run.status='error:'+data.error;}
   else if(data.type==='finish')run.status=data.status||'stopped';
   else if(data.type==='recognition-start')run.status='connected';
   append(run,data);save(run);
   return send(res,200,{id:run.id,status:run.status,results:run.results,cursor:run.h.c.cursor,page:run.h.c.page+1,
    pages:run.layout.pages.length,manuscriptEnd:run.layout.text.length});
  }
  if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,{error:'Method not allowed'});
  if(u.pathname==='/api/config')return send(res,200,{jobs:manifest.jobs.map(j=>{
   const m=JSON.parse(fs.readFileSync(path.join(j.output,'metadata.json'),'utf8'));
   return {date:j.id,duration:m.duration,audio:`/recordings/${j.id}/audio.mp3`};})});
  if(u.pathname==='/api/status')return send(res,200,{runs:[...runs.values()].map(r=>JSON.parse(fs.readFileSync(path.join(r.folder,'state.json'),'utf8')))});
  let file;
  if(u.pathname==='/')file=fs.existsSync(path.join(root,'chrome-test.html'))?path.join(root,'chrome-test.html'):path.join(__dirname,'chrome_worship.html');
  else{const m=u.pathname.match(/^\/recordings\/(\d{8})\/audio\.mp3$/);if(m&&jobs.has(m[1]))file=path.join(jobs.get(m[1]).output,'audio.mp3');}
  if(!file||!fs.existsSync(file))return send(res,404,{error:'Not found'});
  const size=fs.statSync(file).size,type=file.endsWith('.mp3')?'audio/mpeg':'text/html; charset=utf-8';
  const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),size-1):size-1;
   res.writeHead(206,{'Content-Type':type,'Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':end-start+1,'Accept-Ranges':'bytes'});
   if(req.method==='HEAD')res.end();else fs.createReadStream(file,{start,end}).pipe(res);
  }else{res.writeHead(200,{'Content-Type':type,'Content-Length':size,'Accept-Ranges':'bytes','Cache-Control':'no-store'});
   if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);}
 }catch(e){send(res,500,{error:String(e.message||e)});}
});
server.listen(port,'127.0.0.1',()=>console.log('Chrome speech collector',origin));
