export function mountTrialDay({client,container,action,message}){
 let generation=0,scoreDirty=false,orderDirty=false,inFlight=false;
 const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
 const changed=()=>scoreDirty||orderDirty;
 function clear(){generation++;container.hidden=true;container.replaceChildren();scoreDirty=false;orderDirty=false;inFlight=false;}
 function leave(){if(inFlight){message('Wait for the trial-day response.');return false;}return !changed()||confirm('Leave the unsaved result or running order?');}
 async function open(trial){
  clear();const ticket=generation;container.hidden=false;container.append(el('h2','Trial day'),el('p','Save the running order, transcribe judge-provided results, review corrections and record sign-off. The program does not calculate qualification or award titles.'));
  const {data:events,error}=await client.from('caro_events').select('id,official_round,local_date,level,format,judge_name').eq('trial_id',trial.id).order('official_round');
  if(ticket!==generation)return;if(error)throw new Error(error.message);if(!events.length){container.append(el('p','Finalize the application before using official rounds.'));return;}
  const roundLabel=el('label','Official round'),select=el('select'),refresh=el('button','Refresh round'),roundRoot=el('div');refresh.className='secondary';
  for(const event of events){const option=el('option','Round '+event.official_round+' · '+event.local_date+' · '+(event.format==='Working'?'Working':event.level+' '+event.format));option.value=event.id;select.append(option);}roundLabel.append(select);container.append(roundLabel,refresh,roundRoot);
  let currentEvent=select.value,loadGeneration=0;
  async function rpc(name,args){const {data,error}=await client.rpc(name,args);if(error)throw new Error(error.message+(!error.code?' Retry the same values before starting another change.':''));return data;}
  async function load(){
   const loadTicket=++loadGeneration,eventId=select.value,data=await rpc('caro_event_desk',{p_event:eventId});
   if(ticket!==generation||loadTicket!==loadGeneration)return;currentEvent=eventId;scoreDirty=false;orderDirty=false;roundRoot.replaceChildren();
   if(data.event.trialId!==trial.id)throw new Error('Round access could not be verified.');
   roundRoot.append(el('h3','Round '+data.event.round+' · Judge '+data.event.judge),el('p',data.runs.length+' active runs · '+(data.completed?'Trial Record complete':'Not signed off')));
   if(data.completed)roundRoot.append(el('p','Sign-off evidence: '+data.completed.signoff));
   const printForm=el('form'),startLabel=el('label','First running-order number'),start=el('input'),countLabel=el('label','Number of sheets (up to 100)'),count=el('input');
   start.type=count.type='number';start.min=count.min='1';start.max=String(Math.max(1,data.runs.length));count.max='100';start.value='1';count.value=String(Math.min(100,data.runs.length||1));start.required=count.required=true;start.step=count.step='1';startLabel.append(start);countLabel.append(count);printForm.append(el('h4','Judge working sheets'),el('p','Download the current round or a print range. Working layouts must be checked against current official CARO forms.'),startLabel,countLabel);
   const print=el('button',data.runs.length?'Download judge working sheets PDF':'Download blank round verification PDF');print.type='submit';printForm.append(print);roundRoot.append(printForm);
   printForm.addEventListener('submit',event=>{event.preventDefault();action(async()=>{
    if(orderDirty)throw new Error('Save the running order before printing judge sheets.');
    const {data:session,error}=await client.auth.getSession();if(error||!session?.session?.access_token)throw new Error('Sign in again before downloading judge sheets.');
    const response=await fetch('/api/judge-sheets',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.session.access_token},body:JSON.stringify({eventId,reviewToken:data.reviewToken,startRun:Number(start.value),runCount:Number(count.value)})});
    if(ticket!==generation)return;if(!response.ok){const problem=await response.json();throw new Error(problem.error||'Judge sheets could not be downloaded.');}
    const blob=await response.blob();if(ticket!==generation)return;const url=URL.createObjectURL(blob),link=el('a');link.href=url;link.download='CARO-round-'+data.event.round+'-judge-working-sheets.pdf';link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);message('Judge working PDF downloaded. Review the pages before use.');
   });});
   const list=el('div'),scorePane=el('section');let order=[...data.runs],orderKey=crypto.randomUUID();const saveOrder=el('button','Save running order');saveOrder.className='secondary';saveOrder.hidden=!!data.completed;
   function renderOrder(){
    list.replaceChildren();order.forEach((run,index)=>{
     const card=el('article'),partners=run.partner?' & '+run.partner.dog.name+' / '+run.partner.dog.caroId:'';
     card.append(el('h4','Run '+(index+1)+' · '+run.dog.name+' / '+run.dog.caroId+partners),el('p',run.handler+(run.partner?' / '+run.partner.handler:'')+' · '+run.status+(run.feo?' · FEO':'')),el('p','Jump: '+run.dog.jumpHeight+(run.partner?' / '+run.partner.dog.jumpHeight:'')));
     const result=run.score?.outcome;card.append(el('p',!run.score?'Result not recorded':Array.isArray(result)?result.map(item=>(run.offeredExercises?.find(exercise=>exercise.id===item?.id)?.name||item?.id||'Unmapped exercise')+': '+(item?.outcome||'Review outcome')).join('; '):result?.outcome?(result.score??'')+' '+result.outcome:'Saved result format requires review'));
     if(!data.completed){for(const [delta,text] of [[-1,'Move up'],[1,'Move down']]){const move=el('button',text);move.className='secondary';move.disabled=index+delta<0||index+delta>=order.length;move.addEventListener('click',()=>{if(scoreDirty){message('Save or discard the current result before changing the order.');return;}[order[index],order[index+delta]]=[order[index+delta],order[index]];orderDirty=true;renderOrder();});card.append(move);}
      const edit=el('button',run.score?'Review / correct result':'Record judge result');edit.className='secondary';edit.addEventListener('click',()=>{if(orderDirty){message('Save the running order before opening a result.');return;}if(scoreDirty&&!confirm('Discard the unsaved result?'))return;renderScore(run);});card.append(edit);}
     list.append(card);
    });if(!order.length)list.append(el('p','No active accepted runs in this round.'));
   }
   saveOrder.addEventListener('click',()=>action(async()=>{if(scoreDirty)throw new Error('Save or discard the current result first.');inFlight=true;try{await rpc('caro_save_running_order',{p_event:eventId,p_revision:data.orderRevision,p_request:orderKey,p_entries:order.map(run=>run.entryId)});if(ticket!==generation)return;orderDirty=false;await load();message('Running order saved. Official round identity is unchanged.');}finally{inFlight=false;}}));
   roundRoot.append(list,saveOrder,scorePane);renderOrder();
   function renderScore(run){
    scoreDirty=false;scorePane.replaceChildren();scorePane.append(el('h4',run.dog.name+' · '+(run.score?'Transcription correction':'Judge-provided result')),el('p','Assigned judge: '+data.event.judge+(run.score?' · Current version '+run.score.version:'')));
    const form=el('form');form.className='trial-day-form';let requestKey=crypto.randomUUID();const fields=[];
    function outcome(label,values,current){const wrap=el('label',label),select=el('select'),blank=el('option','Select judge outcome');blank.value='';select.append(blank);for(const value of values){const option=el('option',value);option.value=value;select.append(option);}select.value=current||'';select.required=true;wrap.append(select);form.append(wrap);return select;}
    let rallyScore,rallyOutcome;
    if(data.event.format==='Working')for(const exercise of run.exercises||[]){const current=Array.isArray(run.score?.outcome)?run.score.outcome.find(item=>item.id===exercise.id)?.outcome:'';fields.push({id:exercise.id,input:outcome((run.offeredExercises?.find(item=>item.id===exercise.id)?.name||exercise.id)+' · '+exercise.level,run.feo?['FEO','Absent','Excused']:['Pass','Not Yet','FEO','Absent','Excused'],current)});}
    else{rallyOutcome=outcome('Judge outcome',run.feo?['FEO','Absent','Excused']:['Q','NQ','FEO','Absent','Excused'],run.score?.outcome?.outcome);const label=el('label','Rally score (whole number 0–200)'),input=el('input');input.type='number';input.min='0';input.max='200';input.step='1';input.value=run.score?.outcome?.score??'';input.required=rallyOutcome.value==='Q';rallyOutcome.addEventListener('change',()=>{input.required=rallyOutcome.value==='Q';});label.append(input);form.append(label);rallyScore=input;}
    const timeLabel=el('label','Elapsed seconds from the judge record'),elapsed=el('input');elapsed.type='number';elapsed.min='0';elapsed.step='.001';elapsed.required=true;elapsed.value=run.score?.elapsedSeconds??'';timeLabel.append(elapsed);form.append(timeLabel);
    const reasonLabel=el('label',run.score?'Correction reason (required)':'Recording note (optional)'),reason=el('input');reason.maxLength=1000;reason.required=!!run.score;reasonLabel.append(reason);form.append(reasonLabel);
    const confirmLabel=el('label'),confirmed=el('input');confirmLabel.className='judge-confirmed';confirmed.type='checkbox';confirmed.required=true;confirmLabel.append(confirmed,document.createTextNode(' I am transcribing the judge-provided result, not calculating a qualification.'));form.append(confirmLabel);
    const save=el('button',run.score?'Record correction':'Save judge result');save.type='submit';form.append(save);form.addEventListener('input',()=>{scoreDirty=true;});form.addEventListener('change',()=>{scoreDirty=true;});
    form.addEventListener('submit',event=>{event.preventDefault();action(async()=>{if(orderDirty)throw new Error('Save the running order first.');const outcomeValue=data.event.format==='Working'?fields.map(field=>({id:field.id,outcome:field.input.value})):{outcome:rallyOutcome.value,score:rallyScore.value===''?null:Number(rallyScore.value)};
     const controls=[...form.querySelectorAll('input,select')];controls.forEach(control=>control.disabled=true);inFlight=true;
     try{await rpc('caro_record_judge_score',{p_entry:run.entryId,p_event:eventId,p_entry_revision:run.entryRevision,p_version:run.score?.version||0,p_request:requestKey,p_outcome:outcomeValue,p_elapsed:Number(elapsed.value),p_confirmed:confirmed.checked,p_reason:reason.value.trim()});if(ticket!==generation)return;scoreDirty=false;await load();message('Judge-provided result saved. Prior versions remain in history.');}finally{inFlight=false;controls.forEach(control=>control.disabled=false);}
    });});scorePane.append(form);scorePane.scrollIntoView({behavior:'smooth'});
   }
   if(!data.completed){
    if(data.runs.some(run=>!run.score))roundRoot.append(el('p','Record a result, absence or excusal for every active run before sign-off.'));
    else{const form=el('form'),label=el('label','Judge sign-off evidence / signed record reference'),evidence=el('input'),save=el('button','Record reviewed event sign-off');evidence.required=true;evidence.maxLength=1000;label.append(evidence);save.type='submit';form.append(el('h4','Review and complete this event'),el('p','Review all latest results and corrections against the signed judge record. Completion locks further run, order and result changes.'),label,save);let requestKey=crypto.randomUUID();
     form.addEventListener('submit',event=>{event.preventDefault();action(async()=>{if(changed())throw new Error('Save your current result or running order before sign-off.');inFlight=true;try{await rpc('caro_complete_trial_event',{p_event:eventId,p_review_token:data.reviewToken,p_request:requestKey,p_signoff:evidence.value.trim()});if(ticket!==generation)return;await load();message('Event signed off and locked with audit history.');}finally{inFlight=false;}});});roundRoot.append(form);}
   }
  }
  select.addEventListener('change',()=>{if(!leave()){select.value=currentEvent;return;}action(load);});refresh.addEventListener('click',()=>{if(leave())action(load);});await load();if(ticket===generation)container.scrollIntoView({behavior:'smooth'});
 }
 return {open,clear,canLeave:leave};
}
