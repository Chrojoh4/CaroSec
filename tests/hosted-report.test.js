import test from 'node:test';
import assert from 'node:assert/strict';
import {hostedReportState} from '../src/domain/hosted-report.js';
import {trialRehearsal} from '../src/trial-rehearsal.js';
import {trialSummary} from '../web/trial-summary.js';
import {workingReport} from '../web/reports.js';
async function fixture(){
 const {state,trialId}=await trialRehearsal();
 return {generatedAt:'2027-04-22T18:00:00Z',trial:state.trials[trialId],entries:state.entries.map(row=>({...row,receiptToken:'PRIVATE-RECEIPT',requestHash:'PRIVATE-HASH'})),ledger:state.ledger,scores:[...state.scores].reverse(),expenses:state.expenses.map(row=>({...row,kind:'expense'})),audit:state.audit.map(row=>({...row,actorId:'test-staff',details:{entryId:row.entryId,eventId:row.eventId,receivedAt:row.receivedAt,reason:row.reason}})),orders:state.orders,finalizedEvents:state.finalizedEvents,paperwork:state.trialAdmin[trialId]};
}
test('hosted report projection preserves totals and highest result versions while omitting receipt/private transport fields',async()=>{
 const snapshot=await fixture(),state=hostedReportState(snapshot),summary=trialSummary(state,snapshot.trial.id),serialized=JSON.stringify(state);
 assert.equal(summary.finance.balance,0);assert.equal(summary.finance.expenses,3500);assert.equal(summary.events.reduce((n,event)=>n+event.recorded,0),7);
 assert.ok(!serialized.includes('PRIVATE-RECEIPT'));assert.ok(!serialized.includes('PRIVATE-HASH'));assert.equal(state.entries[0].contact.address,undefined);assert.equal(state.entries[0].dog.birthDate,undefined);
 const cedar=state.entries.find(entry=>entry.dog.caroId==='TEST-DOG-2');assert.equal(state.scores.filter(score=>score.entryId===cedar.id&&score.eventId==='rp-test-01').at(-1).results.score,191);
 assert.match(workingReport(state,snapshot.trial.id,'journal'),/Staff references come from saved audit records/);
});
test('report projection rejects foreign scope and flags unknown legacy identities/results instead of inventing outcomes',async()=>{
 const snapshot=await fixture();snapshot.ledger.push({...snapshot.ledger[0],trialId:'foreign'});assert.throws(()=>hostedReportState(snapshot),/foreign trial/);snapshot.ledger.pop();
 snapshot.incidents=[{trialId:'foreign'}];assert.throws(()=>hostedReportState(snapshot),/foreign incident/);delete snapshot.incidents;
 snapshot.entries.push({id:'legacy',trialId:snapshot.trial.id,status:'submitted',selections:[],amountCents:0,createdAt:'2027-03-01T18:00:00Z'});
 snapshot.scores.find(score=>Array.isArray(score.results)).results={unrecognized:true};const state=hostedReportState(snapshot),summary=trialSummary(state,snapshot.trial.id);
 assert.equal(state.diagnostics.legacyEntryCount,1);assert.ok(summary.warnings.some(value=>value.includes('result shapes')));assert.ok(summary.events.some(event=>event.outcomeReview>0));assert.ok(summary.events.every(event=>!Object.hasOwn(event.outcomes,'undefined')));
 assert.match(workingReport(state,snapshot.trial.id,'catalogue'),/incomplete legacy identities/);
});
