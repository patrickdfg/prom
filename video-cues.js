/* Video commands are silent control markers; all other manuscript speech stays indexed. */
(function(root){
'use strict';
const pattern=/\([ \t]*영상(?:[가-힣ㄱ-ㅎㅏ-ㅣ0-9 \t]*(시작|끝))?[ \t]*\)/g;
const normalize=text=>[...text].filter(c=>/[가-힣a-zA-Z0-9]/.test(c)).join('').toLowerCase();
function line(runs){
 const chars=[],colors=[];for(const run of runs||[])for(const ch of String(run.t||'').split('')){chars.push(ch);colors.push(run.c);}
 const raw=chars.join(''),matches=new Map([...raw.matchAll(new RegExp(pattern.source,'g'))].map(m=>[m.index,m]));
 let spoken='',text='';const cues=[];
 for(let i=0;i<chars.length;){const match=matches.get(i);if(match){cues.push({position:text.length,action:match[1]==='끝'?'slideshow':'obs',label:match[0]});i+=match[0].length;continue;}
  if(colors[i]!=='r'&&colors[i]!=='n'){spoken+=chars[i];text+=normalize(chars[i]);}i++;
 }
 return {spoken,text,cues};
}
function build(pages){
 // Layout can wrap one command into several display rows. Spaces join those rows,
 // while a newline embedded in the source text remains an invalid command name.
 const rows=[];let raw='';
 (pages||[]).forEach((page,pi)=>(page||[]).forEach((runs,li)=>{const start=raw.length;raw+=(runs||[]).map(r=>r.t||'').join('');rows.push({runs,pi,li,start});raw+=' ';}));
 const mask=new Uint8Array(raw.length),commands=new Map();
 for(const match of raw.matchAll(new RegExp(pattern.source,'g'))){mask.fill(1,match.index,match.index+match[0].length);commands.set(match.index,match);}
 let text='',ri=0;const starts=[],ends=[],ranges=[],lastLine=[],cues=[],spokenRows=[];
 (pages||[]).forEach((page,pi)=>{starts.push(text.length);const bounds=[],spoken=[];
  (page||[]).forEach((runs,li)=>{const start=text.length,entry=rows[ri++];let offset=entry.start,speech='';
   for(const run of runs||[])for(const ch of String(run.t||'').split('')){
    const match=commands.get(offset);if(match)cues.push({position:text.length,action:match[1]==='끝'?'slideshow':'obs',label:match[0],page:pi,line:li});
    if(!mask[offset]&&run.c!=='r'&&run.c!=='n'){speech+=ch;text+=normalize(ch);}offset++;
   }
   spoken.push(speech);bounds.push([start,text.length]);
  });
  spokenRows.push(spoken);ranges.push(bounds);ends.push(text.length);lastLine.push(bounds.filter(r=>r[1]>r[0]).at(-1)?.[0]??starts[pi]);
 });return {text,starts,ends,ranges,lastLine,cues,spokenRows};
}
function active(cues,cursor){let result=null;for(const cue of cues||[]){if(cue.position>cursor)break;result=cue;}return result;}
const api={line,build,active,speech:runs=>line(runs).spoken,strip:text=>line([{t:String(text||''),c:'k'}]).spoken};
if(typeof module==='object'&&module.exports)module.exports=api;else root.PromVideoCues=api;
})(typeof window==='object'?window:globalThis);
