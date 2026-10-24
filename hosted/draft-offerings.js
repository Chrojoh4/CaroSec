import {money} from '../src/domain/premium.js';
export function mountDraftOfferings({client,container,action,message,navigate}){
 let generation=0,dirty=false;
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 function clear(){generation++;dirty=false;}
 async function open(trial){
  clear();const ticket=generation;container.hidden=false;container.replaceChildren();container.append(el('h2','Classes, streams and fees'),el('p','Set the offered streams, competitive and FEO prices, charging unit and capacity while the trial is a draft. Saving updates the draft streams and entry previews; it does not finalize or open entries.'));
  const results=await Promise.all([client.from('caro_premium_drafts').select('content,revision').eq('trial_id',trial.id).maybeSingle(),client.from('caro_draft_offerings').select('rows,revision,fees_snapshot').eq('trial_id',trial.id).maybeSingle()]);
  if(ticket!==generation)return;if(results.some(r=>r.error))throw new Error('Draft offerings need the draft_offerings database update and trial access.');
  const [premium,saved]=results.map(r=>r.data),fees=premium?.content?.fees||[],events=trial.planning?.events||[];
  container.append(el('p','Fee amounts are managed in Trial details & rounds and remain editable in Premium builder. Select the saved prices for each round below.'));
  if(navigate){const edit=el('button','Edit fee amounts in Trial details');edit.type='button';edit.className='secondary';edit.addEventListener('click',()=>navigate('application'));container.append(edit);}
  if(!fees.length||!events.length){container.append(el('p',!events.length?'Add class rounds in Trial details first.':'Save fee amounts in Trial details & rounds, then return here to assign them to the rounds.'));return;}
  const form=el('form');form.className='draft-offerings-form';const rows=[];
  for(const [index,event] of events.entries()){
   const old=saved?.rows?.find(row=>row.key===event.id),box=el('fieldset');box.append(el('legend','Round '+(index+1)+' · '+event.dayId+' · '+event.level+' '+event.format),el('p','Judge: '+event.judge));
   const offered=(event.stream||'').split(/[ ,;]+/).filter(Boolean);let streams;
   if(event.format==='Working'){const label=el('label','Offered Working levels (separate with commas)'),input=el('input');input.value=offered.join(', ');input.required=true;label.append(input);box.append(label);streams=()=>input.value.split(/[,;]+/).map(x=>x.trim()).filter(Boolean);}
   else{box.append(el('p','Offered streams — select only those reviewed for this CARO class'));const checks=[];for(const name of [...new Set([...( ['Novice','Intermediate'].includes(event.level)?['B']:['B','C']),...offered])]){const label=el('label',name),check=el('input');check.type='checkbox';check.checked=offered.includes(name);label.prepend(check);label.className='stream-choice';box.append(label);checks.push({name,check});}streams=()=>checks.filter(x=>x.check.checked).map(x=>x.name);}
   function selectFee(labelText,previous,optional){const label=el('label',labelText),select=el('select'),blank=el('option',optional?'FEO not offered':'Choose a saved fee');blank.value='';select.append(blank);fees.forEach((fee,i)=>{const o=el('option',fee.label+' · '+money(fee.cents)+' · '+fee.unit);o.value=String(i);select.append(o);});if(previous){const i=fees.findIndex(f=>f.cents===previous.cents&&f.label===previous.label&&f.unit===previous.unit);if(i>=0)select.value=String(i);}select.required=!optional;label.append(select);box.append(label);return select;}
   const fee=selectFee('Competitive fee',old?.fee,false),feo=selectFee('FEO fee',old?.feoFee,true),basisLabel=el('label','Fee charged per'),basis=el('select');
   for(const [value,text] of event.format==='Working'?[['exercise','Selected Working exercise']]:[['','Choose charging unit'],['dog','Participating dog'],['entry','Event entry / Team or Brace group']]){const o=el('option',text);o.value=value;basis.append(o);}basis.required=true;if(old)basis.value=old.basis;basisLabel.append(basis);box.append(basisLabel);
   const capLabel=el('label','Capacity (entry orders for this round)'),capacity=el('input');capacity.type='number';capacity.min='1';capacity.max='1000';capacity.required=true;capacity.value=String(old?.capacity||50);capLabel.append(capacity);box.append(capLabel);
   rows.push({event,streams,fee,feo,basis,capacity});form.append(box);
  }
  const save=el('button','Save draft classes, streams and fees');save.type='submit';form.append(save);form.addEventListener('input',()=>{dirty=true;});form.addEventListener('change',()=>{dirty=true;});
  form.addEventListener('submit',event=>{event.preventDefault();action(async()=>{
   const values=rows.map(r=>({key:r.event.id,levels:r.streams(),fee_index:Number(r.fee.value),feo_index:r.feo.value===''?null:Number(r.feo.value),basis:r.basis.value,capacity:Number(r.capacity.value)}));if(values.some(r=>!r.levels.length))throw new Error('Select the offered streams or levels for every round.');
   const {data,error}=await client.rpc('caro_save_draft_offerings',{p_trial:trial.id,p_trial_revision:trial.revision,p_revision:saved?.revision??-1,p_premium_revision:premium.revision,p_rows:values});if(ticket!==generation)return;if(error)throw new Error(error.message);dirty=false;await open({...trial,revision:data.trialRevision,planning:data.planning});message('Draft offerings saved. Entry previews now show the selected streams and assigned prices. Review before finalizing.');
  });});container.append(form);
 }
 return {open,clear,canLeave:()=>!dirty||confirm('Leave unsaved draft offerings?')};
}
