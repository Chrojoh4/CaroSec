-- Private bookkeeping and coherent read-only report snapshots. No official invoice/submission.
begin;
create table public.caro_expenses(
 id uuid primary key default gen_random_uuid(),club_id uuid not null,trial_id uuid not null,kind text not null check(kind in ('expense','credit')),
 cents integer not null check(cents>0),category text not null,note text not null,source_expense_id uuid references public.caro_expenses(id),
 request_key uuid not null,actor_id uuid not null references auth.users(id),received_at timestamptz,recorded_at timestamptz not null default now(),
 unique(trial_id,request_key),foreign key(club_id,trial_id) references public.caro_trials(club_id,id),
 check((kind='expense' and source_expense_id is null) or (kind='credit' and source_expense_id is not null))
);
alter table public.caro_expenses enable row level security;
revoke all on public.caro_expenses from public,anon,authenticated,service_role;
grant select on public.caro_expenses to authenticated;
create policy caro_expense_staff on public.caro_expenses for select to authenticated using(caro_private.is_administrator() or caro_private.can_read_trial(club_id,trial_id));
create trigger caro_expense_immutable before update or delete on public.caro_expenses for each row execute function caro_private.reject_rewrite();
create index caro_expense_trial on public.caro_expenses(trial_id,recorded_at,id);
create table public.caro_incidents(
 id uuid primary key default gen_random_uuid(),club_id uuid not null,trial_id uuid not null,
 category text not null check(category in ('Dog behaviour / aggression','Sportsmanship','Other')),description text not null check(length(btrim(description)) between 5 and 6000),
 occurred_at timestamptz,recorded_at timestamptz not null default now(),actor_id uuid not null references auth.users(id),request_key uuid not null,
 unique(trial_id,request_key),foreign key(club_id,trial_id) references public.caro_trials(club_id,id)
);
alter table public.caro_incidents enable row level security;
revoke all on public.caro_incidents from public,anon,authenticated,service_role;
grant select on public.caro_incidents to authenticated;
create policy caro_incident_staff on public.caro_incidents for select to authenticated using(caro_private.is_administrator() or caro_private.can_read_trial(club_id,trial_id));
create trigger caro_incident_immutable before update or delete on public.caro_incidents for each row execute function caro_private.reject_rewrite();
create table public.caro_paperwork(
 trial_id uuid primary key,club_id uuid not null,paperwork_sent_on date,data_entry_confirmed_on date,no_incidents boolean,revision integer not null check(revision>=0),
 updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now(),foreign key(club_id,trial_id) references public.caro_trials(club_id,id)
);
alter table public.caro_paperwork enable row level security;
revoke all on public.caro_paperwork from public,anon,authenticated,service_role;
grant select on public.caro_paperwork to authenticated;
create policy caro_paperwork_staff on public.caro_paperwork for select to authenticated using(caro_private.is_administrator() or caro_private.can_read_trial(club_id,trial_id));

create function caro_private.record_expense(p_trial uuid,p_request uuid,p_kind text,p_cents integer,p_category text,p_note text,p_source uuid,p_received timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare trial public.caro_trials;existing public.caro_expenses;original public.caro_expenses;remaining bigint;result uuid;
begin
 select * into trial from public.caro_trials where id=p_trial for update;
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or trial.id is null
  or not(caro_private.is_administrator() or caro_private.can_read_trial(trial.club_id,p_trial)) then raise exception 'Trial access required' using errcode='42501';end if;
 if p_request is null or p_kind is null or p_kind not in ('expense','credit') or p_cents is null or p_cents<=0 or p_category is null or length(btrim(p_category)) not between 1 and 100 or p_note is null or length(btrim(p_note)) not between 1 and 500 or p_received>now() or (p_received is not null and not isfinite(p_received)) then raise exception 'Check expense amount, category, note and effective time';end if;
 if (p_kind='expense' and p_source is not null) or (p_kind='credit' and p_source is null) then raise exception 'Credits must reference the original expense';end if;
 select * into existing from public.caro_expenses where trial_id=p_trial and request_key=p_request;
 if existing.id is not null then
  if existing.actor_id<>auth.uid() or existing.kind<>p_kind or existing.cents<>p_cents or existing.category<>btrim(p_category) or existing.note<>btrim(p_note) or existing.source_expense_id is distinct from p_source or existing.received_at is distinct from p_received then raise exception 'Expense request reference already used';end if;
  return jsonb_build_object('id',existing.id);
 end if;
 if p_kind='credit' then
  select * into original from public.caro_expenses where id=p_source and trial_id=p_trial and kind='expense';
  if original.id is null then raise exception 'Choose an original expense from this trial';end if;
  select original.cents-coalesce(sum(cents),0) into remaining from public.caro_expenses where source_expense_id=p_source and kind='credit';
  if p_cents>remaining then raise exception 'Credit exceeds the remaining original expense';end if;
 end if;
 insert into public.caro_expenses(club_id,trial_id,kind,cents,category,note,source_expense_id,request_key,actor_id,received_at)
 values(trial.club_id,p_trial,p_kind,p_cents,btrim(p_category),btrim(p_note),p_source,p_request,auth.uid(),p_received) returning id into result;
 insert into public.caro_audit(club_id,trial_id,actor_id,action,reference,details) values(trial.club_id,p_trial,auth.uid(),case when p_kind='expense' then 'expense.recorded' else 'expense.credit' end,result::text,
  jsonb_build_object('amountCents',p_cents,'sourceExpenseId',p_source,'receivedAt',to_char(p_received at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
 return jsonb_build_object('id',result);
end;$$;
create function public.caro_record_expense(p_trial uuid,p_request uuid,p_kind text,p_cents integer,p_category text,p_note text,p_source uuid default null,p_received timestamptz default null) returns jsonb
language sql security invoker set search_path='' as $$select caro_private.record_expense(p_trial,p_request,p_kind,p_cents,p_category,p_note,p_source,p_received)$$;

create function caro_private.save_paperwork(p_trial uuid,p_revision integer,p_sent date,p_confirmed date,p_no_incidents boolean default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare trial public.caro_trials;existing public.caro_paperwork;rev integer;today date;
begin
 select * into trial from public.caro_trials where id=p_trial for update;
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or trial.id is null
  or not(caro_private.is_administrator() or caro_private.can_read_trial(trial.club_id,p_trial)) then raise exception 'Trial access required' using errcode='42501';end if;
 if trial.application_state<>'finalized' then raise exception 'Finalize the trial before recording post-trial tracking';end if;
 today:=(now() at time zone trial.timezone)::date;
 if p_sent>today or p_confirmed>today then raise exception 'Record actual paperwork dates, not future dates';end if;
 select * into existing from public.caro_paperwork where trial_id=p_trial for update;
 if p_revision is null or p_revision<>coalesce(existing.revision,-1) then raise exception 'Paperwork tracking changed. Refresh.' using errcode='40001';end if;
 if p_no_incidents is true and exists(select 1 from public.caro_incidents where trial_id=p_trial) then raise exception 'This trial has incident records; do not declare no incidents';end if;
 if p_no_incidents is false and not exists(select 1 from public.caro_incidents where trial_id=p_trial) then raise exception 'Record the incident before confirming incidents were recorded';end if;
 rev:=coalesce(existing.revision,-1)+1;
 insert into public.caro_paperwork(trial_id,club_id,paperwork_sent_on,data_entry_confirmed_on,no_incidents,revision,updated_by) values(p_trial,trial.club_id,p_sent,p_confirmed,coalesce(p_no_incidents,existing.no_incidents),rev,auth.uid())
 on conflict(trial_id) do update set no_incidents=excluded.no_incidents,paperwork_sent_on=excluded.paperwork_sent_on,data_entry_confirmed_on=excluded.data_entry_confirmed_on,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=now();
 insert into public.caro_audit(club_id,trial_id,actor_id,action,reference,details) values(trial.club_id,p_trial,auth.uid(),'trial.paperwork_updated',p_trial::text,jsonb_build_object('previousSent',existing.paperwork_sent_on,'previousConfirmation',existing.data_entry_confirmed_on,'sent',p_sent,'confirmation',p_confirmed,'noIncidents',coalesce(p_no_incidents,existing.no_incidents),'revision',rev));
 return jsonb_build_object('revision',rev);
end;$$;
create function public.caro_save_paperwork(p_trial uuid,p_revision integer,p_sent date default null,p_confirmed date default null) returns jsonb
language sql security invoker set search_path='' as $$select caro_private.save_paperwork(p_trial,p_revision,p_sent,p_confirmed)$$;

create function public.caro_save_post_trial(p_trial uuid,p_revision integer,p_sent date,p_confirmed date,p_no_incidents boolean) returns jsonb
language sql security invoker set search_path='' as $$select caro_private.save_paperwork(p_trial,p_revision,p_sent,p_confirmed,p_no_incidents)$$;
revoke all on function public.caro_save_post_trial(uuid,integer,date,date,boolean) from public,anon,authenticated,service_role;
grant execute on function public.caro_save_post_trial(uuid,integer,date,date,boolean) to authenticated;
create function caro_private.record_incident(p_trial uuid,p_request uuid,p_category text,p_description text,p_occurred timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare trial public.caro_trials;prior public.caro_incidents;incident_id uuid;
begin
 select * into trial from public.caro_trials where id=p_trial for update;
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or trial.id is null or not(caro_private.is_administrator() or caro_private.can_read_trial(trial.club_id,p_trial)) then raise exception 'Trial access required' using errcode='42501';end if;
 if trial.application_state<>'finalized' then raise exception 'Finalize the trial before recording an incident';end if;
 if p_request is null or p_category is null or p_category not in ('Dog behaviour / aggression','Sportsmanship','Other') or p_description is null or length(btrim(p_description)) not between 5 and 6000 or (p_occurred is not null and (not isfinite(p_occurred) or p_occurred>now())) then raise exception 'Check incident category, description and actual time';end if;
 select * into prior from public.caro_incidents where trial_id=p_trial and request_key=p_request;
 if prior.id is not null then
  if prior.actor_id<>auth.uid() or prior.category is distinct from p_category or prior.description is distinct from btrim(p_description) or prior.occurred_at is distinct from p_occurred then raise exception 'Incident reference already used with different information';end if;
  return jsonb_build_object('id',prior.id);
 end if;
 insert into public.caro_incidents(club_id,trial_id,category,description,occurred_at,actor_id,request_key) values(trial.club_id,p_trial,p_category,btrim(p_description),p_occurred,auth.uid(),p_request) returning id into incident_id;
 insert into public.caro_paperwork(trial_id,club_id,no_incidents,revision,updated_by) values(p_trial,trial.club_id,false,0,auth.uid()) on conflict(trial_id) do update set no_incidents=false,revision=caro_paperwork.revision+1,updated_by=auth.uid(),updated_at=now();
 insert into public.caro_audit(club_id,trial_id,actor_id,action,reference,details) values(trial.club_id,p_trial,auth.uid(),'incident.recorded',incident_id::text,jsonb_build_object('category',p_category,'actualTime',p_occurred));
 return jsonb_build_object('id',incident_id);
end;$$;
create function public.caro_record_incident(p_trial uuid,p_request uuid,p_category text,p_description text,p_occurred timestamptz default null) returns jsonb language sql security invoker set search_path='' as $$select caro_private.record_incident(p_trial,p_request,p_category,p_description,p_occurred)$$;
revoke all on function caro_private.record_incident(uuid,uuid,text,text,timestamptz),public.caro_record_incident(uuid,uuid,text,text,timestamptz) from public,anon,authenticated,service_role;
grant execute on function caro_private.record_incident(uuid,uuid,text,text,timestamptz),public.caro_record_incident(uuid,uuid,text,text,timestamptz) to authenticated;

create function caro_private.report_snapshot(p_trial uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare trial public.caro_trials;config jsonb;events jsonb;entries jsonb;ledger jsonb;scores jsonb;expenses jsonb;audit jsonb;orders jsonb;completed jsonb;paperwork jsonb;incidents jsonb;
begin
 select * into trial from public.caro_trials where id=p_trial;
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or trial.id is null
  or not(caro_private.is_administrator() or caro_private.can_read_trial(trial.club_id,p_trial)) then raise exception 'Trial access required' using errcode='42501';end if;
 select snapshot->'configuration' into config from public.caro_premium_versions where trial_id=p_trial and snapshot->>'kind' in ('manual_entry_edition','public_entry_edition') order by version desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'round',e.official_round,'dayId',e.local_date,'format',e.format,'level',e.level,'judge',e.judge_name,'stream',e.offerings->>'stream',
  'exercises',coalesce(source->'exercises','[]'::jsonb),'capacity',(source->>'capacity')::integer) order by e.official_round),'[]'::jsonb) into events from public.caro_events e
  left join lateral (select value source from jsonb_array_elements(coalesce(config->'events','[]'::jsonb)) where value->>'id'=e.id::text) c on true where e.trial_id=p_trial;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'trialId',trial_id,'status',status,'channel',intake_channel,'amountCents',amount_cents,'revision',revision,
  'createdAt',to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'receivedAt',details->'receivedAt',
  'contact',jsonb_build_object('name',details->'contact'->>'name','email',details->'contact'->>'email','phone',details->'contact'->>'phone'),
  'dog',details->'dog','partner',details->'partner','selections',case when jsonb_typeof(details->'selections')='array' then details->'selections' else '[]'::jsonb end) order by created_at,id),'[]'::jsonb) into entries from public.caro_entries where trial_id=p_trial;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'entryId',entry_id,'trialId',trial_id,'eventId',event_id,'kind',kind,'cents',cents,'note',note,'method',method,'actorId',actor_id,
  'occurredAt',to_char(occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'receivedAt',to_char(received_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) order by occurred_at,id),'[]'::jsonb) into ledger from public.caro_ledger where trial_id=p_trial;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'entryId',entry_id,'trialId',trial_id,'eventId',event_id,'version',version,'judge',judge_name,'results',outcome,'elapsedSeconds',elapsed_seconds,'reason',correction_reason,'actorId',actor_id,
  'occurredAt',to_char(occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) order by entry_id,event_id,version),'[]'::jsonb) into scores from public.caro_scores where trial_id=p_trial;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'trialId',trial_id,'kind',kind,'cents',case when kind='credit' then -cents else cents end,'category',category,'note',note,'sourceExpenseId',source_expense_id,'actorId',actor_id,
  'occurredAt',to_char(recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'receivedAt',to_char(received_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) order by recorded_at,id),'[]'::jsonb) into expenses from public.caro_expenses where trial_id=p_trial;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'trialId',trial_id,'action',action,'reference',reference,'actorId',actor_id,'details',details,'occurredAt',to_char(occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) order by occurred_at,id),'[]'::jsonb) into audit from public.caro_audit where trial_id=p_trial;
 select coalesce(jsonb_object_agg(p_trial::text||':'||event_id::text,to_jsonb(entry_ids)),'{}'::jsonb) into orders from public.caro_running_orders where trial_id=p_trial;
 select coalesce(jsonb_object_agg(p_trial::text||':'||event_id::text,jsonb_build_object('signoff',signoff,'occurredAt',to_char(occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))),'{}'::jsonb) into completed from public.caro_completed_events where trial_id=p_trial;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'trialId',trial_id,'category',category,'description',description,'occurredAt',case when occurred_at is not null then to_char(occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,'recordedAt',to_char(recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'actorId',actor_id) order by recorded_at,id),'[]'::jsonb) into incidents from public.caro_incidents where trial_id=p_trial;
 select jsonb_build_object('noIncidentsConfirmed',no_incidents,'revision',revision,'paperworkSentDate',paperwork_sent_on,'dataEntryConfirmationDate',data_entry_confirmed_on,'recordsDue',trial.end_date+14,'paymentDue',data_entry_confirmed_on+7) into paperwork from public.caro_paperwork where trial_id=p_trial;
 return jsonb_build_object('generatedAt',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'trial',jsonb_build_object('id',trial.id,'fictional',trial.is_practice,'title',trial.title,'host',trial.planning->>'host','trialNumber',trial.trial_number,'date',trial.start_date,'endDate',trial.end_date,'timezone',trial.timezone,'events',events),
  'incidents',incidents,'entries',entries,'ledger',ledger,'scores',scores,'expenses',expenses,'audit',audit,'orders',orders,'finalizedEvents',completed,'paperwork',coalesce(paperwork,jsonb_build_object('revision',-1,'recordsDue',trial.end_date+14)));
end;$$;
create function public.caro_report_snapshot(p_trial uuid) returns jsonb language sql stable security invoker set search_path='' as $$select caro_private.report_snapshot(p_trial)$$;
revoke all on function caro_private.record_expense(uuid,uuid,text,integer,text,text,uuid,timestamptz),caro_private.save_paperwork(uuid,integer,date,date,boolean),caro_private.report_snapshot(uuid) from public,anon,authenticated,service_role;
grant execute on function caro_private.record_expense(uuid,uuid,text,integer,text,text,uuid,timestamptz),caro_private.save_paperwork(uuid,integer,date,date,boolean),caro_private.report_snapshot(uuid) to authenticated;
revoke all on function public.caro_record_expense(uuid,uuid,text,integer,text,text,uuid,timestamptz),public.caro_save_paperwork(uuid,integer,date,date),public.caro_report_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.caro_record_expense(uuid,uuid,text,integer,text,text,uuid,timestamptz),public.caro_save_paperwork(uuid,integer,date,date),public.caro_report_snapshot(uuid) to authenticated;
commit;
