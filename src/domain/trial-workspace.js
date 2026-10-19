import { validCalendarDate } from './date-time.js';
import { createApplication, addEvent, finalizeApplication } from './application.js';

export const SHARED_KEYS = Object.freeze(['title', 'host', 'date', 'timezone', 'venue', 'address', 'secretary', 'email', 'chair', 'fictional']);
const EXTRA_TEXT_KEYS = ['endDate', 'organizer', 'organizerEmail', 'memberReference', 'chairEmail', 'surface', 'ringWidth', 'ringLength', 'nearbyNotes', 'submissionDate', 'trialNumber', 'approvalEvidence'];
const CHECK_KEYS = ['professionalConfirmed', 'judgesConfirmed', 'classesConfirmed', 'nearbyConfirmed'];
export const LEVELS = ['Novice', 'Intermediate', 'Advanced', 'Excellent', 'Versatility', 'Versatility Excellent', 'Working'];
export const FORMATS = ['Regular', 'Team', 'Brace', 'Working'];
export function validDate(value) {
  return validCalendarDate(value);
}
export function trialDays(trial) {
  if (!validDate(trial.date) || !validDate(trial.endDate) || trial.endDate < trial.date) return [];
  const length = Math.round((Date.parse(trial.endDate) - Date.parse(trial.date)) / 86400000) + 1;
  if (length > 31) return []; // Prototype limit, not a CARO rule.
  return Array.from({ length }, (_, i) => new Date(Date.parse(trial.date) + i * 86400000).toISOString().slice(0, 10));
}
export function applicationDeadline(trial) {
  if (!validDate(trial.date) || !trial.events.length) return null;
  const leadDays = trial.events.every(event => event.format === 'Working') ? 21 : 42;
  return { leadDays, date: new Date(Date.parse(trial.date) - leadDays * 86400000).toISOString().slice(0, 10) };
}
export function createTrialWorkspace(premium) {
  return {
    schemaVersion: 1, revision: 0, application: null, audit: [],
    ...Object.fromEntries(SHARED_KEYS.map(key => [key, premium[key]])),
    endDate: premium.endDate || premium.date, mode: 'in_person', organizer: '', organizerEmail: '', memberReference: '', chairEmail: '', surface: '', ringWidth: '', ringLength: '', nearbyNotes: '',
    professionalConfirmed: false, judgesConfirmed: false, classesConfirmed: false, nearbyConfirmed: false,
    externalStatus: 'not_submitted', submissionDate: '', trialNumber: premium.trialNumber || '', approvalEvidence: '',
    events: premium.events.map(event => ({ ...structuredClone(event), dayId: event.dayId || premium.date })),
  };
}
function officialContent(trial) {
  return {
    ...Object.fromEntries([...SHARED_KEYS, 'endDate', 'mode', 'organizer', 'organizerEmail', 'memberReference', 'chairEmail', 'surface', 'ringWidth', 'ringLength', 'nearbyNotes', ...CHECK_KEYS].map(key => [key, trial[key]])),
    events: trial.events,
  };
}
function locked(trial) { return trial.application?.state === 'finalized'; }
export function updateTrialField(trial, key, value) {
  if (![...SHARED_KEYS, ...EXTRA_TEXT_KEYS, ...CHECK_KEYS, 'mode'].includes(key)) throw new Error('Unknown trial field');
  const external = ['submissionDate', 'trialNumber', 'approvalEvidence'].includes(key);
  if (locked(trial) && !external) throw new Error('Application is finalized. Its trial details and events are locked.');
  if (key === 'fictional' || CHECK_KEYS.includes(key)) { if (typeof value !== 'boolean') throw new Error('Expected a checkbox value'); }
  else if (typeof value !== 'string') throw new Error('Expected text');
  const next = { ...structuredClone(trial), [key]: value, revision: trial.revision + 1 };
  if (key === 'date' && trial.date === trial.endDate) {
    next.endDate = value;
    next.events = next.events.map(event => ({ ...event, dayId: event.dayId === trial.date ? value : event.dayId }));
  }
  if (trial.externalStatus === 'approved' && external && value !== trial[key]) throw new Error('Approved sanction details are locked; an amendment workflow is required.');
  return next;
}
export function replaceTrialEvents(trial, events) {
  if (locked(trial)) throw new Error('Application is finalized. Official rounds and judges are locked.');
  if (!Array.isArray(events) || events.length > 150) throw new Error('At most 150 events are supported in this local prototype.');
  const ids = events.map(event => event.id);
  if (new Set(ids).size !== ids.length) throw new Error('Event IDs must be unique');
  return { ...structuredClone(trial), revision: trial.revision + 1, events: events.map((event, i) => ({ ...structuredClone(event), round: i + 1 })) };
}
export function validateTrial(trial) {
  const errors = [];
  const labels = { title: 'Trial name', host: 'Host', organizer: 'Organizer', organizerEmail: 'Organizer email', memberReference: 'Professional membership reference', secretary: 'Secretary', email: 'Secretary email', chair: 'Chairperson', chairEmail: 'Chairperson email', venue: 'Venue', address: 'Venue address', surface: 'Ring surface' };
  for (const [key, label] of Object.entries(labels)) if (!trial[key]?.trim()) errors.push(`${label} is required.`);
  for (const key of ['organizerEmail', 'email', 'chairEmail']) if (!/^\S+@\S+\.\S+$/.test(trial[key] || '')) errors.push(`Check ${labels[key].toLowerCase()}.`);
  if (!trialDays(trial).length) errors.push('Choose valid consecutive dates (up to 31 days in this prototype).');
  if (!['in_person', 'virtual'].includes(trial.mode)) errors.push('Choose a supported trial mode.');
  if (trial.mode === 'virtual') errors.push('Virtual application preparation is not enabled in this release.');
  try { new Intl.DateTimeFormat('en-CA', { timeZone: trial.timezone }).format(); } catch { errors.push('Choose a valid IANA timezone.'); }
  if (![trial.ringWidth, trial.ringLength].every(value => Number.isFinite(Number(value)) && Number(value) > 0)) errors.push('Enter positive ring dimensions in feet.');
  if (!trial.professionalConfirmed) errors.push('Confirm the host professional membership review.');
  if (!trial.judgesConfirmed) errors.push('Confirm judge authorizations and good standing were reviewed.');
  if (!trial.classesConfirmed) errors.push('Confirm offered class, format and stream combinations were reviewed.');
  if (!trial.nearbyConfirmed) errors.push('Review nearby-trial conflicts and any required permission.');
  if (!trial.events.length) errors.push('Add at least one event.');
  const days = trialDays(trial);
  for (const row of trial.events) {
    if (!days.includes(row.dayId)) errors.push(`Round ${row.round}: choose a date within the trial.`);
    if (!LEVELS.includes(row.level) || !FORMATS.includes(row.format) || (row.level === 'Working') !== (row.format === 'Working')) errors.push(`Round ${row.round}: check class and format.`);
    if (!row.judge?.trim() || !row.stream?.trim()) errors.push(`Round ${row.round}: a judge and stream/levels are required.`);
    if (row.format === 'Working' && !row.exercises?.trim()) errors.push(`Round ${row.round}: list offered Working exercises and levels.`);
    if (!row.id || row.round !== trial.events.indexOf(row) + 1) errors.push('Official round numbering is invalid.');
  }
  if (new Set(trial.events.map(row => row.id)).size !== trial.events.length) errors.push('Duplicate event IDs.');
  return [...new Set(errors)];
}
export function finalizeTrial(trial, now = new Date().toISOString()) {
  if (locked(trial)) throw new Error('Application already finalized');
  const errors = validateTrial(trial);
  if (errors.length) throw new Error(errors.join('\n'));
  let application = createApplication({ trialId: 'local-trial', clubId: 'local-club' });
  for (const row of trial.events) application = addEvent(application, {
    id: row.id, dayId: row.dayId, discipline: row.format === 'Working' ? 'working' : 'rally',
    ...(row.format === 'Working' ? {} : { level: row.level.toLowerCase().replaceAll(' ', '_'), format: row.format.toLowerCase() }), judgeId: row.judge,
  });
  application = finalizeApplication(application, now);
  return { ...structuredClone(trial), revision: trial.revision + 1, application: { ...application, trialSnapshot: structuredClone(officialContent(trial)) }, audit: [...trial.audit, { action: 'application.finalized', occurredAt: now }] };
}
export function recordExternalStatus(trial, status, now = new Date().toISOString()) {
  if (!locked(trial)) throw new Error('Finalize the local application before recording its submission or approval.');
  const transitions = { not_submitted: ['submitted'], submitted: ['approved', 'rejected'], rejected: ['submitted'], approved: [] };
  if (!transitions[trial.externalStatus]?.includes(status)) throw new Error('Invalid sanction status transition');
  if (!validDate(trial.submissionDate)) throw new Error('Record the date the application was submitted.');
  if (status === 'approved' && (!trial.trialNumber.trim() || !trial.approvalEvidence.trim())) throw new Error('Approval requires an assigned trial number and evidence.');
  return { ...structuredClone(trial), revision: trial.revision + 1, externalStatus: status, audit: [...trial.audit, { action: `sanction.${status}`, occurredAt: now, submissionDate: trial.submissionDate, trialNumber: trial.trialNumber, evidence: trial.approvalEvidence }] };
}
export function premiumFromTrial(trial, premium) {
  return {
    ...structuredClone(premium), ...Object.fromEntries(SHARED_KEYS.map(key => [key, trial[key]])), endDate: trial.endDate,
    events: structuredClone(trial.events), approved: trial.externalStatus === 'approved', trialNumber: trial.trialNumber, approvalEvidence: trial.approvalEvidence,
  };
}
export function syncTrialFromPremium(trial, premium) {
  let next = structuredClone(trial);
  for (const key of SHARED_KEYS) if (premium[key] !== next[key]) next = updateTrialField(next, key, premium[key]);
  // Premium editor has no date selector; preserve the original date for existing rows.
  const events = premium.events.map(row => ({ ...row, dayId: row.dayId || next.events.find(event => event.id === row.id)?.dayId || next.date }));
  if (JSON.stringify(events) !== JSON.stringify(next.events)) next = replaceTrialEvents(next, events);
  return next;
}
export function hydrateTrial(raw, premium) {
  if (!raw) return createTrialWorkspace(premium);
  const trial = structuredClone(raw);
  const base = createTrialWorkspace(premium);
  for (const key of [...SHARED_KEYS, ...EXTRA_TEXT_KEYS, ...CHECK_KEYS, 'mode', 'externalStatus']) if (typeof trial[key] !== typeof base[key]) throw new Error(`Invalid saved trial field: ${key}`);
  if (trial.schemaVersion !== 1 || !Number.isInteger(trial.revision) || !Array.isArray(trial.audit) || !Array.isArray(trial.events) || trial.events.length > 150) throw new Error('Invalid trial backup');
  for (const row of trial.events) if (!['id','dayId','level','format','stream','judge','exercises'].every(key => typeof row[key] === 'string') || !Number.isInteger(row.round)) throw new Error('Invalid trial event');
  if (!['not_submitted','submitted','approved','rejected'].includes(trial.externalStatus)) throw new Error('Invalid sanction state');
  if (trial.application !== null && !locked(trial)) throw new Error('Invalid application snapshot');
  if (locked(trial)) {
    if (JSON.stringify(trial.application.trialSnapshot) !== JSON.stringify(officialContent(trial)) || validateTrial(trial).length) throw new Error('Finalized trial does not match its snapshot');
    const expected = finalizeTrial({ ...trial, application: null }).application.officialSnapshot;
    if (JSON.stringify(trial.application.officialSnapshot) !== JSON.stringify(expected) || JSON.stringify(trial.application.events) !== JSON.stringify(expected)) throw new Error('Finalized official events do not match');
  } else if (trial.externalStatus !== 'not_submitted') throw new Error('Sanction state requires a finalized application');
  if (trial.externalStatus === 'approved' && (!trial.trialNumber.trim() || !trial.approvalEvidence.trim() || !validDate(trial.submissionDate))) throw new Error('Incomplete approval evidence');
  return trial;
}
