import { dateInZone, validCalendarDate,receivedInstant } from './date-time.js';
import { createHash, randomUUID, randomBytes } from 'node:crypto';
import { sourceKey, validatePremium } from './premium.js';
import {activeRun,runStatus} from './run-status.js';
export class DeskError extends Error {
  constructor(message, status = 422) { super(message); this.status = status; }
}
const fail = (message, status) => { throw new DeskError(message, status); };
const text = (value, label, limit = 500) => {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) fail(`${label} is required (maximum ${limit} characters).`);
  return value.trim();
};
const cents = value => { if (!Number.isSafeInteger(value) || value <= 0) fail('Enter a positive amount in CAD cents.'); return value; };
export const emptyRecords = () => ({ schemaVersion: 1, revision: 0, activeTrialId: null, trials: {}, entries: [], ledger: [], expenses: [], scores: [], orders: {}, finalizedEvents: {}, moveUps: [], incidents: [], ribbonClaims: [], trialAdmin: {}, audit: [] });
export function makeTrialConfig({ trial, premium, editions, pricing, capacity = 50 }) {
  if (!premium.fictional) {
    if (trial.application?.state !== 'finalized' || trial.externalStatus !== 'approved') fail('Finalize the application and record CARO approval first.');
    if (validatePremium(premium).length || !editions.some(edition => edition.sourceKey === sourceKey(premium))) fail('Save a reviewed premium edition matching the current draft first.');
  }
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) fail('Capacity must be between 1 and 1000 entries per event in this local version.');
  const fields = ['title','host','fictional','date','endDate','timezone','venue','address','secretary','email','chair','trialNumber','intro','opens','closes','payment','confirmations','refunds','moveups','accommodations','facilities','siteRules','awards','waiver','theme'];
  const config = Object.fromEntries(fields.map(key => [key, premium[key] ?? '']));
  config.premiumVersion = premium.fictional ? 'sample' : editions.at(-1).version;
  config.events = premium.events.map(row => {
    const price = pricing[row.id];
    if (!price) fail(`Configure pricing for round ${row.round}.`);
    const validateFee = (index, optional = false) => {
      if (optional && (index === null || index === '')) return null;
      const fee = premium.fees[Number(index)];
      if (!fee || !Number.isSafeInteger(fee.cents) || fee.cents < 0) fail(`Choose a valid fee for round ${row.round}.`);
      return { label: fee.label, cents: fee.cents };
    };
    if (!['dog','entry','exercise'].includes(price.basis)) fail('Choose a pricing unit.');
    if ((row.format === 'Working') !== (price.basis === 'exercise')) fail('Working pricing must be per exercise; Rally pricing must be per entry or dog.');
    const exercises = row.format === 'Working' ? row.exercises.split(/[·,;\n]+/).map(value => value.trim()).filter(Boolean).map((name, i) => ({ id:`exercise-${i+1}`, name })) : [];
    if (row.format === 'Working' && (!exercises.length || exercises.length > 5)) fail('List one to five offered Working exercises separated by commas, semicolons or dots.');
    const levels = row.format === 'Working' ? ['Rookie','Elite','Expert'].filter(level => row.stream.toLowerCase().includes(level.toLowerCase())) : ['B','C'].filter(stream => row.stream.toUpperCase().split(/[^A-Z]+/).includes(stream));
    if (!levels.length) fail(`Round ${row.round}: state the offered streams/levels explicitly.`);
    return { id:row.id, round:row.round, dayId:row.dayId || trial.date, level:row.level, format:row.format, judge:row.judge, stream:row.stream, exercises, levels, fee:validateFee(price.fee), feoFee:validateFee(price.feoFee, true), basis:price.basis, capacity };
  });
  if (!config.events.length) fail('Add offered events before preparing an entry form.');
  const id = createHash('sha256').update(JSON.stringify({ ...config, premiumVersion:undefined })).digest('hex').slice(0,24);
  return { ...config, id };
}
export function installTrial(state, config, now) {
  state.trials[config.id] ??= structuredClone(config);
  state.activeTrialId = config.id;
  audit(state,'trial.prepared',config.id,now);
  return { trialId:config.id };
}
function audit(state, action, reference, now, reason = '',details={}) {
  const source=state.entries.find(item=>item.id===reference)||[...state.ledger,...state.expenses,...state.scores,...state.incidents].find(item=>item.id===reference);
  const matching=Object.values(state.trials).filter(trial=>trial.id===reference||trial.events.some(event=>event.id===reference));
  state.audit.push({id:randomUUID(),action,reference,occurredAt:now,reason,actor:'Local secretary (not authenticated)',trialId:source?.trialId||(matching.length===1?matching[0].id:null),entryId:source?.entryId||(source?.selections?source.id:null),...details});
}
export function withdrawRun(state,{entryId,eventId,reason},now){
  const entry=getEntry(state,entryId),trial=getTrial(state,entry.trialId);
  const line=entry.selections.find(item=>item.eventId===eventId);
  if(!line||!['submitted','accepted','checked_in','waitlisted'].includes(runStatus(entry,eventId)))fail('Choose an active entered run.');
  const note=text(reason,'Withdrawal reason',1000);
  if(state.finalizedEvents[`${trial.id}:${eventId}`])fail('This event has a completed Trial Record.');
  if(state.scores.some(score=>score.entryId===entryId&&score.eventId===eventId))fail('A judged run cannot be withdrawn. Preserve its result.');
  const record={id:randomUUID(),trialId:trial.id,entryId,eventId,selection:structuredClone(line),priorStatus:runStatus(entry,eventId),reason:note,occurredAt:now};
  for(const item of entry.selections)item.status??=entry.status;
  entry.withdrawnRuns??=[];entry.withdrawnRuns.push(record);
  entry.selections=entry.selections.filter(item=>item.eventId!==eventId);
  // Accepted fees remain in the ledger. Any waiver/refund is a separate decision.
  if(!chargedRun(entry,eventId))entry.amountCents-=line.amountCents;
  aggregateStatus(entry);
  const key=`${trial.id}:${eventId}`;if(state.orders[key])state.orders[key]=state.orders[key].filter(id=>id!==entryId);
  audit(state,'run.withdrawn',entryId,now,note,{eventId,withdrawalId:record.id,amountCents:line.amountCents});
  return record;
}
function getTrial(state,id) { return (Object.hasOwn(state.trials,id) && state.trials[id]) || fail('Trial not found.',404); }
function getEntry(state,id) { return state.entries.find(entry=>entry.id===id) || fail('Entry not found.',404); }
const active = entry => ['accepted','checked_in'].includes(entry.status);
function chargedRun(entry,eventId){return entry.chargedEventIds?entry.chargedEventIds.includes(eventId):entry.chargePosted;}
function postRunCharges(state,entry,lines,now){
  entry.chargedEventIds??=entry.chargePosted?entry.selections.map(line=>line.eventId):[];
  const uncharged=lines.filter(line=>!entry.chargedEventIds.includes(line.eventId));
  const amount=uncharged.reduce((sum,line)=>sum+line.amountCents,0);
  if(amount)state.ledger.push({id:randomUUID(),entryId:entry.id,trialId:entry.trialId,kind:'charge',cents:amount,occurredAt:now,note:'Accepted run fee snapshot',eventIds:uncharged.map(line=>line.eventId)});
  entry.chargedEventIds.push(...uncharged.map(line=>line.eventId));entry.chargePosted=entry.chargedEventIds.length>0;
}
function aggregateStatus(entry){
 const states=entry.selections.map(line=>line.status||entry.status);
 entry.status=states.length&&states.every(status=>status==='checked_in')?'checked_in':states.some(status=>['accepted','checked_in'].includes(status))?'accepted':states.some(status=>status==='submitted')?'submitted':states.some(status=>status==='waitlisted')?'waitlisted':states.length&&states.every(status=>status==='rejected')?'rejected':'withdrawn';
}
export function changeRunStatus(state,{entryId,eventId,status,reason=''},now){
 const entry=getEntry(state,entryId),trial=getTrial(state,entry.trialId),line=entry.selections.find(line=>line.eventId===eventId);
 if(!line)fail('Run not found.');
 const previous=runStatus(entry,eventId);
 const allowed={submitted:['accepted','waitlisted','rejected'],waitlisted:['accepted','rejected'],accepted:['checked_in']};
 if(!allowed[previous]?.includes(status))fail('That run status change is not available.');
 if(status==='rejected')text(reason,'Reason',1000);
 if(state.finalizedEvents[`${trial.id}:${eventId}`]||state.scores.some(score=>score.entryId===entryId&&score.eventId===eventId))fail('This run has a result or completed Trial Record.');
 if(status==='accepted'){
  const count=state.entries.filter(other=>other.trialId===trial.id&&activeRun(other,eventId)).length;
  if(count>=trial.events.find(event=>event.id===eventId).capacity)fail('This event is full. Keep this run waitlisted.');
 }
 // Materialize legacy entry-wide state before the aggregate changes.
 for(const item of entry.selections)item.status??=entry.status;
 if(status==='accepted')postRunCharges(state,entry,[line],now);
 line.status=status;line.statusChangedAt=now;line.statusReason=reason;
 if(status==='waitlisted')line.waitlistedAt=now;
 aggregateStatus(entry);
 audit(state,previous==='waitlisted'&&status==='accepted'?'run.waitlist_promoted':`run.${status}`,entryId,now,reason,{eventId,previousStatus:previous,status});
 return line;
}
export function submitEntry(state, input, channel, now) {
  const trial = getTrial(state,input.trialId);
  const key = text(input.idempotencyKey,'Submission reference',100);
  const requestHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const previous = state.entries.find(entry=>entry.trialId===trial.id && entry.idempotencyKey===key);
  if (previous) { if (previous.requestHash !== requestHash) fail('Submission reference already used for different information.',409); return receipt(previous); }
  let receivedAt;try{receivedAt=channel==='online'?now:receivedInstant(input.receivedAt,now);}catch(error){fail(error.message);}
  if (!trial.fictional && channel === 'online') {
    const today = dateInZone(now,trial.timezone);
    if (today < trial.opens || today > trial.closes) fail('The online entry window is closed. Contact the secretary.');
  }
  const contact = {
    name:text(input.contact?.name,'Handler name',100), email:text(input.contact?.email,'Email',150), phone:text(input.contact?.phone,'Phone',60), address:text(input.contact?.address,'Mailing address',350),
  };
  if (!/^\S+@\S+\.\S+$/.test(contact.email)) fail('Check the handler email.');
  const normalizeDog = (dog, label, defaultOwner=contact.name) => {
    const result = { name:text(dog?.name,`${label} name`,100), caroId:text(dog?.caroId,`${label} CARO ID`,40), breed:text(dog?.breed,`${label} breed`,100), birthDate:text(dog?.birthDate,`${label} birth date`,20), height:text(dog?.height,`${label} height at withers`,40), jumpHeight:text(dog?.jumpHeight,`${label} jump height`,40), veteran:dog?.veteran===true, bye:dog?.bye===true };
    if (result.bye || result.caroId === '2799') fail('Bye participants must be arranged with the secretary; do not register a fictitious owned dog.');
    if (!validCalendarDate(result.birthDate) || result.birthDate>trial.date) fail('Enter a valid dog birth date.');
    result.owner=typeof dog.owner==='string'&&dog.owner.trim()?text(dog.owner,`${label} owner`,100):defaultOwner;
    return result;
  };
  const dog = normalizeDog(input.dog,'Dog');
  if (!Array.isArray(input.selections) || !input.selections.length || input.selections.length > trial.events.length) fail('Select at least one offered event.');
  const seen = new Set();
  let partner = null;
  if (input.selections.some(selection=>['Team','Brace'].includes(trial.events.find(event=>event.id===selection.eventId)?.format))) {
    partner = { dog:normalizeDog(input.partner?.dog,'Partner dog',input.partner?.handler||contact.name), handler:text(input.partner?.handler,'Partner handler',100) };
    if (partner.dog.caroId === dog.caroId) fail('Team and Brace need two different dogs.');
  }
  const selections = input.selections.map(selection => {
    const event = trial.events.find(event=>event.id===selection.eventId);
    if (event && state.finalizedEvents[`${trial.id}:${event.id}`]) fail('A selected event is already complete. Contact the secretary.');
    if (!event || seen.has(event.id)) fail('Choose each offered event at most once.'); seen.add(event.id);
    if (event.format === 'Team' && partner.handler.toLowerCase() === contact.name.toLowerCase()) fail('Team uses two different handlers; use Brace for one handler and two dogs.');
    if (event.format === 'Brace' && partner.handler !== contact.name) fail('Brace uses one handler for both dogs.');
    const feo = selection.feo === true;
    const fee = feo ? event.feoFee : event.fee;
    if (!fee) fail(`FEO is not offered for round ${event.round}.`);
    let exercises = [];
    if (event.format === 'Working') {
      if (!Array.isArray(selection.exercises) || !selection.exercises.length || selection.exercises.length > event.exercises.length) fail(`Select offered exercises for round ${event.round}.`);
      const unique = new Set();
      exercises = selection.exercises.map(item => {
        if (!event.exercises.some(exercise=>exercise.id===item.id) || !event.levels.includes(item.level) || unique.has(item.id)) fail('Choose each offered Working exercise once at an offered level.');
        unique.add(item.id); return { id:item.id, level:item.level };
      });
    } else if (!event.levels.includes(selection.stream)) fail(`Choose an offered stream for round ${event.round}.`);
    const units = event.basis === 'exercise' ? exercises.length : event.basis === 'dog' && ['Team','Brace'].includes(event.format) ? 2 : 1;
    return { eventId:event.id, stream:event.format === 'Working' ? null : selection.stream, feo, exercises, units, unitCents:fee.cents, amountCents:units*fee.cents, participantIds:['Team','Brace'].includes(event.format) ? [dog.caroId,partner.dog.caroId] : [dog.caroId] };
  });
  if (input.agree !== true || input.eligibilityDeclared !== true) fail('Confirm the agreement and eligibility declaration.');
  if (channel !== 'online') text(input.intakeEvidence,'Signed agreement / intake evidence',1000);
  const duplicate = state.entries.some(entry=>entry.trialId===trial.id && !['withdrawn','rejected'].includes(entry.status) && entry.selections.some(old=>!['rejected','withdrawn'].includes(runStatus(entry,old.eventId))&&selections.some(next=>next.eventId===old.eventId && next.participantIds.some(id=>old.participantIds.includes(id)))));
  if (duplicate) fail('An entry for a selected dog and round already exists. Contact the secretary before submitting again.',409);
  const entry = { id:randomUUID(), receiptToken:randomBytes(24).toString('hex'), trialId:trial.id, idempotencyKey:key, requestHash, contact, dog, partner, selections, amountCents:selections.reduce((sum,line)=>sum+line.amountCents,0), status:'submitted', channel, createdAt:now, agreementVersion:trial.premiumVersion, agreementAcceptedAt:now, eligibility:'declared_not_verified', accommodation:String(input.accommodation || '').slice(0,2000), intakeEvidence:channel==='online' ? '' : input.intakeEvidence, chargePosted:false };
  entry.receivedAt=receivedAt;entry.recordedAt=now;
  state.entries.push(entry); audit(state,'entry.submitted',entry.id,now,channel,{receivedAt,actor:channel==='online'?'Online entrant (self-declared)':'Local secretary (not authenticated)'});
  return receipt(entry);
}
export function receipt(entry) { return { id:entry.id, receiptToken:entry.receiptToken, status:entry.status, amountCents:entry.amountCents, createdAt:entry.createdAt, dogName:entry.dog.name, selections:entry.selections }; }
export function changeEntryStatus(state, { entryId, status, reason = '' }, now) {
  const entry = getEntry(state,entryId), trial=getTrial(state,entry.trialId);
  const allowed = { submitted:['accepted','waitlisted','rejected','withdrawn'], waitlisted:['accepted','rejected','withdrawn'], accepted:['checked_in','withdrawn'], checked_in:['withdrawn'], withdrawn:[], rejected:[] };
  if (!allowed[entry.status]?.includes(status)) fail('That entry status change is not available.');
  if (['withdrawn','rejected'].includes(status)) text(reason,'Reason',1000);
  if (['withdrawn','rejected'].includes(status) && state.scores.some(score=>score.entryId===entry.id)) fail('This entry already has a recorded result. Preserve it and record any remaining absences by event.');
  if(status==='checked_in'&&entry.selections.some(line=>!activeRun(entry,line.eventId)))fail('Check in individual accepted runs; this entry still has unaccepted runs.');
  if(status==='accepted'&&entry.selections.some(line=>['rejected','withdrawn'].includes(runStatus(entry,line.eventId))))fail('Accept individual available runs; do not restore rejected runs.');
  if (entry.selections.some(line=>state.finalizedEvents[`${trial.id}:${line.eventId}`])) fail('A selected event has a completed Trial Record. Preserve its entry record.');
  if (status === 'accepted') {
    for (const line of entry.selections) {
      const count=state.entries.filter(other=>other.id!==entry.id&&other.trialId===trial.id&&activeRun(other,line.eventId)).length;
      if (count>=trial.events.find(event=>event.id===line.eventId).capacity) fail('An event is full. Keep this entry on the waiting list.');
    }
    postRunCharges(state,entry,entry.selections,now);
  }
  entry.status=status;entry.statusChangedAt=now;entry.statusReason=reason;
  for(const line of entry.selections){line.status=status;line.statusChangedAt=now;line.statusReason=reason;if(status==='waitlisted')line.waitlistedAt=now;}
  audit(state,`entry.${status}`,entry.id,now,reason); return entry;
}
export function entryBalance(state,entryId) { return state.ledger.filter(item=>item.entryId===entryId).reduce((sum,item)=>sum+(['charge','refund'].includes(item.kind)?item.cents:-item.cents),0); }
export function postFinance(state,{entryId,kind,amountCents,note,method,receivedAt:originalReceived},now) {
  const entry=getEntry(state,entryId), amount=cents(amountCents); text(note,'Payment / adjustment note',500);
  if (!['payment','refund','waiver'].includes(kind)) fail('Unknown financial action.');
  let receivedAt;try{receivedAt=receivedInstant(originalReceived,now);}catch(error){fail(error.message);}
  if (kind==='refund') {
    const paid=state.ledger.filter(item=>item.entryId===entryId).reduce((sum,item)=>sum+(item.kind==='payment'?item.cents:item.kind==='refund'?-item.cents:0),0);
    if (amount>paid) fail('Refund exceeds the net payments recorded for this entry.');
  }
  if (kind==='waiver') {
    const charge=state.ledger.filter(item=>item.entryId===entryId).reduce((sum,item)=>sum+(item.kind==='charge'?item.cents:item.kind==='waiver'?-item.cents:0),0);
    if (amount>charge) fail('Waiver exceeds the remaining entry charges.');
  }
  const record={id:randomUUID(),entryId,trialId:entry.trialId,kind,cents:amount,note:note.trim(),method:String(method||'Manual record').slice(0,60),occurredAt:now};
  record.receivedAt=receivedAt;record.recordedAt=now;
  state.ledger.push(record);audit(state,`finance.${kind}`,record.id,now,note,{receivedAt});return record;
}
export function postExpense(state,{trialId,amountCents,note,category},now) {
  getTrial(state,trialId); const item={id:randomUUID(),trialId,cents:cents(amountCents),note:text(note,'Expense description',500),category:text(category,'Expense category',100),occurredAt:now};state.expenses.push(item);audit(state,'expense.recorded',item.id,now);return item;
}
export function runningOrder(state,trialId,eventId) {
  const entries=state.entries.filter(entry=>entry.trialId===trialId && activeRun(entry,eventId));
  const saved=state.orders[`${trialId}:${eventId}`] || [];
  return entries.sort((a,b)=>{const ai=saved.indexOf(a.id),bi=saved.indexOf(b.id);return (ai<0?1e6:ai)-(bi<0?1e6:bi)||a.createdAt.localeCompare(b.createdAt);});
}
export function setRunningOrder(state,{trialId,eventId,entryIds},now) {
  if(state.finalizedEvents[`${trialId}:${eventId}`]) fail('The Trial Record is complete; its running order is locked.');
  const expected=runningOrder(state,trialId,eventId).map(entry=>entry.id);
  if (!Array.isArray(entryIds)||expected.length!==entryIds.length||new Set(entryIds).size!==expected.length||entryIds.some(id=>!expected.includes(id))) fail('Order must contain every active entry once.');
  state.orders[`${trialId}:${eventId}`]=[...entryIds];audit(state,'order.changed',eventId,now);return entryIds;
}
export function recordScore(state,input,now) {
  const entry=getEntry(state,input.entryId),trial=getTrial(state,entry.trialId),event=trial.events.find(event=>event.id===input.eventId),line=entry.selections.find(line=>line.eventId===input.eventId);
  if (!event||!line||!activeRun(entry,event.id)) fail('Only accepted or checked-in event entries can be scored.');
  if (state.finalizedEvents[`${trial.id}:${event.id}`]) fail('The Trial Record is complete. Judge scores cannot be changed.');
  if (input.judgeConfirmed!==true) fail('Confirm this is the judge-provided result.');
  const prior=state.scores.filter(score=>score.entryId===entry.id&&score.eventId===event.id).at(-1);
  if (prior) text(input.reason,'Recording correction reason',1000);
  if (!Number.isFinite(input.elapsedSeconds)||input.elapsedSeconds<0) fail('Enter a nonnegative elapsed time.');
  let results;
  if (event.format==='Working') {
    if (!Array.isArray(input.results)||input.results.length!==line.exercises.length) fail('Record every selected Working exercise.');
    const ids=new Set();results=input.results.map(result=>{
      if (!line.exercises.some(exercise=>exercise.id===result.id)||ids.has(result.id)||!['Pass','Not Yet','FEO','Absent','Excused'].includes(result.outcome)) fail('Check the exercise outcomes.');
      if (line.feo && !['FEO','Absent','Excused'].includes(result.outcome)) fail('An FEO round cannot earn exercise passes.');
      ids.add(result.id);return {id:result.id,outcome:result.outcome};
    });
  } else {
    if (!['Q','NQ','FEO','Absent','Excused'].includes(input.outcome)) fail('Choose a judge-provided outcome.');
    if (line.feo && !['FEO','Absent','Excused'].includes(input.outcome)) fail('An FEO entry cannot earn a qualifying result.');
    if (input.score!==null&&(!Number.isInteger(input.score)||input.score<0||input.score>200)) fail('Rally score must be a whole number from 0 to 200.');
    if (input.outcome==='Q'&&input.score===null) fail('Record the Rally score.');
    results={outcome:input.outcome,score:input.score};
  }
  const record={id:randomUUID(),entryId:entry.id,trialId:trial.id,eventId:event.id,version:(prior?.version||0)+1,results,elapsedSeconds:input.elapsedSeconds,judge:event.judge,occurredAt:now,reason:input.reason||'',provenance:'judge_provided_not_automatically_calculated'};
  state.scores.push(record);audit(state,'score.recorded',record.id,now,input.reason||'');return record;
}
export function completeEvent(state,{trialId,eventId,signoff},now) {
  const trial=getTrial(state,trialId);if (!trial.events.some(event=>event.id===eventId)) fail('Event not found.');
  text(signoff,'Judge sign-off evidence',1000);
  const entries=runningOrder(state,trialId,eventId);
  if (entries.some(entry=>!state.scores.some(score=>score.entryId===entry.id&&score.eventId===eventId))) fail('Record a result, absence or excusal for every active entry first.');
  const key=`${trialId}:${eventId}`;if(state.finalizedEvents[key])fail('Trial Record already complete.');
  state.finalizedEvents[key]={signoff,occurredAt:now};audit(state,'event.completed',eventId,now,signoff);return state.finalizedEvents[key];
}
export function approveMoveUp(state,input,now) {
  const entry=getEntry(state,input.entryId),trial=getTrial(state,entry.trialId),index=entry.selections.findIndex(line=>line.eventId===input.fromEventId),event=trial.events.find(event=>event.id===input.toEventId);
  if(index<0||!event||!['submitted','waitlisted','accepted','checked_in'].includes(entry.status))fail('Choose an active entry and offered destination.');
  const prior=entry.selections[index],from=trial.events.find(event=>event.id===prior.eventId);
  if(state.scores.some(score=>score.entryId===entry.id&&score.eventId===from.id)||state.finalizedEvents[`${trial.id}:${from.id}`]||state.finalizedEvents[`${trial.id}:${event.id}`])fail('Move-ups apply only to unjudged entries and open Trial Records.');
  if(input.eligibilityReviewed!==true)fail('Record a staff review of the prerequisite evidence.');
  const evidence=text(input.evidence,'Move-up prerequisite evidence',1000);
  if(from.format!==event.format)fail('Keep the same participant format when moving an entry.');
  if(entry.selections.some((line,i)=>i!==index&&line.eventId===event.id))fail('This entry already contains the destination event.');
  let exercises=structuredClone(prior.exercises),stream=prior.stream;
  if(event.format==='Working'){
    if(from.id!==event.id)fail('Working level changes are recorded within the selected round; enter additional rounds separately.');
    if(!Array.isArray(input.exercises)||input.exercises.length!==prior.exercises.length)fail('Preserve every selected exercise during a level move-up.');
    const seen=new Set();exercises=input.exercises.map(item=>{if(!prior.exercises.some(exercise=>exercise.id===item.id)||seen.has(item.id)||!event.levels.includes(item.level))fail('Choose offered levels for the existing exercises.');seen.add(item.id);return{id:item.id,level:item.level};});
  }else{if(!event.levels.includes(input.stream))fail('Choose an offered destination stream.');stream=input.stream;}
  if(state.entries.some(other=>other.id!==entry.id&&other.trialId===trial.id&&!['withdrawn','rejected'].includes(other.status)&&other.selections.some(line=>line.eventId===event.id&&line.participantIds.some(id=>prior.participantIds.includes(id)))))fail('A dog already has another submission for the destination event.',409);
  if(activeRun(entry,from.id)&&from.id!==event.id&&state.entries.filter(other=>other.trialId===trial.id&&activeRun(other,event.id)).length>=event.capacity)fail('The destination event is full.');
  const fee=prior.feo?event.feoFee:event.fee;if(!fee)fail('The destination does not offer this entry type.');
  const units=event.basis==='exercise'?exercises.length:event.basis==='dog'&&['Team','Brace'].includes(event.format)?2:1;
  const next={...structuredClone(prior),eventId:event.id,stream,exercises,units,unitCents:fee.cents,amountCents:units*fee.cents};
  if(JSON.stringify(prior)===JSON.stringify(next))fail('Choose a different event, stream or exercise level.');
  const delta=next.amountCents-prior.amountCents;
  const wasCharged=chargedRun(entry,from.id);
  entry.selections[index]=next;entry.amountCents+=delta;
  if(wasCharged&&entry.chargedEventIds)entry.chargedEventIds=entry.chargedEventIds.map(id=>id===from.id?event.id:id);
  if(wasCharged&&delta)state.ledger.push({id:randomUUID(),entryId:entry.id,trialId:trial.id,kind:delta>0?'charge':'waiver',cents:Math.abs(delta),occurredAt:now,note:'Move-up fee difference: '+evidence});
  const record={id:randomUUID(),entryId:entry.id,trialId:trial.id,before:structuredClone(prior),after:structuredClone(next),evidence,occurredAt:now,eligibility:'staff_reviewed_evidence_not_registry_verified'};
  state.moveUps.push(record);audit(state,'entry.move_up',entry.id,now,evidence);return record;
}
export function recordAccommodation(state,{entryId,eventId,decision,evidence,notified},now) {
  const entry=getEntry(state,entryId),trial=getTrial(state,entry.trialId);
  if(!entry.selections.some(line=>line.eventId===eventId)||!['approved','denied','pending'].includes(decision))fail('Choose a selected event and accommodation decision.');
  const note=text(evidence,'Judge decision / request evidence',1500);
  entry.accommodationDecisions??={};entry.accommodationDecisions[eventId]={decision,evidence:note,notified:notified===true,judge:trial.events.find(event=>event.id===eventId).judge,recordedAt:now};
  audit(state,'accommodation.recorded',entry.id,now);return entry.accommodationDecisions[eventId];
}
export function recordIncident(state,{trialId,category,description},now) {
  getTrial(state,trialId);if(!['Dog behaviour / aggression','Sportsmanship','Other'].includes(category))fail('Choose an incident category.');
  const record={id:randomUUID(),trialId,category,description:text(description,'Incident description',6000),occurredAt:now};state.incidents.push(record);state.trialAdmin[trialId]??={};state.trialAdmin[trialId].noIncidentsConfirmed=false;audit(state,'incident.recorded',record.id,now);return record;
}
export function recordTrialAdmin(state,{trialId,noIncidentsConfirmed,dataEntryConfirmationDate,paperworkSentDate},now) {
  getTrial(state,trialId);
  if(noIncidentsConfirmed&&state.incidents.some(item=>item.trialId===trialId))fail('This trial has an incident record; do not mark no incidents.');
  const result=state.trialAdmin[trialId]??={};
  for(const[key,value]of Object.entries({dataEntryConfirmationDate,paperworkSentDate})){
    if(value!==undefined){if(value!==''&&(!validCalendarDate(value)))fail('Enter a valid reporting date.');result[key]=value;}
  }
  result.noIncidentsConfirmed=noIncidentsConfirmed===true;audit(state,'trial.paperwork_updated',trialId,now);return result;
}
export function recordRibbonClaim(state,{entryId,title,evidence},now) {
  const entry=getEntry(state,entryId);const record={id:randomUUID(),trialId:entry.trialId,entryId,title:text(title,'Reported title / ribbon request',200),evidence:text(evidence,'Handler declaration / evidence',1000),status:'handler_declared_not_awarded_by_app',occurredAt:now};state.ribbonClaims.push(record);audit(state,'ribbon.declared',entry.id,now);return record;
}
