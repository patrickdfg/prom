const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const R=require('../content-rules.js'),C=require('../core.js'),P=require('../pair-template.js'),L=require('../../make/template-layouts.js'),A=require('../../make/announcements.js');
const sunday=JSON.parse(fs.readFileSync('ppt/templates/sunday.json','utf8'));
const c={CaptionContentRules:R,CaptionCore:C,CaptionPairTemplate:P,MakeTemplateLayouts:L,MakeAnnouncements:A,structuredClone,crypto:require('crypto').webcrypto,URL,document:{currentScript:{src:'http://localhost/ppt/builder.js'},fonts:{load:async()=>{}},createElement:()=>({getContext:()=>({font:'',measureText:t=>({width:t.length*15})})})}},decks=[];
c.fetch=async()=>({ok:true,json:async()=>JSON.parse(fs.readFileSync('ppt/template-data.json','utf8'))});
c.window=c;c.CaptionImport={deck:async()=>decks[0],manuscriptRich:async()=>{}};vm.createContext(c);
vm.runInContext(fs.readFileSync('ppt/builder.js','utf8'),c);vm.runInContext(fs.readFileSync('make/engine.js','utf8'),c);
const project={lines:['1. 서로 사랑하며 실천합니다.','2. 작은 일부터 감사하며 행합니다.']};
const full={...structuredClone(sunday),id:'builtin-sunday-worship',name:'기본 주일예배 전체 템플릿',options:{...sunday.options,serviceExtras:true}};
const text=out=>out.slides.flatMap(s=>s.shapes||[]).flatMap(s=>(s.paragraphs||[]).flatMap(p=>(p.runs||[]).map(r=>r.text))).join('\n');
(async()=>{
 const original=JSON.stringify(sunday),only=await c.MakePptEngine.generate(project,sunday,{announcements:'1. 남아 있던 광고',responsiveReading:'남아 있던 교독문'});
 assert(!text(only).includes('남아 있던'));assert.equal(only.announcements,'');assert.equal(JSON.stringify(sunday),original);
 const stale={...sunday,announcementTemplate:{version:1,slots:[{fixedIndex:99,bodyIndex:0}]}};
 await c.MakePptEngine.generate(project,stale,{});
 const staleFull={...full,announcementTemplate:stale.announcementTemplate};
 for(const announcements of ['', '1. 이번 주 광고']){const out=await c.MakePptEngine.generate(project,staleFull,{announcements});assert(out.slides.length);assert.equal(out.links.length,out.slides.length);}
 for(const options of [{},{announcements:'1. 이번 주 모임 안내'},{responsiveReading:'교독문\n인도자: 감사합니다.\n회중: 아멘.'},{announcements:'1. 이번 주 모임 안내',responsiveReading:'교독문\n함께 읽습니다.'}]){
  const before=JSON.stringify(full),out=await c.MakePptEngine.generate(project,full,options);
  assert(out.slides.length>0);assert.equal(out.links.length,out.slides.length);assert.equal(JSON.stringify(full),before);
  assert.equal(text(out).includes('이번 주 모임 안내'),!!options.announcements);assert.equal(text(out).includes('교독문'),!!options.responsiveReading);
 }
 for(const options of [{announcements:'1. 광고만 있습니다.'},{responsiveReading:'교독문만 있습니다.'}]){const out=await c.MakePptEngine.generate({lines:[]},full,options);assert(out.slides.length);assert.equal(out.links.length,out.slides.length);}
 await assert.rejects(()=>c.MakePptEngine.generate({lines:[]},full,{}),/만들 자료/);
 const h={lines:['<2026년 10월 24일 주일말씀>','사랑하며 행하라','본문:','<요한복음 3장 16절> “서로 사랑하라.”','할렐루야!']};
 const header=await c.MakePptEngine.generate(h,full,{});assert(text(header).includes('사랑하며 행하라'));assert(!text(header).includes('할렐루야'));
 const ad=await c.CaptionBuilder.scene('word','교회 광고\n1. 지난 주 모임'),reading=await c.CaptionBuilder.scene('word','교독문\n지난 주 교독문');
 const withOld={...full,fixedSlides:[{before:0,total:1,slide:ad},{before:0,total:1,slide:reading}]};
 const withoutOld=await c.MakePptEngine.generate(project,withOld,{});assert(!text(withoutOld).includes('지난 주'));assert.equal(withoutOld.links.length,withoutOld.slides.length);
 console.log('PASS real shared builder: sermon-only with stale extras, optional Sunday service none/ad/reading/both, extras-only, header-only, no old service text, aligned links, immutable templates');
})().catch(e=>{console.error(e);process.exitCode=1});
