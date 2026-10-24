import {applyPremiumDefaults} from '../src/domain/premium-defaults.js';
export async function saveTrialFees(client,trial,premium,fees){
 if(!Array.isArray(fees)||fees.length>50||fees.some(f=>!f.label?.trim()||!f.unit?.trim()||!Number.isSafeInteger(f.cents)||f.cents<0||f.cents>999999999))throw new Error('Check each fee name, amount and charging unit.');
 const {data,error}=await client.rpc('caro_save_premium_draft',{p_trial:trial.id,p_revision:premium?.revision??-1,p_content:{...(premium?.content||{}),fees}});
 if(error)throw new Error(error.code==='40001'?'Prices or premium wording changed elsewhere. Reopen this screen before saving.':error.message||'Fee amounts could not be saved.');
 return data;
}
export function mountTrialFees({client,container,action,message}){
 let generation=0,dirty=false;
 const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text||'';return n;};
 function clear(){generation++;dirty=false;container.replaceChildren();}
 async function open(trial){
  clear();const ticket=generation;container.append(el('h3','Entry fees'),el('p','These are the same prices used in the premium builder. Edit and save them on either screen. Review round fee assignments after changing prices; received entries retain their recorded charges.'));
  if(trial.revision<0){container.append(el('p','Save the new trial draft first, then enter its fee amounts here.'));return;}
  const result=await client.from('caro_premium_drafts').select('content,revision').eq('trial_id',trial.id).maybeSingle();if(ticket!==generation)return;if(result.error)throw new Error('The saved trial fees could not be loaded.');
  let premium=result.data||{content:{},revision:-1},filled=[];
  if(!Object.hasOwn(premium.content,'fees')){const user=await client.auth.getUser();if(ticket!==generation)return;if(!user.error&&user.data?.user){const remembered=await client.from('caro_premium_user_defaults').select('content').eq('user_id',user.data.user.id).eq('club_id',trial.club_id).eq('is_practice',trial.is_practice===true).maybeSingle();if(ticket!==generation)return;
   if(!remembered.error){const defaults=applyPremiumDefaults(premium.content,remembered.data?.content||{});premium={...premium,content:defaults.content};filled=defaults.filled;}
  }}
  if(filled.length)container.append(el('p','Your remembered premium answers and fees are loaded into this private draft. Review the prices here and the wording in Premium builder before issuing it.'));
  const form=el('form'),rows=el('div');form.className='trial-fees-form';form.append(rows);
  function addFee(fee={label:'',cents:null,unit:''}){const row=el('fieldset');row.append(el('legend','Fee amount'));for(const [key,text,value] of [['label','Fee name',fee.label],['amount','Amount CAD',fee.cents===null?'':(fee.cents/100).toFixed(2)],['unit','Charging unit / description',fee.unit]]){const label=el('label',text),input=el('input');input.name=key;input.value=value;input.required=true;if(key==='amount'){input.type='number';input.min='0';input.step='.01';}label.append(input);row.append(label);}const remove=el('button','Remove fee');remove.type='button';remove.className='secondary';remove.addEventListener('click',()=>{row.remove();dirty=true;});row.append(remove);rows.append(row);}
  for(const fee of premium.content.fees||[])addFee(fee);if(!rows.children.length)addFee();
  const add=el('button','Add fee amount');add.type='button';add.className='secondary';add.addEventListener('click',()=>{if(rows.children.length>=50)return;addFee();dirty=true;});const save=el('button','Save fee amounts');save.type='submit';form.append(add,save);form.addEventListener('input',()=>dirty=true);
  form.addEventListener('submit',e=>{e.preventDefault();action(async()=>{const controls=[...form.querySelectorAll('input,button')];controls.forEach(c=>c.disabled=true);try{const fees=[...rows.children].map(r=>({label:r.querySelector('[name=label]').value.trim(),unit:r.querySelector('[name=unit]').value.trim(),cents:Math.round(Number(r.querySelector('[name=amount]').value)*100)}));const saved=await saveTrialFees(client,trial,premium,fees);if(ticket!==generation)return;premium={content:{...premium.content,fees},revision:saved.revision};dirty=false;message('Fee amounts saved. Premium builder will use these same prices. Review round assignments if prices changed.');}finally{if(ticket===generation)controls.forEach(c=>c.disabled=false);}});});container.append(form);
 }
 return {open,clear,isDirty:()=>dirty,canLeave:()=>!dirty||confirm('Leave fee changes without saving them?')};
}
