import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleDraft } from '../web/sample.js';
import { applicationDeadline, createTrialWorkspace, updateTrialField, replaceTrialEvents, finalizeTrial, recordExternalStatus, premiumFromTrial, syncTrialFromPremium, hydrateTrial, trialDays, validateTrial } from '../src/domain/trial-workspace.js';

function ready() {
  return { ...createTrialWorkspace(sampleDraft()), organizer:'Sample Organizer', organizerEmail:'organizer@example.com', memberReference:'sample-reference', chairEmail:'chair@example.com', surface:'Nonslip rubber', ringWidth:'50', ringLength:'40', professionalConfirmed:true, judgesConfirmed:true, classesConfirmed:true, nearbyConfirmed:true };
}
test('a legacy premium becomes a draft application without claiming CARO approval', () => {
  const premium = { ...sampleDraft(), approved:true, trialNumber:'LEGACY-TEST' };
  const trial = createTrialWorkspace(premium);
  assert.equal(trial.externalStatus,'not_submitted');
  assert.equal(premiumFromTrial(trial,premium).approved,false);
  assert.equal(trial.events[0].id,premium.events[0].id);
});
test('consecutive trial days and Working-only application deadline use date arithmetic', () => {
  let trial = updateTrialField(ready(),'date','2027-03-14');
  trial = updateTrialField(trial,'endDate','2027-03-15');
  assert.deepEqual(trialDays(trial),['2027-03-14','2027-03-15']);
  assert.deepEqual(applicationDeadline(trial),{leadDays:42,date:'2027-01-31'});
  trial = replaceTrialEvents(trial,[trial.events.at(-1)]);
  assert.deepEqual(applicationDeadline(trial),{leadDays:21,date:'2027-02-21'});
});
test('shared source updates the premium while edition snapshots remain unchanged', () => {
  const premium = sampleDraft(), edition = structuredClone(premium);
  const trial = updateTrialField(ready(),'venue','A different venue');
  const projected = premiumFromTrial(trial,premium);
  assert.equal(projected.venue,'A different venue');
  assert.equal(projected.events[0].id,trial.events[0].id);
  assert.equal(edition.venue,'The Meadow Training Hall');
});
test('draft reordering renumbers official events; finalization uses the domain snapshot and locks both editors', () => {
  let trial = ready();
  trial = replaceTrialEvents(trial,[...trial.events].reverse());
  const firstId = trial.events[0].id;
  const frozen = finalizeTrial(trial,'2026-10-19T01:00:00Z');
  assert.equal(frozen.application.officialSnapshot[0].id,firstId);
  assert.equal(frozen.application.officialSnapshot[0].officialRoundNumber,1);
  assert.throws(()=>updateTrialField(frozen,'date','2027-01-01'),/locked/);
  assert.throws(()=>replaceTrialEvents(frozen,[]),/locked/);
  const premium = premiumFromTrial(frozen,sampleDraft()); premium.events[0].judge = 'Different judge';
  assert.throws(()=>syncTrialFromPremium(frozen,premium),/locked/);
  assert.equal(frozen.externalStatus,'not_submitted');
});
test('approval is separate from local finalization and requires a recorded submission and evidence', () => {
  assert.throws(()=>recordExternalStatus(ready(),'submitted'),/Finalize/);
  let trial = finalizeTrial(ready());
  assert.equal(premiumFromTrial(trial,sampleDraft()).approved,false);
  assert.throws(()=>recordExternalStatus(trial,'approved'),/transition/);
  assert.throws(()=>recordExternalStatus(trial,'submitted'),/date/);
  trial = updateTrialField(trial,'submissionDate','2026-10-18');
  trial = recordExternalStatus(trial,'submitted');
  assert.throws(()=>recordExternalStatus(trial,'approved'),/evidence/);
  trial = updateTrialField(trial,'trialNumber','TEST-ONLY');
  trial = updateTrialField(trial,'approvalEvidence','Fictional test evidence');
  trial = recordExternalStatus(trial,'approved');
  assert.equal(premiumFromTrial(trial,sampleDraft()).approved,true);
  assert.equal(trial.audit.length,3);
  assert.throws(()=>updateTrialField(trial,'trialNumber','REPLACE'),/locked/);
});
test('out-of-range event dates and missing Working offerings block finalization', () => {
  const trial = ready(); trial.events[0].dayId='2027-01-01'; trial.events.at(-1).exercises='';
  assert.ok(validateTrial(trial).some(error=>error.includes('date within')));
  assert.ok(validateTrial(trial).some(error=>error.includes('Working exercises')));
  assert.throws(()=>finalizeTrial(trial),/Round/);
});
test('backup hydration preserves valid locks and rejects altered frozen trial or official snapshots', () => {
  const frozen=finalizeTrial(ready());
  assert.deepEqual(hydrateTrial(frozen,sampleDraft()),frozen);
  const changed=structuredClone(frozen); changed.events[0].stream='changed';
  assert.throws(()=>hydrateTrial(changed,sampleDraft()),/snapshot/);
  const tampered=structuredClone(frozen); tampered.application.officialSnapshot[0].judgeId='changed';
  assert.throws(()=>hydrateTrial(tampered,sampleDraft()),/match/);
});
test('private organizer details do not enter the public premium projection', () => {
  const trial = ready();
  const premium = premiumFromTrial(trial,sampleDraft());
  assert.equal(premium.organizerEmail,undefined);
  assert.equal(premium.memberReference,undefined);
  assert.equal(premium.nearbyNotes,undefined);
});
