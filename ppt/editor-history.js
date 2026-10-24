// 자막 편집기의 임시 기록. 프로젝트나 사용자 저장 형식에는 넣지 않는다.
(function(root){
'use strict';
// 이미지 주소 문자열은 불변이므로 여러 기록에서 그대로 공유한다.
function clone(value){
 if(!value||typeof value!=='object')return value;
 if(Array.isArray(value))return value.map(clone);
 if(Object.prototype.toString.call(value)!=='[object Object]')return structuredClone(value);
 return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,clone(item)]));
}
function equal(a,b){
 if(a===b)return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
 const keys=Object.keys(a);
 return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k]));
}
function create(initial,{limit=50,delay=650}={}){
 let states=[clone(initial)],at=0,group='',time=0;
 const equivalent=(a,b)=>equal(a.draft,b.draft)&&equal(a.form,b.form);
 return {
  get canUndo(){return at>0;},
  get canRedo(){return at<states.length-1;},
  record(state,key='',now=Date.now()){
   if(equivalent(state,states[at])){states[at].target=state.target;return;}
   const coalesce=key&&key===group&&now-time<delay&&at===states.length-1&&at>0;
   states.length=at+1;
   if(coalesce)states[at]=clone(state);
   else{states.push(clone(state));at++;if(states.length>limit){states.shift();at--;}}
   group=key;time=now;
  },
  refresh(state){states[at]=clone(state);group='';},
  undo(){if(at===0)return null;group='';return clone(states[--at]);},
  redo(){if(at===states.length-1)return null;group='';return clone(states[++at]);}
 };
}
const api={create};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root)root.CaptionEditorHistory=api;
})(typeof window!=='undefined'?window:null);
