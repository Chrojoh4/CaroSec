import {mountEntryForm} from '../web/entry-form.js';
import {draftEntryPreview} from '../src/domain/entry-preview.js';
import {money} from '../src/domain/premium.js';
import {timezoneLabel} from '../src/domain/date-time.js';
export function mountEntryPreview({client,container,navigate}){
 let generation=0;
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 function clear(){generation++;container.hidden=true;container.replaceChildren();}
 async function open(trial){
  clear();const ticket=generation;container.hidden=false;container.append(el('h2','Entry form preview'),el('p','Secretary review only. All entry controls are disabled. Nothing can be submitted or looked up from this preview.'));
  let config=null;
  if(trial.application_state==='finalized'){const result=await client.rpc('caro_manual_entry_configuration',{p_trial:trial.id});if(ticket!==generation)return;if(!result.error&&result.data?.id===trial.id)config=result.data;}
  if(!config){const {data,error}=await client.from('caro_premium_drafts').select('content').eq('trial_id',trial.id).maybeSingle();if(ticket!==generation)return;if(error)throw new Error('Saved premium details could not be loaded for the preview.');const content=data?.content||{};config=draftEntryPreview(trial,content);
   container.append(el('p','DRAFT LAYOUT — saved trial and premium information. Round prices and FEO options are not inferred from premium fee labels. Complete and review entry setup for an exact configured preview.'));
   if(content.fees?.length){container.append(el('h3','Saved premium fees — not yet mapped in this preview'));for(const fee of content.fees)container.append(el('p',fee.label+' · '+money(fee.cents)+' · '+fee.unit));}
  }else container.append(el('p','Configured form using the saved entry terms. If entries already exist, their frozen terms are used. This is still a private, non-submitting preview.'));
  container.append(el('h3',trial.title),el('p',config.host+' · '+config.venue+' · '+config.address),el('p','Entries: '+(config.opens||'Opening date not entered')+' to '+(config.closes||'Closing date not entered')+' · '+timezoneLabel(config.timezone)));
  const controls=el('div');controls.className='actions';for(const [section,label] of [['premium','Edit premium wording and fees'],['entry-settings','Review pricing and capacity']]){const b=el('button',label);b.className='secondary';b.addEventListener('click',()=>navigate(section));controls.append(b);}container.append(controls);
  const root=el('div');root.className='hosted-intake readonly-entry-preview';container.append(root);mountEntryForm(root,config,{readOnly:true});
 }
 return {open,clear,canLeave:()=>true};
}
