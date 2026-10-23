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
export function receivedInstant(value,recordedAt){
  if(value===undefined||value===null||value==='')return null;
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!validCalendarDate(value.slice(0,10)))throw new RangeError('Received time must be an ISO timestamp with seconds and Z or an explicit offset.');
  const parts=value.slice(11,19).split(':').map(Number);
  if(parts[0]>23||parts[1]>59||parts[2]>59)throw new RangeError('Received time has an invalid clock time.');
  const date=instant(value),recorded=instant(recordedAt);
  if(date>recorded)throw new RangeError('Received time cannot be later than the recording time.');
  return date.toISOString();
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
    }).format(date);
  } catch { return 'Time unavailable (check timestamp and trial timezone)'; }
}

// Human-facing region label; keep the IANA identifier only as stored configuration.
export function timezoneLabel(timeZone){
 try{return new Intl.DateTimeFormat('en-CA',{timeZone,timeZoneName:'longGeneric'}).formatToParts(new Date('2026-01-15T12:00:00Z')).find(part=>part.type==='timeZoneName').value;}
 catch{return 'Local trial time';}
}

export const timezoneChoices=[['America/Vancouver','Pacific Time'],['America/Edmonton','Mountain Time'],['America/Regina','Saskatchewan Time'],['America/Winnipeg','Central Time'],['America/Toronto','Eastern Time'],['America/Halifax','Atlantic Time'],['America/St_Johns','Newfoundland Time'],['America/Whitehorse','Yukon Time']];
export function timezoneChoicesFor(current){return timezoneChoices.some(([value])=>value===current)||!current?timezoneChoices:[...timezoneChoices,[current,timezoneLabel(current)]];}
