import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {sampleScenario} from './sample-scenario.js';
import {withdrawRun,changeRunStatus,postFinance,postExpense,entryBalance,runningOrder,setRunningOrder,recordScore,completeEvent,recordTrialAdmin} from './domain/secretary.js';
import {trialSummary} from '../web/trial-summary.js';
import {workingReport,csv} from '../web/reports.js';
import {runRegister,runRegisterCsvRows} from '../web/run-register.js';
import {createBackup,readBackup} from './adapters/records-backup.js';

export async function trialRehearsal(){
 const data=await sampleScenario(),{state,trialId}=data,trial=state.trials[trialId],steps=[];
 const maple=state.entries.find(entry=>entry.dog.caroId==='TEST-DOG-1'),willow=state.entries.find(entry=>entry.dog.caroId==='TEST-DOG-3');
 withdrawRun(state,{entryId:maple.id,eventId:'rp-test-02',reason:'Fictional second withdrawal for full rehearsal'},'2027-04-17T17:05:00Z');
 changeRunStatus(state,{entryId:willow.id,eventId:'rp-test-02',status:'accepted',reason:'Fictional secretary promotion after released capacity'},'2027-04-17T17:06:00Z');
 steps.push('Withdraw one remaining unjudged run and explicitly promote the waiting run.');
 const adjustment=maple.withdrawnRuns.reduce((sum,run)=>sum+run.selection.amountCents,0);
 postFinance(state,{entryId:maple.id,kind:'waiver',amountCents:adjustment,method:'Fictional policy decision',note:'Test-only approved fee adjustment for two withdrawn runs'},'2027-04-17T17:07:00Z');
 postFinance(state,{entryId:maple.id,kind:'refund',amountCents:adjustment,method:'Fictional refund record',note:'Test only: no money was returned'},'2027-04-17T17:08:00Z');
 for(const entry of state.entries){const owing=entryBalance(state,entry.id);if(owing>0)postFinance(state,{entryId:entry.id,kind:'payment',amountCents:owing,method:'Fictional receipt',note:'Test only: no money received'},'2027-04-17T17:09:00Z');}
 postExpense(state,{trialId,amountCents:3500,note:'Fictional venue expense; no payment made',category:'Practice venue'},'2027-04-17T17:10:00Z');
 steps.push('Record separate waiver and refund decisions, settle other fictional entry balances and record one expense.');
 for(const event of trial.events){
  const date=event.dayId,time=date+'T18:00:00Z',order=runningOrder(state,trialId,event.id);
  for(const entry of order)if(!state.scores.some(score=>score.entryId===entry.id&&score.eventId===event.id))changeRunStatus(state,{entryId:entry.id,eventId:event.id,status:'checked_in'},time);
  setRunningOrder(state,{trialId,eventId:event.id,entryIds:order.map(entry=>entry.id)},date+'T18:05:00Z');
  for(const entry of order){
   if(state.scores.some(score=>score.entryId===entry.id&&score.eventId===event.id))continue;
   const line=entry.selections.find(line=>line.eventId===event.id),common={entryId:entry.id,eventId:event.id,judgeConfirmed:true,elapsedSeconds:70};
   recordScore(state,event.format==='Working'?{...common,results:line.exercises.map(exercise=>({id:exercise.id,outcome:'Pass'}))}:{...common,outcome:'Q',score:190},date+'T19:00:00Z');
  }
  if(event.id==='rp-test-01'){
   const cedar=state.entries.find(entry=>entry.dog.caroId==='TEST-DOG-2');
   recordScore(state,{entryId:cedar.id,eventId:event.id,judgeConfirmed:true,elapsedSeconds:65,outcome:'Q',score:191,reason:'Fictional transcription correction checked against test judge record'},date+'T19:05:00Z');
  }
  completeEvent(state,{trialId,eventId:event.id,signoff:'Fictional signed test judge record for round '+event.round},date+'T20:00:00Z');
 }
 steps.push('Check in remaining unjudged runs, preserve the existing sample result, save orders, transcribe judge-provided results and append one correction before signing all six events.');
 recordTrialAdmin(state,{trialId,noIncidentsConfirmed:true,paperworkSentDate:'2027-04-20',dataEntryConfirmationDate:'2027-04-22'},'2027-04-22T18:00:00Z');
 steps.push('Record fictional paperwork/confirmation dates. Nothing is submitted to CARO.');
 const summary=trialSummary(state,trialId),backup=createBackup(state,'2027-04-22T18:01:00Z'),recovered=readBackup(JSON.parse(JSON.stringify(backup)));
 steps.push('Verify a complete backup round trip, retaining original scores, corrections, money and journal records.');
 return {...data,summary,backup,recovered,steps};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
 const data=await trialRehearsal(),directory=resolve(import.meta.dirname,'../output/trial-rehearsal');await mkdir(directory,{recursive:true});
 for(const [file,value] of [['records.json',data.state],['recovery-backup.json',data.backup],['reconciliation.json',data.summary],['steps.json',data.steps]])await writeFile(resolve(directory,file),JSON.stringify(value,null,2));
 for(const type of ['summary','journal','running','judges','finance','catalogue','waitlist','withdrawals','runs'])await writeFile(resolve(directory,type+'.html'),workingReport(data.state,data.trialId,type));
 await writeFile(resolve(directory,'run-register.csv'),csv(runRegisterCsvRows(runRegister(data.state,data.trialId))));
 console.log('Completed fictional rehearsal in '+directory+'. Practice/live records were not changed. No external actions occurred.');
}
