import {feeFields,readFeeFields} from './fee-fields.js';
import {feeKind,feeKinds} from '../src/domain/fee-defaults.js';
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
  clear();const ticket=generation;container.append(el('h3','Entry fees'),el('p','Set the default regular price and choose whether this trial offers FEO. Rounds inherit these prices; Team, Brace and Working can have their own prices. These same fees appear in Premium builder. Existing received entries keep their recorded charges.'));
  if(trial.revision<0){container.append(el('p','Save the new trial draft first, then enter its fee amounts here.'));return;}
  const result=await client.from('caro_premium_drafts').select('content,revision').eq('trial_id',trial.id).maybeSingle();if(ticket!==generation)return;if(result.error)throw new Error('The saved trial fees could not be loaded.');
  let premium=result.data||{content:{},revision:-1},filled=[];
  if(!Object.hasOwn(premium.content,'fees')){const user=await client.auth.getUser();if(ticket!==generation)return;if(!user.error&&user.data?.user){const remembered=await client.from('caro_premium_user_defaults').select('content').eq('user_id',user.data.user.id).eq('club_id',trial.club_id).eq('is_practice',trial.is_practice===true).maybeSingle();if(ticket!==generation)return;
   if(!remembered.error){const defaults=applyPremiumDefaults(premium.content,remembered.data?.content||{});premium={...premium,content:defaults.content};filled=defaults.filled;}
  }}
  if(filled.length)container.append(el('p','Your remembered premium answers and fees are loaded into this private draft. Review the prices here and the wording in Premium builder before issuing it.'));
  const form=el('form'),rows=el('div');form.className='trial-fees-form';form.append(rows);
  function addFee(fee={label:'Other fee',kind:'custom',cents:null,unit:'per dog / event'}){const row=el('fieldset');row.append(el('legend',feeKinds[feeKind(fee)]+' fee'));feeFields(row,fee);const remove=el('button','Remove fee');remove.type='button';remove.className='secondary';remove.addEventListener('click',()=>{row.remove();dirty=true;});row.append(remove);rows.append(row);}
  for(const fee of premium.content.fees||[])addFee(fee);
  if(!rows.children.length){addFee({label:'Competitive Rally',kind:'regular',cents:null,unit:'per dog / event'});addFee({label:'FEO Rally',kind:'feo',cents:0,unit:'per dog / event',offered:false});}
  const defaultsBar=el('div');defaultsBar.className='actions';
  for(const kind of ['regular','feo',...new Set((trial.planning?.events||[]).map(e=>e.format.toLowerCase()).filter(x=>['team','brace','working'].includes(x)))]){const button=el('button','Add '+feeKinds[kind]+' price');button.type='button';button.className='secondary';button.addEventListener('click',()=>{if([...rows.children].some(r=>r.querySelector('[name=fee-kind]').value===kind))return;addFee({label:kind==='regular'?'Competitive Rally':kind==='feo'?'FEO Rally':feeKinds[kind],kind,cents:null,unit:kind==='working'?'per selected Working exercise':kind==='team'||kind==='brace'?'per event entry / group':'per dog / event',offered:false});dirty=true;});if(![...rows.children].some(r=>r.dataset.feeKind===kind))defaultsBar.append(button);}form.append(defaultsBar);
  const add=el('button','Add fee amount');add.type='button';add.className='secondary';add.addEventListener('click',()=>{if(rows.children.length>=50)return;addFee();dirty=true;});const save=el('button','Save fee amounts');save.type='submit';form.append(add,save);form.addEventListener('input',()=>dirty=true);
  form.addEventListener('submit',e=>{e.preventDefault();action(async()=>{const controls=[...form.querySelectorAll('input,select,button')];controls.forEach(c=>c.disabled=true);try{const fees=[...rows.children].map(readFeeFields);const saved=await saveTrialFees(client,trial,premium,fees);if(ticket!==generation)return;premium={content:{...premium.content,fees},revision:saved.revision};dirty=false;message('Trial prices and FEO availability saved. Draft rounds and premiums use these defaults. Review any round exceptions before opening entries.');}finally{if(ticket===generation)controls.forEach(c=>c.disabled=false);}});});container.append(form);
 }
 return {open,clear,isDirty:()=>dirty,canLeave:()=>!dirty||confirm('Leave fee changes without saving them?')};
}
