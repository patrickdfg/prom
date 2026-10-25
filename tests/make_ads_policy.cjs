// Regression: dawn sermons do not accept optional worship advertisements.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const calls=[];
let paired=false;
const sandbox={
  CaptionBuilder:{
    layouts:{},
    useTemplate:async()=>{},
    generate:async()=>({slides:[{tag:'generated'}],links:[{reason:'generated'}]})
  },
  CaptionContentRules:{mode:record=>record?.options?.sourceMode||'numbered'},
  CaptionPairTemplate:{
    generate:async(_project,record)=>{calls.push('pair');return paired?{slides:[{tag:'paired'}],links:[],record}:null;},
    weave:(fixed,slides,links)=>{
      calls.push('weave:'+fixed.length);
      return {
        slides:[...fixed.map(item=>item.slide),...slides],
        links:[...fixed.map(()=>({reason:'fixed'})),...links]
      };
    }
  },
  MakeTemplateLayouts:{prepare:record=>record},
  MakeAnnouncements:{
    upgrade:record=>record,
    replace:()=>{throw Error('Dawn sermon must not call announcement replacement.');}
  },
  CaptionImport:{deck:()=>{},manuscriptRich:()=>{}},
  structuredClone
};
sandbox.window=sandbox;
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../make/engine.js'),'utf8'),sandbox,{filename:'make/engine.js'});
const {policy,generate}=sandbox.MakePptEngine;

function check(record,full,ads){
  const actual=policy(record);
  assert.equal(actual.full,full,JSON.stringify(record));
  assert.equal(actual.allowAnnouncements,ads,JSON.stringify(record));
}
check({id:'builtin-dawn'},false,false);
check({id:'my-dawn',copiedFrom:'builtin-dawn',name:'내 템플릿'},false,false);
check({id:'my-dawn',name:'새벽 설교 복사본'},false,false);
check({id:'builtin-sunday'},false,false);
check({id:'sunday-copy',copiedFrom:'builtin-sunday'},false,false);
check({id:'builtin-sunday-worship',options:{serviceExtras:true}},true,true);
check({name:'새벽설교 예배 전반',options:{sourceMode:'worship'}},true,true);
check({name:'수요설교',options:{sourceMode:'numbered'}},false,true);

(async()=>{
  const project={lines:['하나님을 사랑하라'],richLines:[]};
  for(const exact of [true,false]){
    paired=exact;calls.length=0;
    const template={id:'builtin-dawn',fixedSlides:[{slide:{tag:'fixed'}}]};
    const original=JSON.stringify(template);
    const result=await generate(project,template,{announcements:'1. 광고 문구',responsiveReading:'교독문'});
    assert.equal(result.announcements,'');
    assert.equal(result.responsiveReading,'');
    assert.deepEqual(Array.from(result.slides,s=>s.tag),exact?['paired']:['fixed','generated']);
    assert.ok(calls.includes('pair'),'Dawn paired-PPT matching must remain enabled.');
    assert.equal(JSON.stringify(template),original,'Original template must not be modified.');
  }
  console.log('make dawn announcement policy: PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
