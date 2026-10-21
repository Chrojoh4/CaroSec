-- System Administrator foundation. No account is promoted by this migration.
begin;
alter table public.caro_trials add column is_practice boolean not null default false;
create table caro_private.system_administrators (
 user_id uuid primary key references auth.users(id), active boolean not null default true,
 granted_by uuid references auth.users(id), reason text not null check(length(btrim(reason))>=5),
 granted_at timestamptz not null default now(), revoked_at timestamptz
);
alter table caro_private.system_administrators enable row level security;
revoke all on caro_private.system_administrators from public,anon,authenticated,service_role;
create table caro_private.administration_audit (
 id uuid primary key default gen_random_uuid(),actor_id uuid references auth.users(id),
 action text not null,target_user uuid references auth.users(id),club_id uuid references public.caro_clubs(id),
 reason text not null,details jsonb not null default '{}',occurred_at timestamptz not null default now()
);
alter table caro_private.administration_audit enable row level security;
revoke all on caro_private.administration_audit from public,anon,authenticated,service_role;
create trigger admin_audit_append_only before update or delete on caro_private.administration_audit
 for each row execute function caro_private.reject_rewrite();
create function caro_private.is_administrator() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
 and exists(select 1 from caro_private.system_administrators where user_id=auth.uid() and active);
$$;
revoke all on function caro_private.is_administrator() from public,anon,authenticated;
grant execute on function caro_private.is_administrator() to authenticated;
create function public.caro_is_administrator() returns boolean
language sql security invoker set search_path='' as $$select caro_private.is_administrator();$$;
revoke all on function public.caro_is_administrator() from public,anon,authenticated;
grant execute on function public.caro_is_administrator() to authenticated;
do $$declare t text;begin
 foreach t in array array['caro_clubs','caro_memberships','caro_trials','caro_trial_assignments','caro_events','caro_premium_versions','caro_public_trials','caro_entries','caro_ledger','caro_scores','caro_completed_events','caro_audit'] loop
 execute format('create policy caro_administrator_read on public.%I for select to authenticated using ((select caro_private.is_administrator()))',t);
 end loop;
end $$;
create function caro_private.administrator_staff() returns table(user_id uuid,email text,club_id uuid,club_name text,role text,active boolean)
language plpgsql security definer set search_path='' as $$
begin
 if not caro_private.is_administrator() then raise exception 'Administrator access required' using errcode='42501'; end if;
 return query select u.id,u.email::text,m.club_id,c.name,m.role,m.active from auth.users u
 left join public.caro_memberships m on m.user_id=u.id left join public.caro_clubs c on c.id=m.club_id order by u.email,c.name;
end;$$;
revoke all on function caro_private.administrator_staff() from public,anon,authenticated;
grant execute on function caro_private.administrator_staff() to authenticated;
create function public.caro_administrator_staff() returns table(user_id uuid,email text,club_id uuid,club_name text,role text,active boolean)
language sql security invoker set search_path='' as $$select * from caro_private.administrator_staff();$$;
revoke all on function public.caro_administrator_staff() from public,anon,authenticated;
grant execute on function public.caro_administrator_staff() to authenticated;
create function caro_private.administrator_membership(p_club uuid,p_user uuid,p_role text,p_active boolean,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); previous jsonb;
begin
 -- Serialize access changes with administrator revocation and other membership edits.
 perform pg_catalog.pg_advisory_xact_lock(774213008);
 if not caro_private.is_administrator() then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_role is null or p_role not in ('owner','secretary','scorer') or p_active is null or p_reason is null or length(btrim(p_reason)) not between 5 and 1000 then raise exception 'Choose a role and provide a reason'; end if;
 perform 1 from public.caro_clubs where id=p_club for update;
 if not found then raise exception 'Club not found'; end if;
 perform 1 from auth.users where id=p_user;
 if not found then raise exception 'Staff account not found'; end if;
 select to_jsonb(m) into previous from public.caro_memberships m where club_id=p_club and user_id=p_user for update;
 if previous->>'role'='owner' and (previous->>'active')::boolean and (p_role<>'owner' or not p_active)
 and not exists(select 1 from public.caro_memberships where club_id=p_club and user_id<>p_user and role='owner' and active) then raise exception 'Keep at least one active club owner'; end if;
 insert into public.caro_memberships(club_id,user_id,role,active) values(p_club,p_user,p_role,p_active)
 on conflict(club_id,user_id) do update set role=excluded.role,active=excluded.active;
 insert into caro_private.administration_audit(actor_id,action,target_user,club_id,reason,details)
 values(caller,'membership.changed',p_user,p_club,btrim(p_reason),jsonb_build_object('before',previous,'role',p_role,'active',p_active));
end;$$;
revoke all on function caro_private.administrator_membership(uuid,uuid,text,boolean,text) from public,anon,authenticated;
grant execute on function caro_private.administrator_membership(uuid,uuid,text,boolean,text) to authenticated;
create function public.caro_administrator_membership(p_club uuid,p_user uuid,p_role text,p_active boolean,p_reason text) returns void
language sql security invoker set search_path='' as $$select caro_private.administrator_membership(p_club,p_user,p_role,p_active,p_reason);$$;
revoke all on function public.caro_administrator_membership(uuid,uuid,text,boolean,text) from public,anon,authenticated;
grant execute on function public.caro_administrator_membership(uuid,uuid,text,boolean,text) to authenticated;
create function caro_private.administrator_audit() returns setof caro_private.administration_audit
language plpgsql security definer set search_path='' as $$begin
 if not caro_private.is_administrator() then raise exception 'Administrator access required' using errcode='42501'; end if;
 return query select * from caro_private.administration_audit order by occurred_at desc,id limit 200;
end;$$;
revoke all on function caro_private.administrator_audit() from public,anon,authenticated;
grant execute on function caro_private.administrator_audit() to authenticated;
create function public.caro_administrator_audit() returns table(id uuid,actor_id uuid,action text,target_user uuid,club_id uuid,reason text,details jsonb,occurred_at timestamptz)
language sql security invoker set search_path='' as $$select * from caro_private.administrator_audit();$$;
revoke all on function public.caro_administrator_audit() from public,anon,authenticated;
grant execute on function public.caro_administrator_audit() to authenticated;
-- Promotion/revocation is deliberately unavailable through browser RPCs.
create function caro_private.guard_last_administrator() returns trigger language plpgsql set search_path='' as $$begin
 perform pg_catalog.pg_advisory_xact_lock(774213008);
 if tg_op='UPDATE' and new.user_id<>old.user_id then raise exception 'Administrator identity is immutable; grant a separate assignment'; end if;
 if old.active and (tg_op='DELETE' or not new.active) and not exists(select 1 from caro_private.system_administrators where active and user_id<>old.user_id) then raise exception 'Cannot revoke the last active Administrator'; end if;
 if tg_op='DELETE' then return old; end if;return new;
end;$$;
revoke all on function caro_private.guard_last_administrator() from public,anon,authenticated;
create trigger keep_last_administrator before update or delete on caro_private.system_administrators for each row execute function caro_private.guard_last_administrator();
create function caro_private.audit_administrator_assignment() returns trigger language plpgsql security definer set search_path='' as $$begin
 insert into caro_private.administration_audit(actor_id,action,target_user,reason,details)
 values(auth.uid(),'administrator.'||lower(tg_op),case when tg_op='DELETE' then old.user_id else new.user_id end,
 case when tg_op='DELETE' then old.reason else new.reason end,
 jsonb_build_object('before',case when tg_op='INSERT' then null else to_jsonb(old) end,'after',case when tg_op='DELETE' then null else to_jsonb(new) end,'source','protected database assignment'));
 if tg_op='DELETE' then return old;end if;return new;
end;$$;
revoke all on function caro_private.audit_administrator_assignment() from public,anon,authenticated;
create trigger audit_administrator_assignment after insert or update or delete on caro_private.system_administrators for each row execute function caro_private.audit_administrator_assignment();
create or replace function caro_private.write_trial_draft(p_id uuid,p_club uuid,p_revision integer,p_title text,p_start date,p_end date,p_timezone text,p_planning jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current_trial public.caro_trials; caller uuid:=auth.uid(); member_role text; item record; event jsonb; next_revision integer;
begin
  if caller is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in required' using errcode='42501'; end if;
  select role into member_role from public.caro_memberships where club_id=p_club and user_id=caller and active for share;
  if caro_private.is_administrator() then member_role:='owner'; end if;
  if member_role is null or member_role not in ('owner','secretary') then raise exception 'Trial access denied' using errcode='42501'; end if;
  if p_id is null or p_revision is null or p_revision < -1 or p_title is null or length(btrim(p_title)) not between 1 and 200 or p_start is null or p_end is null or p_end<p_start or p_end-p_start>30 or p_timezone is null or not caro_private.valid_timezone(p_timezone) then raise exception 'Check trial name, dates and timezone'; end if;
  if p_planning is null or jsonb_typeof(p_planning)<>'object' or octet_length(p_planning::text)>200000 then raise exception 'Invalid draft'; end if;
  for item in select key,value from jsonb_each(p_planning) loop
    if item.key in ('host','venue','address','secretary','email','chair','organizer','organizerEmail','memberReference','chairEmail','surface','ringWidth','ringLength','nearbyNotes') then
      if jsonb_typeof(item.value)<>'string' or length(item.value#>>'{}')>5000 then raise exception 'Invalid draft text'; end if;
    elsif item.key='events' then
      if jsonb_typeof(item.value)<>'array' or jsonb_array_length(item.value)>150 then raise exception 'Invalid draft events'; end if;
      for event in select value from jsonb_array_elements(item.value) loop
        if jsonb_typeof(event)<>'object' or not (event ?& array['id','dayId','level','format','stream','judge','exercises']) then raise exception 'Invalid draft event'; end if;
        if exists(select 1 from jsonb_each(event) e where e.key not in ('id','dayId','level','format','stream','judge','exercises') or jsonb_typeof(e.value)<>'string' or length(e.value#>>'{}')>2000) then raise exception 'Invalid draft event fields'; end if;
        if (event->>'format') not in ('Regular','Team','Brace','Working') or (event->>'level') not in ('Novice','Intermediate','Advanced','Excellent','Versatility','Versatility Excellent','Working') or ((event->>'format'='Working')<>(event->>'level'='Working')) then raise exception 'Invalid event class'; end if;
        if (event->>'dayId') !~ '^\d{4}-\d{2}-\d{2}$' or (event->>'dayId')::date not between p_start and p_end then raise exception 'Event date must be inside trial dates'; end if;
      end loop;
      if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(item.value)) then raise exception 'Duplicate event IDs'; end if;
    else raise exception 'Unknown draft field'; end if;
  end loop;
  -- Serialize creation retries and edits for the same caller-generated trial ID.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,0));
  select * into current_trial from public.caro_trials where id=p_id for update;
  if found then
    if current_trial.club_id<>p_club or not (caro_private.is_administrator() or caro_private.can_read_trial(p_club,p_id)) then raise exception 'Trial access denied' using errcode='42501'; end if;
    if p_revision=-1 then
      if current_trial.application_state='draft' and current_trial.title=btrim(p_title) and current_trial.start_date=p_start and current_trial.end_date=p_end and current_trial.timezone=p_timezone and current_trial.planning=p_planning then return jsonb_build_object('id',p_id,'revision',current_trial.revision); end if;
      raise exception 'Trial already exists; reload before editing';
    end if;
    if current_trial.application_state<>'draft' then raise exception 'Finalized trial is locked'; end if;
    if current_trial.revision<>p_revision then raise exception 'Another change was saved; reload this trial before saving' using errcode='40001'; end if;
    next_revision:=p_revision+1;
    update public.caro_trials set title=btrim(p_title),start_date=p_start,end_date=p_end,timezone=p_timezone,planning=p_planning,revision=next_revision,updated_at=now() where id=p_id;
  else
    if p_revision<>-1 or member_role<>'owner' then raise exception 'Only a club owner can create a trial' using errcode='42501'; end if;
    next_revision:=0;
    insert into public.caro_trials(id,club_id,title,start_date,end_date,timezone,planning) values(p_id,p_club,btrim(p_title),p_start,p_end,p_timezone,p_planning);
  end if;
  insert into public.caro_audit(club_id,trial_id,actor_id,action,reference,details) values(p_club,p_id,caller,case when p_revision=-1 then 'trial.draft_created' else 'trial.draft_saved' end,p_id::text,jsonb_build_object('revision',next_revision));
  return jsonb_build_object('id',p_id,'revision',next_revision);
end;
$$;

commit;
