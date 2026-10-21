import {runningOrder,DeskError} from './secretary.js';
export function judgePacket(state,trialId,eventId=null){
 const trial=state.trials[trialId];if(!trial)throw new DeskError('Trial not found.',404);
 const events=eventId?trial.events.filter(event=>event.id===eventId):trial.events;
 if(!events.length)throw new DeskError('Event not found.',404);
 return {title:trial.title,host:trial.host,trialNumber:trial.trialNumber||'',fictional:trial.fictional,timezone:trial.timezone,
  events:events.map(event=>({id:event.id,round:event.round,date:event.dayId,format:event.format,level:event.level,judge:event.judge,complete:!!state.finalizedEvents[`${trialId}:${event.id}`],
   runs:runningOrder(state,trialId,event.id).map((entry,index)=>{const line=entry.selections.find(item=>item.eventId===event.id);
    return {run:index+1,entryId:entry.id,handler:entry.contact.name,stream:line.stream,feo:line.feo,
     dogs:[{...entry.dog,handler:entry.contact.name},...(['Team','Brace'].includes(event.format)?[{...entry.partner.dog,handler:entry.partner.handler}]:[])].map(dog=>({name:dog.name,caroId:dog.caroId,breed:dog.breed,handler:dog.handler,jumpHeight:dog.jumpHeight,height:dog.height,veteran:dog.veteran})),
     exercises:line.exercises.map(selection=>({name:event.exercises.find(item=>item.id===selection.id)?.name||selection.id,level:selection.level})),
     accommodation:entry.accommodationDecisions?.[event.id]?.decision==='approved'?'Approved accommodation recorded separately':'No approved accommodation recorded'};
   })}))};
}
