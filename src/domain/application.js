import { validateEventVocabulary } from './catalog.js';

function requireDraft(application) {
  if (application.state !== 'draft') throw new Error('Official application is locked');
}

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`);
}

function requirePermutation(ids, expected) {
  if (!Array.isArray(ids) || ids.length !== expected.length ||
      new Set(ids).size !== ids.length || ids.some(id => !expected.includes(id))) {
    throw new Error('Order must contain every event ID exactly once');
  }
}

export function createApplication({ trialId, clubId }) {
  requireText(trialId, 'Trial ID');
  requireText(clubId, 'Club ID');
  return { trialId, clubId, revision: 0, state: 'draft', events: [] };
}

export function addEvent(application, event) {
  requireDraft(application);
  requireText(event.id, 'Event ID');
  requireText(event.dayId, 'Day ID');
  validateEventVocabulary(event);
  if (application.events.some(row => row.id === event.id)) throw new Error('Duplicate event ID');
  // Copy explicit fields so callers cannot inject official round numbers or state.
  const row = {
    id: event.id, dayId: event.dayId, discipline: event.discipline,
    ...(event.discipline === 'rally' ? { level: event.level, format: event.format } : {}),
    judgeId: event.judgeId ?? null, officialRoundNumber: application.events.length + 1,
  };
  return { ...structuredClone(application), events: [...structuredClone(application.events), row] };
}

export function reorderDraftApplication(application, eventIds) {
  requireDraft(application);
  requirePermutation(eventIds, application.events.map(row => row.id));
  const rows = new Map(application.events.map(row => [row.id, row]));
  return {
    ...structuredClone(application),
    events: eventIds.map((id, index) => ({ ...structuredClone(rows.get(id)), officialRoundNumber: index + 1 })),
  };
}

export function assignJudge(application, eventId, judgeId) {
  requireDraft(application);
  requireText(judgeId, 'Judge ID');
  if (!application.events.some(row => row.id === eventId)) throw new Error('Unknown event');
  return {
    ...structuredClone(application),
    events: application.events.map(row => ({ ...structuredClone(row), ...(row.id === eventId ? { judgeId } : {}) })),
  };
}

export function finalizeApplication(application, finalizedAt) {
  requireDraft(application);
  if (!application.events.length) throw new Error('At least one event is required');
  if (!application.events.every(row => typeof row.judgeId === 'string' && row.judgeId.trim())) {
    throw new Error('Every event requires an assigned judge');
  }
  if (typeof finalizedAt !== 'string' || !Number.isFinite(Date.parse(finalizedAt))) {
    throw new Error('A valid finalization timestamp is required');
  }
  const snapshot = structuredClone(application.events);
  return { ...structuredClone(application), state: 'finalized', finalizedAt, officialSnapshot: snapshot };
}

// Schedule is a separate projection; it cannot mutate the official application.
export function scheduleEvents(application, eventIds) {
  requirePermutation(eventIds, application.events.map(row => row.id));
  return eventIds.map((eventId, index) => ({ eventId, executionPosition: index + 1 }));
}
