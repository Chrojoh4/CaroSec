import test from 'node:test';
import assert from 'node:assert/strict';
import {trialRehearsal} from '../src/trial-rehearsal.js';
import {recordScore,withdrawRun,entryBalance} from '../src/domain/secretary.js';
import {activityJournal} from '../web/activity-journal.js';

test('fictional weekend reconciles all runs, separate refunds, score corrections, sign-offs and recovery',async()=>{
 const {state,trialId,summary,recovered}=await trialRehearsal();
 assert.deepEqual(recovered,state);assert.equal(summary.entries,4);assert.equal(summary.events.length,6);
 assert.equal(summary.events.reduce((n,event)=>n+event.recorded,0),7);
 assert.equal(summary.events.reduce((n,event)=>n+event.withdrawn,0),2);
 assert.equal(summary.events.reduce((n,event)=>n+event.waitlisted+event.unrecorded,0),0);
 assert.ok(summary.events.every(event=>event.complete));assert.equal(summary.finance.balance,0);assert.equal(summary.finance.owing,0);assert.equal(summary.finance.credit,0);assert.equal(summary.finance.expenses,3500);
 assert.ok(state.entries.every(entry=>entryBalance(state,entry.id)===0));
 assert.equal(state.scores.length,8);const cedar=state.entries.find(entry=>entry.dog.caroId==='TEST-DOG-2');
 const versions=state.scores.filter(score=>score.entryId===cedar.id&&score.eventId==='rp-test-01');assert.deepEqual(versions.map(score=>score.results.score),[190,191]);
 assert.throws(()=>recordScore(state,{entryId:cedar.id,eventId:'rp-test-01',judgeConfirmed:true,score:192,outcome:'Q',elapsedSeconds:65,reason:'Attempt after sign-off'},'2027-04-23T00:00:00Z'),/complete/);
 assert.throws(()=>withdrawRun(state,{entryId:cedar.id,eventId:'rp-test-01',reason:'Attempt after sign-off'},'2027-04-23T00:00:00Z'),/completed/);
 const journal=activityJournal(state,trialId);assert.equal(journal.filter(row=>row.action==='run.withdrawn').length,2);assert.equal(journal.filter(row=>row.action==='event.completed').length,6);
 assert.equal(state.ribbonClaims.length,0);
});
