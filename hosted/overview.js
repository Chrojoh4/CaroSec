import {hostedReportState} from '../src/domain/hosted-report.js';
import {trialReadiness} from '../src/domain/trial-readiness.js';
import {money} from '../src/domain/premium.js';
import {timestampLabel} from '../src/domain/date-time.js';

export function mountOverview({client,container,action,navigate}){
 let generation=0;
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 function clear(){generation++;container.hidden=true;container.replaceChildren();}
 async function open(trial){
  clear();const ticket=generation;
  const values=await Promise.all([
   client.rpc('caro_report_snapshot',{p_trial:trial.id}),
   client.from('caro_premium_drafts').select('revision').eq('trial_id',trial.id).maybeSingle(),
   client.from('caro_entry_settings').select('premium_draft_revision').eq('trial_id',trial.id).maybeSingle(),
   client.from('caro_public_trials').select('is_live,slug,online_enabled').eq('trial_id',trial.id).eq('is_live',true).maybeSingle()
  ]);
  if(ticket!==generation)return;if(values.some(v=>v.error))throw new Error('The overview could not load. Verify the database updates and trial access, then refresh.');
  const [snapshot,premium,settings,listing]=values.map(v=>v.data);
  if(snapshot?.trial?.id!==trial.id)throw new Error('Trial overview scope could not be verified.');
  const state=hostedReportState(snapshot),model=trialReadiness(trial,state,{premium,settings,listing}),s=model.summary;
  container.hidden=false;container.append(el('h2','Trial overview'),el('p',trial.title),el('p','Saved data as of '+timestampLabel(snapshot.generatedAt,trial.timezone)));
  if(model.practice)container.append(el('p','PRACTICE ONLY — private test records. No real CARO approval or public listing.'));
  if(model.next){const next=el('section');next.className='workflow-next';next.append(el('h3','Your next step'),el('p',model.next.label));const continueButton=el('button','Continue: '+model.next.label);continueButton.type='button';continueButton.addEventListener('click',()=>navigate(model.next.section));next.append(continueButton);container.append(next);}
  const refresh=el('button','Refresh overview');refresh.type='button';refresh.addEventListener('click',()=>action(()=>open(trial)));container.append(refresh);
  container.append(el('h3','At the secretary’s desk'),el('p',s.entries+' entry orders · '+model.pending+' runs awaiting review · '+s.events.reduce((n,e)=>n+e.waitlisted,0)+' runs waitlisted'),el('p','Charges '+money(s.finance.charges)+' · Payments '+money(s.finance.payments)+' · Still owing '+money(s.finance.owing)+' · Credits '+money(s.finance.credit)));
  const shortcuts=el('div');shortcuts.className='report-actions';for(const [section,label] of [['entry-preview','Preview entry form (read-only)'],['entries','Entries and waitlist'],['manual-intake','Record paper / email entry'],['finance','Payments and balances'],['trial-day','Running order, scoring and judge sheets'],['reports','Results and CARO paperwork'],['journal','Activity journal']]){const button=el('button',label);button.type='button';button.className='secondary';button.addEventListener('click',()=>navigate(section));shortcuts.append(button);}container.append(shortcuts);
  if(model.practice&&s.entries===0)container.append(el('p','This practice trial currently has no entry orders. The practice draft supplies trial details and rounds only. Complete the premium and entry pricing, then use Record paper / email entry to add fictional competitors.'));
  const list=el('ol');for(const task of model.tasks){const row=el('li'),button=el('button',(task.done?'✓ ':'')+task.label);button.type='button';button.className='secondary';button.addEventListener('click',()=>navigate(task.section));row.append(button);list.append(row);}container.append(el('h3','Trial preparation and progress'),list);
  for(const warning of s.warnings)container.append(el('p',warning));
  if(state.diagnostics.legacyEntryCount)container.append(el('p',state.diagnostics.legacyEntryCount+' entries need identity review before official paperwork.'));
  if(listing){const a=el('a','Open current public premium');a.href='/public-trial.html?trial='+encodeURIComponent(listing.slug);a.target='_blank';a.rel='noopener';container.append(a);}
 }
 return {open,clear,canLeave:()=>true};
}
