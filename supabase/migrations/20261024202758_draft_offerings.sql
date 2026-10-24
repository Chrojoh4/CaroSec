-- Draft offerings are editable before official rounds exist. No entry intake is opened.
begin;
create table public.caro_draft_offerings(
 trial_id uuid primary key,club_id uuid not null,revision integer not null,rows jsonb not null,fees_snapshot jsonb not null,
 updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now(),
 foreign key(club_id,trial_id) references public.caro_trials(club_id,id)
);
alter table public.caro_draft_offerings enable row level security;
revoke all on public.caro_draft_offerings from public,anon,authenticated,service_role;
grant select on public.caro_draft_offerings to authenticated;
create policy caro_draft_offerings_staff on public.caro_draft_offerings for select to authenticated using(auth.uid() is not null and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false) and (caro_private.is_administrator() or caro_private.can_read_trial(club_id,trial_id)));
create function caro_private.save_draft_offerings(p_trial uuid,p_trial_revision integer,p_revision integer,p_premium_revision integer,p_rows jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare trial public.caro_trials;premium public.caro_premium_drafts;current_row public.caro_draft_offerings;item jsonb;event jsonb;events jsonb:='[]';rows jsonb:='[]';seen text[]:='{}';levels text[];price jsonb;feo jsonb;basis text;capacity integer;rev integer;result jsonb;source jsonb;planning jsonb;
begin
 select * into trial from public.caro_trials where id=p_trial for update;
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or trial.id is null or not(caro_private.is_administrator() or caro_private.can_read_trial(trial.club_id,p_trial)) then raise exception 'Trial access required' using errcode='42501';end if;
 if trial.application_state<>'draft' or exists(select 1 from public.caro_entries where trial_id=p_trial) then raise exception 'Draft offerings are locked; use reviewed official entry setup';end if;
 if p_trial_revision is null or p_trial_revision<>trial.revision then raise exception 'Trial details changed. Reopen offerings' using errcode='40001';end if;
 select * into premium from public.caro_premium_drafts where trial_id=p_trial for update;
 if premium.trial_id is null or p_premium_revision is null or p_premium_revision<>premium.revision then raise exception 'Premium fees changed. Reopen offerings' using errcode='40001';end if;
 select * into current_row from public.caro_draft_offerings where trial_id=p_trial for update;
 if p_revision is null or p_revision<>coalesce(current_row.revision,-1) then raise exception 'Offerings changed. Reopen before saving' using errcode='40001';end if;
 if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 or jsonb_array_length(p_rows)<>jsonb_array_length(trial.planning->'events') or octet_length(p_rows::text)>150000 then raise exception 'Configure every draft round exactly once';end if;
 for event in select value from jsonb_array_elements(trial.planning->'events') loop
  select value into item from jsonb_array_elements(p_rows) where value->>'key'=event->>'id';
  if item is null or event->>'id'=any(seen) or (select count(*) from jsonb_array_elements(p_rows) where value->>'key'=event->>'id')<>1 then raise exception 'Each round needs one explicit offering';end if;
  seen:=array_append(seen,event->>'id');
  if jsonb_typeof(item->'levels') is distinct from 'array' or jsonb_array_length(item->'levels') not between 1 and 10 or exists(select 1 from jsonb_array_elements(item->'levels') x where jsonb_typeof(x)<>'string' or length(btrim(x#>>'{}')) not between 1 and 40) then raise exception 'Select the offered streams or Working levels';end if;
  select array_agg(btrim(value)) into levels from jsonb_array_elements_text(item->'levels');
  if (select count(distinct value) from unnest(levels) value)<>cardinality(levels) then raise exception 'Duplicate offered stream';end if;
  if event->>'format'<>'Working' and (exists(select 1 from unnest(levels) value where value not in ('B','C')) or (event->>'level' in ('Novice','Intermediate') and 'C'=any(levels))) then raise exception 'CARO Rally offers B, with C from Advanced through Versatility Excellent';end if;
  if coalesce(item->>'fee_index','')!~'^[0-9]{1,2}$' or coalesce(item->>'capacity','')!~'^[0-9]{1,4}$' then raise exception 'Select a saved fee and capacity';end if;
  price:=premium.content->'fees'->((item->>'fee_index')::integer);feo:=null;basis:=item->>'basis';capacity:=(item->>'capacity')::integer;
  if price is null or (price->>'cents')::integer<=0 or capacity not between 1 and 1000 or basis is null or basis not in ('entry','dog','exercise') or (event->>'format'='Working')<>(basis='exercise') then raise exception 'Review price, fee unit and capacity';end if;
  if item->>'feo_index' is not null then
   if item->>'feo_index'!~'^[0-9]{1,2}$' then raise exception 'Invalid FEO fee';end if;
   feo:=premium.content->'fees'->((item->>'feo_index')::integer);if feo is null then raise exception 'Select an offered FEO fee';end if;
  end if;
  event:=jsonb_set(event,'{stream}',to_jsonb(array_to_string(levels,' ')));events:=events||jsonb_build_array(event);
  source:=jsonb_build_array(event->>'id',event->>'dayId',event->>'level',event->>'format',event->>'stream',event->>'judge',event->>'exercises');
  rows:=rows||jsonb_build_array(jsonb_build_object('key',event->>'id','source',source,'levels',levels,'fee',price,'feoFee',feo,'basis',basis,'capacity',capacity));
 end loop;
 planning:=jsonb_set(trial.planning,'{events}',events);
 if planning is distinct from trial.planning then planning:=jsonb_set(planning,'{classesConfirmed}','false'::jsonb);end if;
 result:=caro_private.write_trial_draft(trial.id,trial.club_id,trial.revision,trial.title,trial.start_date,trial.end_date,trial.timezone,planning);
 rev:=coalesce(current_row.revision,-1)+1;
 insert into public.caro_draft_offerings(trial_id,club_id,revision,rows,fees_snapshot,updated_by) values(p_trial,trial.club_id,rev,rows,premium.content->'fees',auth.uid())
 on conflict(trial_id) do update set revision=excluded.revision,rows=excluded.rows,fees_snapshot=excluded.fees_snapshot,updated_by=excluded.updated_by,updated_at=now();
 insert into public.caro_audit(club_id,trial_id,actor_id,action,reference,details) values(trial.club_id,p_trial,auth.uid(),'trial.draft_offerings_saved',p_trial::text,jsonb_build_object('revision',rev,'rounds',jsonb_array_length(rows)));
 return jsonb_build_object('revision',rev,'trialRevision',result->'revision','planning',planning);
end;$$;
create function public.caro_save_draft_offerings(p_trial uuid,p_trial_revision integer,p_revision integer,p_premium_revision integer,p_rows jsonb) returns jsonb language sql security invoker set search_path='' as $$select caro_private.save_draft_offerings(p_trial,p_trial_revision,p_revision,p_premium_revision,p_rows)$$;
revoke all on function caro_private.save_draft_offerings(uuid,integer,integer,integer,jsonb),public.caro_save_draft_offerings(uuid,integer,integer,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function caro_private.save_draft_offerings(uuid,integer,integer,integer,jsonb),public.caro_save_draft_offerings(uuid,integer,integer,integer,jsonb) to authenticated;
commit;
