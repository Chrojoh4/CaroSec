import {runStatus,activeRun} from '../src/domain/run-status.js';
export function trialSummary(state,trialId){
 const trial=state.trials[trialId];if(!trial)throw new Error('Trial not found.');
 const entries=state.entries.filter(entry=>entry.trialId===trialId),ledger=state.ledger.filter(item=>item.trialId===trialId);
 const sum=kind=>ledger.filter(item=>item.kind===kind).reduce((total,item)=>total+item.cents,0);
 const charges=sum('charge'),payments=sum('payment'),refunds=sum('refund'),waivers=sum('waiver');
 const events=trial.events.map(event=>{
  const lines=entries.flatMap(entry=>entry.selections.filter(line=>line.eventId===event.id).map(line=>({entry,line})));
  const accepted=lines.filter(({entry})=>activeRun(entry,event.id));
  const withdrawals=entries.reduce((total,entry)=>total+(entry.withdrawnRuns||[]).filter(run=>run.eventId===event.id).length,0);
  const outcomes={};let recorded=0,exerciseResults=0,outcomeReview=0;
  for(const {entry,line} of accepted){const score=state.scores.filter(score=>score.entryId===entry.id&&score.eventId===event.id).at(-1);if(!score)continue;recorded++;
   const working=event.format==='Working';
   if(working?!Array.isArray(score.results):!score.results||typeof score.results!=='object'||Array.isArray(score.results)){outcomeReview++;continue;}
   const results=working?score.results:[score.results],allowed=working?['Pass','Not Yet','FEO','Absent','Excused']:['Q','NQ','FEO','Absent','Excused'];
   let needsReview=working&&(results.length===0||results.length!==(line.exercises||[]).length);
   const selected=new Set((line.exercises||[]).map(item=>item.id)),ids=new Map();if(working)for(const item of results)ids.set(item?.id,(ids.get(item?.id)||0)+1);
   for(const result of results){if(!allowed.includes(result?.outcome)||(working&&(!selected.has(result?.id)||ids.get(result?.id)!==1))){needsReview=true;continue;}outcomes[result.outcome]=(outcomes[result.outcome]||0)+1;if(working)exerciseResults++;}
   if(needsReview)outcomeReview++;
  }
  return {id:event.id,round:event.round,date:event.dayId,format:event.format,level:event.level,capacity:event.capacity,
   submitted:lines.filter(({entry})=>runStatus(entry,event.id)==='submitted').length,accepted:accepted.length,waitlisted:lines.filter(({entry})=>runStatus(entry,event.id)==='waitlisted').length,
   rejected:lines.filter(({entry})=>runStatus(entry,event.id)==='rejected').length,withdrawn:withdrawals+lines.filter(({entry})=>runStatus(entry,event.id)==='withdrawn').length,
   feo:accepted.filter(({line})=>line.feo).length,recorded,unrecorded:accepted.length-recorded,exerciseResults,outcomeReview,outcomes,complete:!!state.finalizedEvents[`${trialId}:${event.id}`]};
 });
 const byStatus={};for(const entry of entries)byStatus[entry.status]=(byStatus[entry.status]||0)+1;
 const balances=entries.map(entry=>ledger.filter(item=>item.entryId===entry.id).reduce((total,item)=>total+(['charge','refund'].includes(item.kind)?item.cents:-item.cents),0));
 const expenses=state.expenses.filter(item=>item.trialId===trialId).reduce((total,item)=>total+item.cents,0);
 const incidents=(state.incidents||[]).filter(row=>row.trialId===trialId),paperwork=state.trialAdmin?.[trialId]||{},incidentReview={records:incidents.length,noIncidentsConfirmed:typeof paperwork.noIncidentsConfirmed==='boolean'?paperwork.noIncidentsConfirmed:null};
 return {trialId,incidentReview,entries:entries.length,byStatus,events,finance:{charges,payments,refunds,waivers,balance:charges+refunds-payments-waivers,owing:balances.filter(value=>value>0).reduce((a,b)=>a+b,0),credit:balances.filter(value=>value<0).reduce((a,b)=>a-b,0),expenses,netCash:payments-refunds-expenses},
  warnings:[...(incidentReview.noIncidentsConfirmed===null?['Incident review has not been recorded.']:incidentReview.noIncidentsConfirmed&&incidents.length?['Incident records conflict with the no-incidents declaration; review before paperwork.']:[]),'Secretary reconciliation only. Verify counts and reporting categories against current CARO forms.','Working exercise outcomes and Rally run outcomes are separate units. Do not add them as a single qualifying-run count.','CARO fees and taxes are not automatically determined from these totals.',...(events.some(event=>event.outcomeReview)?['Some saved result shapes require review; their outcomes could not all be counted.']:[])]};
}
