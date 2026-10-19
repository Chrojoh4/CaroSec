import { RevisionConflict } from '../../ports/application-repository.js';

// Local test/demo adapter only. No disk writes and no production durability.
export class MemoryApplicationRepository {
  #applications = new Map();
  #audit = [];

  constructor(applications = []) {
    for (const application of applications) {
      if (this.#applications.has(application.trialId)) throw new Error('Duplicate trial ID');
      this.#applications.set(application.trialId, structuredClone(application));
    }
  }

  async get(trialId) {
    return structuredClone(this.#applications.get(trialId) ?? null);
  }

  async commit({ application, expectedRevision, audit }) {
    const current = this.#applications.get(application.trialId);
    if (!current) throw new Error('Application not found');
    if (current.revision !== expectedRevision) throw new RevisionConflict();
    if (application.clubId !== current.clubId) throw new Error('Club ownership cannot change');
    if (current.state === 'finalized') throw new Error('Official application is locked');
    // Clone all input before mutation; failed serialization cannot partially commit.
    const saved = structuredClone({ ...application, revision: expectedRevision + 1 });
    const event = structuredClone({ ...audit, aggregateId: saved.trialId, revision: saved.revision });
    this.#applications.set(saved.trialId, saved);
    this.#audit.push(event);
    return structuredClone(saved);
  }

  auditEvents() { return structuredClone(this.#audit); }
}
