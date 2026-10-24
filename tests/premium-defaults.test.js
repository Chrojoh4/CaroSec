import test from 'node:test';import assert from 'node:assert/strict';import {applyPremiumDefaults} from '../src/domain/premium-defaults.js';
test('previous personal premium fills reusable answers and fees without trial source or date carryover',()=>{
 const previous={intro:'Welcome',payment:'Pay host',fees:[{label:'Regular',cents:2400,unit:'per dog'}],opens:'2026-01-01',closes:'2026-02-01',timing:'Old schedule',capacity:'Old limit',judge:'Old judge',approved:true,entryUrl:'old',theme:'ocean'};
 const result=applyPremiumDefaults({},previous);assert.deepEqual(result.content,{intro:'Welcome',payment:'Pay host',theme:'ocean',fees:previous.fees});result.content.fees[0].cents=2500;assert.equal(previous.fees[0].cents,2400);
});
test('existing answers, intentional blanks and removed fee rows remain unchanged',()=>{
 const existing={intro:'Current',payment:'',fees:[],opens:'2027-01-01'};const result=applyPremiumDefaults(existing,{intro:'Old',payment:'Old',fees:[{label:'Old'}],refunds:'Old policy'});
 assert.equal(result.content.intro,'Current');assert.equal(result.content.payment,'');assert.deepEqual(result.content.fees,[]);assert.equal(result.content.opens,'2027-01-01');assert.deepEqual(result.filled,['refunds']);assert.equal(Object.hasOwn(existing,'refunds'),false);
});
test('empty or malformed remembered answers do not dirty a draft',()=>{
 assert.deepEqual(applyPremiumDefaults({}, {intro:'',payment:null,fees:{}}),{content:{},filled:[]});
});
