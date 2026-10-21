import {timestampLabel} from '../src/domain/date-time.js';

export function mountActivityJournal({client,container,action,message}){
 let generation=0;
 const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
 function clear(){generation++;container.hidden=true;container.replaceChildren();}
 async function open(trial){
  clear();const ticket=generation;container.hidden=false;
  container.append(el('h2','Activity journal'),el('p','Entry receipts, financial records and trial audit activity, newest first. Times use '+trial.timezone+'. Original receipt times are shown only when explicitly recorded. Separate source records may describe the same action.'));
  const filters=el('form'),searchLabel=el('label','Search all matching trial activity'),search=el('input'),groupLabel=el('label','Activity type'),group=el('select');search.maxLength=200;search.type='search';searchLabel.append(search);groupLabel.append(group);
  for(const [value,label] of [['all','All activity'],['receipts','Entry receipts'],['payments','Payments and adjustments'],['withdrawals','Withdrawals'],['results','Results and sign-offs'],['incidents','Incident records'],['administration','Trial administration']]){const option=el('option',label);option.value=value;group.append(option);}
  const date=(label)=>{const wrap=el('label',label),input=el('input');input.type='date';wrap.append(input);filters.append(wrap);return input;};
  filters.append(searchLabel,groupLabel);const from=date('Recorded from (trial timezone)'),to=date('Recorded through (trial timezone)'),apply=el('button','Apply filters / refresh');apply.type='submit';filters.append(apply);
  const count=el('p'),list=el('div'),more=el('button','Load older matching activity');more.className='secondary';let cursor=null,loaded=0,active={p_query:'',p_group:'all',p_from:null,p_to:null};
  filters.addEventListener('submit',event=>{event.preventDefault();action(async()=>{if(from.value&&to.value&&to.value<from.value)throw new Error('The ending date must be on or after the starting date.');active={p_query:search.value.trim(),p_group:group.value,p_from:from.value||null,p_to:to.value||null};cursor=null;loaded=0;list.replaceChildren();await page();});});
  async function page(){
   const {data,error}=await client.rpc('caro_filtered_trial_activity',{...active,p_trial:trial.id,p_before:cursor?.recorded_at||null,p_key:cursor?.record_key||null,p_limit:50});
   if(ticket!==generation)return;
   if(error){more.hidden=true;throw new Error(error.code==='PGRST202'?'The activity journal needs its database update.':error.message);}
   if(!data?.length&&!cursor)list.append(el('p','No activity matches these filters.'));
   for(const row of data||[]){
    const card=el('article');card.append(el('h3',row.action.replaceAll('.',' · ')),el('p',timestampLabel(row.recorded_at,trial.timezone)),el('p','Reference: '+row.reference),el('p',row.actor_id?'Recorded by staff '+row.actor_id:row.summary?.channel==='online'?'Online entrant (self-declared)':'Actor identity was not recorded for this source.'));
    const info=row.summary||{};
    if(info.receivedAt)card.append(el('p','Original received/effective time: '+timestampLabel(info.receivedAt,trial.timezone)));
    if(info.handler||info.dog)card.append(el('p',[info.handler,info.dog].filter(Boolean).join(' · ')));
    if(info.channel)card.append(el('p','Received through '+info.channel));
    if(info.method)card.append(el('p','Method / reference: '+info.method));
    if(Number.isSafeInteger(info.amountCents))card.append(el('p',new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(info.amountCents/100)));
    if(info.note)card.append(el('p',info.note));
    if(info.details){const detail=el('details'),heading=el('summary','Recorded details'),pre=el('pre',JSON.stringify(info.details,null,2));pre.className='journal-details';detail.append(heading,pre);card.append(detail);}
    list.append(card);
   }
   loaded+=data?.length||0;count.textContent=loaded+' matching source records loaded. Filters search the saved trial journal, not only this page. Dates apply to recording time.';
   cursor=data?.at(-1)||cursor;more.hidden=(data?.length||0)<50;
  }
  more.addEventListener('click',()=>action(page));container.append(filters,count,list,more);await page();
  if(ticket===generation){message('Private trial activity loaded.');container.scrollIntoView({behavior:'smooth'});}
 }
 return {open,clear,canLeave:()=>true};
}
