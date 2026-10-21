import {timestampLabel} from '../src/domain/date-time.js';
const money=value=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(value/100);
const transitions={submitted:[['accepted','Accept run'],['waitlisted','Waitlist run'],['rejected','Reject run'],['withdrawn','Withdraw run']],waitlisted:[['accepted','Promote run'],['rejected','Reject run'],['withdrawn','Withdraw run']],accepted:[['checked_in','Check in'],['withdrawn','Withdraw run']],checked_in:[['withdrawn','Withdraw run']]};
export function mountEntries({client,container,action,message,onManual,onFinance}){
 let generation=0,inFlight=false,pending=null;
 const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
 function clear(){generation++;container.hidden=true;container.replaceChildren();pending=null;inFlight=false;}
 async function open(trial){
  clear();const ticket=generation;container.hidden=false;container.append(el('h2','Entries and waitlist'),el('p','Review declarations before accepting a run. Each round keeps its own status. Acceptance posts its saved fee once; withdrawal preserves the run, charge and payment history.'));
  const manual=el('button','Record a paper / email entry');manual.addEventListener('click',onManual);container.append(manual);
  const searchLabel=el('label','Search loaded entries'),search=el('input'),filterLabel=el('label','Show loaded entries'),filter=el('select');search.type='search';searchLabel.append(search);
  for(const [value,text] of [['all','All'],['submitted','With submitted runs'],['waitlisted','With waitlisted runs'],['accepted','With accepted/check-in runs']]){const option=el('option',text);option.value=value;filter.append(option);}filterLabel.append(filter);
  const count=el('p'),list=el('div'),more=el('button','Load older entries'),detail=el('section');more.className='secondary';container.append(searchLabel,filterLabel,count,list,more,detail);
  let rows=[],cursor=null,viewGeneration=0;
  function render(){
   list.replaceChildren();const term=search.value.trim().toLowerCase();
   const visible=rows.filter(entry=>{
    const text=[entry.id,entry.details?.contact?.name,entry.details?.dog?.name,entry.details?.dog?.caroId,entry.details?.partner?.dog?.caroId].join(' ').toLowerCase();
    const states=(entry.details?.selections||[]).map(line=>line.status||entry.status);
    return (!term||text.includes(term))&&(filter.value==='all'||states.some(status=>filter.value==='accepted'?['accepted','checked_in'].includes(status):status===filter.value));
   });
   count.textContent=visible.length+' shown from '+rows.length+' loaded entries. Load older entries to search more history.';
   for(const entry of visible){const card=el('article');card.append(el('h3',(entry.details?.dog?.name||'Entry')+' · '+(entry.details?.dog?.caroId||entry.id)),el('p',(entry.details?.contact?.name||'Handler not available')+' · '+entry.intake_channel+' · '+entry.status),el('p','Recorded '+timestampLabel(entry.created_at,trial.timezone)));
    const review=el('button','Review entry');review.className='secondary';review.addEventListener('click',()=>action(()=>selected(entry.id)));card.append(review);list.append(card);}
   if(!visible.length)list.append(el('p','No matching loaded entries.'));
  }
  async function page(){
   let query=client.from('caro_entries').select('id,status,intake_channel,created_at,revision,details,amount_cents').eq('trial_id',trial.id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(51);
   if(cursor)query=query.or('created_at.lt.'+cursor.created_at+',and(created_at.eq.'+cursor.created_at+',id.lt.'+cursor.id+')');
   const {data,error}=await query;if(ticket!==generation)return;if(error)throw new Error(error.message);
   const batch=(data||[]).slice(0,50);rows.push(...batch);cursor=batch.at(-1)||cursor;more.hidden=(data?.length||0)<51;render();
  }
  async function selected(id){
   const selectedTicket=++viewGeneration;detail.replaceChildren();
   const {data,error}=await client.rpc('caro_entry_review',{p_entry:id});if(ticket!==generation||selectedTicket!==viewGeneration)return;
   if(error||data?.entry?.trial_id!==trial.id)throw new Error(error?.message||'Entry access could not be verified.');
   const entry=data.entry;if(pending?.p_entry===id&&entry.revision>pending.p_revision)pending=null;rows=rows.map(row=>row.id===id?entry:row);render();const info=entry.details||{};
   detail.append(el('h3','Entry '+id),el('p',(info.contact?.name||'')+' · '+(info.dog?.name||'')+' · '+(info.dog?.caroId||'')),el('p','Recorded '+timestampLabel(entry.created_at,trial.timezone)),el('p',info.receivedAt?'Original receipt '+timestampLabel(info.receivedAt,trial.timezone):'Original receipt time not recorded.'),el('p','Original quote '+money(entry.amount_cents)+' · '+entry.status),el('p','Eligibility: entrant declaration; not registry verified.'));
   const contact=el('details');contact.append(el('summary','Private contact and intake evidence'),el('p',[info.contact?.email,info.contact?.phone,info.contact?.address].filter(Boolean).join(' · ')),el('p',info.intakeEvidence||'No intake evidence supplied'),el('p',info.accommodation||'No accommodation request recorded'));detail.append(contact);
   const finance=el('button','Payments and adjustments');finance.className='secondary';finance.addEventListener('click',()=>onFinance(id));detail.append(finance);
   for(const line of info.selections||[]){
    const event=data.events.find(event=>event.id===line.eventId),source=data.entryEvents?.find(event=>event.id===line.eventId),status=line.status||entry.status,card=el('article');
    card.append(el('h4',event?'Round '+event.round+' · '+event.date+' · '+(event.format==='Working'?'Working':event.level+' '+event.format):line.eventId),el('p','Status: '+status+' · Saved run quote '+money(line.amountCents)+(line.feo?' · FEO':'')),el('p','Participants: '+(line.participantIds||[]).join(' / ')),el('p',line.stream?'Stream '+line.stream:(line.exercises||[]).map(item=>(source?.exercises?.find(exercise=>exercise.id===item.id)?.name||item.id)+' / '+item.level).join('; ')));
    if(line.statusReason)card.append(el('p',line.statusReason));
    if(data.completedEvents.includes(line.eventId)||data.scoredEvents.includes(line.eventId)){card.append(el('p','A result or completed Trial Record protects this run.'));detail.append(card);continue;}
    const options=transitions[status]||[];
    if(options.length){const label=el('label','Decision note (required for rejection or withdrawal)'),reason=el('input');reason.maxLength=1000;label.append(reason);card.append(label);
     for(const [target,text] of options){const button=el('button',text);button.className='secondary';button.addEventListener('click',()=>action(async()=>{
      if(pending&&(pending.p_entry!==id||pending.p_event!==line.eventId||pending.p_status!==target))throw new Error('Retry the pending decision before starting a different change.');
      if(!pending){const note=reason.value.trim();if(['withdrawn','rejected'].includes(target)&&!note)throw new Error('Record the reason first.');pending={p_entry:id,p_event:line.eventId,p_revision:entry.revision,p_request:crypto.randomUUID(),p_status:target,p_reason:note};}
      inFlight=true;try{const result=await client.rpc('caro_change_run_status',pending);if(ticket!==generation)return;if(result.error){if(/^[0-9A-Z]{5}$/.test(result.error.code||'')||result.error.code?.startsWith('PGRST'))pending=null;throw new Error(result.error.message+' Refresh the entry if another change was saved.');}pending=null;await selected(id);message('Run decision saved and audited. Review refunds or waivers separately.');}finally{inFlight=false;}
     }));card.append(button);}
    }
    detail.append(card);
   }
   const reload=el('button','Refresh this entry');reload.className='secondary';reload.addEventListener('click',()=>action(()=>selected(id)));detail.append(reload);detail.scrollIntoView({behavior:'smooth'});
  }
  search.addEventListener('input',render);filter.addEventListener('change',render);more.addEventListener('click',()=>action(page));await page();if(ticket===generation)container.scrollIntoView({behavior:'smooth'});
 }
 return {open,clear,canLeave(){if(inFlight){message('Wait for the run decision response before switching trials.');return false;}return !pending||confirm('Leave an unconfirmed decision? Review the journal and current entry before trying a new change.');}};
}
