import {money} from '../src/domain/premium.js';
export function mountDraftOfferings({client,container,action,message,navigate}){
 let generation=0,dirty=false,feeDirty=false,offeringsDirty=false;
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 function clear(){generation++;dirty=false;feeDirty=false;offeringsDirty=false;}
 async function open(trial){
  clear();const ticket=generation;container.hidden=false;container.replaceChildren();container.append(el('h2','Classes, streams and fees'),el('p','Set the offered streams, competitive and FEO prices, charging unit and capacity while the trial is a draft. Saving updates the draft streams and entry previews; it does not finalize or open entries.'));
  const results=await Promise.all([client.from('caro_premium_drafts').select('content,revision').eq('trial_id',trial.id).maybeSingle(),client.from('caro_draft_offerings').select('rows,revision,fees_snapshot').eq('trial_id',trial.id).maybeSingle()]);
  if(ticket!==generation)return;if(results.some(r=>r.error))throw new Error('Draft offerings need the draft_offerings database update and trial access.');
  const [premium,saved]=results.map(r=>r.data),fees=premium?.content?.fees||[],events=trial.planning?.events||[];
  const feeDetails=el('details'),feeSummary=el('summary','Fee amounts (edit here)'),feeForm=el('form'),feeRows=el('div');feeDetails.open=!fees.length;feeForm.append(el('p','These are the same saved fee amounts used by the premium. Choose their charging unit for each round below.'),feeRows);
  function addFee(fee={label:'',cents:0,unit:''}){const row=el('div');row.className='premium-fee-row';for(const [key,label,value] of [['label','Fee name',fee.label],['amount','Amount CAD',fee.cents?(fee.cents/100).toFixed(2):''],['unit','Fee description / unit',fee.unit]]){const wrap=el('label',label),input=el('input');input.name=key;input.value=value;input.required=true;if(key==='amount'){input.type='number';input.min='0';input.step='.01';}wrap.append(input);row.append(wrap);}feeRows.append(row);}
  for(const fee of fees)addFee(fee);if(!fees.length)addFee();
  const add=el('button','Add fee amount');add.type='button';add.className='secondary';add.addEventListener('click',()=>{if(feeRows.children.length>=50)return;addFee();dirty=true;feeDirty=true;});
  const saveFees=el('button','Save fee amounts');saveFees.type='submit';feeForm.append(add,saveFees);feeDetails.append(feeSummary,feeForm);container.append(feeDetails);
  feeForm.addEventListener('input',()=>{dirty=true;feeDirty=true;});feeForm.addEventListener('submit',event=>{event.preventDefault();action(async()=>{
   if(offeringsDirty&&!confirm('Saving fee amounts will reload this screen and discard unsaved round choices. Continue?'))return;
   const next=[...feeRows.children].map(row=>({label:row.querySelector('[name=label]').value.trim(),unit:row.querySelector('[name=unit]').value.trim(),cents:Math.round(Number(row.querySelector('[name=amount]').value)*100)}));
   if(next.some(f=>!Number.isSafeInteger(f.cents)||f.cents<0||f.cents>999999999))throw new Error('Check fee amounts.');
   const {error}=await client.rpc('caro_save_premium_draft',{p_trial:trial.id,p_revision:premium?.revision??-1,p_content:{...(premium?.content||{}),fees:next}});if(ticket!==generation)return;if(error)throw new Error(error.message);dirty=false;await open(trial);message('Fee amounts saved to the premium. Select and save their round assignments below.');
  });});
  if(!fees.length||!events.length){container.append(el('p',!events.length?'Add class rounds in Trial details first.':'Enter and save fee amounts above, then assign them to the rounds.'));return;}
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
  const save=el('button','Save draft classes, streams and fees');save.type='submit';form.append(save);form.addEventListener('input',()=>{dirty=true;offeringsDirty=true;});form.addEventListener('change',()=>{dirty=true;offeringsDirty=true;});
  form.addEventListener('submit',event=>{event.preventDefault();action(async()=>{
   if(feeDirty)throw new Error('Save fee amount changes above before saving round assignments.');
   const values=rows.map(r=>({key:r.event.id,levels:r.streams(),fee_index:Number(r.fee.value),feo_index:r.feo.value===''?null:Number(r.feo.value),basis:r.basis.value,capacity:Number(r.capacity.value)}));if(values.some(r=>!r.levels.length))throw new Error('Select the offered streams or levels for every round.');
   const {data,error}=await client.rpc('caro_save_draft_offerings',{p_trial:trial.id,p_trial_revision:trial.revision,p_revision:saved?.revision??-1,p_premium_revision:premium.revision,p_rows:values});if(ticket!==generation)return;if(error)throw new Error(error.message);dirty=false;await open({...trial,revision:data.trialRevision,planning:data.planning});message('Draft offerings saved. Entry previews now show the selected streams and assigned prices. Review before finalizing.');
  });});container.append(form);
 }
 return {open,clear,canLeave:()=>!dirty||confirm('Leave unsaved draft offerings?')};
}
