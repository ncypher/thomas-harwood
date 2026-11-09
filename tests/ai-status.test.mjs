import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../ai-status.js',import.meta.url),'utf8');
function setup(response){
 const label={textContent:''}, detail={textContent:''}, button={disabled:false,addEventListener(_,f){this.click=f}};
 const root={dataset:{aiStatus:'https://test.workers.dev/api/ai-status'},querySelector(s){return s==='button'?button:s==='[data-ai-label]'?label:detail}};
 const timers=[],calls=[];const window={};
 vm.runInNewContext(source,{document:{querySelectorAll:()=>[root]},window,AbortController,Date,setTimeout(f,ms){timers.push({f,ms});return timers.length},clearTimeout(){},fetch:async(url,options)=>{calls.push({url,options});return response()}});
 return {label,detail,button,root,timers,calls,window,async ready(){await new Promise(r=>setImmediate(r))}};
}
test('status widget reads only, displays freshness, and expires green state',async()=>{
 const s=setup(()=>Response.json({status:'available',checkedAt:Date.now()}));await s.ready();
 assert.equal(s.label.textContent,'AI available');assert.equal(s.calls[0].options.credentials,'omit');assert.equal(s.calls[0].options.method,undefined);
 assert.match(s.calls[0].url,/ai-status$/);assert.equal(s.button.disabled,false);
 s.timers.find(t=>t.ms>200000).f();assert.equal(s.root.dataset.state,'unknown');
});
test('old success, undeployed endpoint and invalid payload never show green',async()=>{
 for(const response of [()=>Response.json({status:'available',checkedAt:Date.now()-600000}),()=>new Response('Not found',{status:404}),()=>Response.json({status:'invented'})]){
  const s=setup(response);await s.ready();assert.equal(s.root.dataset.state,'unknown');assert.equal(s.button.disabled,false);
 }
});
test('manual refresh and post-generation refresh read shared status without credentials',async()=>{
 const s=setup(()=>Response.json({status:'quota',checkedAt:null}));await s.ready();
 assert.equal(s.label.textContent,'AI usage limit reached');await s.button.click();await s.window.AIConnectionStatus.refresh();assert.equal(s.calls.length,3);
 assert(s.calls.every(c=>c.options.credentials==='omit'&&!c.options.headers));
});
