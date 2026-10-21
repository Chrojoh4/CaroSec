import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleScenario} from '../src/sample-scenario.js';
import {runRegister,runRegisterCsvRows} from '../web/run-register.js';
import {workingReport,csv} from '../web/reports.js';

test('per-run register preserves mixed waitlists and withdrawn selections without inventing refunds',async()=>{
 const {state,trialId}=await sampleScenario(),rows=runRegister(state,trialId);
 assert.equal(rows.length,9);assert.equal(rows.filter(row=>row.status==='waitlisted').length,1);assert.equal(rows.filter(row=>row.status==='withdrawn').length,1);
 const willow=rows.filter(row=>row.dogs.includes('Willow'));assert.deepEqual(willow.map(row=>row.status),['accepted','waitlisted']);
 const withdrawn=rows.find(row=>row.status==='withdrawn');assert.ok(withdrawn.reason);assert.ok(withdrawn.quoteCents>0);assert.ok(withdrawn.withdrawalId);
 assert.match(workingReport(state,trialId,'waitlist'),/Willow/);assert.doesNotMatch(workingReport(state,trialId,'waitlist'),/Maple \(test\)/);
 assert.match(workingReport(state,trialId,'withdrawals'),/other runs retained/);
 const output=csv(runRegisterCsvRows(rows));assert.match(output,/Original run quote CAD/);assert.match(output,/TEST-PARTNER-1/);
});
