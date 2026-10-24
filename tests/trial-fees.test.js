import test from 'node:test';import assert from 'node:assert/strict';import {saveTrialFees} from '../hosted/trial-fees.js';import {hostedPremium} from '../src/domain/hosted-premium.js';
test('Trial details fee saves update the same premium content and preserve wording with revision protection',async()=>{
 const trial={id:'trial',title:'Example trial',planning:{}},premium={revision:4,content:{intro:'Current welcome',payment:'Pay host',fees:[{label:'Regular',cents:2400,unit:'per dog'}]}};let saved;
 const client={rpc:async(name,args)=>{assert.equal(name,'caro_save_premium_draft');assert.equal(args.p_revision,4);saved=args.p_content;return {data:{revision:5}};}};
 await saveTrialFees(client,trial,premium,[{label:'Regular',cents:2600,unit:'per dog'}]);assert.equal(saved.intro,'Current welcome');assert.equal(saved.payment,'Pay host');assert.equal(hostedPremium(trial,saved).fees[0].cents,2600);assert.equal(premium.content.fees[0].cents,2400);
});
test('invalid and stale fee saves are rejected instead of overwriting newer premium edits',async()=>{
 let called=false;await assert.rejects(()=>saveTrialFees({rpc:()=>called=true},{id:'trial'},{},[{label:'',cents:1,unit:'dog'}]),/Check each fee/);assert.equal(called,false);
 await assert.rejects(()=>saveTrialFees({rpc:async()=>({error:{code:'40001'}})},{id:'trial'},{revision:2},[]),/changed elsewhere/);
});
