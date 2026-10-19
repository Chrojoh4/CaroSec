import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createApplication, addEvent, reorderDraftApplication, assignJudge,
  finalizeApplication, scheduleEvents,
} from '../src/domain/application.js';
import { requireVerifiedRules } from '../src/domain/rules.js';
import { MemoryApplicationRepository } from '../src/adapters/memory/application-repository.js';
import { makeFinalizeTrialApplication } from '../src/application/finalize-trial-application.js';
import { RevisionConflict } from '../src/ports/application-repository.js';

const timestamp = '2026-10-18T18:00:00.000Z';
function fixture() {
  let draft = createApplication({ trialId: 'trial', clubId: 'club' });
  draft = addEvent(draft, { id: 'rally', dayId: 'day', discipline: 'rally', level: 'novice', format: 'regular', judgeId: 'judge-a' });
  return addEvent(draft, { id: 'working', dayId: 'day', discipline: 'working', judgeId: 'judge-b' });
}
const secretary = {
  userId: 'secretary', memberships: [{ clubId: 'club', role: 'secretary', trialIds: ['trial'] }],
};

test('draft order becomes official numbering, then a different running order preserves the snapshot', () => {
  const original = fixture();
  const reordered = reorderDraftApplication(original, ['working', 'rally']);
  const final = finalizeApplication(reordered, timestamp);
  const schedule = scheduleEvents(final, ['rally', 'working']);
  assert.equal(final.events.find(row => row.id === 'working').officialRoundNumber, 1);
  assert.equal(schedule[0].eventId, 'rally');
  assert.deepEqual(final.officialSnapshot, reordered.events);
  assert.equal(original.events[0].id, 'rally');
  assert.throws(() => assignJudge(final, 'working', 'judge-c'), /locked/);
  assert.throws(() => reorderDraftApplication(final, ['rally', 'working']), /locked/);
  assert.throws(() => addEvent(final, { id: 'new' }), /locked/);
});

test('incomplete applications cannot finalize', () => {
  assert.throws(() => finalizeApplication(createApplication({ trialId: 't', clubId: 'c' }), timestamp), /At least one/);
  const draft = fixture();
  draft.events[0].judgeId = null;
  assert.throws(() => finalizeApplication(draft, timestamp), /assigned judge/);
});

test('schedule rejects missing, duplicate and foreign event references', () => {
  for (const order of [['rally'], ['rally', 'rally'], ['rally', 'other']]) {
    assert.throws(() => scheduleEvents(fixture(), order), /exactly once/);
  }
});

test('Working cannot accidentally inherit a Rally round-level classification', () => {
  assert.throws(() => addEvent(fixture(), {
    id: 'bad', dayId: 'day', discipline: 'working', level: 'rookie',
  }), /individual exercise/);
});

test('another club and an unassigned secretary cannot finalize or create audit events', async () => {
  const repository = new MemoryApplicationRepository([fixture()]);
  const execute = makeFinalizeTrialApplication({ repository, now: () => timestamp });
  const forbidden = [
    { userId: 'other', memberships: [{ clubId: 'different', role: 'club_admin' }] },
    { userId: 'unassigned', memberships: [{ clubId: 'club', role: 'secretary', trialIds: [] }] },
    { userId: 'scorer', memberships: [{ clubId: 'club', role: 'scorer', trialIds: ['trial'] }] },
  ];
  for (const actor of forbidden) {
    await assert.rejects(execute({ actor, trialId: 'trial', expectedRevision: 0 }), /Access denied/);
  }
  assert.equal((await repository.get('trial')).state, 'draft');
  assert.deepEqual(repository.auditEvents(), []);
});

test('simultaneous finalizations commit exactly one revision and one audit event', async () => {
  const repository = new MemoryApplicationRepository([fixture()]);
  const execute = makeFinalizeTrialApplication({ repository, now: () => timestamp });
  const command = { actor: secretary, trialId: 'trial', expectedRevision: 0 };
  const results = await Promise.allSettled([execute(command), execute(command)]);
  assert.equal(results.filter(row => row.status === 'fulfilled').length, 1);
  assert.ok(results.find(row => row.status === 'rejected').reason instanceof RevisionConflict);
  assert.equal((await repository.get('trial')).revision, 1);
  assert.equal(repository.auditEvents().length, 1);
  const fetched = await repository.get('trial');
  fetched.events[0].judgeId = 'tampered';
  assert.equal((await repository.get('trial')).events[0].judgeId, 'judge-a');
});

test('stale requests and failed audit serialization leave both state and audit unchanged', async () => {
  const repository = new MemoryApplicationRepository([fixture()]);
  const execute = makeFinalizeTrialApplication({ repository, now: () => timestamp });
  await assert.rejects(execute({ actor: secretary, trialId: 'trial', expectedRevision: 9 }), RevisionConflict);
  await assert.rejects(repository.commit({
    application: finalizeApplication(fixture(), timestamp), expectedRevision: 0,
    audit: { invalid: () => {} },
  }));
  assert.equal((await repository.get('trial')).state, 'draft');
  assert.deepEqual(repository.auditEvents(), []);
});

test('repository rejects direct overwrites of finalized official assignments', async () => {
  const final = finalizeApplication(fixture(), timestamp);
  const repository = new MemoryApplicationRepository([final]);
  final.events[0].judgeId = 'tampered';
  await assert.rejects(repository.commit({ application: final, expectedRevision: 0, audit: {} }), /locked/);
  assert.equal((await repository.get('trial')).events[0].judgeId, 'judge-a');
});

test('unverified, out-of-date and mode-incompatible rules never authorize calculations', () => {
  const context = { localDate: '2026-10-18', mode: 'in_person' };
  assert.throws(() => requireVerifiedRules(null, context), /Verified rules/);
  const bundle = {
    reviewStatus: 'draft', contentHash: 'test-only', sources: ['fictional test source'],
    effectiveFrom: '2025-04-01', effectiveTo: '2026-12-31', modes: ['in_person'],
  };
  assert.throws(() => requireVerifiedRules(bundle, context), /Verified rules/);
  bundle.reviewStatus = 'verified';
  assert.throws(() => requireVerifiedRules(bundle, { ...context, mode: 'virtual' }), /do not apply/);
  assert.throws(() => requireVerifiedRules(bundle, { ...context, localDate: '2027-01-01' }), /do not apply/);
  assert.equal(requireVerifiedRules(bundle, context).contentHash, 'test-only');
});
