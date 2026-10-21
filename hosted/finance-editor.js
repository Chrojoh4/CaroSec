import {timestampLabel,receivedInstant} from '../src/domain/date-time.js';
const money=cents=>Number.isSafeInteger(cents)?new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(cents/100):'Amount needs review';
export function mountFinanceEditor({client,container,action,message}){
 let generation=0,dirty=false;
 const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
 function clear(){generation++;dirty=false;container.hidden=true;container.replaceChildren();}
 async function open(trial,selectedEntryId=null){
  clear();const ticket=generation;container.hidden=false;container.append(el('h2','Payments and adjustments'),el('p','Record money already received, refunds already made, or an authorized fee waiver. This screen does not transfer money.'));
  const {data:entries,error}=await client.from('caro_entries').select('id,status,intake_channel,created_at').eq('trial_id',trial.id).order('created_at',{ascending:false}).order('id').limit(100);
  if(ticket!==generation)return;if(error)throw new Error(error.message);
  if(selectedEntryId&&!entries.some(entry=>entry.id===selectedEntryId)){
   const {data:chosen,error:chosenError}=await client.from('caro_entries').select('id,status,intake_channel,created_at').eq('id',selectedEntryId).eq('trial_id',trial.id).maybeSingle();
   if(ticket!==generation)return;if(chosenError||!chosen)throw new Error('Selected entry access could not be verified.');entries.unshift(chosen);
  }
  if(!entries?.length){container.append(el('p','No hosted entries have been received for this trial yet.'));return;}
  container.append(el('p','Showing the newest '+entries.length+' entries (newest 100 plus any selected reference). References identify the exact entry; no balance is inferred from a partial history.'));
  const label=el('label','Entry reference'),select=el('select'),panel=el('div');label.append(select);
  for(const entry of entries){const option=el('option',entry.id+' · '+entry.status+' · '+entry.intake_channel);option.value=entry.id;select.append(option);}
  if(selectedEntryId)select.value=selectedEntryId;
  container.append(label,panel);let entryGeneration=0,displayedId=select.value;
  async function selected(){
   const selectedTicket=++entryGeneration,id=select.value;displayedId=id;panel.replaceChildren();dirty=false;
   const [{data:entry,error:entryError},{data:ledger,error:ledgerError},{data:totals,error:totalsError}]=await Promise.all([
    client.from('caro_entries').select('id,revision,status,amount_cents').eq('id',id).eq('trial_id',trial.id).maybeSingle(),
    client.from('caro_ledger').select('id,kind,cents,note,method,occurred_at,received_at,actor_id').eq('entry_id',id).eq('trial_id',trial.id).order('occurred_at',{ascending:false}).order('id').limit(101),
    client.rpc('caro_entry_finance_summary',{p_entry:id})
   ]);
   if(ticket!==generation||selectedTicket!==entryGeneration)return;
   if(entryError||ledgerError||totalsError||!entry)throw new Error(entryError?.message||ledgerError?.message||totalsError?.message||'Entry access could not be verified.');
   panel.append(el('h3','Entry '+id),el('p','Status: '+entry.status+' · Original entry quote: '+money(entry.amount_cents)));
   panel.append(el('p','All recorded charges '+money(totals.charges)+' · Payments '+money(totals.payments)+' · Refunds '+money(totals.refunds)+' · Waivers '+money(totals.waivers)),el('p',totals.balance<0?'Recorded credit: '+money(-totals.balance):'Recorded amount owing: '+money(totals.balance)));
   if(totals.revision!==entry.revision)panel.append(el('p','The entry changed during loading. Reopen before recording money.'));
   if(ledger.length>100)panel.append(el('p','Showing the newest 100 financial records. Earlier history remains stored.'));
   for(const row of ledger.slice(0,100)){
    const card=el('article');card.append(el('h4',row.kind+' · '+money(row.cents)),el('p',row.note),el('p','Recorded '+timestampLabel(row.occurred_at,trial.timezone)),el('p',row.received_at?'Received/effective '+timestampLabel(row.received_at,trial.timezone):'Original received/effective time was not recorded.'));panel.append(card);
   }
   const form=el('form'),kindLabel=el('label','Record type'),kind=el('select');for(const value of ['payment','refund','waiver']){const option=el('option',value);option.value=value;kind.append(option);}kindLabel.append(kind);form.append(kindLabel);
   function input(label,max){const wrap=el('label',label),node=el('input');node.maxLength=max;wrap.append(node);form.append(wrap);return node;}
   const amount=input('Amount in CAD (for example 25.00)',12);amount.inputMode='decimal';amount.required=true;amount.pattern='[0-9]+([.][0-9]{1,2})?';
   const method=input('Method or adjustment reference',60);method.required=true;
   const note=input('Payment or adjustment note',500);note.required=true;
   const received=input('Original received/effective timestamp (optional, with seconds and UTC offset)',35);received.placeholder='2026-10-20T10:30:00-07:00';
   const save=el('button','Record manual transaction');save.type='submit';form.append(save);let request=crypto.randomUUID(),pending=null;
   form.addEventListener('input',()=>{dirty=true;});
   form.addEventListener('submit',event=>{event.preventDefault();action(async()=>{
    if(!pending){
     if(!/^\d+(\.\d{1,2})?$/.test(amount.value))throw new Error('Enter a positive CAD amount with at most two decimal places.');
     const [whole,fraction='']=amount.value.split('.'),cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
     if(!Number.isSafeInteger(cents)||cents<1||cents>2147483647)throw new Error('Check the amount.');
     pending={p_entry:id,p_revision:entry.revision,p_request:request,p_kind:kind.value,p_cents:cents,p_method:method.value.trim(),p_note:note.value.trim(),p_received:receivedInstant(received.value,new Date().toISOString())};
    }
    const controls=[...form.querySelectorAll('input,select')];controls.forEach(node=>node.disabled=true);select.disabled=true;
    const {error}=await client.rpc('caro_record_finance',pending);
    if(ticket!==generation||selectedTicket!==entryGeneration)return;
    if(error){save.textContent='Retry the same transaction';throw new Error(error.code==='40001'?'Entry changed. Reopen this entry and review its ledger before recording another transaction.':'Transaction was not confirmed. Retry preserves the same request reference. '+error.message);}
    dirty=false;select.disabled=false;await selected();message('Manual financial record saved with staff identity and audit history.');
   });});
   panel.append(form);
  }
  select.addEventListener('change',()=>{if(dirty&&!confirm('Leave the unfinished financial record?')){select.value=displayedId;return;}action(selected);});await selected();if(ticket===generation)container.scrollIntoView({behavior:'smooth'});
 }
 return {open,clear,canLeave(){return !dirty||confirm('Leave the unfinished financial record? Review the ledger before entering the transaction again.');}};
}
