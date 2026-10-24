import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
import {databaseUpdate} from '../scripts/prepare-database-update.js';import {editableUsersUpdate} from '../scripts/prepare-editable-users-update.js';
test('the exact user-facing editable-users SQL is executable, atomic, preserves access and enables RLS',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql as $$select '{}'::jsonb$$;`);
 for(const file of ['202610190001_caro_foundation.sql','20261020153706_hosted_trial_drafts.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 const bundle=await databaseUpdate();
 for(const file of bundle.files.filter(f=>!f.name.includes('editable_users')))await db.exec(await readFile(new URL('../supabase/migrations/'+file.name,import.meta.url),'utf8'));
 const id='00000000-0000-0000-0000-000000000001';await db.query("insert into auth.users values($1,'admin@example.com')",[id]);await db.query("insert into caro_private.system_administrators(user_id,reason) values($1,'Existing administrator')",[id]);
 const sql=await editableUsersUpdate();assert.equal(/^import\s/m.test(sql),false);assert.equal((sql.match(/^begin;$/gm)||[]).length,1);assert.equal((sql.match(/^commit;$/gm)||[]).length,1);
 await db.exec(sql);
 assert.equal((await db.query('select system_role from public.caro_users where user_id=$1',[id])).rows[0].system_role,'administrator');
 assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.caro_users'::regclass")).rows[0].relrowsecurity,true);
 assert.equal((await db.query('select count(*)::int n from public.caro_trials')).rows[0].n,0);
});
