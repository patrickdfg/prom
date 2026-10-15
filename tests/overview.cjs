// State/event regression for the production overview module (no browser layout assertions).
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
class Element{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.attrs={};this.events={};this.className='';this.style={setProperty(k,v){this[k]=v}};this.hidden=false;this.offsetHeight=60;this.offsetTop=56;this.clientHeight=500;this.scrollTop=0;this.classList={toggle:(k,v)=>{const a=new Set(this.className.split(' ').filter(Boolean));v?a.add(k):a.delete(k);this.className=[...a].join(' ')},contains:k=>this.className.split(' ').includes(k)};}
 append(...els){els.forEach(el=>this.appendChild(el));}appendChild(el){if(el.tagName==='fragment')this.children.push(...el.children);else this.children.push(el);return el;}
 replaceChildren(){this.children=[];}setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];}
 querySelectorAll(selector){const k=selector.slice(1);return this.children.flatMap(ch=>[...(ch.classList.contains(k)?[ch]:[]),...ch.querySelectorAll(selector)]);}
 addEventListener(k,fn){(this.events[k]||=[]).push(fn);}click(){for(const fn of this.events.click||[])fn();this.onclick?.();}
 getBoundingClientRect(){return {height:100};}scrollIntoView(){this.scrolled=true;}
}
const ids=['view','slideGrid','overview','overviewToolbar','bar','viewSingle','viewMultiple','overviewZoom','overviewZoomValue','overviewCount','overviewCurrent','overviewAudience','audience','note','theme','page','dim'];
const nodes=Object.fromEntries(ids.map(id=>[id,new Element()]));nodes.theme.value='dark';nodes.dim.checked=true;
const store=new Map();let sentPage=-1,audience=0,editCalls=0;
const c={console,$:id=>nodes[id],P:Array.from({length:12},(_,i)=>[[{t:'원고 '+i,c:'k'}],[{t:'강조',c:'b'}]]),LINES:5,MOBILE:false,page:0,cursor:0,lineRange:Array.from({length:12},()=>[[0,5],[5,10]]),editing:false,localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},document:{createElement:t=>new Element(t),createDocumentFragment:()=>new Element('fragment')},addEventListener(){},fit(){},showBar(){}};
c.window={PromUI:{finishNote(){},render(){sentPage=c.page;},beforeBodyEdit(){editCalls++},holdControls(){return false}}};
c.render=()=>c.window.PromUI.render();c.go=p=>{c.page=p;c.cursor=0;c.render();};c.endEdit=()=>{c.editing=false;c.render();};nodes.audience.onclick=()=>audience++;
vm.createContext(c);vm.runInContext(fs.readFileSync('overview.js','utf8'),c);
const original=JSON.stringify(c.P);nodes.viewMultiple.click();assert.equal(nodes.slideGrid.children.length,12);assert.equal(nodes.view.classList.contains('overview-mode'),true);
assert.equal(nodes.slideGrid.children[0].attrs['aria-current'],'page');nodes.slideGrid.children[6].click();assert.equal(c.page,6);assert.equal(sentPage,6,'existing render/publication hook runs');assert.equal(nodes.slideGrid.children[6].attrs['aria-current'],'page');assert(!nodes.slideGrid.children[0].attrs['aria-current']);
nodes.overviewZoom.value='150';nodes.overviewZoom.oninput();assert.equal(c.page,6,'zoom must not change broadcast page');assert.equal(store.get('promOverviewZoom'),'150');
c.go(8);assert.equal(nodes.slideGrid.children[8].attrs['aria-current'],'page','voice page changes update active card');
nodes.overviewAudience.click();assert.equal(audience,1);nodes.overviewCurrent.click();assert(nodes.slideGrid.children[8].scrolled);
nodes.slideGrid.children[8].ondblclick();assert(!nodes.view.classList.contains('overview-mode'));assert(nodes.overview.hidden);
nodes.viewMultiple.click();c.window.PromUI.beforeBodyEdit();assert.equal(editCalls,1);assert(!nodes.view.classList.contains('overview-mode'));
c.editing=true;nodes.viewMultiple.click();assert.equal(c.editing,false,'pending body edit committed before overview');
nodes.note.click();assert(!nodes.view.classList.contains('overview-mode'),'note editing uses single page');assert.equal(JSON.stringify(c.P),original);
console.log('PASS overview cards, page selection, render/publication hook, voice-page sync, zoom isolation/persistence, audience action, return to single view, edit handling, unchanged manuscript');
