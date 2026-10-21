// Serialized into an isolated extension context. Keep this function self-contained.
export function fillOfficialFields(packet,overwrite=false){
 if(location.origin!=='https://app.canadianrallyo.ca'||!/^\/trialapplication\/?$/.test(location.pathname))throw new Error('Open the official CARO Trial Application before filling.');
 if(packet?.kind!=='caro-official-application-transfer'||packet.version!==1||!packet.fields||packet.trial?.practice!==false)throw new Error('Only reviewed real-trial packets can fill the official site. Practice packets cannot be transferred.');
 const ids={professionalMemberEmail:'professional_member_email','host.name':'host_name','host.website':'website','host.chairperson':'chairperson','host.chairpersonEmail':'chairperson_email','host.secretary':'secretary','host.secretaryEmail':'secretary_email'};
 const allowed=[...Object.keys(ids),'trial.startDate','trial.endDate','trial.venueName','trial.address','trial.city','trial.province','trial.postalCode','trial.country','trialTypes.rally','trialTypes.working'];
 const controls=[...document.querySelectorAll('input,select,textarea')],results=[];
 for(const key of allowed){
  const value=packet.fields[key];if(value===undefined||value===null||value==='')continue;
  if(!['string','boolean'].includes(typeof value)||(typeof value==='string'&&value.length>5000))throw new Error('Invalid transfer field.');
  const matches=controls.filter(node=>!node.disabled&&!node.readOnly&&node.type!=='hidden'&&node.getClientRects().length&&getComputedStyle(node).visibility!=='hidden'&&
   ((ids[key]&&node.id===ids[key])||['wire:model','wire:model.defer','wire:model.live','wire:model.blur'].some(name=>node.getAttribute(name)===key)));
  if(matches.length!==1){results.push({field:key,status:matches.length?'ambiguous - unchanged':'not on this page'});continue;}
  const node=matches[0],checkbox=node.type==='checkbox';
  if(checkbox&&typeof value!=='boolean'){results.push({field:key,status:'type mismatch - unchanged'});continue;}
  if(!checkbox&&typeof value!=='string'){results.push({field:key,status:'type mismatch - unchanged'});continue;}
  if(!overwrite&&(checkbox?node.checked:String(node.value||'').trim()!=='')){results.push({field:key,status:'existing value - unchanged'});continue;}
  let target=value;
  if(node.tagName==='SELECT'){
   const norm=s=>String(s).trim().toLowerCase();const options=[...node.options].filter(o=>!o.disabled&&norm(o.textContent)===norm(value));
   if(options.length!==1){results.push({field:key,status:'choose the official option manually'});continue;}target=options[0].value;
  }
  const prototype=node.tagName==='SELECT'?HTMLSelectElement.prototype:node.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype,checkbox?'checked':'value').set.call(node,target);
  node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));results.push({field:key,status:'filled - review on CARO'});
 }
 // Never click Find, Next, Add, Finalize, Pay or Submit; never set Livewire state.
 return results;
}
