import {showWorkspaceError} from './workspace-errors.js';
import {createStaffAccount} from './account-signup.js';
import {requestPasswordReset,exchangeEmailCallback,saveRecoveredPassword} from './password-recovery.js';
import {trialWorkflow} from './trial-workflow.js';
import {mountEntryPreview} from './entry-preview.js';
import {timezoneLabel} from '../src/domain/date-time.js';
import {mountJudgeAmendments} from './judge-amendments.js';
import {mountOverview} from './overview.js';
import {createBrowserAuth} from '../src/cloud/auth.js';
import {loadWorkspace,createClub} from '../src/cloud/workspace.js';
import {mountTrialEditor} from './trial-editor.js';
import {mountAdministration} from './administration.js';
import {mountPremiumEditor} from './premium-editor.js';
import {mountSanctionEditor} from './sanction-editor.js';
import {mountActivityJournal} from './activity-journal.js';
import {mountFinanceEditor} from './finance-editor.js';
import {mountEntrySettings} from './entry-settings.js';
import {mountManualIntake} from './manual-intake.js';
import {mountEntries} from './entries.js';
import {mountTrialDay} from './trial-day.js';
import {mountReports} from './reports.js';
import sampleTrial from '../fixtures/rallypaws-practice-trial.json';
const $=id=>document.getElementById(id);
let selectedSection='overview',proofLinkHandled=false,recoveryReady=false,adminWorkspace=null;
let entryPreview,judgeAmendments,overview,client,busy=false,editor,administration,premiumEditor,sanctionEditor,journal,finance,entrySettings,manualIntake,entriesPanel,trialDay,reportsPanel,refreshGeneration=0,currentUserId=null,selectedTrialId=null;
function message(value,error=false){$('status').textContent=value;$('status').classList.toggle('error',error);if(error)showWorkspaceError(value);}
document.addEventListener('invalid',event=>{const field=event.target;if(!field.validationMessage)return;event.preventDefault();const label=field.closest('label')?.firstChild?.textContent?.trim()||'This field';message(label+': '+field.validationMessage,true);},true);
async function action(work){
 if(busy)return;busy=true;document.body.setAttribute('aria-busy','true');
 const buttons=[...document.querySelectorAll('button')].map(button=>({button,disabled:button.disabled}));buttons.forEach(({button})=>button.disabled=true);
 try{await work();}catch(error){message(error.message||'Unable to complete this action. Please try again.',true);}
 finally{busy=false;document.body.removeAttribute('aria-busy');for(const {button,disabled} of buttons)if(button.isConnected)button.disabled=disabled;}
}
function clearTrialContext(){administration?.hide();selectedTrialId=null;selectedSection='overview';$('workspace-home-content').hidden=false;for(const button of document.querySelectorAll('#trial-navigation button'))button.removeAttribute('aria-current');$('trial-navigation').hidden=true;$('selected-trial-banner').hidden=true;$('selected-trial-name').textContent='';$('selected-trial-banner').textContent='';}
function leaveEditors(){if(![editor,premiumEditor,sanctionEditor,journal,finance,entrySettings,manualIntake,entriesPanel,trialDay,reportsPanel,judgeAmendments].every(panel=>panel?.canLeave?.()!==false))return false;administration?.hide();editor.clear();premiumEditor.clear();sanctionEditor.clear();journal.clear();finance.clear();entrySettings.clear();manualIntake.clear();entriesPanel.clear();trialDay.clear();reportsPanel.clear();overview?.clear();entryPreview?.clear();judgeAmendments?.clear();return true;}
function openNewTrial(value){if(!leaveEditors())return;clearTrialContext();editor.open(value);}
function showTrialContext(row){selectedTrialId=row.id;$('workspace-home-content').hidden=true;$('trial-navigation').hidden=false;$('selected-trial-banner').hidden=false;$('selected-trial-name').textContent=row.title;$('selected-trial-banner').textContent=(row.is_practice?'PRACTICE · ':'')+row.title+' · '+row.start_date+' to '+row.end_date;}
async function openTrialSection(trialId,section,entryId=null){
 const draftProof=entrySettings?.getDraftProof?.();
 // Proofing is a reversible view of current controls, not a request to discard edits.
 if(draftProof?.trial.id===trialId&&selectedTrialId===trialId&&['entry-preview','entry-paper-proof','entry-settings'].includes(section)&&['entry-settings','entry-preview','entry-paper-proof'].includes(selectedSection)){
  if(section==='entry-settings'){entryPreview.clear();$('entry-settings-panel').hidden=false;}
  else{$('entry-settings-panel').hidden=true;await entryPreview.open(draftProof.trial,{draftRows:draftProof.draftRows,premiumContent:draftProof.premiumContent,downloadPaper:section==='entry-paper-proof'});}
  selectedSection=section;const routeUrl=new URL(location.href);routeUrl.searchParams.set('view',section==='entry-paper-proof'?'entry-preview':section);history.replaceState(null,'',routeUrl);
  for(const button of document.querySelectorAll('#trial-navigation button')){if(button.id==='nav-'+section)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}
  return;
 }
 if(!leaveEditors())return;
 const ticket=refreshGeneration;const {data:row,error}=await client.from('caro_trials').select('id,club_id,title,start_date,end_date,timezone,application_state,is_practice,sanction_status,submitted_on,trial_number,approval_evidence,revision,planning').eq('id',trialId).maybeSingle();
 if(ticket!==refreshGeneration)return;if(error||!row){clearTrialContext();throw new Error('Trial access could not be verified. Refresh your workspace.');}
 selectedSection=section;showTrialContext(row);const routeUrl=new URL(location.href);routeUrl.searchParams.set('trial',row.id);routeUrl.searchParams.set('view',section==='entry-paper-proof'?'entry-preview':section);routeUrl.searchParams.delete('trialTitle');history.replaceState(null,'',routeUrl);for(const button of document.querySelectorAll('#trial-navigation button')){if(button.id==='nav-'+section)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}if(section==='entry-preview'||section==='entry-paper-proof')await entryPreview.open(row,{downloadPaper:section==='entry-paper-proof'});else if(section==='judge-amendments')await judgeAmendments.open(row);else if(section==='overview')await overview.open(row);else if(section==='reports')await reportsPanel.open(row);else if(['trial-day','running-order','judge-sheets','score-entry'].includes(section))await trialDay.open(row,{mode:section==='trial-day'?'all':section});else if(section==='entries')await entriesPanel.open(row);else if(section==='manual-intake')await manualIntake.open(row);else if(section==='entry-settings')await entrySettings.open(row);else if(section==='finance')await finance.open(row,entryId);else if(section==='journal')await journal.open(row);else if(section==='premium')await premiumEditor.open(row);else if(section==='sanction')sanctionEditor.open(row);else editor.open(row);
}
function cards(target,rows,empty,describe){target.replaceChildren();if(!rows.length){target.textContent=empty;return;}for(const row of rows){const article=document.createElement('article'),title=document.createElement('h4'),detail=document.createElement('p');const [name,text]=describe(row);title.textContent=name;detail.textContent=text;article.append(title,detail);target.append(article);}}
async function refresh(){
  if(recoveryReady){$('login').hidden=true;$('workspace').hidden=true;$('request-reset').hidden=true;$('new-password').hidden=false;return;}
  const ticket=++refreshGeneration;
  // Never retain another user's private rows after logout/session expiry.
  $('clubs').replaceChildren();$('trials').replaceChildren();$('identity').textContent='';$('workspace').hidden=true;
  administration?.clear();$('admin-link').hidden=true;
  const {data,error}=await client.auth.getUser();
  if(ticket!==refreshGeneration)return;
  if(error||!data?.user||data.user.is_anonymous){editor?.clear();premiumEditor?.clear();sanctionEditor?.clear();journal?.clear();finance?.clear();entrySettings?.clear();manualIntake?.clear();entriesPanel?.clear();trialDay?.clear();reportsPanel?.clear();overview?.clear();entryPreview?.clear();judgeAmendments?.clear();$('login').hidden=false;message('Sign in to manage your club.');return;}
  $('login').hidden=true;
  if(currentUserId!==data.user.id){editor?.clear();premiumEditor?.clear();sanctionEditor?.clear();journal?.clear();finance?.clear();entrySettings?.clear();manualIntake?.clear();entriesPanel?.clear();trialDay?.clear();reportsPanel?.clear();overview?.clear();entryPreview?.clear();judgeAmendments?.clear();clearTrialContext();currentUserId=data.user.id;}
  const workspace=await loadWorkspace(client);if(ticket!==refreshGeneration)return;$('workspace').hidden=false;$('identity').textContent=`Signed in as ${data.user.email}`;
  if(selectedTrialId){const selected=workspace.trials.find(trial=>trial.id===selectedTrialId);if(selected)showTrialContext(selected);else{editor.clear();premiumEditor.clear();sanctionEditor.clear();journal.clear();finance.clear();entrySettings.clear();manualIntake.clear();entriesPanel.clear();trialDay.clear();reportsPanel.clear();overview?.clear();entryPreview?.clear();judgeAmendments?.clear();clearTrialContext();}}
  adminWorkspace=workspace;const isAdmin=await administration.load(workspace.clubs,workspace.trials);$('admin-link').hidden=!isAdmin;
  if(ticket!==refreshGeneration)return;
  $('club-heading').textContent=isAdmin?'All clubs':'Your clubs';$('trial-heading').textContent=isAdmin?'All trials':'Trials you can access';
  $('club-setup').open=workspace.clubs.length===0;
  cards($('clubs'),workspace.clubs,'No clubs yet. Create your club below.',row=>[row.name,timezoneLabel(row.timezone)]);
  cards($('trials'),workspace.trials,'No trials yet. Use Create trial under your club to start.',row=>[row.title,`${row.start_date} to ${row.end_date} · ${timezoneLabel(row.timezone)} · ${row.application_state}`]);
  [...$('clubs').children].forEach((card,i)=>{if(!workspace.clubs[i])return;const club=workspace.clubs[i],button=document.createElement('button');button.textContent='Create trial';button.addEventListener('click',()=>openNewTrial({id:crypto.randomUUID(),club_id:club.id,title:'',start_date:'',end_date:'',timezone:club.timezone,revision:-1,application_state:'draft',planning:{host:club.name,events:[]}}));const sample=document.createElement('button');sample.textContent='Start fictional practice trial';sample.className='secondary';sample.addEventListener('click',()=>openNewTrial({id:crypto.randomUUID(),club_id:club.id,is_practice:true,title:club.name+' Practice Weekend — TEST ONLY',start_date:sampleTrial.start_date,end_date:sampleTrial.end_date,timezone:sampleTrial.timezone,revision:-1,application_state:'draft',planning:{...structuredClone(sampleTrial.planning),host:club.name}}));card.append(button,sample);});
  [...$('trials').children].forEach((card,i)=>{if(!workspace.trials[i])return;const button=document.createElement('button');button.textContent='Open trial';button.addEventListener('click',()=>action(()=>openTrialSection(workspace.trials[i].id,'overview')));const premium=document.createElement('button');premium.textContent='Premium builder';premium.className='secondary';premium.addEventListener('click',()=>action(()=>openTrialSection(workspace.trials[i].id,'premium')));const sanction=document.createElement('button');sanction.textContent='CARO approval record';sanction.className='secondary';sanction.addEventListener('click',()=>action(()=>openTrialSection(workspace.trials[i].id,'sanction')));card.append(button,premium,sanction);});
  message(isAdmin?'Administrator workspace loaded. All clubs and trials are accessible.':'Workspace loaded securely.');
  if(!proofLinkHandled){const params=new URL(location.href).searchParams,view=params.get('view'),id=params.get('trial'),title=params.get('trialTitle');if(trialWorkflow.some(item=>item.key===view)||view==='entry-paper-proof'){
   const matches=workspace.trials.filter(row=>id?row.id===id:!!title&&row.title===title);if(matches.length!==1)throw new Error('This private preview requires access to the matching trial. Sign in with the authorized secretary account.');
   proofLinkHandled=true;await openTrialSection(matches[0].id,view);return;
  }}
}
function recoveryScreen(name){for(const id of ['login','workspace','request-reset','new-password'])$(id).hidden=id!==name;}
$('forgot-password').addEventListener('click',()=>{$('reset-email').value=$('email').value.trim();$('password').value='';recoveryScreen('request-reset');message('Request a password-reset email.');});
$('reset-back').addEventListener('click',()=>{recoveryScreen('login');message('Sign in to manage your club.');});
$('request-reset-form').addEventListener('submit',event=>{event.preventDefault();action(async()=>message(await requestPasswordReset(client.auth,$('reset-email').value,location.origin)));});
$('new-password-form').addEventListener('submit',event=>{event.preventDefault();action(async()=>{try{const result=await saveRecoveredPassword(client.auth,$('new-password-value').value,$('confirm-password').value,recoveryReady);recoveryReady=false;recoveryScreen('login');message(result);}finally{$('new-password-value').value='';$('confirm-password').value='';}});});
$('cancel-reset').addEventListener('click',()=>action(async()=>{recoveryReady=false;$('new-password-form').reset();await client.auth.signOut({scope:'local'});recoveryScreen('login');message('Password reset cancelled. Your password was not changed.');}));
$('auth-form').addEventListener('submit',event=>{event.preventDefault();action(async()=>{const {error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});$('password').value='';if(error)throw new Error('Sign-in failed. Check your email, password and email confirmation.');await refresh();});});
$('signup').addEventListener('click',()=>{if(!$('auth-form').reportValidity())return;action(async()=>{try{const result=await createStaffAccount(client.auth,$('email').value,$('password').value,location.origin);if(result.signedIn)await refresh();else message(result.message);}finally{$('password').value='';}});});
$('club-form').addEventListener('submit',event=>{event.preventDefault();action(async()=>{await createClub(client,$('club-name').value,$('timezone').value);$('club-name').value='';await refresh();});});
$('signout').addEventListener('click',()=>action(async()=>{const {error}=await client.auth.signOut();if(error)throw new Error('Sign out failed. Please retry.');editor.clear();await refresh();}));
for(const [id,view] of [['admin-users','users'],['admin-assignments','assignments']])$(id).addEventListener('click',()=>action(async()=>{if(!adminWorkspace||!leaveEditors())return;clearTrialContext();const url=new URL(location.href);for(const key of ['trial','trialTitle','view'])url.searchParams.delete(key);history.replaceState(null,'',url.pathname+url.search);$('workspace-home-content').hidden=true;$('admin-link').open=false;const allowed=await administration.load(adminWorkspace.clubs,adminWorkspace.trials,{view,show:true});if(!allowed){$('workspace-home-content').hidden=false;throw new Error('Administrator access is required.');}message(view==='users'?'Users & access loaded.':'Trial assignments loaded.');$('administration').scrollIntoView({behavior:'smooth'});}));
$('workspace-home').addEventListener('click',()=>{if(leaveEditors()){clearTrialContext();const url=new URL(location.href);for(const key of ['trial','trialTitle','view'])url.searchParams.delete(key);history.replaceState(null,'',url);}});
$('refresh').addEventListener('click',()=>action(refresh));
for(const item of trialWorkflow){const button=document.createElement('button');button.id='nav-'+item.key;button.className='secondary';button.textContent=item.label;button.addEventListener('click',()=>{if(selectedTrialId)action(()=>openTrialSection(selectedTrialId,item.key));});$('trial-workflow-links').append(button);}
try{
  client=createBrowserAuth(__CARO_PUBLIC_CONFIG__,sessionStorage,{verifierStorage:localStorage});
  editor=mountTrialEditor({client,container:$('trial-editor'),message,action,navigate:section=>action(()=>openTrialSection(selectedTrialId,section)),onSaved:async value=>{if(value?.id)showTrialContext(value);await refresh();}});
  administration=mountAdministration({client,container:$('administration'),action,message});
  premiumEditor=mountPremiumEditor({client,container:$('premium-panel'),action,message,navigate:section=>action(()=>openTrialSection(selectedTrialId,section))});
  overview=mountOverview({client,container:$('overview-panel'),action,navigate:section=>action(()=>openTrialSection(selectedTrialId,section))});
  entryPreview=mountEntryPreview({client,container:$('entry-preview-panel'),action,message,navigate:section=>action(()=>openTrialSection(selectedTrialId,section))});
  judgeAmendments=mountJudgeAmendments({client,container:$('judge-amendments-panel'),action,message});
  reportsPanel=mountReports({client,container:$('reports-panel'),action,message});
  trialDay=mountTrialDay({client,container:$('trial-day-panel'),action,message});
  entriesPanel=mountEntries({client,container:$('entries-panel'),action,message,onManual:()=>action(()=>openTrialSection(selectedTrialId,'manual-intake')),onFinance:id=>action(()=>openTrialSection(selectedTrialId,'finance',id))});
  manualIntake=mountManualIntake({client,container:$('manual-intake-panel'),action,message,navigate:section=>action(()=>openTrialSection(selectedTrialId,section))});
  entrySettings=mountEntrySettings({client,container:$('entry-settings-panel'),action,message,navigate:section=>action(()=>openTrialSection(selectedTrialId,section))});
  finance=mountFinanceEditor({client,container:$('finance-panel'),action,message});
  journal=mountActivityJournal({client,container:$('journal-panel'),action,message});
  sanctionEditor=mountSanctionEditor({client,container:$('sanction-panel'),action,message,navigate:section=>action(()=>openTrialSection(selectedTrialId,section)),onSaved:async()=>{await refresh();await openTrialSection(selectedTrialId,'sanction');}});
  // Auth callbacks only schedule work; no awaited client calls inside the callback.
  client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){recoveryReady=false;$('new-password').hidden=true;$('request-reset').hidden=true;$('new-password-form').reset();refreshGeneration++;currentUserId=null;adminWorkspace=null;clearTrialContext();editor.clear();administration.clear();premiumEditor.clear();sanctionEditor.clear();journal.clear();finance.clear();entrySettings.clear();manualIntake.clear();entriesPanel.clear();trialDay.clear();reportsPanel.clear();overview?.clear();entryPreview?.clear();judgeAmendments?.clear();$('admin-link').hidden=true; $('workspace').hidden=true;$('clubs').replaceChildren();$('trials').replaceChildren();$('identity').textContent='';$('login').hidden=false;message('You are signed out.');}});
  await action(async()=>{const callback=new URL(location.href),code=callback.searchParams.get('code'),flowId=callback.searchParams.get('sb_flow_id'),requestedRecovery=callback.searchParams.get('auth')==='recovery',callbackError=callback.searchParams.has('error')||callback.searchParams.has('error_code')||new URLSearchParams(callback.hash.slice(1)).has('error');
   if(code||requestedRecovery||callbackError){for(const key of ['code','sb_flow_id','auth','error','error_code','error_description'])callback.searchParams.delete(key);callback.hash='';history.replaceState(null,'',callback.pathname+callback.search);recoveryScreen('login');
    if(callbackError||!code)throw new Error('This email link is invalid or expired. Use Forgot password to request a new link.');
    recoveryReady=await exchangeEmailCallback(client.auth,code,flowId);
    if(requestedRecovery&&!recoveryReady)throw new Error('This is not a password-reset link. Use Forgot password to request a new link.');
    if(recoveryReady){recoveryScreen('new-password');message('Your reset link was verified. Choose a new password.');return;}
   }await refresh();});
}catch{message('Staff access is not configured yet. Please contact the administrator.',true);}
