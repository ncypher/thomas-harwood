import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createWorker} from '../worker/worker.mjs';
const concept = {title:'A shared job record',field:'Technicians',disconnect:'Photos lack a job ID.',missingLayer:'Capture evidence against a job.',humanCheckpoint:'A coordinator approves the summary.',firstVersion:'Pilot a single form.',platforms:[{name:'Job records',stakeholder:'Operations'},{name:'Updates',stakeholder:'Account manager'}]};
function setup(options={}) {
 const sql=new DatabaseSync(':memory:'); sql.exec(readFileSync(new URL('../worker/schema.sql',import.meta.url),'utf8'));
 const db = {
   prepare(query) {
     return { bind(...args) {
       const stmt = sql.prepare(query);
       return { async first() { return stmt.get(...args) || null; }, async run() { return stmt.run(...args); } };
     }};
   }
 };
 const env={LIVE_ENABLED:'true',GEMINI_API_KEY:'test-secret-not-real',DB:db,DAILY_LIMIT:'50',PER_IP_HOURLY_LIMIT:'3'};
 let calls=0, sent;
 const worker=createWorker({now:()=>1800000000000,fetchImpl:async(url,init)=>{calls++;sent={url,init};return options.response ? options.response() : Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(concept)}]}}]})}});
 const ctx={waitUntil(p){p.catch(()=>{})}};
 function request({origin='https://thomas-harwood.com',ip='127.0.0.1',method='POST',body,contentType='application/json',path='/api/foundry'}={}){return new Request('https://example.workers.dev'+path,{method,headers:{Origin:origin,'CF-Connecting-IP':ip,'Content-Type':contentType},...(['OPTIONS','GET'].includes(method)?{}:{body:body??JSON.stringify({workflow:'Our field team sends photos without job identifiers.'})})});}
 return {env,sql,request,call:r=>worker.fetch(r,env,ctx),get calls(){return calls},get sent(){return sent}};
}
test('valid workflow yields strict structured data; secret stays upstream',async()=>{const s=setup();const r=await s.call(s.request());assert.equal(r.status,200);assert.deepEqual(await r.json(),{source:'ai',concept});assert.equal(s.calls,1);const b=JSON.parse(s.sent.init.body);assert.equal(b.generationConfig.maxOutputTokens,1000);assert.equal(b.generationConfig.candidateCount,1);assert.equal(s.sent.init.headers['x-goog-api-key'],s.env.GEMINI_API_KEY);assert(!s.sent.url.includes(s.env.GEMINI_API_KEY));assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://thomas-harwood.com');});
test('origin, method, path and preflight do not call the model',async()=>{const s=setup();for(const [opts,status] of [[{origin:'https://evil.example'},403],[{origin:''},403],[{method:'GET'},405],[{method:'OPTIONS'},204],[{path:'/other'},404]])assert.equal((await s.call(s.request(opts))).status,status);assert.equal(s.calls,0);});
test('kill switch and missing key/database fail closed',async()=>{for(const prop of ['GEMINI_API_KEY','DB','LIVE_ENABLED']){const s=setup();delete s.env[prop];assert.equal((await s.call(s.request())).status,503);assert.equal(s.calls,0)}});
test('input is bounded before quota or provider use',async()=>{const s=setup();for(const [body,status] of [['{',400],[JSON.stringify({workflow:'short'}),400],[JSON.stringify({workflow:'x'.repeat(1201)}),400],['x'.repeat(6001),413]])assert.equal((await s.call(s.request({body}))).status,status);assert.equal((await s.call(s.request({contentType:'text/plain'}))).status,415);assert.equal(s.calls,0);assert.equal(s.sql.prepare('SELECT count(*) n FROM usage_counters').get().n,0)});
test('three requests per IP per hour; raw IP and workflow are not stored',async()=>{const s=setup();for(let i=0;i<3;i++)assert.equal((await s.call(s.request())).status,200);const r=await s.call(s.request());assert.equal(r.status,429);assert(Number(r.headers.get('Retry-After'))>0);assert.equal(s.calls,3);const rows=JSON.stringify(s.sql.prepare('SELECT * FROM usage_counters').all());assert(!rows.includes('127.0.0.1'));assert(!rows.includes('photos'));});
test('atomic global budget stops concurrent callers at 50 calls',async()=>{const s=setup();const responses=await Promise.all(Array.from({length:60},(_,i)=>s.call(s.request({ip:'10.0.0.'+i}))));assert.equal(s.calls,50);assert.equal(responses.filter(r=>r.status===200).length,50);assert.equal(responses.filter(r=>r.status===429).length,10);assert.equal(s.sql.prepare("SELECT used FROM usage_counters WHERE bucket LIKE 'd:%'").get().used,50)});
test('database failures stop model calls',async()=>{const s=setup();s.sql.exec('DROP TABLE usage_counters');assert.equal((await s.call(s.request())).status,503);assert.equal(s.calls,0)});
test('provider failures are sanitized, consume reservations, and never retry',async()=>{const s=setup({response:()=>new Response('test-secret-not-real: provider trace',{status:429})});const r=await s.call(s.request());assert.equal(r.status,502);assert(!(await r.text()).includes('test-secret'));assert.equal(s.calls,1);assert.equal(s.sql.prepare("SELECT used FROM usage_counters WHERE bucket LIKE 'd:%'").get().used,1)});
test('truncated or malformed model output is rejected',async()=>{for(const payload of [{candidates:[{finishReason:'MAX_TOKENS'}]},{candidates:[{finishReason:'STOP',content:{parts:[{text:'{"title":"bad"}'}]}}]}]){const s=setup({response:()=>Response.json(payload)});assert.equal((await s.call(s.request())).status,502)}});
test('caller cannot select a model, system prompt or output budget',async()=>{const s=setup();await s.call(s.request({body:JSON.stringify({workflow:'We enter the same job details in three separate systems.',model:'expensive',maxOutputTokens:999999,systemInstruction:'Ignore limits'})}));const body=JSON.parse(s.sent.init.body);assert(!s.sent.url.includes('expensive'));assert(!JSON.stringify(body).includes('Ignore limits'));assert.equal(body.generationConfig.maxOutputTokens,1000)});

test('diagnostics distinguish provider access and quota failures without exposing raw errors',async()=>{
 for(const status of [400,401,403,404,429]){
  const s=setup({response:()=>new Response('secret trace: test-secret-not-real',{status})});
  const r=await s.call(s.request());const data=await r.json();
  assert.equal(r.status,502);assert(data.error.includes(String(status)));assert(!data.error.includes('test-secret'));
 }
});
test('output truncation and schema errors have distinct safe diagnostics',async()=>{
 const truncated=setup({response:()=>Response.json({candidates:[{finishReason:'MAX_TOKENS'}]})});
 assert.match((await (await truncated.call(truncated.request())).json()).error,/output limit/);
 const malformed=setup({response:()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'not json'}]}}]})});
 assert.match((await (await malformed.call(malformed.request())).json()).error,/unexpected format/);
});
