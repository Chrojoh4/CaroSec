import {mountEntryForm} from '../web/entry-form.js';
import {draftEntryPreview,unsavedEntryPreview} from '../src/domain/entry-preview.js';
import {money} from '../src/domain/premium.js';
import {timezoneLabel} from '../src/domain/date-time.js';
export function mountEntryPreview({client,container,navigate,action,message}){
 let generation=0;
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 function clear(){generation++;container.hidden=true;container.replaceChildren();}
 async function open(trial,{downloadPaper=false,draftRows=null,premiumContent=null}={}){
  clear();const ticket=generation;container.hidden=false;container.append(el('h2','Entry form preview'),el('p','Secretary review only. All entry controls are disabled. Nothing can be submitted or looked up from this preview.'));
  let config=draftRows?unsavedEntryPreview(trial,premiumContent||{},draftRows):null;if(draftRows)container.append(el('p','UNSAVED PROOF — current streams and fee selections. Nothing has been saved or published. Return to the controls above to make corrections.'));
  if(!config&&trial.application_state==='finalized'){const result=await client.rpc('caro_manual_entry_configuration',{p_trial:trial.id});if(ticket!==generation)return;if(!result.error&&result.data?.id===trial.id)config=result.data;}
  if(!config){const {data,error}=await client.from('caro_premium_drafts').select('content').eq('trial_id',trial.id).maybeSingle();if(ticket!==generation)return;if(error)throw new Error('Saved premium details could not be loaded for the preview.');const content=data?.content||{};const offering=await client.from('caro_draft_offerings').select('rows,fees_snapshot').eq('trial_id',trial.id).maybeSingle();if(ticket!==generation)return;config=draftEntryPreview(trial,content,offering.error?null:offering.data);
   container.append(el('p','DRAFT LAYOUT — saved trial and premium information. Trial default prices and round exceptions are shown for proofing. Review FEO switches, charging units and any missing prices in Classes, streams and fees before opening entries.'));
   if(content.fees?.length){container.append(el('h3','Saved premium fee amounts'));for(const fee of content.fees)container.append(el('p',fee.label+' · '+money(fee.cents)+' · '+fee.unit));}
  }else if(!draftRows)container.append(el('p','Configured form using the saved entry terms. If entries already exist, their frozen terms are used. This is still a private, non-submitting preview.'));
  container.append(el('h3',trial.title),el('p',config.host+' · '+config.venue+' · '+config.address),el('p','Entries: '+(config.opens||'Opening date not entered')+' to '+(config.closes||'Closing date not entered')+' · '+timezoneLabel(config.timezone)));
  const controls=el('div');controls.className='actions';for(const [section,label] of [['premium','Edit premium wording and fees'],['entry-settings','Review pricing and capacity']]){const b=el('button',label);b.className='secondary';b.addEventListener('click',()=>navigate(section));controls.append(b);}container.append(controls);
  async function download(){
   const {data:session,error}=await client.auth.getSession();if(error||!session?.session?.access_token)throw new Error('Sign in again before downloading the PDF proof.');
   const response=await fetch('/api/entry-proof',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.session.access_token},body:JSON.stringify({trialId:trial.id,...(draftRows?{draftRows}:{})})});
   if(ticket!==generation)return;if(!response.ok){const problem=await response.json();throw new Error(problem.error||'The PDF proof could not be downloaded.');}
   const blob=await response.blob();if(ticket!==generation)return;const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='CARO-PRIVATE-entry-proof.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);message('Fillable PRIVATE PDF proof downloaded. Test locally; do not submit it as an entry.');
  }
  const paper=el('button','Download fillable paper / email entry PDF — PRIVATE PROOF');paper.className='secondary';paper.addEventListener('click',()=>action(download));container.append(paper);
  const root=el('div');root.className='hosted-intake readonly-entry-preview';container.append(root);mountEntryForm(root,config,{readOnly:true});if(downloadPaper)await download();
 }
 return {open,clear,canLeave:()=>true};
}
