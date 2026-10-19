import { createApplication, addEvent, assignJudge, scheduleEvents } from './domain/application.js';
import { MemoryApplicationRepository } from './adapters/memory/application-repository.js';
import { makeFinalizeTrialApplication } from './application/finalize-trial-application.js';

let application = createApplication({ trialId: 'demo-trial', clubId: 'demo-club' });
application = addEvent(application, {
  id: 'rally-novice', dayId: 'demo-day', discipline: 'rally', level: 'novice', format: 'regular', judgeId: 'demo-judge',
});
application = addEvent(application, {
  id: 'working', dayId: 'demo-day', discipline: 'working', judgeId: 'demo-judge',
});
const repository = new MemoryApplicationRepository([application]);
const finalize = makeFinalizeTrialApplication({ repository });
const saved = await finalize({
  actor: { userId: 'demo-secretary', memberships: [{ clubId: 'demo-club', role: 'secretary', trialIds: ['demo-trial'] }] },
  trialId: 'demo-trial', expectedRevision: 0,
});
console.log('Fictional local demonstration; no official submission or persistent storage.');
console.table(saved.events.map(({ id, officialRoundNumber, judgeId }) => ({ id, officialRoundNumber, judgeId })));
console.log('Independent running order:');
console.table(scheduleEvents(saved, ['working', 'rally-novice']));
try { assignJudge(saved, 'working', 'different-judge'); }
catch (error) { console.log(`Judge change rejected: ${error.message}`); }
console.log(`Atomic audit events: ${repository.auditEvents().length}`);
