begin;
create table public.caro_premium_drafts (
 trial_id uuid primary key,club_id uuid not null,content jsonb not null default '{}'::jsonb,
 revision integer not null default 0 check(revision>=0),updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now(),
 foreign key(club_id,trial_id) references public.caro_trials(club_id,id)
);
alter table public.caro_premium_drafts enable row level security;
revoke all on public.caro_premium_drafts from public,anon,authenticated,service_role;
grant select on public.caro_premium_drafts to authenticated;
create policy caro_premium_draft_read on public.caro_premium_drafts for select to authenticated
 using(caro_private.is_administrator() or caro_private.can_read_trial(club_id,trial_id));
create function caro_private.save_premium_draft(p_trial uuid,p_revision integer,p_content jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid();trial public.caro_trials;draft public.caro_premium_drafts;item record;fee jsonb;rev integer;
begin
 if caller is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in required' using errcode='42501'; end if;
 select * into trial from public.caro_trials where id=p_trial for update;
 if not found or not(caro_private.is_administrator() or caro_private.can_read_trial(trial.club_id,p_trial)) then raise exception 'Trial access denied' using errcode='42501'; end if;
 if p_revision is null or p_revision < -1 or p_content is null or jsonb_typeof(p_content)<>'object' or octet_length(p_content::text)>200000 then raise exception 'Invalid premium draft'; end if;
 for item in select key,value from jsonb_each(p_content) loop
  if item.key='fees' then
   if jsonb_typeof(item.value)<>'array' or jsonb_array_length(item.value)>50 then raise exception 'Check premium fees'; end if;
   for fee in select value from jsonb_array_elements(item.value) loop
    if jsonb_typeof(fee)<>'object' or not (fee ?& array['label','cents','unit']) or jsonb_typeof(fee->'label') is distinct from 'string' or jsonb_typeof(fee->'unit') is distinct from 'string' or jsonb_typeof(fee->'cents') is distinct from 'number' or (fee->>'cents') !~ '^[0-9]{1,9}$' then raise exception 'Check fee labels, units and nonnegative integer cents'; end if;
   end loop;
  elsif item.key in ('opens','closes','capacity','intro','timing','dayOf','orderNote','payment','confirmations','facilities','accommodations','awards','moveups','refunds','siteRules','waiver','theme') then
   if jsonb_typeof(item.value)<>'string' or length(item.value#>>'{}')>10000 then raise exception 'Invalid premium text'; end if;
  else raise exception 'Premium source fields come from the trial application';end if;
 end loop;
 if p_content ? 'theme' and p_content->>'theme' not in ('forest','ocean','berry') then raise exception 'Choose a premium theme'; end if;
 foreach rev in array array[1,2] loop
  if coalesce(p_content->>(case when rev=1 then 'opens' else 'closes' end),'')<>'' then perform (p_content->>(case when rev=1 then 'opens' else 'closes' end))::date;end if;
 end loop;
 if coalesce(p_content->>'opens','')<>'' and coalesce(p_content->>'closes','')<>'' and (p_content->>'closes')::date<(p_content->>'opens')::date then raise exception 'Closing date must follow opening date'; end if;
 select * into draft from public.caro_premium_drafts where trial_id=p_trial for update;
 if found then
  if p_revision<>draft.revision then raise exception 'Premium changed; reopen before saving' using errcode='40001';end if;
  rev:=draft.revision+1;update public.caro_premium_drafts set content=p_content,revision=rev,updated_by=caller,updated_at=now() where trial_id=p_trial;
 else
  if p_revision<>-1 then raise exception 'Premium changed; reopen before saving' using errcode='40001';end if;
  rev:=0;insert into public.caro_premium_drafts(trial_id,club_id,content,updated_by) values(p_trial,trial.club_id,p_content,caller);
 end if;
 insert into public.caro_audit(club_id,trial_id,actor_id,action,reference,details) values(trial.club_id,p_trial,caller,'premium.draft_saved',p_trial::text,jsonb_build_object('revision',rev));
 return jsonb_build_object('revision',rev);
end;$$;
revoke all on function caro_private.save_premium_draft(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function caro_private.save_premium_draft(uuid,integer,jsonb) to authenticated;
create function public.caro_save_premium_draft(p_trial uuid,p_revision integer,p_content jsonb) returns jsonb
language sql security invoker set search_path='' as $$select caro_private.save_premium_draft(p_trial,p_revision,p_content);$$;
revoke all on function public.caro_save_premium_draft(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.caro_save_premium_draft(uuid,integer,jsonb) to authenticated;
commit;
