// Calendar dates and real instants are different types. Never infer the machine zone.
export function validCalendarDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
function instant(value) {
  if (typeof value !== 'string' || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new RangeError('A timestamp must include UTC Z or an explicit offset.');
  }
  return new Date(value);
}
export function dateInZone(value, timeZone) {
  if (typeof timeZone !== 'string' || !timeZone.trim()) throw new RangeError('An explicit trial timezone is required.');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year:'numeric', month:'2-digit', day:'2-digit',
  }).formatToParts(instant(value));
  const values = Object.fromEntries(parts.map(part => [part.type,part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
export function timestampLabel(value, timeZone) {
  try {
    if (typeof timeZone !== 'string' || !timeZone.trim()) throw new RangeError('Trial timezone required.');
    const date = instant(value);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone, year:'numeric', month:'short', day:'numeric', hour:'numeric',
      minute:'2-digit', second:'2-digit', timeZoneName:'shortOffset',
    }).format(date) + ` [${timeZone}]`;
  } catch { return 'Time unavailable (check timestamp and trial timezone)'; }
}
