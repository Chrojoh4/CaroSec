import {entryAgreementError} from './entry-agreement-review.js';
import {uniqueFee} from '../src/domain/fee-defaults.js';
import {draftEntryPreview} from '../src/domain/entry-preview.js';
import {mountDraftOfferings} from './draft-offerings.js';
export function mountEntrySettings({client,container,action,message,navigate}){
 let generation=0,dirty=false;
 const draftEditor=mountDraftOfferings({client,container,action,message,navigate});
 const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
 function go(section,label){if(!navigate)return;const button=el('button',label);button.type='button';button.className='secondary';button.addEventListener('click',()=>navigate(section));container.append(button);}
 function clear(){draftEditor.clear();generation++;dirty=false;container.hidden=true;container.replaceChildren();}
 async function open(trial){
  clear();const ticket=generation;container.hidden=false;container.append(el('h2','Entry pricing and capacity'),el('p','Map every finalized round to a saved premium fee. This private setup does not publish a premium or open entry forms. Prices lock after the first hosted entry.'));
  if(trial.application_state!=='finalized'){await draftEditor.open(trial);return;}
  const results=await Promise.all([
   client.from('caro_entry_settings').select('revision,premium_draft_revision,pricing,agreement_version').eq('trial_id',trial.id).maybeSingle(),
   client.from('caro_premium_drafts').select('revision,content').eq('trial_id',trial.id).maybeSingle(),
   client.from('caro_events').select('id,local_key,official_round,local_date,format,level,judge_name').eq('trial_id',trial.id).order('official_round'),
   client.from('caro_draft_offerings').select('rows,fees_snapshot').eq('trial_id',trial.id).maybeSingle()
  ]);
  if(ticket!==generation)return;const failed=results.slice(0,3).find(result=>result.error);if(failed)throw new Error(failed.error.message);
  const [settings,draft,events,offerings]=results.map(result=>result.data);
  if(!draft||!draft.content.fees?.length){container.append(el('p','Save premium fees, opening/closing dates and the host agreement first.'));go('premium','Complete premium dates, fees and agreement');return;}
  const prepared=draftEntryPreview(trial,draft.content,offerings);
  const stale=settings&&settings.premium_draft_revision!==draft.revision;
  if(stale)container.append(el('p','The premium has changed since this setup. Review and select every price again before saving.'));
  container.append(el('p','Entry dates from the premium: '+(draft.content.opens||'Not set')+' to '+(draft.content.closes||'Not set')),el('h3','Host agreement to review'),el('p',draft.content.waiver||'No agreement saved.'));
  if(!draft.content.waiver?.trim()){container.append(el('p','The actual host agreement wording is missing. Save it in Premium builder under Host\u2019s waiver, then return here. Giving the agreement a name does not supply its wording.'));go('premium','Add host agreement wording in Premium builder');}
  const form=el('form'),rows=[];
  for(const event of events){
   const suggested=prepared.events.find(row=>row.id===event.local_key&&!row.previewMissingFee);const previous=stale?null:(settings?.pricing.find(row=>row.event_id===event.id)||suggested),box=el('fieldset');box.append(el('legend','Round '+event.official_round+' · '+event.local_date+' · '+event.level+' '+event.format),el('p','Judge: '+event.judge_name));
   function selectFee(text,saved,optional){const label=el('label',text),select=el('select'),blank=el('option',optional?'FEO not offered':'Select a saved premium fee');blank.value='';select.append(blank);select.required=!optional;
    draft.content.fees.forEach((fee,index)=>{const option=el('option',fee.label+' · CAD '+(fee.cents/100).toFixed(2)+' · '+fee.unit);option.value=String(index);select.append(option);});
    if(saved){const index=draft.content.fees.findIndex(fee=>fee.cents===saved.cents&&fee.label===saved.label&&fee.unit===saved.unit);if(index>=0)select.value=String(index);}
    label.append(select);box.append(label);return select;
   }
   const fee=selectFee('Regular price',previous?.fee,false),feo=selectFee('FEO price',previous?.feoFee||uniqueFee(draft.content.fees,'feo'),true);
   const feoLabel=el('label','Offer FEO for this round'),feoEnabled=el('input');feoEnabled.type='checkbox';feoEnabled.checked=!!previous?.feoFee;feoLabel.className='stream-choice';feoLabel.prepend(feoEnabled);box.insertBefore(feoLabel,feo.parentElement);
   const showFeo=()=>{feo.parentElement.hidden=!feoEnabled.checked;feo.required=feoEnabled.checked;};showFeo();feoEnabled.addEventListener('change',showFeo);

   const basisLabel=el('label','How the selected fee is charged'),basis=el('select');
   for(const [value,text] of event.format==='Working'?[['exercise','Per selected Working exercise']]:[['','Select the fee basis'],['entry','Per event entry / participant group'],['dog','Per participating dog']]){const option=el('option',text);option.value=value;basis.append(option);}
   basis.required=true;if(previous)basis.value=previous.basis;basisLabel.append(basis);box.append(basisLabel);
   const capacityLabel=el('label','Maximum accepted entry orders in this event'),capacity=el('input');capacity.type='number';capacity.min='1';capacity.max='1000';capacity.step='1';capacity.required=true;capacity.value=String(previous?.capacity||50);capacityLabel.append(capacity);box.append(capacityLabel);
   rows.push({event,fee,feo,feoEnabled,basis,capacity});form.append(box);
  }
  const agreementLabel=el('label','Reviewed agreement name / version'),agreement=el('input');agreement.required=true;agreement.maxLength=200;agreement.value=settings?.agreement_version||'';agreement.placeholder='Example: '+trial.title.slice(0,120)+' — Entry Agreement v1';agreement.setAttribute('aria-describedby','agreement-reference-help');agreementLabel.append(agreement);const agreementHelp=el('p','Give the waiver / entry agreement you reviewed a recognizable name and version, such as your trial name + Entry Agreement v1. This identifies the wording in the premium; if the wording changes, use v2.');agreementHelp.id='agreement-reference-help';form.append(agreementLabel,agreementHelp);
  const confirmLabel=el('label'),confirmed=el('input');confirmed.type='checkbox';confirmed.required=true;confirmLabel.className='review-check';confirmLabel.append(confirmed,document.createTextNode(' I reviewed the agreement, each fee basis, FEO availability and event capacities.'));form.append(confirmLabel);
  const save=el('button','Save private entry setup');save.type='submit';form.append(save);form.addEventListener('input',()=>{dirty=true;});form.addEventListener('change',()=>{dirty=true;});
  form.addEventListener('submit',event=>{event.preventDefault();action(async()=>{
   const agreementError=entryAgreementError({wording:draft.content.waiver,reference:agreement.value,confirmed:confirmed.checked});if(agreementError)throw new Error(agreementError);
   const pricing=rows.map(row=>({event_id:row.event.id,fee_index:Number(row.fee.value),feo_index:!row.feoEnabled.checked||row.feo.value===''?null:Number(row.feo.value),basis:row.basis.value,capacity:Number(row.capacity.value)}));
   const inputs=[...form.querySelectorAll('input,select')];inputs.forEach(input=>input.disabled=true);
   let result;try{result=await client.rpc('caro_save_entry_settings',{p_trial:trial.id,p_revision:settings?.revision??-1,p_premium_revision:draft.revision,p_pricing:pricing,p_agreement:agreement.value.trim(),p_confirmed:confirmed.checked});}finally{inputs.forEach(input=>input.disabled=false);}
   if(ticket!==generation)return;if(result.error)throw new Error(result.error.message==='Review the host agreement and confirm pricing'?'The saved premium needs host agreement wording, an agreement name/version, and the review checkbox. Open Premium builder, save Host\u2019s waiver, then reopen this page and review again.':result.error.message);dirty=false;await open(trial);message('Private event prices and capacities saved. Online entries remain closed.');
  });});
  container.append(form);container.scrollIntoView({behavior:'smooth'});
 }
 return {open,clear,getDraftProof:()=>draftEditor.getDraftProof(),canLeave(){return draftEditor.canLeave()&&(!dirty||confirm('Leave entry setup without saving?'));}};
}
