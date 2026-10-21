export function mountSanctionEditor({client,container,action,message,onSaved}){
 let dirty=false,generation=0;
 const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
 function clear(){generation++;dirty=false;container.hidden=true;container.replaceChildren();}
 function open(trial){
  clear();const ticket=generation;container.hidden=false;container.append(el('h2','CARO submission and approval'),el('p','Record a submission or decision that has already occurred. This screen does not send an application to CARO or verify a decision automatically.'),el('p','Current recorded status: '+(trial.sanction_status||'not_submitted')));
  if(trial.is_practice){container.append(el('p','Practice trial: exercise the private secretary workflow without recording a real CARO approval. Publication is blocked.'));return;}
  if(trial.application_state!=='finalized'){container.append(el('p','Finalize the application before recording submission.'));return;}
  const transitions={not_submitted:['submitted'],submitted:['approved','rejected'],rejected:['submitted'],approved:[]},options=transitions[trial.sanction_status||'not_submitted'];
  if(!options?.length){container.append(el('p','Approval is recorded. Amendments and approval withdrawal require a separate reviewed workflow.'));return;}
  const form=el('form'),wrap=el('label','Record completed action'),status=el('select');for(const value of options){const option=el('option',value);option.value=value;status.append(option);}wrap.append(status);form.append(wrap);
  function input(label,type,value){const wrap=el('label',label),node=el('input');node.type=type;node.value=value||'';wrap.append(node);form.append(wrap);return node;}
  const date=input('Actual submission date','date',trial.submitted_on);date.required=true;
  const number=input('Assigned CARO trial number (required for approval)','text',trial.trial_number);number.maxLength=100;
  const evidence=input('Submission or decision evidence / confirmation reference','text','');evidence.required=true;evidence.minLength=5;evidence.maxLength=5000;
  const save=el('button','Record completed CARO action');save.type='submit';form.append(save);
  form.addEventListener('input',()=>{dirty=true;});form.addEventListener('change',()=>{dirty=true;});
  form.addEventListener('submit',event=>{event.preventDefault();action(async()=>{const values={p_trial:trial.id,p_revision:trial.revision,p_status:status.value,p_submitted:date.value,p_number:number.value.trim(),p_evidence:evidence.value.trim()};if(values.p_status==='approved'&&!values.p_number)throw new Error('Enter the assigned CARO trial number.');const inputs=[...form.querySelectorAll('input,select')];inputs.forEach(input=>input.disabled=true);let result;try{result=await client.rpc('caro_record_sanction',values);}finally{inputs.forEach(input=>input.disabled=false);}if(ticket!==generation)return;const {error}=result;if(error)throw new Error(error.code==='PGRST202'?'CARO status recording needs the database update.':error.message);clear();await onSaved();message('CARO action recorded with evidence. No external submission or publication occurred.');});});
  container.append(form);container.scrollIntoView({behavior:'smooth'});
 }
 return {open,clear,canLeave(){return !dirty||confirm('Leave the CARO record form without saving?');}};
}
