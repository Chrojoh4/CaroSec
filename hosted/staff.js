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
let selectedSection='overview';
let overview,client,busy=false,editor,administration,premiumEditor,sanctionEditor,journal,finance,entrySettings,manualIntake,entriesPanel,trialDay,reportsPanel,refreshGeneration=0,currentUserId=null,selectedTrialId=null;
function message(value,error=false){$('status').textContent=value;$('status').classList.toggle('error',error);}
async function action(work){
 if(busy)return;busy=true;document.body.setAttribute('aria-busy','true');
 const buttons=[...document.querySelectorAll('button')].map(button=>({button,disabled:button.disabled}));buttons.forEach(({button})=>button.disabled=true);
 try{await work();}catch(error){message(error.message||'Unable to complete this action. Please try again.',true);}
 finally{busy=false;document.body.removeAttribute('aria-busy');for(const {button,disabled} of buttons)if(button.isConnected)button.disabled=disabled;}
}
function clearTrialContext(){selectedTrialId=null;selectedSection='overview';$('workspace-home-content').hidden=false;for(const button of document.querySelectorAll('#trial-navigation button'))button.removeAttribute('aria-current');$('trial-navigation').hidden=true;$('selected-trial-banner').hidden=true;$('selected-trial-name').textContent='';$('selected-trial-banner').textContent='';}
function leaveEditors(){if(![editor,premiumEditor,sanctionEditor,journal,finance,entrySettings,manualIntake,entriesPanel,trialDay,reportsPanel].every(panel=>panel?.canLeave?.()!==false))return false;editor.clear();premiumEditor.clear();sanctionEditor.clear();journal.clear();finance.clear();entrySettings.clear();manualIntake.clear();entriesPanel.clear();trialDay.clear();reportsPanel.clear();overview?.clear();return true;}
function openNewTrial(value){if(!leaveEditors())return;clearTrialContext();editor.open(value);}
function showTrialContext(row){selectedTrialId=row.id;$('workspace-home-content').hidden=true;$('trial-navigation').hidden=false;$('selected-trial-banner').hidden=false;$('selected-trial-name').textContent=row.title;$('selected-trial-banner').textContent=(row.is_practice?'PRACTICE · ':'')+row.title+' · '+row.start_date+' to '+row.end_date+' · '+row.timezone;}
async function openTrialSection(trialId,section,entryId=null){
 if(!leaveEditors())return;
 const ticket=refreshGeneration;const {data:row,error}=await client.from('caro_trials').select('id,club_id,title,start_date,end_date,timezone,application_state,is_practice,sanction_status,submitted_on,trial_number,approval_evidence,revision,planning').eq('id',trialId).maybeSingle();
 if(ticket!==refreshGeneration)return;if(error||!row){clearTrialContext();throw new Error('Trial access could not be verified. Refresh your workspace.');}
 selectedSection=section;showTrialContext(row);for(const button of document.querySelectorAll('#trial-navigation button')){if(button.id==='nav-'+section)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}if(section==='overview')await overview.open(row);else if(section==='reports')await reportsPanel.open(row);else if(section==='trial-day')await trialDay.open(row);else if(section==='entries')await entriesPanel.open(row);else if(section==='manual-intake')await manualIntake.open(row);else if(section==='entry-settings')await entrySettings.open(row);else if(section==='finance')await finance.open(row,entryId);else if(section==='journal')await journal.open(row);else if(section==='premium')await premiumEditor.open(row);else if(section==='sanction')sanctionEditor.open(row);else editor.open(row);
}
function cards(target,rows,empty,describe){target.replaceChildren();if(!rows.length){target.textContent=empty;return;}for(const row of rows){const article=document.createElement('article'),title=document.createElement('h4'),detail=document.createElement('p');const [name,text]=describe(row);title.textContent=name;detail.textContent=text;article.append(title,detail);target.append(article);}}
async function refresh(){
  const ticket=++refreshGeneration;
  // Never retain another user's private rows after logout/session expiry.
  $('clubs').replaceChildren();$('trials').replaceChildren();$('identity').textContent='';$('workspace').hidden=true;
  administration?.clear();$('admin-link').hidden=true;
  const {data,error}=await client.auth.getUser();
  if(ticket!==refreshGeneration)return;
  if(error||!data?.user||data.user.is_anonymous){editor?.clear();premiumEditor?.clear();sanctionEditor?.clear();journal?.clear();finance?.clear();entrySettings?.clear();manualIntake?.clear();entriesPanel?.clear();trialDay?.clear();reportsPanel?.clear();overview?.clear();$('login').hidden=false;message('Sign in to manage your club.');return;}
  $('login').hidden=true;
  if(currentUserId!==data.user.id){editor?.clear();premiumEditor?.clear();sanctionEditor?.clear();journal?.clear();finance?.clear();entrySettings?.clear();manualIntake?.clear();entriesPanel?.clear();trialDay?.clear();reportsPanel?.clear();overview?.clear();clearTrialContext();currentUserId=data.user.id;}
  const workspace=await loadWorkspace(client);if(ticket!==refreshGeneration)return;$('workspace').hidden=false;$('identity').textContent=`Signed in as ${data.user.email}`;
  if(selectedTrialId){const selected=workspace.trials.find(trial=>trial.id===selectedTrialId);if(selected)showTrialContext(selected);else{editor.clear();premiumEditor.clear();sanctionEditor.clear();journal.clear();finance.clear();entrySettings.clear();manualIntake.clear();entriesPanel.clear();trialDay.clear();reportsPanel.clear();overview?.clear();clearTrialContext();}}
  const isAdmin=await administration.load(workspace.clubs,workspace.trials);$('admin-link').hidden=!isAdmin;
  if(ticket!==refreshGeneration)return;
  $('club-heading').textContent=isAdmin?'All clubs':'Your clubs';$('trial-heading').textContent=isAdmin?'All trials':'Trials you can access';
  $('club-setup').open=workspace.clubs.length===0;
  cards($('clubs'),workspace.clubs,'No clubs yet. Create your club below.',row=>[row.name,row.timezone]);
  cards($('trials'),workspace.trials,'No trials yet. Use Create trial under your club to start.',row=>[row.title,`${row.start_date} to ${row.end_date} · ${row.timezone} · ${row.application_state}`]);
  [...$('clubs').children].forEach((card,i)=>{if(!workspace.clubs[i])return;const club=workspace.clubs[i],button=document.createElement('button');button.textContent='Create trial';button.addEventListener('click',()=>openNewTrial({id:crypto.randomUUID(),club_id:club.id,title:'',start_date:'',end_date:'',timezone:club.timezone,revision:-1,application_state:'draft',planning:{host:club.name,events:[]}}));const sample=document.createElement('button');sample.textContent='Start fictional practice trial';sample.className='secondary';sample.addEventListener('click',()=>openNewTrial({id:crypto.randomUUID(),club_id:club.id,is_practice:true,title:club.name+' Practice Weekend — TEST ONLY',start_date:sampleTrial.start_date,end_date:sampleTrial.end_date,timezone:sampleTrial.timezone,revision:-1,application_state:'draft',planning:{...structuredClone(sampleTrial.planning),host:club.name}}));card.append(button,sample);});
  [...$('trials').children].forEach((card,i)=>{if(!workspace.trials[i])return;const button=document.createElement('button');button.textContent='Open trial';button.addEventListener('click',()=>action(()=>openTrialSection(workspace.trials[i].id,'overview')));const premium=document.createElement('button');premium.textContent='Premium builder';premium.className='secondary';premium.addEventListener('click',()=>action(()=>openTrialSection(workspace.trials[i].id,'premium')));const sanction=document.createElement('button');sanction.textContent='CARO approval record';sanction.className='secondary';sanction.addEventListener('click',()=>action(()=>openTrialSection(workspace.trials[i].id,'sanction')));card.append(button,premium,sanction);});
  message(isAdmin?'Administrator workspace loaded. All clubs and trials are accessible.':'Workspace loaded securely.');
}
$('auth-form').addEventListener('submit',event=>{event.preventDefault();action(async()=>{const {error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});$('password').value='';if(error)throw new Error('Sign-in failed. Check your email, password and email confirmation.');await refresh();});});
$('signup').addEventListener('click',()=>{if(!$('auth-form').reportValidity())return;action(async()=>{const {error}=await client.auth.signUp({email:$('email').value.trim(),password:$('password').value,options:{emailRedirectTo:location.origin+'/'}});$('password').value='';if(error)throw new Error('Account creation could not be completed. Try again later or contact the trial administrator.');message('Check your email for confirmation, then return here to sign in.');});});
$('club-form').addEventListener('submit',event=>{event.preventDefault();action(async()=>{await createClub(client,$('club-name').value,$('timezone').value);$('club-name').value='';await refresh();});});
$('signout').addEventListener('click',()=>action(async()=>{const {error}=await client.auth.signOut();if(error)throw new Error('Sign out failed. Please retry.');editor.clear();await refresh();}));
$('workspace-home').addEventListener('click',()=>{if(leaveEditors())clearTrialContext();});
$('refresh').addEventListener('click',()=>action(refresh));
for(const [id,section] of [['nav-overview','overview'],['nav-application','application'],['nav-premium','premium'],['nav-sanction','sanction'],['nav-journal','journal'],['nav-finance','finance'],['nav-entry-settings','entry-settings'],['nav-manual-intake','manual-intake'],['nav-entries','entries'],['nav-trial-day','trial-day'],['nav-reports','reports']])$(id).addEventListener('click',()=>{if(selectedTrialId)action(()=>openTrialSection(selectedTrialId,section));});
try{
  client=createBrowserAuth(__CARO_PUBLIC_CONFIG__,sessionStorage);
  editor=mountTrialEditor({client,container:$('trial-editor'),message,action,onSaved:async value=>{if(value?.id)showTrialContext(value);await refresh();}});
  administration=mountAdministration({client,container:$('administration'),action,message});
  premiumEditor=mountPremiumEditor({client,container:$('premium-panel'),action,message,navigate:section=>action(()=>openTrialSection(selectedTrialId,section))});
  overview=mountOverview({client,container:$('overview-panel'),action,navigate:section=>action(()=>openTrialSection(selectedTrialId,section))});
  reportsPanel=mountReports({client,container:$('reports-panel'),action,message});
  trialDay=mountTrialDay({client,container:$('trial-day-panel'),action,message});
  entriesPanel=mountEntries({client,container:$('entries-panel'),action,message,onManual:()=>action(()=>openTrialSection(selectedTrialId,'manual-intake')),onFinance:id=>action(()=>openTrialSection(selectedTrialId,'finance',id))});
  manualIntake=mountManualIntake({client,container:$('manual-intake-panel'),action,message,navigate:section=>action(()=>openTrialSection(selectedTrialId,section))});
  entrySettings=mountEntrySettings({client,container:$('entry-settings-panel'),action,message,navigate:section=>action(()=>openTrialSection(selectedTrialId,section))});
  finance=mountFinanceEditor({client,container:$('finance-panel'),action,message});
  journal=mountActivityJournal({client,container:$('journal-panel'),action,message});
  sanctionEditor=mountSanctionEditor({client,container:$('sanction-panel'),action,message,onSaved:refresh});
  // Auth callbacks only schedule work; no awaited client calls inside the callback.
  client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){refreshGeneration++;currentUserId=null;clearTrialContext();editor.clear();administration.clear();premiumEditor.clear();sanctionEditor.clear();journal.clear();finance.clear();entrySettings.clear();manualIntake.clear();entriesPanel.clear();trialDay.clear();reportsPanel.clear();overview?.clear();$('admin-link').hidden=true; $('workspace').hidden=true;$('clubs').replaceChildren();$('trials').replaceChildren();$('identity').textContent='';$('login').hidden=false;message('You are signed out.');}});
  await action(async()=>{const code=new URL(location.href).searchParams.get('code');if(code){history.replaceState(null,'',location.pathname);const {error}=await client.auth.exchangeCodeForSession(code);if(error)throw new Error('Email confirmation could not be completed in this tab. Return to sign in, or request a new confirmation.');}await refresh();});
}catch{message('Staff access is not configured yet. Please contact the administrator.',true);}
