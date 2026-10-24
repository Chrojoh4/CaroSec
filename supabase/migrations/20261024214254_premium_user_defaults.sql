-- Remember reusable premium answers per user and club, separate from practice trials.
begin;
create table public.caro_premium_user_defaults (
 user_id uuid not null references auth.users(id),club_id uuid not null references public.caro_clubs(id),
 is_practice boolean not null default false,content jsonb not null check(jsonb_typeof(content)='object'),
 source_trial_id uuid references public.caro_trials(id),updated_at timestamptz not null default now(),
 primary key(user_id,club_id,is_practice)
);
alter table public.caro_premium_user_defaults enable row level security;
revoke all on public.caro_premium_user_defaults from public,anon,authenticated,service_role;
grant select on public.caro_premium_user_defaults to authenticated;
create policy own_premium_defaults on public.caro_premium_user_defaults for select to authenticated
 using(user_id=(select auth.uid()) and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false));
create function caro_private.premium_reusable_answers(p_content jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) from jsonb_each(p_content)
 where key in ('intro','dayOf','orderNote','payment','confirmations','facilities','accommodations','awards','moveups','refunds','siteRules','waiver','theme','fees');
$$;
revoke all on function caro_private.premium_reusable_answers(jsonb) from public,anon,authenticated;
insert into public.caro_premium_user_defaults(user_id,club_id,is_practice,content,source_trial_id,updated_at)
 select distinct on(d.updated_by,d.club_id,t.is_practice) d.updated_by,d.club_id,t.is_practice,caro_private.premium_reusable_answers(d.content),d.trial_id,d.updated_at
 from public.caro_premium_drafts d join public.caro_trials t on t.id=d.trial_id
 order by d.updated_by,d.club_id,t.is_practice,d.updated_at desc,d.trial_id;
create function caro_private.remember_premium_answers() returns trigger
language plpgsql security definer set search_path='' as $$
declare practice boolean;
begin
 select is_practice into practice from public.caro_trials where id=new.trial_id;
 insert into public.caro_premium_user_defaults(user_id,club_id,is_practice,content,source_trial_id,updated_at)
 values(new.updated_by,new.club_id,practice,caro_private.premium_reusable_answers(new.content),new.trial_id,now())
 on conflict(user_id,club_id,is_practice) do update set content=excluded.content,source_trial_id=excluded.source_trial_id,updated_at=excluded.updated_at;
 return new;
end;$$;
revoke all on function caro_private.remember_premium_answers() from public,anon,authenticated;
create trigger remember_premium_answers after insert or update of content,updated_by on public.caro_premium_drafts
 for each row execute function caro_private.remember_premium_answers();
commit;
