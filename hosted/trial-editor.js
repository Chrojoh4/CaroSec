import {validCalendarDate} from '../src/domain/date-time.js';
const fields=[['host','Host club'],['organizer','Organizer'],['organizerEmail','Organizer email'],['memberReference','Professional membership reference'],['secretary','Trial secretary'],['email','Secretary email'],['chair','Trial chair'],['chairEmail','Chair email'],['venue','Venue'],['address','Venue address'],['surface','Ring surface'],['ringWidth','Ring width (feet)'],['ringLength','Ring length (feet)'],['nearbyNotes','Nearby trials / permission notes']];
const levels=['Novice','Intermediate','Advanced','Excellent','Versatility','Versatility Excellent','Working'];
export function mountTrialEditor({client,container,message,action,onSaved}){
 let row=null,dirty=false;
 const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
 function input(parent,key,label,value='',type='text'){const wrap=el('label',label),node=el('input');node.name=key;node.type=type;node.value=value;node.maxLength=5000;wrap.append(node);parent.append(wrap);return node;}
 function select(parent,key,label,values,value){const wrap=el('label',label),node=el('select');node.name=key;for(const v of values){const o=el('option',v);o.value=v;node.append(o);}node.value=value;wrap.append(node);parent.append(wrap);return node;}
 function snapshot(form){const data=new FormData(form),planning=Object.fromEntries(fields.map(([key])=>[key,String(data.get(key)||'')]));planning.events=[...form.querySelectorAll('[data-event]')].map(block=>Object.fromEntries(['id','dayId','level','format','stream','judge','exercises'].map(key=>[key,block.querySelector(`[name="${key}"]`).value])));return {...row,title:String(data.get('title')).trim(),start_date:data.get('start_date'),end_date:data.get('end_date'),timezone:String(data.get('timezone')),planning};}
 function eventBlock(form,event={id:crypto.randomUUID(),dayId:form.elements.start_date.value,level:'Novice',format:'Regular',stream:'',judge:'',exercises:''}){
  const block=el('fieldset');block.dataset.event='';block.append(el('legend','Draft event'));const id=input(block,'id','Event ID',event.id);id.type='hidden';id.parentElement.hidden=true;
  input(block,'dayId','Event date',event.dayId,'date');const level=select(block,'level','Class',levels,event.level),format=select(block,'format','Format',['Regular','Team','Brace','Working'],event.format);
  level.addEventListener('change',()=>{if(level.value==='Working')format.value='Working';else if(format.value==='Working')format.value='Regular';});format.addEventListener('change',()=>{if(format.value==='Working')level.value='Working';else if(level.value==='Working')level.value='Novice';});
  input(block,'stream','Stream / offered levels',event.stream);input(block,'judge','Judge',event.judge);input(block,'exercises','Working exercises and levels (if applicable)',event.exercises);
  const remove=el('button','Remove event');remove.type='button';remove.className='secondary';remove.addEventListener('click',()=>{block.remove();dirty=true;});block.append(remove);form.querySelector('#event-list').append(block);
 }
 function close(){if(dirty&&!confirm('Leave this draft without saving your latest changes?'))return;container.hidden=true;container.replaceChildren();row=null;dirty=false;}
 function open(value){if(dirty&&!confirm('Leave this draft without saving your latest changes?'))return;row=structuredClone(value);dirty=false;container.hidden=false;container.replaceChildren();container.append(el('h2',row.revision===-1?'Create a trial':'Trial application draft'),el('p','Save your work at any stage. This prepares a draft; it does not submit an application to CARO or open entries.'));
  const form=el('form');form.className='trial-form';input(form,'title','Trial name',row.title);input(form,'start_date','First day',row.start_date,'date');input(form,'end_date','Last day',row.end_date,'date');input(form,'timezone','Trial timezone (IANA)',row.timezone);for(const [key,label] of fields)input(form,key,label,row.planning?.[key]||'');
  const events=el('div');events.id='event-list';form.append(el('h3','Events and judges'),events);const add=el('button','Add event');add.type='button';add.className='secondary';add.addEventListener('click',()=>{if(events.children.length>=150){message('This release supports up to 150 events.',true);return;}eventBlock(form);dirty=true;});form.append(add);
  const controls=el('div');controls.className='actions';const save=el('button','Save trial draft');save.type='submit';const cancel=el('button','Back to workspace');cancel.type='button';cancel.className='secondary';cancel.addEventListener('click',close);controls.append(save,cancel);form.append(controls);container.append(form);
  for(const event of row.planning?.events||[])eventBlock(form,event);
  form.addEventListener('input',()=>{dirty=true;});form.addEventListener('change',()=>{dirty=true;});
  if(row.application_state!=='draft'){for(const control of form.elements)control.disabled=true;cancel.disabled=false;message('This trial is finalized and cannot be edited here.');}
  form.addEventListener('submit',event=>{event.preventDefault();action(async()=>{
   if(row.application_state!=='draft')throw new Error('Finalized trials cannot be edited here.');
   const draft=snapshot(form);if(!draft.title||draft.title.length>200)throw new Error('Enter a trial name of 1 to 200 characters.');if(!validCalendarDate(draft.start_date)||!validCalendarDate(draft.end_date)||draft.end_date<draft.start_date||(Date.parse(draft.end_date)-Date.parse(draft.start_date))/86400000>30)throw new Error('Choose valid consecutive trial dates, up to 31 days.');
   for(const event of draft.planning.events)if(!validCalendarDate(event.dayId)||event.dayId<draft.start_date||event.dayId>draft.end_date)throw new Error('Every event date must be within the trial dates.');
   const inputs=[...form.querySelectorAll('input,select')];inputs.forEach(node=>node.disabled=true);
   let result;try{result=await client.rpc('caro_save_trial_draft',{p_id:draft.id,p_club:draft.club_id,p_revision:draft.revision,p_title:draft.title,p_start:draft.start_date,p_end:draft.end_date,p_timezone:draft.timezone,p_planning:draft.planning});}finally{inputs.forEach(node=>node.disabled=false);}
   const {data,error}=result;
   if(error){if(error.code==='PGRST202')throw new Error('Trial saving needs the new Supabase setup SQL. Your draft remains on this screen.');if(error.code==='40001')throw new Error('Another change was saved. Keep a copy of your changes, then reopen this trial before saving.');throw new Error(error.message||'Unable to save. Your changes remain here; retry or reopen the trial.');}
   row={...draft,revision:data.revision};dirty=false;await onSaved();message('Trial draft saved to your club.');
  });});container.scrollIntoView({behavior:'smooth'});
 }
 window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
 return {open,clear(){row=null;dirty=false;container.hidden=true;container.replaceChildren();}};
}
