/* Canonical Make engine, shared by Make and the PPT workspace. UI adapters only supply manuscripts, templates and overrides. */
window.MakePptEngine=(()=>{
 'use strict';
 const B=CaptionBuilder,R=CaptionContentRules,P=CaptionPairTemplate,L=MakeTemplateLayouts;
 async function generate(project,template,options={}){
  let record=template?L.prepare(window.MakeAnnouncements?MakeAnnouncements.upgrade(structuredClone(template)):structuredClone(template),B.layouts):null;
  await B.useTemplate(record?.design||null);
  const run=async()=>{
   if(R.mode(record)==='worship'){
    const result=R.generateWorship(project,record,await R.sourceDeck(record,CaptionImport.deck),options);
    record=L.prepare(result.record,B.layouts);await B.useTemplate(record.design);
    return {...result,record,worship:true,exportSize:{width:1920,height:1080}};
   }
   const original=await P.generate(project,record,CaptionImport.deck,CaptionImport.manuscriptRich,options);
   if(original)return {...original,record:L.prepare(original.record,B.layouts)};
   const generated=await B.generate(project,options),woven=P.weave(record?.fixedSlides||[],generated.slides,generated.links);
   return {...generated,...woven,record,exportSize:{width:1920,height:1080}};
  };
  // A previously open PPT must not add its project-specific master overrides to a different selected template.
  const result=await (window.CaptionMasters?.withRecords?CaptionMasters.withRecords({},run):run());
  return options.announcements?.trim()||result.record?.announcementTemplate?MakeAnnouncements.replace(result,result.record,options.announcements):{...result,announcements:String(options.announcements||'')};
 }
 return {generate};
})();
