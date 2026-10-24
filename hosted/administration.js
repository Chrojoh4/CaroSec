export function mountAdministration({client,container,action,message}){
 let generation=0;
 const node=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};
 async function load(clubs,trials=[]){
  const ticket=++generation;
  container.replaceChildren();container.hidden=true;
  const {data:allowed,error}=await client.rpc('caro_is_administrator');
  if(ticket!==generation)return false;
  if(error||allowed!==true)return false;
  const [staff,audit,directory]=await Promise.all([client.rpc('caro_administrator_staff'),client.rpc('caro_administrator_audit'),client.rpc('caro_administrator_users')]);
  if(ticket!==generation)return false;
  if(staff.error||audit.error)throw new Error('Administrator records could not be loaded.');
  container.append(node('h2','Administration'),node('p','System Administrator access covers all clubs and trials. Finalized records retain their normal locks.'));
  const roles={owner:'Club owner',secretary:'Secretary',scorer:'Scorer (limited access)'};
  const list=node('section','');list.append(node('h3','Users & access'),node('p','Administrator access covers every club and trial. Club owners manage their club’s trials. Secretaries and scorers need an active club membership and a trial assignment. Scorer is a limited role; CARO does not yet have a separate assistant role.'));
  if(directory.error){list.append(node('p','The detailed users directory needs the CARO user-directory database update. Existing membership and assignment controls remain available.'));
   for(const person of staff.data||[]){const card=node('article','');card.append(node('strong',person.email||person.user_id),node('p',`${person.club_name||'No club'} · ${roles[person.role]||'Unassigned'} · ${person.active?'Active':'Inactive'}`));list.append(card);}
  }else{
   const label=node('label','Search users, roles, clubs or trials'),search=node('input','');search.type='search';label.append(search);list.append(label);
   const summary=node('p',''),wrap=node('div','');wrap.className='users-table-wrap';wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Users and access table');
   const table=node('table','');table.className='users-table';const caption=node('caption','Registered accounts and granted access');table.append(caption);
   const head=node('thead',''),header=node('tr','');for(const title of ['Account','System access','Club memberships','Trial assignments']){const th=node('th',title);th.scope='col';header.append(th);}head.append(header);const body=node('tbody','');table.append(head,body);wrap.append(table);list.append(summary,wrap);
   const people=Array.isArray(directory.data)?directory.data:[];
   const render=()=>{body.replaceChildren();let shown=0;const term=search.value.trim().toLowerCase();
    for(const person of people){const memberships=person.memberships||[],assignments=person.assignments||[];
     const searchable=[person.email,person.user_id,person.administrator?'Administrator':'',...memberships.flatMap(m=>[m.club_name,roles[m.role]||m.role,m.active?'Active':'Inactive']),...assignments.map(a=>a.title)].join(' ').toLowerCase();if(term&&!searchable.includes(term))continue;shown++;
     const row=node('tr',''),account=node('td','');account.append(node('strong',person.email||'Email unavailable'),node('p',person.user_id));row.append(account,node('td',person.administrator?'Administrator — all clubs and trials':'Club / trial access only'));
     const clubsCell=node('td','');for(const m of memberships)clubsCell.append(node('p',`${m.club_name} · ${roles[m.role]||m.role} · ${m.active?'Active':'Inactive'}`));if(!memberships.length)clubsCell.textContent='No club membership';row.append(clubsCell);
     const trialsCell=node('td','');for(const a of assignments)trialsCell.append(node('p',`${a.title} · ${a.club_name} · ${roles[a.role]||a.role}${a.active?'':' · Inactive membership — assignment grants no access'}`));if(!assignments.length)trialsCell.textContent=person.administrator?'All trials through Administrator access':memberships.some(m=>m.active&&m.role==='owner')?'Club trials through active owner membership':'No trial assignment';row.append(trialsCell);body.append(row);
    }summary.textContent=`${shown} of ${people.length} accounts`;if(!shown){const row=node('tr',''),cell=node('td','No matching accounts');cell.colSpan=4;row.append(cell);body.append(row);}
   };search.addEventListener('input',render);render();
  }container.append(list);
  const form=node('form','');form.append(node('h3','Change club membership'));
  const select=(label,options)=>{const wrap=node('label',label),el=node('select','');for(const [value,text] of options){const option=node('option',text);option.value=value;el.append(option);}wrap.append(el);form.append(wrap);return el;};
  const club=select('Club',clubs.map(c=>[c.id,c.name]));const people=[...new Map((staff.data||[]).map(p=>[p.user_id,p])).values()];
  const user=select('Staff account',people.map(p=>[p.user_id,p.email||p.user_id]));const role=select('Club role',[['secretary','Secretary'],['scorer','Scorer'],['owner','Club owner']]);const active=select('Membership status',[['true','Active'],['false','Inactive']]);
  const label=node('label','Reason for change'),reason=node('input','');reason.required=true;reason.minLength=5;reason.maxLength=1000;label.append(reason);form.append(label);
  const save=node('button','Save membership change');save.type='submit';form.append(save);
  form.addEventListener('submit',event=>{event.preventDefault();action(async()=>{const {error}=await client.rpc('caro_administrator_membership',{p_club:club.value,p_user:user.value,p_role:role.value,p_active:active.value==='true',p_reason:reason.value.trim()});if(ticket!==generation)return;if(error)throw new Error(error.message||'Membership update failed.');await load(clubs,trials);message('Club membership updated and audited.');});});container.append(form);
  const assignment=node('form','');assignment.append(node('h3','Trial staff assignments'),node('p','The staff account must have an active membership in this trial’s club. Scorer is a limited role and does not grant full secretary access.'));
  const choice=(label,options)=>{const wrap=node('label',label),select=node('select','');for(const [value,text] of options){const option=node('option',text);option.value=value;select.append(option);}wrap.append(select);assignment.append(wrap);return select;};
  const trial=choice('Trial',trials.map(row=>[row.id,row.title+' · '+row.start_date]));const staffAccount=choice('Staff account',people.map(row=>[row.user_id,row.email||row.user_id]));const status=choice('Assignment',[['true','Assign to trial'],['false','Remove trial assignment']]);
  const assignmentLabel=node('label','Reason for assignment change'),assignmentReason=node('input','');assignmentReason.required=true;assignmentReason.minLength=5;assignmentReason.maxLength=1000;assignmentLabel.append(assignmentReason);assignment.append(assignmentLabel);const saveAssignment=node('button','Save trial assignment');saveAssignment.type='submit';assignment.append(saveAssignment);
  assignment.addEventListener('submit',event=>{event.preventDefault();action(async()=>{const {data,error}=await client.rpc('caro_administrator_trial_assignment',{p_trial:trial.value,p_user:staffAccount.value,p_assigned:status.value==='true',p_reason:assignmentReason.value.trim()});if(ticket!==generation)return;if(error)throw new Error(error.message||'Assignment failed.');await load(clubs,trials);message(data?'Trial assignment updated and audited.':'That trial assignment was already in the selected state.');});});container.append(assignment,node('h3','Recent administrative changes'));
  for(const entry of audit.data||[]){const card=node('article','');card.append(node('strong',entry.action),node('p',entry.reason),node('p',`${entry.occurred_at} (UTC timestamp)`));container.append(card);}
  container.hidden=false;return true;
 }
 return {load,clear(){generation++;container.replaceChildren();container.hidden=true;}};
}
