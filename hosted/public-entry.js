import {mountEntryForm,api} from '../web/entry-form.js';
import {money} from '../src/domain/premium.js';
import {timestampLabel} from '../src/domain/date-time.js';
const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};

export async function showReceipt(root,secret){
 const value=await api('/api/entry-receipt',{receiptSecret:secret});
 root.replaceChildren();root.append(el('h1','Entry received for secretary review'),el('p',value.trialTitle),el('p','Entry reference: '+value.entryId),el('p','Received '+timestampLabel(value.receivedAt,value.timezone)),el('p','Dog: '+value.dogName),el('p','Agreement reference: '+value.agreementVersion),el('p','Quoted fees '+money(value.quoteCents)+' · '+value.status),el('p','This receipt records submission. The secretary reviews acceptance and records payments separately. Keep this private receipt link for status checks.'));
 const list=el('ul');for(const run of value.runs||[])list.append(el('li','Round '+run.round+' · '+run.date+' · '+run.level+' '+run.format+' · '+run.status+(run.feo?' · FEO':'')));root.append(list);for(const [key,label] of [['waiver','Agreed host terms'],['payment','Payment instructions'],['refunds','Refund policy'],['confirmations','Confirmation instructions']]){if(value.agreement?.[key]){const text=el('p',value.agreement[key]);text.className='preserve-lines';root.append(el('h2',label),text);}}
 const refresh=el('button','Refresh receipt status'),print=el('button','Print / save receipt');refresh.type=print.type='button';refresh.addEventListener('click',async()=>{refresh.disabled=true;try{await showReceipt(root,secret);}catch(error){root.append(el('p',error.message));refresh.disabled=false;}});print.addEventListener('click',()=>window.print());root.append(refresh,print);
}
export function mountPublicEntry(root,published){
 const form=el('div'),linkBox=el('div');form.className='hosted-intake';root.append(el('h2','Online trial entry'),el('p','Submit once. Save the private receipt link shown when you submit. The secretary confirms acceptance and payment separately.'),linkBox,form);
 const secret=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');let dirty=false,pending=false;
 mountEntryForm(form,published.configuration,{lookupResults:null,onSubmitted:async input=>{
  pending=true;
  const url=new URL(location.href);url.hash='receipt='+secret;
  const link=el('a','Save this private receipt link');link.href=url.href;linkBox.replaceChildren(link);
  // The fragment is not included in HTTP requests or referrer headers.
  history.replaceState(null,'',url);
  try{
   await api('/api/online-entry',{slug:published.slug,input,receiptSecret:secret});dirty=false;
   document.getElementById('premium').replaceChildren();document.getElementById('controls').hidden=true;
   await showReceipt(root,secret);
  }finally{pending=false;}
 }});
 form.addEventListener('input',()=>{dirty=true;});form.addEventListener('change',()=>{dirty=true;});
 window.addEventListener('beforeunload',event=>{if(dirty||pending){event.preventDefault();event.returnValue='';}});
}
