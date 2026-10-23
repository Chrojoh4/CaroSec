import {timezoneLabel} from '../src/domain/date-time.js';
import {publicationControls} from './publication.js';
import {hostedPremium,premiumTextFields} from '../src/domain/hosted-premium.js';
import {renderPremium} from '../src/domain/premium.js';
import premiumStyle from './premium.css';
const labels={opens:'Entries open',closes:'Entries close',capacity:'Entry limit wording',intro:'Welcome introduction',timing:'Trial day schedule',dayOf:'Day-of entry policy',orderNote:'Running-order information',payment:'Payment instructions',confirmations:'Entry confirmations',facilities:'Venue facilities',accommodations:'Accessibility and accommodations',awards:'Awards',moveups:'Move-up policy',refunds:'Withdrawal and refund policy',siteRules:'Site rules',waiver:'Reviewed host agreement'};
export function mountPremiumEditor({client,container,action,message,navigate}){
 let revision=-1,trial=null,dirty=false,generation=0;
 const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
 function clear(){generation++;container.hidden=true;container.replaceChildren();trial=null;dirty=false;}
 async function open(value){
  if(dirty&&!confirm('Leave the current premium without saving your changes?'))return;
  const ticket=++generation;
  const {data,error}=await client.from('caro_premium_drafts').select('content,revision').eq('trial_id',value.id).maybeSingle();
  if(ticket!==generation)return;
  if(error)throw new Error('Premium drafts need the premium database setup SQL and trial access.');
  trial=structuredClone(value);revision=data?.revision??-1;dirty=false;const content=data?.content||{};container.hidden=false;container.replaceChildren();container.append(el('h2','Premium builder'),el('p','Private draft. Trial identity, officials, dates and events come from the saved application. Saving or downloading does not publish entries or record CARO approval.'));
  const amendments=await client.from('caro_judge_amendments').select('event_id,version,officiating_judge,results_judge,public_notice').eq('trial_id',trial.id).order('version',{ascending:false});
  if(ticket!==generation)return;
  if(amendments.error)container.append(el('p','Judge replacement history is unavailable. Confirm database setup before issuing revised materials.'));
  else if(amendments.data.length){const notice=el('article');notice.append(el('h3','Recorded judge replacements'),el('p','The original trial source and frozen editions remain unchanged. The public premium displays these amendments alongside the original edition.'));
   for(const a of amendments.data)notice.append(el('p','Amendment '+a.version+': '+a.public_notice+' · Attending: '+a.officiating_judge+' · Results credit: '+a.results_judge));
   container.append(notice);if(navigate){const manage=el('button','Review judge replacements and notify entrants');manage.type='button';manage.className='secondary';manage.addEventListener('click',()=>navigate('judge-amendments'));container.append(manage);}}
  const source=hostedPremium(trial,content),details=el('article');details.append(el('h3','Information from your saved trial'));
  for(const [label,value] of [['Host',source.host],['Dates',source.date+' to '+source.endDate],['Time zone',timezoneLabel(source.timezone)],['Venue',source.venue],['Address',source.address],['Secretary',source.secretary],['Contact email',source.email],['Chairperson',source.chair]])details.append(el('p',label+': '+(value||'Not entered in trial details')));
  details.append(el('h4','Scheduled rounds'));
  for(const event of source.events)details.append(el('p','Round '+event.round+' · '+Object.entries(event).filter(([key,value])=>key!=='id'&&key!=='round'&&typeof value==='string'&&value).map(([,value])=>value).join(' · ')));
  if(!source.events.length)details.append(el('p','No rounds saved. Add rounds in trial details before preparing entry pricing.'));
  if(navigate){const edit=el('button','Edit trial details and rounds');edit.type='button';edit.className='secondary';edit.addEventListener('click',()=>navigate('application'));details.append(edit);}
  container.append(details,el('h3','Premium wording and entry policies'),el('p','The information above is already included in the preview. Complete the entry dates, fees and host policies below; these require your decisions and are not inferred from competition rules.'));
  const {data:listing,error:listingError}=await client.from('caro_public_trials').select('slug,online_enabled').eq('trial_id',trial.id).eq('is_live',true).maybeSingle();
  if(ticket!==generation)return;
  if(listingError)container.append(el('p','Current published entry links could not be verified. Refresh before distributing this premium.'));
  function linkedPremium(content){const draft=hostedPremium(trial,content);if(listing&&!listingError){draft.entryPdfUrl=location.origin+'/api/entry-form?trial='+encodeURIComponent(listing.slug);if(listing.online_enabled)draft.entryUrl=location.origin+'/public-trial.html?trial='+encodeURIComponent(listing.slug);}return draft;}
  if(navigate){const reviewEntry=el('button','Preview entry form (read-only)');reviewEntry.type='button';reviewEntry.className='secondary';reviewEntry.addEventListener('click',()=>navigate('entry-preview'));container.append(reviewEntry);}
  const form=el('form'),preview=el('div'),fees=el('div');fees.id='premium-fees';
  for(const key of premiumTextFields){const label=el('label',labels[key]||'Colour palette');let input;if(key==='theme'){input=el('select');for(const name of ['forest','ocean','berry']){const option=el('option',name);option.value=name;input.append(option);}}else input=el(['opens','closes'].includes(key)?'input':'textarea');input.name=key;if(['opens','closes'].includes(key))input.type='date';input.value=content[key]||(key==='theme'?'forest':'');input.maxLength=10000;label.append(input);form.append(label);}
  form.append(el('h3','Fees in Canadian dollars'),el('p','State the unit explicitly: per dog, per event entry/group, or per selected Working exercise.'),fees);
  function feeRow(fee={label:'',unit:'per dog / event',cents:0}){const row=el('div');row.className='premium-fee-row';for(const [name,text,value] of [['label','Fee description',fee.label],['amount','Amount CAD',(fee.cents/100).toFixed(2)],['unit','Fee unit',fee.unit]]){const label=el('label',text),input=el('input');input.name=name;input.value=value;if(name==='amount'){input.type='number';input.min='0';input.step='.01';}input.required=true;label.append(input);row.append(label);}const remove=el('button','Remove fee');remove.type='button';remove.className='secondary';remove.addEventListener('click',()=>{row.remove();dirty=true;render();});row.append(remove);fees.append(row);}
  for(const fee of content.fees||[])feeRow(fee);
  const add=el('button','Add fee');add.type='button';add.className='secondary';add.addEventListener('click',()=>{if(fees.children.length>=50){message('At most 50 fee rows are supported.',true);return;}feeRow();dirty=true;render();});form.append(add);
  function snapshot(){const data=Object.fromEntries(premiumTextFields.map(key=>[key,form.elements.namedItem(key).value]));data.fees=[...fees.children].map(row=>({label:row.querySelector('[name=label]').value,unit:row.querySelector('[name=unit]').value,cents:Math.round(Number(row.querySelector('[name=amount]').value)*100)}));return data;}
  function render(){preview.innerHTML=renderPremium(linkedPremium(snapshot()),{secretaryPreview:true});}
  preview.addEventListener('click',event=>{const link=event.target.closest('a'),href=link?.getAttribute('href');if(!['#secretary-online-entry-preview','#secretary-paper-entry-preview'].includes(href))return;event.preventDefault();if(href==='#secretary-online-entry-preview'){navigate?.('entry-preview');return;}action(async()=>{
   if(dirty||revision<0)throw new Error('Save the premium draft before downloading its PDF proof.');
   const {data:session,error}=await client.auth.getSession();if(error||!session?.session?.access_token)throw new Error('Sign in again before downloading the private proof.');
   const response=await fetch('/api/entry-proof',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.session.access_token},body:JSON.stringify({trialId:trial.id})});
   if(ticket!==generation)return;if(!response.ok){const problem=await response.json();throw new Error(problem.error||'The private PDF proof could not be generated.');}
   const blob=await response.blob();if(ticket!==generation)return;const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='CARO-PRIVATE-entry-proof.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);message('Fillable private PDF proof downloaded. Test filling and saving locally; do not send it as an entry.');
  });});
  const save=el('button','Save premium draft');save.type='submit';const download=el('button','Download private premium HTML');download.type='button';download.className='secondary';download.addEventListener('click',()=>{const html=renderPremium(linkedPremium(snapshot()),{standalone:true}).replace('</head>',`<style>${premiumStyle}</style></head>`),url=URL.createObjectURL(new Blob([html],{type:'text/html'})),link=el('a');link.href=url;link.download='CARO-private-premium-draft.html';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  const close=el('button','Close premium builder');close.type='button';close.className='secondary';close.addEventListener('click',()=>{if(!dirty||confirm('Close without saving the current premium changes?'))clear();});const controls=el('div');controls.className='actions';controls.append(save,download,close);form.append(controls);
  form.addEventListener('input',()=>{dirty=true;render();});form.addEventListener('change',()=>{dirty=true;render();});
  form.addEventListener('submit',event=>{event.preventDefault();action(async()=>{const content=snapshot();if(content.fees.some(fee=>!Number.isSafeInteger(fee.cents)||fee.cents<0||fee.cents>999999999))throw new Error('Check the fee amounts.');const controls=[...form.querySelectorAll('input,textarea,select')];controls.forEach(input=>input.disabled=true);let result;try{result=await client.rpc('caro_save_premium_draft',{p_trial:trial.id,p_revision:revision,p_content:content});}finally{controls.forEach(input=>input.disabled=false);}if(ticket!==generation)return;if(result.error)throw new Error(result.error.code==='40001'?'Another premium change was saved. Keep a copy, then reopen before saving.':result.error.message);revision=result.data.revision;dirty=false;message('Private premium draft saved. It has not been published.');});});
  const copies=el('div'),copyControls=el('div');copyControls.append(el('h3','Frozen private review copies'),el('p','Save an immutable review copy of the saved trial and premium. This is not a published premium and cannot open entries.'));
  const versionLabel=el('label','Host agreement version / reference'),agreement=el('input');agreement.maxLength=200;versionLabel.append(agreement);copyControls.append(versionLabel);
  const noteLabel=el('label','Review note'),note=el('input');note.maxLength=1000;noteLabel.append(note);copyControls.append(noteLabel);
  let pendingCopy=null;
  async function loadCopies(){
   copies.replaceChildren();const {data,error}=await client.from('caro_premium_versions').select('id,version,snapshot,agreement_version,created_at').eq('trial_id',trial.id).order('version',{ascending:false});
   if(ticket!==generation)return;
   if(error){copies.append(el('p','Review copies could not be loaded.'));return;}
   for(const copy of data||[]){if(copy.snapshot?.kind!=='private_review_copy')continue;const card=el('article');card.append(el('h4','Private review copy '+copy.version),el('p','Agreement: '+copy.agreement_version));const download=el('button','Download this frozen review copy');download.type='button';download.className='secondary';download.addEventListener('click',()=>{const html=renderPremium(hostedPremium(copy.snapshot.trial,copy.snapshot.content),{standalone:true,version:copy.version}).replace('</head>',`<style>${premiumStyle}</style></head>`),url=URL.createObjectURL(new Blob([html],{type:'text/html'})),link=el('a');link.href=url;link.download=`CARO-private-review-copy-${copy.version}.html`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});card.append(download);copies.append(card);}
  }
  const saveCopy=el('button','Save frozen private review copy');saveCopy.type='button';saveCopy.className='secondary';saveCopy.addEventListener('click',()=>action(async()=>{
   if(dirty||revision<0)throw new Error('Save the premium draft before making a review copy.');
   if(!agreement.value.trim()||note.value.trim().length<5)throw new Error('Enter an agreement reference and a review note of at least five characters.');
   const payload={p_trial:trial.id,p_trial_revision:trial.revision,p_draft_revision:revision,p_agreement:agreement.value.trim(),p_reason:note.value.trim()},signature=JSON.stringify(payload);
   if(pendingCopy?.signature!==signature)pendingCopy={signature,key:crypto.randomUUID()};
   const {data,error}=await client.rpc('caro_save_premium_review_copy',{...payload,p_request:pendingCopy.key});if(ticket!==generation)return;if(error)throw new Error(error.code==='PGRST202'?'Review copies need the database update.':error.message);await loadCopies();message('Private review copy '+data.version+' saved. It has not been published.');
  }));copyControls.append(saveCopy,copies);
  container.append(form,copyControls,publicationControls({client,trial,action,message,isCurrent:()=>ticket===generation,isDirty:()=>dirty}),el('h3','Private premium preview'),preview);render();await loadCopies();container.scrollIntoView({behavior:'smooth'});
 }
 window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
 return {open,clear,canLeave(){return !dirty||confirm('Leave the premium without saving its latest changes?');}};
}
