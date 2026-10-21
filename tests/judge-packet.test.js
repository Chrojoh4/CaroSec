import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleScenario} from '../src/sample-scenario.js';
import {judgePacket} from '../src/domain/judge-packet.js';
import {activityJournal} from '../web/activity-journal.js';
import {trialSummary} from '../web/trial-summary.js';
test('practice scenario and judge packet preserve withdrawal, group and exercise identity without private contacts',async()=>{
 const {state,trialId}=await sampleScenario(),packet=judgePacket(state,trialId);
 assert.equal(packet.events.length,6);assert.equal(packet.events[0].runs.length,2);
 assert.ok(packet.events[0].runs.every(run=>run.dogs[0].caroId!=='TEST-DOG-1'));
 assert.equal(packet.events.find(event=>event.format==='Team').runs[0].dogs.length,2);
 assert.equal(packet.events.find(event=>event.format==='Brace').runs[0].dogs[0].handler,packet.events.find(event=>event.format==='Brace').runs[0].dogs[1].handler);
 assert.equal(packet.events.find(event=>event.format==='Working').runs[0].exercises[0].level,'Rookie');
 const json=JSON.stringify(packet);assert.ok(!json.includes('@example.com'));assert.ok(!json.includes('receiptToken'));assert.ok(!json.includes('Fictional practice address'));assert.ok(!json.includes('Fictional payment'));
 const journal=activityJournal(state,trialId);assert.equal(journal.filter(item=>item.action==='run.withdrawn').length,1);assert.equal(journal.filter(item=>item.action==='finance.payment').length,1);assert.equal(state.entries.length,4);
 assert.throws(()=>judgePacket(state,'missing'),/Trial not found/);assert.throws(()=>judgePacket(state,trialId,'missing'),/Event not found/);
});
test('summary separates run counts, Working outcomes, withdrawals and ledger balances',async()=>{
 const {state,trialId}=await sampleScenario(),summary=trialSummary(state,trialId);
 assert.equal(summary.entries,4);assert.equal(summary.events[0].accepted,2);assert.equal(summary.events[0].withdrawn,1);assert.equal(summary.events[0].recorded,1);assert.equal(summary.events[0].outcomes.Q,1);assert.equal(summary.events[0].unrecorded,1);assert.equal(summary.events[1].waitlisted,1);assert.equal(summary.events[1].accepted,1);
 const f=summary.finance;assert.equal(f.balance,f.owing-f.credit);assert.equal(f.balance,f.charges+f.refunds-f.payments-f.waivers);
 const before=structuredClone(state);state.scores.push({...state.scores[0],version:2,results:{outcome:'NQ',score:150}});const revised=trialSummary(state,trialId);assert.equal(revised.events[0].recorded,1);assert.equal(revised.events[0].outcomes.Q,undefined);assert.equal(revised.events[0].outcomes.NQ,1);
 state.entries.push({...structuredClone(state.entries[0]),id:'other-entry',trialId:'another-trial'});state.ledger.push({trialId:'another-trial',kind:'payment',cents:999999});assert.deepEqual(trialSummary(state,trialId),revised);
 assert.equal(before.entries.length,4);
});
