export function runStatus(entry,eventId){return entry.selections.find(line=>line.eventId===eventId)?.status||entry.status;}
export function activeRun(entry,eventId){return ['accepted','checked_in'].includes(runStatus(entry,eventId))&&entry.selections.some(line=>line.eventId===eventId);}
