import {runStatus} from '../src/domain/run-status.js';
export function runRegister(state,trialId){
 const trial=state.trials[trialId];if(!trial)throw new Error('Trial not found.');
 const rows=[];
 for(const entry of state.entries.filter(entry=>entry.trialId===trialId)){
  function project(line,status,withdrawal=null){
   const event=trial.events.find(event=>event.id===line.eventId);if(!event)return;
   const paired=['Team','Brace'].includes(event.format),dogs=[entry.dog,...(paired&&entry.partner?[entry.partner.dog]:[])];
   rows.push({entryId:entry.id,eventId:event.id,round:event.round,date:event.dayId,format:event.format,level:event.level,status,
    dogs:dogs.map(dog=>dog.name+' / '+dog.caroId).join(' & '),handlers:[entry.contact.name,...(paired&&entry.partner?[entry.partner.handler]:[])].join(' / '),
    selection:line.stream||(line.exercises||[]).map(item=>(event.exercises.find(exercise=>exercise.id===item.id)?.name||item.id)+' / '+item.level).join('; '),
    feo:!!line.feo,quoteCents:Number.isSafeInteger(line.amountCents)?line.amountCents:null,channel:entry.channel,recordedAt:entry.createdAt,receivedAt:entry.receivedAt||null,
    decisionAt:withdrawal?.occurredAt||line.statusChangedAt||entry.statusChangedAt||null,reason:withdrawal?.reason||line.statusReason||entry.statusReason||'',withdrawalId:withdrawal?.id||null});
  }
  for(const line of entry.selections)project(line,runStatus(entry,line.eventId));
  for(const withdrawal of entry.withdrawnRuns||[])project(withdrawal.selection,'withdrawn',withdrawal);
 }
 return rows.sort((a,b)=>a.round-b.round||a.recordedAt.localeCompare(b.recordedAt)||a.entryId.localeCompare(b.entryId));
}
export function runRegisterCsvRows(rows){
 return [['Entry reference','Round','Date','Format','Level','Dog(s) / ID(s)','Handler(s)','Stream / exercises','FEO','Run status','Original run quote CAD','Intake','Recorded UTC','Received UTC','Decision UTC','Withdrawal reason'],
 ...rows.map(row=>[row.entryId,row.round,row.date,row.format,row.level,row.dogs,row.handlers,row.selection,row.feo?'Yes':'No',row.status,row.quoteCents===null?'Not recorded':(row.quoteCents/100).toFixed(2),row.channel,row.recordedAt,row.receivedAt||'',row.decisionAt||'',row.reason])];
}
