import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html = readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source = readFileSync(new URL('../foundry.js',import.meta.url),'utf8');
const concept = {title:'<img src=x onerror=alert(1)>',field:'Field team',disconnect:'Missing records',missingLayer:'Link the records',humanCheckpoint:'Review each draft',firstVersion:'Pilot a form',platforms:[{name:'Jobs',stakeholder:'Operations'},{name:'Updates',stakeholder:'Manager'}]};
function setup(apiUrl='',response=()=>Response.json({source:'ai',concept})) {
 const nodes = new Map(); let calls=0, copied='';
 function element(){return {textContent:'',value:'',hidden:false,disabled:false,children:[],attrs:{},handlers:{},classList:{toggle(){}},addEventListener(name,f){this.handlers[name]=f},setAttribute(k,v){this.attrs[k]=v},replaceChildren(){this.children=[]},append(...n){this.children.push(...n)},reportValidity(){return true},focus(){}};}
 const root={querySelector(s){
   const kind=s[0]==='#'?'id':'class';
   assert(new RegExp(kind+'="[^"\\n]*'+s.slice(1)+'(?:[ "]|$)').test(html), 'Selector absent from page: '+s);
   if(!nodes.has(s))nodes.set(s,element());return nodes.get(s);
 }};
 vm.runInNewContext(source,{document:{getElementById(id){assert.equal(id,'foundry-lab');return root},createElement:element},window:{HARWOOD_FOUNDRY_CONFIG:{apiUrl}},URL,AbortController,setTimeout,clearTimeout,navigator:{clipboard:{async writeText(s){copied=s}}},fetch:async()=>{calls++;return response()}});
 return {nodes,get calls(){return calls},get copied(){return copied},event(sel,event='click'){return nodes.get(sel).handlers[event]({preventDefault(){}})}};
}
test('sample is explicit and makes no network call',async()=>{const s=setup();await s.event('#foundry-sample');assert.equal(s.calls,0);assert.match(s.nodes.get('#foundry-provenance').textContent,/not an AI response/);assert.equal(s.nodes.get('#foundry-result').hidden,false);await s.event('#foundry-copy');assert.match(s.copied,/Sample concept/)});
test('invalid public endpoint leaves live mode disabled',()=>{const s=setup('http://insecure.example/api/foundry');assert.equal(s.nodes.get('.fl-mode'),undefined)});
test('live success renders untrusted strings as text and resets busy state',async()=>{const s=setup('https://test.workers.dev/api/foundry');s.nodes.get('#foundry-workflow').value='We copy job records between two unrelated systems.';await s.event('#foundry-form','submit');assert.equal(s.calls,1);assert.equal(s.nodes.get('#foundry-result-title').textContent,concept.title);assert.equal(s.nodes.get('.fl-output').attrs['aria-busy'],'false');assert.equal(s.nodes.get('#foundry-submit').disabled,false);assert.match(s.nodes.get('#foundry-provenance').textContent,/AI-generated/)});
test('rate-limit error is shown without fabricating an AI result',async()=>{const s=setup('https://test.workers.dev/api/foundry',()=>Response.json({error:'Daily allowance reached'},{status:429}));s.nodes.get('#foundry-workflow').value='The office retypes every job report into three systems.';await s.event('#foundry-form','submit');assert.match(s.nodes.get('#foundry-status').textContent,/Daily allowance/);assert.equal(s.nodes.get('#foundry-result').hidden,true);assert.equal(s.nodes.get('#foundry-submit').disabled,false)});
test('repeat submissions while busy make one request',async()=>{let resolve;const response=new Promise(r=>resolve=r);const s=setup('https://test.workers.dev/api/foundry',()=>response);s.nodes.get('#foundry-workflow').value='The office retypes every job report into three systems.';const first=s.event('#foundry-form','submit');await s.event('#foundry-form','submit');assert.equal(s.calls,1);resolve(Response.json({source:'ai',concept}));await first;});
