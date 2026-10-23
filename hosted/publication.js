import {publicPremiumHtml} from '../src/domain/public-premium.js';

export function publicationControls({client,trial,action,message,isCurrent,isDirty}){
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const box=el('section'),preview=el('div'),links=el('div'),reviewLabel=el('label','I reviewed these exact public terms, officials, fees and host agreement.'),review=el('input');review.type='checkbox';reviewLabel.prepend(review);
 const label=el('label','Public link name (lowercase letters, digits and hyphens)'),slug=el('input');slug.value=trial.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,65);slug.maxLength=80;slug.pattern='[a-z0-9][a-z0-9-]{2,79}';label.append(slug);
 let source=null,pending=null;
 const refresh=el('button','Review public premium'),publish=el('button','Publish reviewed premium'),close=el('button','Close public listing');for(const button of [refresh,publish,close])button.type='button';publish.disabled=true;close.className='secondary';
 box.append(el('h3','Public premium and paper entry form'),el('p','CARO approval and reviewed entry pricing are required. Once an entry arrives, its terms remain frozen. Online intake is not enabled in this release.'),label,refresh,reviewLabel,publish,close,links,preview);
 slug.addEventListener('input',()=>{review.checked=false;pending=null;});
 refresh.addEventListener('click',()=>action(async()=>{
  if(isDirty())throw new Error('Save the premium draft before reviewing publication.');
  const {data,error}=await client.rpc('caro_publication_preview',{p_trial:trial.id});if(!isCurrent())return;if(error)throw new Error(error.message);
  source=data;review.checked=false;publish.disabled=false;pending=null;
  preview.innerHTML=publicPremiumHtml({kind:'public_entry_edition',publicationReady:true,configuration:data.configuration,content:data.content,judgeAmendments:data.judgeAmendments,version:'for review'});
  message(data.usesFrozenTerms?'Reviewing the frozen terms already used for received entries.':'Reviewing the saved application, premium and entry pricing.');
 }));
 publish.addEventListener('click',()=>action(async()=>{
  if(isDirty()||!source||!review.checked||!slug.reportValidity())throw new Error('Save changes, review the public premium and confirm its terms first.');
  const payload={p_trial:trial.id,p_review_token:source.reviewToken,p_slug:slug.value,p_reviewed:true,p_online:false},signature=JSON.stringify(payload);
  if(pending?.signature!==signature)pending={signature,key:crypto.randomUUID()};
  const {data,error}=await client.rpc('caro_publish_premium',{...payload,p_request:pending.key});if(!isCurrent())return;if(error)throw new Error(error.message);
  const link=el('a','Open published premium and paper entry download');link.href='/public-trial.html?trial='+encodeURIComponent(data.slug);link.target='_blank';link.rel='noopener';links.replaceChildren(link);message('Premium edition '+data.version+' published. Online entries remain disabled.');
 }));
 close.addEventListener('click',()=>action(async()=>{
  const {error}=await client.rpc('caro_close_public_trial',{p_trial:trial.id});if(!isCurrent())return;if(error)throw new Error(error.message);links.replaceChildren();message('The public trial listing is closed. Received entries and their terms are preserved.');
 }));
 return box;
}
