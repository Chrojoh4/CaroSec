import {publicPremiumHtml} from '../src/domain/public-premium.js';

export function publicationControls({client,trial,action,message,isCurrent,isDirty}){
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const frozenNotice=el('p');frozenNotice.hidden=true;
 const box=el('section'),preview=el('div'),links=el('div'),reviewLabel=el('label','I reviewed these exact public terms, officials, fees and host agreement.'),review=el('input');review.type='checkbox';reviewLabel.prepend(review);
 const label=el('label','Public link name (lowercase letters, digits and hyphens)'),slug=el('input');slug.value=trial.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,65);slug.maxLength=80;slug.pattern='[a-z0-9][a-z0-9-]{2,79}';label.append(slug);
 let source=null,pending=null;
 const refresh=el('button','Review public premium'),publish=el('button','Publish reviewed premium'),close=el('button','Close public listing');for(const button of [refresh,publish,close])button.type='button';close.className='secondary';
 box.append(el('h3','Public premium and paper entry form'),el('p','CARO approval and reviewed entry pricing are required. Once an entry arrives, its terms remain frozen. Both paper and online entry links are included. Online entry follows the opening and closing dates in the trial time zone.'),label,refresh,reviewLabel,publish,close,links,frozenNotice,preview);
 slug.addEventListener('input',()=>{review.checked=false;pending=null;});
 async function loadReview(){
  source=null;review.checked=false;
  if(isDirty())throw new Error('Save premium draft first. Then return here to review and publish.');
  const {data,error}=await client.rpc('caro_publication_preview',{p_trial:trial.id});if(!isCurrent())return;
  if(error)throw new Error('Publication review: '+error.message);
  if(!data?.configuration||!data?.reviewToken)throw new Error('The publication review could not be loaded. Try Review public premium again.');
  const html=publicPremiumHtml({kind:'public_entry_edition',publicationReady:true,configuration:data.configuration,content:data.content,judgeAmendments:data.judgeAmendments,version:'for review'});
  preview.innerHTML=html;source=data;pending=null;frozenNotice.hidden=!data.usesFrozenTerms;frozenNotice.textContent=data.usesFrozenTerms?'Received entries have frozen the original entry dates, prices and waiver. This review uses those original terms. Saving a private draft or republishing will not apply your new date or waiver to this edition. A reviewed amendment is needed.':'';
  if(data.usesFrozenTerms){message(frozenNotice.textContent);return;}
  message('Review the public premium below, check the confirmation above Publish reviewed premium, then click Publish reviewed premium. Both entry links are included; online entry follows the saved opening and closing dates.');
 }
 refresh.addEventListener('click',()=>action(loadReview));
 publish.addEventListener('click',()=>action(async()=>{
  if(isDirty())throw new Error('Save premium draft before publishing. Your latest wording has not been saved.');
  if(!source){await loadReview();return;}
  if(!review.checked)throw new Error('Check I reviewed these exact public terms, officials, fees and host agreement, then click Publish reviewed premium.');
  if(!slug.reportValidity())throw new Error('Choose a public link name using 3–80 lowercase letters, digits and hyphens.');
  const payload={p_trial:trial.id,p_review_token:source.reviewToken,p_slug:slug.value,p_reviewed:true,p_online:true},signature=JSON.stringify(payload);
  if(pending?.signature!==signature)pending={signature,key:crypto.randomUUID()};
  const {data,error}=await client.rpc('caro_publish_premium',{...payload,p_request:pending.key});if(!isCurrent())return;if(error)throw new Error(/Online intake is not enabled/.test(error.message)?'The scheduled online entry database update must be applied before publishing. Run enable-scheduled-online-entries.sql for CARO, then retry.':error.message);
  const link=el('a','Open published premium and paper entry download');link.href='/public-trial.html?trial='+encodeURIComponent(data.slug);link.target='_blank';link.rel='noopener';links.replaceChildren(link);message('Premium edition '+data.version+' published with paper and scheduled online entry links.');
 }));
 close.addEventListener('click',()=>action(async()=>{
  const {error}=await client.rpc('caro_close_public_trial',{p_trial:trial.id});if(!isCurrent())return;if(error)throw new Error(error.message);links.replaceChildren();message('The public trial listing is closed. Received entries and their terms are preserved.');
 }));
 box.invalidateReview=()=>{source=null;pending=null;review.checked=false;preview.innerHTML='';frozenNotice.hidden=true;};
 return box;
}
