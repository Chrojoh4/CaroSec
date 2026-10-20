-- CARO foundation. Apply once through authorized Supabase migration tooling.
-- This migration changes only new caro_* objects. No credentials or seed users.
begin;

create schema if not exists caro_private;
revoke all on schema caro_private from public, anon, authenticated;

create function caro_private.valid_timezone(value text) returns boolean
language sql stable set search_path = '' as $$
  select exists(select 1 from pg_catalog.pg_timezone_names where name=value);
$$;

create table public.caro_clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(btrim(name)) between 1 and 150),
  timezone text not null check(caro_private.valid_timezone(timezone)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.caro_memberships (
  club_id uuid not null references public.caro_clubs(id),
  user_id uuid not null references auth.users(id),
  role text not null check(role in ('owner','secretary','scorer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key(club_id,user_id)
);
create table public.caro_trials (
  id uuid primary key default gen_random_uuid(), club_id uuid not null references public.caro_clubs(id),
  title text not null check(length(btrim(title)) between 1 and 200),
  start_date date not null, end_date date not null check(end_date>=start_date),
  timezone text not null check(caro_private.valid_timezone(timezone)),
  application_state text not null default 'draft' check(application_state in ('draft','finalized')),
  sanction_status text not null default 'not_submitted' check(sanction_status in ('not_submitted','submitted','approved','rejected')),
  trial_number text, approval_evidence text,
  planning jsonb not null default '{}'::jsonb check(jsonb_typeof(planning)='object'),
  revision integer not null default 0 check(revision>=0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(club_id,id),
  check(sanction_status<>'approved' or (application_state='finalized' and length(btrim(trial_number))>0 and length(btrim(approval_evidence))>0 and trial_number is not null and approval_evidence is not null))
);
create table public.caro_trial_assignments (
  club_id uuid not null, trial_id uuid not null, user_id uuid not null,
  created_at timestamptz not null default now(), primary key(trial_id,user_id),
  foreign key(club_id,trial_id) references public.caro_trials(club_id,id),
  foreign key(club_id,user_id) references public.caro_memberships(club_id,user_id)
);
create table public.caro_events (
  id uuid primary key default gen_random_uuid(),club_id uuid not null,trial_id uuid not null,
  local_key text not null, official_round integer not null check(official_round>0),
  local_date date not null, format text not null check(format in ('Regular','Team','Brace','Working')),
  level text not null, judge_name text not null,
  offerings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(club_id,trial_id,id),unique(trial_id,local_key),unique(trial_id,official_round),
  foreign key(club_id,trial_id) references public.caro_trials(club_id,id)
);
create table public.caro_premium_versions (
  id uuid primary key default gen_random_uuid(),club_id uuid not null,trial_id uuid not null,
  version integer not null check(version>0),
  snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),
  agreement_version text not null,
  reviewed_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(club_id,trial_id,id),unique(trial_id,version),
  foreign key(club_id,trial_id) references public.caro_trials(club_id,id)
);
-- Dedicated public columns; never a SELECT * view over private planning/entries.
create table public.caro_public_trials (
  id uuid primary key default gen_random_uuid(),club_id uuid not null,trial_id uuid not null,premium_id uuid not null,
  slug text not null unique check(slug ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  title text not null,host_name text not null,venue text not null,public_email text not null,
  start_date date not null,end_date date not null,timezone text not null check(caro_private.valid_timezone(timezone)),
  opens_on date not null,closes_on date not null check(closes_on>=opens_on),
  is_live boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key(club_id,trial_id,premium_id) references public.caro_premium_versions(club_id,trial_id,id)
);
create table public.caro_entries (
  id uuid primary key default gen_random_uuid(),club_id uuid not null,trial_id uuid not null,premium_id uuid not null,
  idempotency_key text not null check(length(idempotency_key) between 1 and 100),request_hash text not null,
  receipt_token_hash text not null unique check(receipt_token_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'submitted' check(status in ('submitted','accepted','checked_in','waitlisted','withdrawn','rejected')),
  intake_channel text not null check(intake_channel in ('online','email','paper')),
  details jsonb not null check(jsonb_typeof(details)='object'),
  amount_cents integer not null check(amount_cents>=0),
  eligibility text not null default 'declared_not_verified' check(eligibility='declared_not_verified'),
  agreement_version text not null,agreement_accepted_at timestamptz not null,
  revision integer not null default 0 check(revision>=0),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  unique(club_id,trial_id,id),unique(trial_id,idempotency_key),
  foreign key(club_id,trial_id,premium_id) references public.caro_premium_versions(club_id,trial_id,id)
);
create table public.caro_ledger (
  id uuid primary key default gen_random_uuid(),club_id uuid not null,trial_id uuid not null,entry_id uuid not null,
  kind text not null check(kind in ('charge','payment','refund','waiver')),
  cents integer not null check(cents>0),note text not null,method text,
  actor_id uuid references auth.users(id),occurred_at timestamptz not null default now(),
  foreign key(club_id,trial_id,entry_id) references public.caro_entries(club_id,trial_id,id)
);
create table public.caro_scores (
  id uuid primary key default gen_random_uuid(),club_id uuid not null,trial_id uuid not null,entry_id uuid not null,event_id uuid not null,
  version integer not null check(version>0),judge_name text not null,judge_confirmed boolean not null check(judge_confirmed),
  outcome jsonb not null check(jsonb_typeof(outcome)='object' or jsonb_typeof(outcome)='array'),
  correction_reason text,actor_id uuid not null references auth.users(id),occurred_at timestamptz not null default now(),
  unique(entry_id,event_id,version),
  check(version=1 or length(btrim(correction_reason))>0 and correction_reason is not null),
  foreign key(club_id,trial_id,entry_id) references public.caro_entries(club_id,trial_id,id),
  foreign key(club_id,trial_id,event_id) references public.caro_events(club_id,trial_id,id)
);
create table public.caro_completed_events (
  club_id uuid not null,trial_id uuid not null,event_id uuid primary key,
  signoff text not null check(length(btrim(signoff))>0),
  actor_id uuid not null references auth.users(id),occurred_at timestamptz not null default now(),
  foreign key(club_id,trial_id,event_id) references public.caro_events(club_id,trial_id,id)
);
create table public.caro_audit (
  id uuid primary key default gen_random_uuid(),club_id uuid not null,trial_id uuid not null,
  actor_id uuid references auth.users(id),action text not null,reference text not null,
  details jsonb not null default '{}'::jsonb,occurred_at timestamptz not null default now(),
  foreign key(club_id,trial_id) references public.caro_trials(club_id,id)
);

create function caro_private.is_member(p_club uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.caro_memberships where club_id=p_club and user_id=(select auth.uid()) and active);
$$;
create function caro_private.is_owner(p_club uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.caro_memberships where club_id=p_club and user_id=(select auth.uid()) and active and role='owner');
$$;
create function caro_private.can_read_trial(p_club uuid,p_trial uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.caro_memberships m where m.club_id=p_club and m.user_id=(select auth.uid()) and m.active
    and (m.role='owner' or (m.role='secretary' and exists(select 1 from public.caro_trial_assignments a where a.club_id=p_club and a.trial_id=p_trial and a.user_id=m.user_id))));
$$;
revoke all on all functions in schema caro_private from public,anon,authenticated;
grant usage on schema caro_private to authenticated;
grant usage on schema caro_private to service_role;
grant execute on function caro_private.valid_timezone(text) to service_role;
grant execute on function caro_private.is_member(uuid),caro_private.is_owner(uuid),caro_private.can_read_trial(uuid,uuid) to authenticated;

-- No self-promotion/membership write endpoint. Owners are created atomically here;
-- additional memberships require a separately authorized server command.
create function caro_private.create_club(p_name text,p_timezone text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; caller uuid := auth.uid();
begin
  if caller is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in required' using errcode='42501'; end if;
  insert into public.caro_clubs(name,timezone) values(p_name,p_timezone) returning id into result;
  insert into public.caro_memberships(club_id,user_id,role) values(result,caller,'owner');
  return result;
end;
$$;
revoke all on function caro_private.create_club(text,text) from public,anon,authenticated,service_role;
grant execute on function caro_private.create_club(text,text) to authenticated;
create function public.caro_create_club(p_name text,p_timezone text) returns uuid
language sql security invoker set search_path='' as $$
  select caro_private.create_club(p_name,p_timezone);
$$;
revoke all on function public.caro_create_club(text,text) from public,anon,authenticated;
grant execute on function public.caro_create_club(text,text) to authenticated;

create function caro_private.reject_rewrite() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Append-only record; retain history'; end;
$$;
create function caro_private.guard_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    perform 1 from public.caro_trials where id=new.trial_id for update;
    if exists(select 1 from public.caro_trials where id=new.trial_id and application_state='finalized') then raise exception 'Finalized official event is locked'; end if;
    return new;
  end if;
  perform 1 from public.caro_trials where id=old.trial_id for update;
  if exists(select 1 from public.caro_trials where id=old.trial_id and application_state='finalized') then
    raise exception 'Finalized official event is locked';
  end if;
  if tg_op='UPDATE' and (new.trial_id<>old.trial_id or new.club_id<>old.club_id or new.id<>old.id) then raise exception 'Event identity cannot be reassigned'; end if;
  if tg_op='DELETE' then return old; end if; return new;
end;
$$;
create function caro_private.guard_score() returns trigger language plpgsql security definer set search_path='' as $$
begin
  -- Share the event row lock with sign-off, serializing score insertion and closing.
  perform 1 from public.caro_events where id=new.event_id for update;
  if exists(select 1 from public.caro_completed_events where event_id=new.event_id) then raise exception 'Trial Record is complete'; end if;
  return new;
end;
$$;
create function caro_private.guard_completion() returns trigger language plpgsql security definer set search_path='' as $$
begin perform 1 from public.caro_events where id=new.event_id for update; return new; end;
$$;
create function caro_private.guard_publication() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.caro_trials where id=new.trial_id for update;
  if new.is_live and not exists(select 1 from public.caro_trials where id=new.trial_id and club_id=new.club_id and application_state='finalized' and sanction_status='approved') then
    raise exception 'CARO approval is required before publication';
  end if;
  return new;
end;
$$;
create function caro_private.guard_trial() returns trigger language plpgsql set search_path='' as $$
begin
  if old.application_state='finalized' and
    (new.application_state<>old.application_state or new.id<>old.id or new.club_id<>old.club_id or new.title<>old.title or
     new.start_date<>old.start_date or new.end_date<>old.end_date or new.timezone<>old.timezone) then
    raise exception 'Finalized trial identity and calendar are locked';
  end if;
  return new;
end;
$$;
create function caro_private.withdraw_publication() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.sanction_status<>'approved' then update public.caro_public_trials set is_live=false where trial_id=new.id and is_live; end if;
  return new;
end;
$$;
revoke all on all functions in schema caro_private from public,anon;
create trigger caro_event_lock before insert or update or delete on public.caro_events for each row execute function caro_private.guard_event();
create trigger caro_score_closed before insert on public.caro_scores for each row execute function caro_private.guard_score();
create trigger caro_completion_lock before insert on public.caro_completed_events for each row execute function caro_private.guard_completion();
create trigger caro_publication_gate before insert or update on public.caro_public_trials for each row execute function caro_private.guard_publication();
create trigger caro_trial_identity_lock before update on public.caro_trials for each row execute function caro_private.guard_trial();
create trigger caro_trial_withdraw_publication after update of sanction_status on public.caro_trials for each row execute function caro_private.withdraw_publication();

do $$ declare t text; begin
  foreach t in array array['caro_clubs','caro_memberships','caro_trials','caro_trial_assignments','caro_events','caro_premium_versions','caro_public_trials','caro_entries','caro_ledger','caro_scores','caro_completed_events','caro_audit'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from public,anon,authenticated,service_role',t);
    execute format('grant select on table public.%I to authenticated',t);
    execute format('grant select,insert,update on table public.%I to service_role',t);
  end loop;
  foreach t in array array['caro_premium_versions','caro_ledger','caro_scores','caro_completed_events','caro_audit'] loop
    execute format('revoke update on table public.%I from service_role',t);
    execute format('create trigger caro_append_only before update or delete on public.%I for each row execute function caro_private.reject_rewrite()',t);
  end loop;
  foreach t in array array['caro_trials','caro_events','caro_premium_versions','caro_entries','caro_ledger','caro_scores','caro_completed_events','caro_audit'] loop
    execute format('create policy caro_staff_read on public.%I for select to authenticated using(caro_private.can_read_trial(club_id,%s))',t,case when t='caro_trials' then 'id' else 'trial_id' end);
  end loop;
end $$;
create policy caro_club_read on public.caro_clubs for select to authenticated using(caro_private.is_member(id));
create policy caro_roster_read on public.caro_memberships for select to authenticated using(user_id=(select auth.uid()) or caro_private.is_owner(club_id));
create policy caro_assignment_read on public.caro_trial_assignments for select to authenticated using(user_id=(select auth.uid()) or caro_private.is_owner(club_id));
grant select on public.caro_public_trials to anon;
create policy caro_public_read on public.caro_public_trials for select to anon,authenticated using(is_live);
create policy caro_public_staff_read on public.caro_public_trials for select to authenticated using(caro_private.can_read_trial(club_id,trial_id));

create index caro_membership_user on public.caro_memberships(user_id,club_id) where active;
create index caro_assignment_user on public.caro_trial_assignments(user_id,club_id,trial_id);
create index caro_trials_club on public.caro_trials(club_id,start_date);
create index caro_events_trial on public.caro_events(club_id,trial_id);
create index caro_entries_trial on public.caro_entries(club_id,trial_id,status);
create index caro_ledger_trial on public.caro_ledger(club_id,trial_id,entry_id);
create index caro_scores_trial on public.caro_scores(club_id,trial_id,event_id);
create index caro_audit_trial on public.caro_audit(club_id,trial_id,occurred_at);
commit;
