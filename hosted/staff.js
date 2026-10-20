import {createBrowserAuth} from '../src/cloud/auth.js';
import {loadWorkspace,createClub} from '../src/cloud/workspace.js';
import {mountTrialEditor} from './trial-editor.js';
const $=id=>document.getElementById(id);
let client,busy=false,editor;
function message(value,error=false){$('status').textContent=value;$('status').classList.toggle('error',error);}
async function action(work){if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);try{await work();}catch(error){message(error.message||'Unable to complete this action. Please try again.',true);}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}}
function cards(target,rows,empty,describe){target.replaceChildren();if(!rows.length){target.textContent=empty;return;}for(const row of rows){const article=document.createElement('article'),title=document.createElement('h4'),detail=document.createElement('p');const [name,text]=describe(row);title.textContent=name;detail.textContent=text;article.append(title,detail);target.append(article);}}
async function refresh(){
  // Never retain another user's private rows after logout/session expiry.
  $('clubs').replaceChildren();$('trials').replaceChildren();$('identity').textContent='';$('workspace').hidden=true;
  const {data,error}=await client.auth.getUser();
  if(error||!data?.user||data.user.is_anonymous){editor?.clear();$('login').hidden=false;message('Sign in to manage your club.');return;}
  $('login').hidden=true;
  const workspace=await loadWorkspace(client);$('workspace').hidden=false;$('identity').textContent=`Signed in as ${data.user.email}`;
  cards($('clubs'),workspace.clubs,'No clubs yet. Create your club below.',row=>[row.name,row.timezone]);
  cards($('trials'),workspace.trials,'No trials yet. Use Create trial under your club to start.',row=>[row.title,`${row.start_date} to ${row.end_date} · ${row.timezone} · ${row.application_state}`]);
  [...$('clubs').children].forEach((card,i)=>{if(!workspace.clubs[i])return;const club=workspace.clubs[i],button=document.createElement('button');button.textContent='Create trial';button.addEventListener('click',()=>editor.open({id:crypto.randomUUID(),club_id:club.id,title:'',start_date:'',end_date:'',timezone:club.timezone,revision:-1,application_state:'draft',planning:{host:club.name,events:[]}}));card.append(button);});
  [...$('trials').children].forEach((card,i)=>{if(!workspace.trials[i])return;const button=document.createElement('button');button.textContent='Open trial';button.addEventListener('click',()=>editor.open(workspace.trials[i]));card.append(button);});
  message('Workspace loaded securely.');
}
$('auth-form').addEventListener('submit',event=>{event.preventDefault();action(async()=>{const {error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});$('password').value='';if(error)throw new Error('Sign-in failed. Check your email, password and email confirmation.');await refresh();});});
$('signup').addEventListener('click',()=>{if(!$('auth-form').reportValidity())return;action(async()=>{const {error}=await client.auth.signUp({email:$('email').value.trim(),password:$('password').value,options:{emailRedirectTo:location.origin+'/'}});$('password').value='';if(error)throw new Error('Account creation could not be completed. Try again later or contact the trial administrator.');message('Check your email for confirmation, then return here to sign in.');});});
$('club-form').addEventListener('submit',event=>{event.preventDefault();action(async()=>{await createClub(client,$('club-name').value,$('timezone').value);$('club-name').value='';await refresh();});});
$('signout').addEventListener('click',()=>action(async()=>{const {error}=await client.auth.signOut();if(error)throw new Error('Sign out failed. Please retry.');editor.clear();await refresh();}));
$('refresh').addEventListener('click',()=>action(refresh));
try{
  client=createBrowserAuth(__CARO_PUBLIC_CONFIG__,sessionStorage);
  editor=mountTrialEditor({client,container:$('trial-editor'),message,action,onSaved:refresh});
  // Auth callbacks only schedule work; no awaited client calls inside the callback.
  client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){editor.clear(); $('workspace').hidden=true;$('clubs').replaceChildren();$('trials').replaceChildren();$('identity').textContent='';$('login').hidden=false;message('You are signed out.');}});
  await action(async()=>{const code=new URL(location.href).searchParams.get('code');if(code){history.replaceState(null,'',location.pathname);const {error}=await client.auth.exchangeCodeForSession(code);if(error)throw new Error('Email confirmation could not be completed in this tab. Return to sign in, or request a new confirmation.');}await refresh();});
}catch{message('Staff access is not configured yet. Please contact the administrator.',true);}
