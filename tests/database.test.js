import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const ids={owner:'00000000-0000-0000-0000-000000000001',other:'00000000-0000-0000-0000-000000000002',secretary:'00000000-0000-0000-0000-000000000003',scorer:'00000000-0000-0000-0000-000000000004'};
test('Supabase migration compiles and enforces club isolation, private data, grants and record locks',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
 insert into auth.users values ${Object.values(ids).map(id=>`('${id}')`).join(',')};`);
 await db.exec(await readFile(new URL('../supabase/migrations/202610190001_caro_foundation.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261020153706_hosted_trial_drafts.sql',import.meta.url),'utf8'));
 const as=async(role,user='')=>{await db.exec(`reset role;set role ${role}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.query("select set_config('request.jwt.claims','{}',false)");};
 const one=async(sql,params=[]) => (await db.query(sql,params)).rows[0];
 let clubA,clubB,trialA,trialB,event,premium,entry;
 await t.test('signed-in user can create own club atomically, anonymous cannot',async()=>{
  await as('anon');await assert.rejects(()=>db.query("select public.caro_create_club('No','America/Edmonton')"),/permission denied/);
  await as('authenticated',ids.owner);clubA=(await one("select public.caro_create_club('Club A','America/Edmonton') as id")).id;
  await db.query("select set_config('request.jwt.claims','{\"is_anonymous\":true}',false)");
  await assert.rejects(()=>db.query("select public.caro_create_club('Anonymous','America/Edmonton')"),/Sign in required/);
  await db.query("select set_config('request.jwt.claims','{}',false)");
  assert.equal((await one('select count(*)::int n from public.caro_memberships')).n,1);
  await assert.rejects(()=>db.query("select public.caro_create_club('Bad','fake-zone')"),/check constraint/);
  await as('authenticated',ids.other);clubB=(await one("select public.caro_create_club('Club B','America/Vancouver') as id")).id;
  assert.equal((await one('select count(*)::int n from public.caro_clubs')).n,1);
 });
 await t.test('trusted server inserts calendar dates, UTC timestamps and private trial records',async()=>{
  await as('service_role');
  trialA=(await one("insert into public.caro_trials(club_id,title,start_date,end_date,timezone) values($1,'Trial A','2026-11-01','2026-11-02','America/Edmonton') returning id",[clubA])).id;
  trialB=(await one("insert into public.caro_trials(club_id,title,start_date,end_date,timezone) values($1,'Trial B','2026-11-01','2026-11-01','America/Vancouver') returning id",[clubB])).id;
  await db.query("insert into public.caro_memberships(club_id,user_id,role) values($1,$2,'secretary'),($1,$3,'scorer')",[clubA,ids.secretary,ids.scorer]);
  event=(await one("insert into public.caro_events(club_id,trial_id,local_key,official_round,local_date,format,level,judge_name) values($1,$2,'e1',1,'2026-11-01','Regular','Novice','Test judge') returning id",[clubA,trialA])).id;
  premium=(await one("insert into public.caro_premium_versions(club_id,trial_id,version,snapshot,agreement_version,reviewed_by) values($1,$2,1,'{}','v1',$3) returning id",[clubA,trialA,ids.owner])).id;
  entry=(await one("insert into public.caro_entries(club_id,trial_id,premium_id,idempotency_key,request_hash,receipt_token_hash,intake_channel,details,amount_cents,agreement_version,agreement_accepted_at) values($1,$2,$3,'test-request','test-hash',repeat('a',64),'paper','{\"contact\":\"Private\"}',2500,'v1',now()) returning id",[clubA,trialA,premium])).id;
  await assert.rejects(()=>db.query("insert into public.caro_entries(club_id,trial_id,premium_id,idempotency_key,request_hash,receipt_token_hash,intake_channel,details,amount_cents,agreement_version,agreement_accepted_at) values($1,$2,$3,'forged','hash',repeat('b',64),'paper','{}',2500,'v1',now())",[clubB,trialB,premium]),/foreign key/);
 });
 await t.test('other club and unassigned staff cannot read contacts; assigned secretary can',async()=>{
  await as('authenticated',ids.other);assert.equal((await one('select count(*)::int n from public.caro_entries')).n,0);
  await as('authenticated',ids.secretary);assert.equal((await one('select count(*)::int n from public.caro_entries')).n,0);
  await assert.rejects(()=>db.query("update public.caro_memberships set role='owner'"),/permission denied/);
  await assert.rejects(()=>db.query("insert into public.caro_trial_assignments(club_id,trial_id,user_id) values($1,$2,$3)",[clubA,trialA,ids.secretary]),/permission denied/);
  await as('service_role');await db.query('insert into public.caro_trial_assignments(club_id,trial_id,user_id) values($1,$2,$3),($1,$2,$4)',[clubA,trialA,ids.secretary,ids.scorer]);
  await as('authenticated',ids.secretary);assert.equal((await one('select count(*)::int n from public.caro_entries')).n,1);
  await assert.rejects(()=>db.query("update public.caro_entries set amount_cents=1"),/permission denied/);
  await as('authenticated',ids.scorer);assert.equal((await one('select count(*)::int n from public.caro_entries')).n,0);
 });
 await t.test('public projection remains closed until approved; private tables cannot be enumerated',async()=>{
  await as('service_role');
  const insert="insert into public.caro_public_trials(club_id,trial_id,premium_id,slug,title,host_name,venue,public_email,start_date,end_date,timezone,opens_on,closes_on,is_live) values($1,$2,$3,'trial-a','Trial A','Club A','Venue','public@example.com','2026-11-01','2026-11-02','America/Edmonton','2026-10-20','2026-10-31',true)";
  await assert.rejects(()=>db.query(insert,[clubA,trialA,premium]),/CARO approval/);
  await db.query("update public.caro_trials set application_state='finalized',sanction_status='approved',trial_number='Test',approval_evidence='Test evidence' where id=$1",[trialA]);
  await db.query(insert,[clubA,trialA,premium]);
  await assert.rejects(()=>db.query("update public.caro_trials set application_state='draft',sanction_status='not_submitted' where id=$1",[trialA]),/locked/);
  await assert.rejects(()=>db.query("update public.caro_trials set start_date='2026-10-31' where id=$1",[trialA]),/locked/);
  await as('anon');const pub=await one('select * from public.caro_public_trials');assert.equal(pub.title,'Trial A');assert.equal(pub.details,undefined);assert.equal(pub.planning,undefined);
  await assert.rejects(()=>db.query('select * from public.caro_entries'),/permission denied/);
  await assert.rejects(()=>db.query('select * from public.caro_trials'),/permission denied/);
 });
 await t.test('withdrawing sanction approval immediately hides the public listing',async()=>{
  await as('service_role');await db.query("update public.caro_trials set sanction_status='rejected' where id=$1",[trialA]);
  await as('anon');assert.equal((await one('select count(*)::int n from public.caro_public_trials')).n,0);
 });
 await t.test('financial history and premium snapshots cannot be rewritten, even by trusted server',async()=>{
  await as('service_role');await db.query("insert into public.caro_ledger(club_id,trial_id,entry_id,kind,cents,note) values($1,$2,$3,'charge',2500,'Test charge')",[clubA,trialA,entry]);
  await assert.rejects(()=>db.query('update public.caro_ledger set cents=1'),/permission denied/);
  await assert.rejects(()=>db.query('delete from public.caro_ledger'),/permission denied/);
  await assert.rejects(()=>db.query("update public.caro_premium_versions set snapshot='{}'"),/permission denied/);
  await db.exec('reset role');await assert.rejects(()=>db.query('update public.caro_ledger set cents=1'),/Append-only/);
 });
 await t.test('hosted drafts restrict clubs, reject stale edits and append one audit per successful save',async()=>{
  const draftId='10000000-0000-0000-0000-000000000001';
  const sql='select public.caro_save_trial_draft($1,$2,$3,$4,$5,$6,$7,$8) as result';
  const args=[draftId,clubA,-1,'Draft trial','2027-01-02','2027-01-03','America/Edmonton',{host:'Club A',events:[]}];
  await as('anon');await assert.rejects(()=>db.query(sql,args),/permission denied/);
  await as('authenticated',ids.other);await assert.rejects(()=>db.query(sql,args),/access denied/);
  await as('authenticated',ids.scorer);await assert.rejects(()=>db.query(sql,args),/access denied/);
  await as('authenticated',ids.owner);
  assert.equal((await one(sql,args)).result.revision,0);
  assert.equal((await one(sql,args)).result.revision,0); // retry does not duplicate
  assert.equal((await one('select count(*)::int n from public.caro_audit where trial_id=$1',[draftId])).n,1);
  const edit=[...args];edit[2]=0;edit[3]='Updated trial';
  assert.equal((await one(sql,edit)).result.revision,1);
  await assert.rejects(()=>db.query(sql,edit),/Another change/);
  const malicious=[...edit];malicious[2]=1;malicious[7]={externalStatus:'approved'};
  await assert.rejects(()=>db.query(sql,malicious),/Unknown draft/);
  const badEvent=[...edit];badEvent[2]=1;badEvent[7]={events:[{id:'e1',dayId:'2028-01-01',format:'Regular',level:'Novice',stream:'A',judge:'Judge',exercises:''}]};
  await assert.rejects(()=>db.query(sql,badEvent),/Event date/);
  await as('authenticated',ids.secretary);await assert.rejects(()=>db.query(sql,[...edit.slice(0,2),1,...edit.slice(3)]),/access denied/);
  await as('service_role');await db.query('insert into public.caro_trial_assignments(club_id,trial_id,user_id) values($1,$2,$3)',[clubA,draftId,ids.secretary]);
  await as('authenticated',ids.secretary);assert.equal((await one(sql,[...edit.slice(0,2),1,...edit.slice(3)])).result.revision,2);
  await as('service_role');await db.query("update public.caro_trials set application_state='finalized' where id=$1",[draftId]);
  await as('authenticated',ids.owner);await assert.rejects(()=>db.query(sql,[...edit.slice(0,2),2,...edit.slice(3)]),/Finalized/);
  assert.equal((await one('select count(*)::int n from public.caro_audit where trial_id=$1',[draftId])).n,3);
 });
 await t.test('finalized official events lock, score revisions append, completed results reject new revisions',async()=>{
  await as('service_role');await assert.rejects(()=>db.query("update public.caro_events set official_round=2 where id=$1",[event]),/locked/);
  await assert.rejects(()=>db.query("insert into public.caro_events(club_id,trial_id,local_key,official_round,local_date,format,level,judge_name) values($1,$2,'late',2,'2026-11-01','Regular','Novice','Judge')",[clubA,trialA]),/locked/);
  const score="insert into public.caro_scores(club_id,trial_id,entry_id,event_id,version,judge_name,judge_confirmed,outcome,actor_id,correction_reason) values($1,$2,$3,$4,$5,'Test judge',true,'{\"score\":190,\"outcome\":\"Q\"}',$6,$7)";
  await db.query(score,[clubA,trialA,entry,event,1,ids.owner,null]);
  await assert.rejects(()=>db.query(score,[clubA,trialA,entry,event,2,ids.owner,null]),/check constraint/);
  await db.query(score,[clubA,trialA,entry,event,2,ids.owner,'Recording error corrected']);
  await db.query('insert into public.caro_completed_events(club_id,trial_id,event_id,signoff,actor_id) values($1,$2,$3,$4,$5)',[clubA,trialA,event,'Signed test record',ids.owner]);
  await assert.rejects(()=>db.query(score,[clubA,trialA,entry,event,3,ids.owner,'Late correction']),/complete/);
 });
});
