import { finalizeApplication } from '../domain/application.js';
import { RevisionConflict } from '../ports/application-repository.js';

// Actor context must come from a trusted session adapter, never a request body.
export function makeFinalizeTrialApplication({ repository, now = () => new Date().toISOString() }) {
  return async function execute({ actor, trialId, expectedRevision }) {
    if (!actor?.userId || !Array.isArray(actor.memberships)) throw new Error('Access denied');
    const application = await repository.get(trialId);
    if (!application) throw new Error('Application not found');
    const allowed = actor.memberships.some(membership =>
      membership.clubId === application.clubId && (
        membership.role === 'club_admin' ||
        (membership.role === 'secretary' && membership.trialIds?.includes(trialId))
      ));
    if (!allowed) throw new Error('Access denied');
    if (application.revision !== expectedRevision) throw new RevisionConflict();
    const occurredAt = now();
    const finalized = finalizeApplication(application, occurredAt);
    return repository.commit({
      application: finalized, expectedRevision,
      audit: { actorId: actor.userId, clubId: application.clubId, action: 'application.finalized', occurredAt },
    });
  };
}
