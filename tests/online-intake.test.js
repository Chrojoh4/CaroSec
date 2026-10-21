import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {sampleScenario} from '../src/sample-scenario.js';
import {receiveOnlineEntry,onlineReceipt} from '../src/cloud/online-intake.js';
import {makeOnlineHandler} from '../src/cloud/online-runtime.js';

async function fixture(){
 const {state,trialId}=await sampleScenario(),config=structuredClone(state.trials[trialId]);config.fictional=false;config.opens='2020-01-01';config.closes='2099-01-01';
 const body={slug:'test-trial',receiptSecret:'a'.repeat(64),input:{trialId,idempotencyKey:randomUUID(),contact:{name:'Test Handler',email:'test@example.com',phone:'555',address:'Test address'},dog:{name:'Test dog',caroId:'001334',breed:'Mixed',birthDate:'2020-01-01',height:'18',jumpHeight:'12'},selections:[{eventId:config.events[0].id,stream:'B',unitCents:1}],agree:true,eligibilityDeclared:true}};
 return {config,body};
}
test('online boundary computes normalized entry prices and stores only a receipt hash',async()=>{
 const {config,body}=await fixture(),calls=[];
 const client={rpc:async(name,args)=>{calls.push({name,args});return {data:name==='caro_public_premium'?{kind:'public_entry_edition',publicationReady:true,onlineEnabled:true,premiumId:'edition',configuration:config}:name==='caro_commit_online_entry'?{entryId:'saved',status:'submitted'}:null};}};
 const result=await receiveOnlineEntry(body,{client,now:'2026-10-20T12:00:00Z'});assert.equal(result.entryId,'saved');
 const commit=calls.find(c=>c.name==='caro_commit_online_entry').args;
 assert.equal(commit.p_details.dog.caroId,'001334');assert.equal(commit.p_details.selections[0].unitCents,config.events[0].fee.cents);assert.equal(commit.p_receipt_hash.length,64);assert.notEqual(commit.p_receipt_hash,body.receiptSecret);
 assert.equal(JSON.stringify(commit).includes(body.receiptSecret),false);assert.equal(commit.p_details.receiptToken,undefined);assert.equal(commit.p_details.agreementAcceptedAt,undefined);
});
test('online retries recover an existing receipt before checking a closed window',async()=>{
 const {body}=await fixture(),calls=[];const receipt={entryId:'saved'};
 assert.deepEqual(await receiveOnlineEntry(body,{client:{rpc:async name=>{calls.push(name);return {data:receipt};}}}),receipt);assert.deepEqual(calls,['caro_online_entry_replay']);
});
test('online validation rejects unchecked agreements, closed windows and forged publication before commit',async()=>{
 const {config,body}=await fixture();let commits=0;
 const run=async published=>receiveOnlineEntry(body,{now:'2026-10-20T12:00:00Z',client:{rpc:async name=>{if(name==='caro_commit_online_entry')commits++;return {data:name==='caro_public_premium'?published:null};}}});
 const published={kind:'public_entry_edition',publicationReady:true,onlineEnabled:true,configuration:config};
 body.input.agree=false;await assert.rejects(()=>run(published),/agreement/);body.input.agree=true;
 await assert.rejects(()=>run({...published,configuration:{...config,opens:'2027-01-01'}}),/closed/);
 await assert.rejects(()=>run({...published,kind:'manual_entry_edition'}),/not available/);assert.equal(commits,0);
 await assert.rejects(()=>onlineReceipt('short',{client:{rpc:()=>assert.fail('Invalid receipt reached RPC')}}),/incomplete/);
});
test('server handler stays disabled without a secret and never creates an anonymous privileged client',async()=>{
 let created=0;const handler=makeOnlineHandler('entry',{env:{},clientFactory:()=>{created++;}});
 const result={headers:{},setHeader(k,v){this.headers[k]=v;},end(value){this.body=JSON.parse(value);}};
 await handler({method:'POST',headers:{'content-type':'application/json'},body:{}},result);assert.equal(result.statusCode,503);assert.equal(created,0);assert.match(result.body.error,/not configured/);
});
test('server quota uses a hashed provider IP and blocks excess requests before intake',async()=>{
 const calls=[],key='sb_'+'secret_'+'x'.repeat(30),env={SUPABASE_SECRET_KEY:key,VERCEL:'1'};
 const handler=makeOnlineHandler('entry',{env,clientFactory:(url,secret,options)=>{assert.equal(secret,key);assert.equal(options.auth.persistSession,false);assert.equal(options.global,undefined);return {rpc:async(name,args)=>{calls.push({name,args});return {data:false};}};}});
 const response={headers:{},setHeader(k,v){this.headers[k]=v;},end(value){this.body=JSON.parse(value);}};
 await handler({method:'POST',headers:{host:'carosec.vercel.app',origin:'https://carosec.vercel.app','content-type':'application/json','x-vercel-forwarded-for':'192.0.2.1'},body:{}},response);
 assert.equal(response.statusCode,429);assert.equal(response.headers['Retry-After'],'60');assert.equal(calls.length,1);assert.equal(calls[0].args.p_bucket.length,64);assert.equal(JSON.stringify(calls).includes('192.0.2.1'),false);
});
