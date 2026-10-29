const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),K=require('../korean-line-breaks.js');
const measure=s=>[...s].reduce((a,ch)=>a+(/[가-힣]/.test(ch)?1:.5),0);
const first=[['1. 섭리사를','따라와도','시대'],['보낸','자와','말씀과','그가','행한'],['일에','대해','자세히','알아야','한다.']];
assert.equal(K.refine(first,measure,17.5),null,'행한 일에를 붙이려고 일에 / 대해를 새로 끊지 않는다');
const humanity=[['4. 성령님)','아닌','것은','온'],['인류가','주장해도','아니다.']];
assert.deepEqual(K.refine(humanity,measure,17.5),[3,4],'온 인류가는 25% 이내에서 한 줄로');
assert.equal(K.refine(humanity,measure,12),null,'의미를 붙이려고 최대 너비를 넘지 않는다');
assert.equal(K.refine([['온'],['인류가','주장해도','아니다.']],measure,17.5),null,'25% 균형 조건을 만족하지 않으면 유지');
const protectedUnits=[['그가','행한'],['일에','대해','말씀을','통해','알아야','한다.']];
assert.deepEqual(K.refine(protectedUnits,measure,17.5),[4,4],'일에 대해와 말씀을 통해를 각각 붙여서 균형 있게 배치');
assert.deepEqual(humanity,[['4. 성령님)','아닌','것은','온'],['인류가','주장해도','아니다.']],'입력은 변경하지 않는다');

// 실제 PPT 자동 줄바꿈을 너비별로 확인한다. 수동 줄바꿈은 자동 보조 규칙을 거치지 않는다.
const code=fs.readFileSync('ppt/builder.js','utf8');
for(const factor of [40,45,50,55,60,65,70]){
 const c={URL,structuredClone,crypto:require('node:crypto').webcrypto,PromLineBreaks:K,CaptionCore:require('../ppt/core.js'),CaptionContentRules:require('../ppt/content-rules.js'),document:{currentScript:{src:'http://localhost/ppt/builder.js'},createElement:()=>({getContext:()=>({measureText:t=>({width:measure(t)*factor})})})}};
 c.window=c;vm.createContext(c);vm.runInContext(code,c);
 for(const text of ['1. 섭리사를 따라와도 시대 보낸 자와 말씀과 그가 행한 일에 대해 자세히 알아야 한다.','4. 성령님) 아닌 것은 온 인류가 주장해도 아니다.']){
  const lines=c.CaptionBuilder.wrapForLayout(text,'word');
  assert.equal(lines.join('').replace(/\s/g,''),text.replace(/\s/g,''));
  assert(!lines.some(l=>/^\d+\.?$/.test(l.trim())));
  assert(!lines.some((l,i)=>/일에$/.test(l)&&/^대해/.test(lines[i+1]||'')),'PPT에서도 일에 대해 보호');
 }
 assert.equal(c.CaptionBuilder.wrapForLayout('그가 행한\n일에 대해','word').join('\n'),'그가 행한\n일에 대해');
}
console.log('PASS 25% modifier grouping, protected relational phrases, width cap, immutable input and PPT automatic/manual text');
