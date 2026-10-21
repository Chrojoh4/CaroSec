const labels={'entry.received':'Entry received','order.saved':'Running order saved','expense.recorded':'Expense recorded','expense.credit':'Expense credit','run.accepted':'Run accepted','run.waitlisted':'Run waitlisted','run.waitlist_promoted':'Waitlisted run promoted','run.checked_in':'Run checked in','run.rejected':'Run rejected','entry.submitted':'Entry received','entry.accepted':'Entry accepted','entry.waitlisted':'Entry waitlisted','entry.withdrawn':'Whole entry withdrawn','entry.rejected':'Entry rejected','entry.checked_in':'Entry checked in','run.withdrawn':'Run withdrawn','finance.payment':'Payment recorded','finance.refund':'Refund recorded','finance.waiver':'Fee waiver recorded','order.changed':'Running order changed','score.recorded':'Judge result recorded','event.completed':'Trial Record completed'};
export function activityJournal(state,trialId,{search='',action=''}={}){
 const trial=state.trials[trialId];if(!trial)return [];
 const entries=state.entries.filter(entry=>entry.trialId===trialId);
 return state.audit.map((item,index)=>{
  const source=entries.find(entry=>entry.id===item.reference)||[...state.ledger,...state.expenses,...state.scores,...state.incidents].find(record=>record.id===item.reference&&record.trialId===trialId);
  const entry=entries.find(entry=>entry.id===(item.entryId||source?.entryId))||(source?.dog?source:null);
  const matching=Object.values(state.trials).filter(value=>value.id===item.reference||value.events.some(event=>event.id===item.reference));
  const resolved=item.trialId||source?.trialId||(matching.length===1?matching[0].id:null);
  if(resolved!==trialId)return null;
  const event=trial.events.find(event=>event.id===item.eventId);
  return {...item,index,label:labels[item.action]||item.action,handler:entry?.contact.name||'',dog:entry?.dog.name||'',caroId:entry?.dog.caroId||'',channel:entry?.channel||'',actor:item.actor||'Not recorded in legacy local data',receivedAt:item.receivedAt??source?.receivedAt??null,amountCents:item.amountCents??source?.cents??null,event:event?`Round ${event.round} · ${event.level} ${event.format}`:''};
 }).filter(Boolean).filter(item=>(!action||item.action===action)&&[item.label,item.handler,item.dog,item.caroId,item.reason,item.actor,item.event].join(' ').toLowerCase().includes(search.toLowerCase())).sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)||b.index-a.index);
}
