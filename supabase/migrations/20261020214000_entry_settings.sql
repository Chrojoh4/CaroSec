-- Private priced entry setup. Publication/intake remain separate commands.
begin;
create table public.caro_entry_settings(
 trial_id uuid primary key,club_id uuid not null,premium_draft_revision integer not null,
 opens_on date not null,closes_on date not null check(closes_on>=opens_on),
 pricing jsonb not null check(jsonb_typeof(pricing)='array'),agreement_version text not null,
 revision integer not null check(revision>=0),updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now(),
 foreign key(club_id,trial_id) references public.caro_trials(club_id,id)
);
alter table public.caro_entry_settings enable row level security;
revoke all on public.caro_entry_settings from anon,authenticated;
grant select on public.caro_entry_settings to authenticated;
create policy caro_entry_settings_staff on public.caro_entry_settings for select to authenticated using(caro_private.is_administrator() or caro_private.can_read_trial(club_id,trial_id));
create function caro_private.save_entry_settings(p_trial uuid,p_revision integer,p_premium_revision integer,p_pricing jsonb,p_agreement text,p_confirmed boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare trial public.caro_trials;draft public.caro_premium_drafts;settings public.caro_entry_settings;
 event public.caro_events;item jsonb;fee jsonb;feo jsonb;prices jsonb:='[]';seen uuid[]:='{}';event_id uuid;fee_index integer;feo_index integer;capacity integer;basis text;opens date;closes date;next_revision integer;
begin
 select * into trial from public.caro_trials where id=p_trial for update;
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or trial.id is null
   or not(caro_private.is_administrator() or caro_private.can_read_trial(trial.club_id,p_trial)) then raise exception 'Trial access required' using errcode='42501';end if;
 if trial.application_state<>'finalized' then raise exception 'Finalize the application before mapping entry prices';end if;
 if exists(select 1 from public.caro_entries where trial_id=p_trial) then raise exception 'Entry pricing is locked after an entry has been received';end if;
 select * into draft from public.caro_premium_drafts where trial_id=p_trial for update;
 if draft.trial_id is null or p_premium_revision is null or draft.revision<>p_premium_revision then raise exception 'Premium changed. Reopen entry setup.' using errcode='40001';end if;
 select * into settings from public.caro_entry_settings where trial_id=p_trial for update;
 if p_revision is null or p_revision<>coalesce(settings.revision,-1) then raise exception 'Entry setup changed. Reopen before saving.' using errcode='40001';end if;
 if p_confirmed is distinct from true or p_agreement is null or length(btrim(p_agreement)) not between 1 and 200
   or coalesce(length(btrim(draft.content->>'waiver')),0)=0 then raise exception 'Review the host agreement and confirm pricing';end if;
 if draft.content->>'waiver'~*'DRAFT[[:space:]]+PLACEHOLDER' then raise exception 'Replace the placeholder host agreement before preparing intake';end if;
 opens:=(draft.content->>'opens')::date;closes:=(draft.content->>'closes')::date;
 if opens is null or closes is null or closes<opens then raise exception 'Set valid opening and closing dates in the premium';end if;
 if jsonb_typeof(p_pricing) is distinct from 'array' or jsonb_array_length(p_pricing)<>(select count(*) from public.caro_events where trial_id=p_trial) or jsonb_array_length(p_pricing)=0 then raise exception 'Map every official event exactly once';end if;
 for item in select value from jsonb_array_elements(p_pricing) loop
  if jsonb_typeof(item) is distinct from 'object' then raise exception 'Invalid event price';end if;
  event_id:=(item->>'event_id')::uuid;
  select * into event from public.caro_events where id=event_id and trial_id=p_trial;
  if event.id is null or event_id=any(seen) then raise exception 'Unknown or duplicate official event';end if;
  seen:=array_append(seen,event_id);
  if coalesce(item->>'fee_index','')!~'^[0-9]{1,2}$' or coalesce(item->>'capacity','')!~'^[0-9]{1,4}$' then raise exception 'Select a saved premium fee and capacity';end if;
  fee_index:=(item->>'fee_index')::integer;capacity:=(item->>'capacity')::integer;basis:=item->>'basis';
  if capacity not between 1 and 1000 or basis is null or basis not in ('entry','dog','exercise') or (event.format='Working')<>(basis='exercise') then raise exception 'Check capacity and the fee basis for Rally or Working';end if;
  fee:=draft.content->'fees'->fee_index;feo:=null;
  if fee is null or (fee->>'cents')::integer<=0 or coalesce(length(btrim(fee->>'label')),0)=0 or coalesce(length(btrim(fee->>'unit')),0)=0 then raise exception 'Select a positive saved premium fee with a label and unit';end if;
  if item->>'feo_index' is not null then
   if item->>'feo_index'!~'^[0-9]{1,2}$' then raise exception 'Invalid FEO fee selection';end if;
   feo_index:=(item->>'feo_index')::integer;feo:=draft.content->'fees'->feo_index;
   if feo is null or (feo->>'cents')::integer<0 or coalesce(length(btrim(feo->>'label')),0)=0 or coalesce(length(btrim(feo->>'unit')),0)=0 then raise exception 'Invalid FEO fee selection';end if;
  end if;
  prices:=prices||jsonb_build_array(jsonb_build_object('event_id',event_id,'round',event.official_round,'basis',basis,'capacity',capacity,'fee',fee,'feoFee',feo));
 end loop;
 next_revision:=coalesce(settings.revision,-1)+1;
 insert into public.caro_entry_settings(trial_id,club_id,premium_draft_revision,opens_on,closes_on,pricing,agreement_version,revision,updated_by)
 values(p_trial,trial.club_id,draft.revision,opens,closes,prices,btrim(p_agreement),next_revision,auth.uid())
 on conflict(trial_id) do update set premium_draft_revision=excluded.premium_draft_revision,opens_on=excluded.opens_on,closes_on=excluded.closes_on,pricing=excluded.pricing,agreement_version=excluded.agreement_version,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=now();
 insert into public.caro_audit(club_id,trial_id,actor_id,action,reference,details) values(trial.club_id,p_trial,auth.uid(),'entry_setup.saved',p_trial::text,jsonb_build_object('revision',next_revision,'premiumRevision',draft.revision,'events',jsonb_array_length(prices)));
 return jsonb_build_object('revision',next_revision,'pricing',prices);
end;
$$;
revoke all on function caro_private.save_entry_settings(uuid,integer,integer,jsonb,text,boolean) from public,anon,authenticated,service_role;
grant execute on function caro_private.save_entry_settings(uuid,integer,integer,jsonb,text,boolean) to authenticated;
create function public.caro_save_entry_settings(p_trial uuid,p_revision integer,p_premium_revision integer,p_pricing jsonb,p_agreement text,p_confirmed boolean) returns jsonb
language sql security invoker set search_path='' as $$select caro_private.save_entry_settings(p_trial,p_revision,p_premium_revision,p_pricing,p_agreement,p_confirmed)$$;
revoke all on function public.caro_save_entry_settings(uuid,integer,integer,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.caro_save_entry_settings(uuid,integer,integer,jsonb,text,boolean) to authenticated;
commit;
