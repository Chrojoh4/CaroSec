import {mountEntryForm} from '../web/entry-form.js';
export function mountManualIntake({client,container,action,message,navigate}){
 let generation=0,dirty=false,pending=false;
 const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
 function clear(){generation++;dirty=false;pending=false;container.hidden=true;container.replaceChildren();}
 async function open(trial){
  clear();const ticket=generation;container.hidden=false;container.append(el('h2','Record a paper or email entry'),el('p','Enter the signed form received by the secretary. Submission records the entrant declaration for review; acceptance, fees charged and payment records are separate decisions.'));
  const {data:config,error}=await client.rpc('caro_manual_entry_configuration',{p_trial:trial.id});if(ticket!==generation)return;
  if(error){container.append(el('p',error.message),el('p','Entry intake needs locked rounds, premium dates and fees, mapped prices and capacities, and CARO approval for a real trial. Practice trials remain private.'));if(navigate)for(const [section,label] of [['application','Trial details and rounds'],['premium','Premium builder'],['entry-settings','Entry pricing and capacity'],['sanction','CARO approval record']]){const button=el('button',label);button.type='button';button.className='secondary';button.addEventListener('click',()=>navigate(section));container.append(button);}return;}
  container.append(el('p','Agreement and pricing are frozen with the first received hosted entry. Later private premium edits do not change those entry terms. Record the original receipt time when known; leave it blank if unknown.'));
  const root=el('div');root.className='hosted-intake';container.append(root);
  mountEntryForm(root,config,{manual:true,lookupResults:async dogId=>{
   const {data:session,error}=await client.auth.getSession();if(error||!session?.session?.access_token)throw new Error('Sign in again to use the optional lookup.');
   const response=await fetch('/api/dog-results',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.session.access_token},body:JSON.stringify({trialId:trial.id,dogId})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Public lookup is unavailable.');return result;
  },onSubmitted:async(input,channel)=>{
   pending=true;try{
    const result=await client.rpc('caro_record_manual_entry',{p_trial:trial.id,p_setup_revision:config.setupRevision,p_channel:channel,p_input:input});
    if(ticket!==generation)return;if(result.error)throw new Error(result.error.message+' Keep this entry reference and retry the same form if the response was interrupted.');
    dirty=false;root.replaceChildren();root.append(el('h3','Entry received for review'),el('p','Reference: '+result.data.entryId),el('p','Quoted CAD '+(result.data.quoteCents/100).toFixed(2)+' · '+result.data.status+' · '+result.data.channel),el('p','No acceptance, charge, payment or email was generated. Review the entry before the separate acceptance step.'));
    const another=el('button','Record another entry');another.className='secondary';another.addEventListener('click',()=>action(()=>open(trial)));root.append(another);message('Paper/email entry saved with original receipt provenance and staff audit.');
   }finally{pending=false;}
  }});
  root.addEventListener('input',()=>{dirty=true;});root.addEventListener('change',()=>{dirty=true;});container.scrollIntoView({behavior:'smooth'});
 }
 return {open,clear,canLeave(){if(pending){message('Wait for the entry response before switching trials.');return false;}return !dirty||confirm('Leave this unfinished entry? If you already submitted, review saved entries before starting another.');}};
}
