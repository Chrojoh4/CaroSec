import {trialSummary} from '../../web/trial-summary.js';
import {runStatus} from './run-status.js';

export function trialReadiness(trial,state,{premium=null,settings=null,listing=null}={}){
 const summary=trialSummary(state,trial.id),tasks=[],entries=state.entries.filter(e=>e.trialId===trial.id);
 const add=(section,label,done)=>tasks.push({section,label,done});
 add('application','Review and lock trial details and rounds',trial.application_state==='finalized');
 if(!trial.is_practice)add('sanction','Record the actual CARO approval',trial.sanction_status==='approved');
 add('premium','Save premium wording and fees',premium!==null);
 add('entry-settings','Review event pricing and capacity',!!settings&&(entries.length>0||settings.premium_draft_revision===premium?.revision));
 if(!trial.is_practice)add('premium','Publish the reviewed premium and paper entry link',listing?.is_live===true);
 const pending=entries.reduce((n,e)=>n+e.selections.filter(line=>runStatus(e,line.eventId)==='submitted').length,0);
 if(entries.length)add('entries','Review all submitted runs',pending===0);
 if(entries.length)add('trial-day','Record results and sign off every offered round',summary.events.every(e=>e.complete));
 if(summary.events.length&&summary.events.every(e=>e.complete)){const paperwork=state.trialAdmin?.[trial.id]||{};add('reports','Review incidents and record post-trial paperwork sent',typeof paperwork.noIncidentsConfirmed==='boolean'&&!!paperwork.paperworkSentDate);add('reports','Record Data Entry confirmation after it arrives',!!paperwork.dataEntryConfirmationDate);}
 return {summary,tasks,pending,next:tasks.find(task=>!task.done)||null,practice:trial.is_practice===true};
}
