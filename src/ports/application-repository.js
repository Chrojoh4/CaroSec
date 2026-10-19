/**
 * ApplicationRepository contract (trusted server-side adapter only).
 *
 * get(trialId): Promise<Application|null>
 * commit({ application, expectedRevision, audit }): Promise<Application>
 *
 * commit must compare the current revision, persist revision + 1 and append
 * audit in one atomic transaction. Throw on a stale revision or missing row.
 * Return detached values; callers cannot mutate stored state by reference.
 * A persistent adapter additionally enforces club ownership, RLS, immutable
 * finalized snapshots and command idempotency inside the database boundary.
 */
export class RevisionConflict extends Error {
  constructor() { super('Application changed; reload before saving'); this.name = 'RevisionConflict'; }
}
