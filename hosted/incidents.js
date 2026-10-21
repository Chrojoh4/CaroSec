import {receivedInstant,timestampLabel} from '../src/domain/date-time.js';
export function mountIncidentRegister({client,container,trial,action,message,initial,onSaved,isCurrent}){
 let dirty=false,pending=false,disposed=false,request=null;
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const root=el('section'),history=el('div'),form=el('form');root.append(el('h3','Private incident register'),el('p','Record factual observations for review and transfer to the current official incident form. History cannot be overwritten. Append a correction with the original reference when needed.'),history,form);container.append(root);
 const label=el('label','Incident category'),category=el('select');for(const name of ['Dog behaviour / aggression','Sportsmanship','Other']){const option=el('option',name);option.value=name;category.append(option);}label.append(category);form.append(label);
 const descriptionLabel=el('label','Factual description / correction reference'),description=el('textarea');description.required=true;description.minLength=5;description.maxLength=6000;descriptionLabel.append(description);form.append(descriptionLabel);
 const timeLabel=el('label','Actual incident time, if known (include UTC offset)'),time=el('input');time.placeholder='2026-10-20T10:30:00-06:00';time.maxLength=40;timeLabel.append(time);form.append(timeLabel,el('p','Leave actual time blank when unknown. The recording time and staff identity are saved separately.'));
 const save=el('button','Record incident');save.type='submit';form.append(save);
 function render(rows){history.replaceChildren();if(!rows?.length)history.append(el('p','No incident records saved. This does not itself confirm that no incidents occurred.'));for(const row of rows||[]){const card=el('article'),body=el('p',row.description);body.className='preserve-lines';card.append(el('h4',row.category),el('p','Reference: '+row.id),el('p','Recorded '+timestampLabel(row.recordedAt||row.occurredAt,trial.timezone)),el('p',row.occurredAt?'Actual time '+timestampLabel(row.occurredAt,trial.timezone):'Actual time not recorded.'),body);history.append(card);}}
 const beforeUnload=event=>{if(dirty||pending){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',beforeUnload);
 render(initial);form.addEventListener('input',()=>{dirty=true;});form.addEventListener('change',()=>{dirty=true;});
 form.addEventListener('submit',event=>{event.preventDefault();action(async()=>{
  const payload={p_trial:trial.id,p_category:category.value,p_description:description.value.trim(),p_occurred:time.value?receivedInstant(time.value,new Date().toISOString()):null},signature=JSON.stringify(payload);
  if(request?.signature!==signature)request={signature,key:crypto.randomUUID()};pending=true;
  try{const {error}=await client.rpc('caro_record_incident',{...payload,p_request:request.key});if(disposed||!isCurrent())return;if(error)throw new Error(error.message);dirty=false;request=null;description.value=time.value='';const rows=await onSaved();if(disposed||!isCurrent())return;render(rows);message('Incident saved. The no-incidents declaration is cleared and the paperwork revision was updated.');}finally{pending=false;}
 });});
 return {clear(){window.removeEventListener('beforeunload',beforeUnload);disposed=true;root.remove();},canLeave(){if(pending){message('Wait for the incident response before switching screens.');return false;}return !dirty||confirm('Leave the unfinished incident description?');}};
}
