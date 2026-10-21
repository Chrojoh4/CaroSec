-- Durable staff running orders, judge transcription/corrections and reviewed sign-off.
begin;
alter table public.caro_scores add column elapsed_seconds double precision check(elapsed_seconds is null or (elapsed_seconds>=0 and elapsed_seconds<'Infinity'::double precision));
create table public.caro_running_orders(
 event_id uuid primary key,club_id uuid not null,trial_id uuid not null,entry_ids uuid[] not null,
 revision integer not null check(revision>=0),updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now(),
 foreign key(club_id,trial_id,event_id) references public.caro_events(club_id,trial_id,id)
);
alter table public.caro_running_orders enable row level security;
revoke all on public.caro_running_orders from public,anon,authenticated,service_role;
grant select on public.caro_running_orders to authenticated;
create policy caro_orders_staff on public.caro_running_orders for select to authenticated using(caro_private.is_administrator() or caro_private.can_read_trial(club_id,trial_id));

create function caro_private.event_desk(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare event public.caro_events;trial public.caro_trials;running public.caro_running_orders;runs jsonb;closed jsonb;payload jsonb;
begin
 select * into event from public.caro_events where id=p_event;
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or event.id is null
  or not(caro_private.is_administrator() or caro_private.can_read_trial(event.club_id,event.trial_id)) then raise exception 'Trial access required' using errcode='42501';end if;
 select * into trial from public.caro_trials where id=event.trial_id;
 select * into running from public.caro_running_orders where event_id=p_event;
 select coalesce(jsonb_agg(jsonb_build_object('entryId',entry.id,'entryRevision',entry.revision,'status',coalesce(line->>'status',entry.status),
  'handler',entry.details->'contact'->>'name','dog',jsonb_build_object('name',entry.details->'dog'->>'name','caroId',entry.details->'dog'->>'caroId','breed',entry.details->'dog'->>'breed','height',entry.details->'dog'->>'height','jumpHeight',entry.details->'dog'->>'jumpHeight','veteran',entry.details->'dog'->'veteran'),
  'partner',case when event.format in ('Team','Brace') then jsonb_build_object('handler',entry.details->'partner'->>'handler','dog',jsonb_build_object('name',entry.details->'partner'->'dog'->>'name','caroId',entry.details->'partner'->'dog'->>'caroId','breed',entry.details->'partner'->'dog'->>'breed','height',entry.details->'partner'->'dog'->>'height','jumpHeight',entry.details->'partner'->'dog'->>'jumpHeight','veteran',entry.details->'partner'->'dog'->'veteran')) else null end,
  'stream',line->'stream','feo',line->'feo','exercises',line->'exercises','offeredExercises',source->'exercises',
  'score',case when score.id is not null then jsonb_build_object('id',score.id,'version',score.version,'outcome',score.outcome,'elapsedSeconds',score.elapsed_seconds,'judge',score.judge_name,'actorId',score.actor_id,'recordedAt',to_char(score.occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'reason',score.correction_reason) else null end)
  order by coalesce(array_position(running.entry_ids,entry.id),2147483647),entry.created_at,entry.id),'[]'::jsonb) into runs
 from public.caro_entries entry
 cross join lateral jsonb_array_elements(case when jsonb_typeof(entry.details->'selections')='array' then entry.details->'selections' else '[]'::jsonb end) line
 join public.caro_premium_versions edition on edition.id=entry.premium_id
 left join lateral (select value source from jsonb_array_elements(coalesce(edition.snapshot->'configuration'->'events','[]'::jsonb)) where value->>'id'=p_event::text) offered on true
 left join lateral (select * from public.caro_scores where entry_id=entry.id and event_id=p_event order by version desc limit 1) score on true
 where entry.trial_id=event.trial_id and line->>'eventId'=p_event::text and coalesce(line->>'status',entry.status) in ('accepted','checked_in');
 select jsonb_build_object('signoff',signoff,'actorId',actor_id,'recordedAt',to_char(occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) into closed from public.caro_completed_events where event_id=p_event;
 payload:=jsonb_build_object('event',jsonb_build_object('id',event.id,'trialId',trial.id,'round',event.official_round,'date',event.local_date,'format',event.format,'level',event.level,'judge',event.judge_name,'fictional',trial.is_practice,'title',trial.title,'host',trial.planning->>'host','trialNumber',trial.trial_number,'timezone',trial.timezone),
  'orderRevision',coalesce(running.revision,-1),'runs',runs,'completed',closed);
 return payload||jsonb_build_object('reviewToken',encode(sha256(convert_to(payload::text,'UTF8')),'hex'));
end;$$;
create function public.caro_event_desk(p_event uuid) returns jsonb language sql stable security invoker set search_path='' as $$select caro_private.event_desk(p_event)$$;

create function caro_private.save_running_order(p_event uuid,p_revision integer,p_request uuid,p_entries uuid[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare event public.caro_events;running public.caro_running_orders;receipt caro_private.trial_command_receipts;payload jsonb;result jsonb;active_ids uuid[];rev integer;
begin
 select * into event from public.caro_events where id=p_event;
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or event.id is null
  or not(caro_private.is_administrator() or caro_private.can_read_trial(event.club_id,event.trial_id)) then raise exception 'Trial access required' using errcode='42501';end if;
 perform 1 from public.caro_trials where id=event.trial_id for update;perform 1 from public.caro_events where id=p_event for update;
 if p_request is null or p_entries is null then raise exception 'Provide the complete running order';end if;
 payload:=jsonb_build_object('command','running_order','event',p_event,'revision',p_revision,'entries',p_entries);
 select * into receipt from caro_private.trial_command_receipts where trial_id=event.trial_id and request_key=p_request;
 if receipt.request_key is not null then if receipt.actor_id<>auth.uid() or receipt.payload is distinct from payload then raise exception 'Request reference already used';end if;return receipt.result;end if;
 if exists(select 1 from public.caro_completed_events where event_id=p_event) then raise exception 'Completed running order is locked';end if;
 select * into running from public.caro_running_orders where event_id=p_event for update;
 if p_revision is null or p_revision<>coalesce(running.revision,-1) then raise exception 'Running order changed. Refresh.' using errcode='40001';end if;
 select coalesce(array_agg(distinct entry.id),'{}'::uuid[]) into active_ids from public.caro_entries entry cross join lateral jsonb_array_elements(case when jsonb_typeof(entry.details->'selections')='array' then entry.details->'selections' else '[]'::jsonb end) line
  where entry.trial_id=event.trial_id and line->>'eventId'=p_event::text and coalesce(line->>'status',entry.status) in ('accepted','checked_in');
 if cardinality(p_entries)<>cardinality(active_ids) or cardinality(p_entries)<>(select count(distinct value) from unnest(p_entries) value) or not(p_entries @> active_ids and active_ids @> p_entries) then raise exception 'The active entry set changed or the order contains duplicates. Refresh.';end if;
 rev:=coalesce(running.revision,-1)+1;
 insert into public.caro_running_orders(event_id,club_id,trial_id,entry_ids,revision,updated_by) values(p_event,event.club_id,event.trial_id,p_entries,rev,auth.uid())
 on conflict(event_id) do update set entry_ids=excluded.entry_ids,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=now();
 insert into public.caro_audit(club_id,trial_id,actor_id,action,reference,details) values(event.club_id,event.trial_id,auth.uid(),'order.saved',p_event::text,jsonb_build_object('revision',rev,'entries',p_entries));
 result:=jsonb_build_object('revision',rev);insert into caro_private.trial_command_receipts values(event.trial_id,p_request,auth.uid(),payload,result,now());return result;
end;$$;
create function public.caro_save_running_order(p_event uuid,p_revision integer,p_request uuid,p_entries uuid[]) returns jsonb language sql security invoker set search_path='' as $$select caro_private.save_running_order(p_event,p_revision,p_request,p_entries)$$;

create function caro_private.record_judge_score(p_entry uuid,p_event uuid,p_entry_revision integer,p_version integer,p_request uuid,p_outcome jsonb,p_elapsed double precision,p_confirmed boolean,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare entry public.caro_entries;event public.caro_events;line jsonb;payload jsonb;receipt caro_private.trial_command_receipts;result jsonb;prior integer;normalized jsonb;item jsonb;seen text[]:='{}';score_value integer;score_id uuid;
begin
 select * into entry from public.caro_entries where id=p_entry;
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or entry.id is null
  or not(caro_private.is_administrator() or caro_private.can_read_trial(entry.club_id,entry.trial_id)) then raise exception 'Trial access required' using errcode='42501';end if;
 perform 1 from public.caro_trials where id=entry.trial_id for update;
 select * into event from public.caro_events where id=p_event and trial_id=entry.trial_id for update;
 select * into entry from public.caro_entries where id=p_entry for update;
 if event.id is null or p_request is null or p_confirmed is distinct from true or p_elapsed is null or p_elapsed<0 or p_elapsed>='Infinity'::double precision or p_reason is null or length(p_reason)>1000 then raise exception 'Confirm the judge-provided result and a finite nonnegative elapsed time';end if;
 payload:=jsonb_build_object('command','judge_score','entry',p_entry,'event',p_event,'entryRevision',p_entry_revision,'version',p_version,'outcome',p_outcome,'elapsed',p_elapsed,'confirmed',p_confirmed,'reason',btrim(p_reason));
 select * into receipt from caro_private.trial_command_receipts where trial_id=entry.trial_id and request_key=p_request;
 if receipt.request_key is not null then if receipt.actor_id<>auth.uid() or receipt.payload is distinct from payload then raise exception 'Request reference already used';end if;return receipt.result;end if;
 if exists(select 1 from public.caro_completed_events where event_id=p_event) then raise exception 'Completed Trial Record is locked';end if;
 if p_entry_revision is null or p_entry_revision<>entry.revision then raise exception 'Entry changed. Refresh before transcribing.' using errcode='40001';end if;
 select value into line from jsonb_array_elements(case when jsonb_typeof(entry.details->'selections')='array' then entry.details->'selections' else '[]'::jsonb end) where value->>'eventId'=p_event::text;
 if line is null or coalesce(line->>'status',entry.status) not in ('accepted','checked_in') then raise exception 'Only accepted or checked-in runs can be scored';end if;
 select coalesce(max(version),0) into prior from public.caro_scores where entry_id=p_entry and event_id=p_event;
 if p_version is null or p_version<>prior then raise exception 'Result changed. Refresh before recording a correction.' using errcode='40001';end if;
 if prior>0 and length(btrim(p_reason))=0 then raise exception 'Record the transcription correction reason';end if;
 if event.format='Working' then
  if jsonb_typeof(line->'exercises') is distinct from 'array' or jsonb_array_length(line->'exercises')=0 or jsonb_typeof(p_outcome) is distinct from 'array' or jsonb_array_length(p_outcome)<>jsonb_array_length(line->'exercises') then raise exception 'Record every selected Working exercise';end if;
  normalized:='[]';
  for item in select value from jsonb_array_elements(p_outcome) loop
   if item->>'id' is null or item->>'outcome' is null or item->>'outcome' not in ('Pass','Not Yet','FEO','Absent','Excused') or item->>'id'=any(seen)
    or not exists(select 1 from jsonb_array_elements(line->'exercises') selected where selected->>'id'=item->>'id') then raise exception 'Check Working exercise outcomes';end if;
   if line->'feo'='true'::jsonb and item->>'outcome' not in ('FEO','Absent','Excused') then raise exception 'An FEO round cannot earn exercise passes';end if;
   seen:=array_append(seen,item->>'id');normalized:=normalized||jsonb_build_array(jsonb_build_object('id',item->>'id','outcome',item->>'outcome'));
  end loop;
 else
  if jsonb_typeof(p_outcome) is distinct from 'object' or p_outcome->>'outcome' is null or p_outcome->>'outcome' not in ('Q','NQ','FEO','Absent','Excused') then raise exception 'Choose the judge-provided Rally outcome';end if;
  score_value:=null;
  if p_outcome->'score' is not null and p_outcome->'score'<>'null'::jsonb then
   if jsonb_typeof(p_outcome->'score') is distinct from 'number' or p_outcome->>'score'!~'^[0-9]{1,3}$' then raise exception 'Rally score must be a whole number from 0 to 200';end if;
   score_value:=(p_outcome->>'score')::integer;if score_value>200 then raise exception 'Rally score must be a whole number from 0 to 200';end if;
  end if;
  if p_outcome->>'outcome'='Q' and score_value is null then raise exception 'Record the Rally score';end if;
  if line->'feo'='true'::jsonb and p_outcome->>'outcome' not in ('FEO','Absent','Excused') then raise exception 'An FEO run cannot earn a qualifying result';end if;
  normalized:=jsonb_build_object('outcome',p_outcome->>'outcome','score',score_value);
 end if;
 insert into public.caro_scores(club_id,trial_id,entry_id,event_id,version,judge_name,judge_confirmed,outcome,correction_reason,actor_id,elapsed_seconds)
 values(entry.club_id,entry.trial_id,p_entry,p_event,prior+1,event.judge_name,true,normalized,nullif(btrim(p_reason),''),auth.uid(),p_elapsed) returning id into score_id;
 insert into public.caro_audit(club_id,trial_id,actor_id,action,reference,details) values(entry.club_id,entry.trial_id,auth.uid(),'score.recorded',score_id::text,jsonb_build_object('entryId',p_entry,'eventId',p_event,'version',prior+1,'reason',btrim(p_reason),'provenance','judge_provided_not_automatically_calculated'));
 result:=jsonb_build_object('id',score_id,'version',prior+1);insert into caro_private.trial_command_receipts values(entry.trial_id,p_request,auth.uid(),payload,result,now());return result;
end;$$;
create function public.caro_record_judge_score(p_entry uuid,p_event uuid,p_entry_revision integer,p_version integer,p_request uuid,p_outcome jsonb,p_elapsed double precision,p_confirmed boolean,p_reason text default '') returns jsonb
language sql security invoker set search_path='' as $$select caro_private.record_judge_score(p_entry,p_event,p_entry_revision,p_version,p_request,p_outcome,p_elapsed,p_confirmed,p_reason)$$;

create function caro_private.complete_trial_event(p_event uuid,p_review_token text,p_request uuid,p_signoff text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare event public.caro_events;desk jsonb;payload jsonb;receipt caro_private.trial_command_receipts;result jsonb;
begin
 select * into event from public.caro_events where id=p_event;
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or event.id is null
  or not(caro_private.is_administrator() or caro_private.can_read_trial(event.club_id,event.trial_id)) then raise exception 'Trial access required' using errcode='42501';end if;
 perform 1 from public.caro_trials where id=event.trial_id for update;perform 1 from public.caro_events where id=p_event for update;
 if p_request is null or p_review_token is null or p_signoff is null or length(btrim(p_signoff)) not between 1 and 1000 then raise exception 'Provide the reviewed record and judge sign-off evidence';end if;
 payload:=jsonb_build_object('command','event_complete','event',p_event,'reviewToken',p_review_token,'signoff',btrim(p_signoff));
 select * into receipt from caro_private.trial_command_receipts where trial_id=event.trial_id and request_key=p_request;
 if receipt.request_key is not null then if receipt.actor_id<>auth.uid() or receipt.payload is distinct from payload then raise exception 'Request reference already used';end if;return receipt.result;end if;
 desk:=caro_private.event_desk(p_event);
 if desk->'completed'<>'null'::jsonb then raise exception 'Trial Record already complete';end if;
 if p_review_token is distinct from desk->>'reviewToken' then raise exception 'The reviewed event changed. Refresh and review again.' using errcode='40001';end if;
 if exists(select 1 from jsonb_array_elements(desk->'runs') run where run->'score'='null'::jsonb) then raise exception 'Record a result, absence or excusal for every active run';end if;
 insert into public.caro_completed_events(club_id,trial_id,event_id,signoff,actor_id) values(event.club_id,event.trial_id,p_event,btrim(p_signoff),auth.uid());
 insert into public.caro_audit(club_id,trial_id,actor_id,action,reference,details) values(event.club_id,event.trial_id,auth.uid(),'event.completed',p_event::text,jsonb_build_object('signoff',btrim(p_signoff),'reviewToken',p_review_token));
 result:=jsonb_build_object('eventId',p_event,'complete',true);insert into caro_private.trial_command_receipts values(event.trial_id,p_request,auth.uid(),payload,result,now());return result;
end;$$;
create function public.caro_complete_trial_event(p_event uuid,p_review_token text,p_request uuid,p_signoff text) returns jsonb language sql security invoker set search_path='' as $$select caro_private.complete_trial_event(p_event,p_review_token,p_request,p_signoff)$$;

revoke all on function caro_private.event_desk(uuid),caro_private.save_running_order(uuid,integer,uuid,uuid[]),caro_private.record_judge_score(uuid,uuid,integer,integer,uuid,jsonb,double precision,boolean,text),caro_private.complete_trial_event(uuid,text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function caro_private.event_desk(uuid),caro_private.save_running_order(uuid,integer,uuid,uuid[]),caro_private.record_judge_score(uuid,uuid,integer,integer,uuid,jsonb,double precision,boolean,text),caro_private.complete_trial_event(uuid,text,uuid,text) to authenticated;
revoke all on function public.caro_event_desk(uuid),public.caro_save_running_order(uuid,integer,uuid,uuid[]),public.caro_record_judge_score(uuid,uuid,integer,integer,uuid,jsonb,double precision,boolean,text),public.caro_complete_trial_event(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.caro_event_desk(uuid),public.caro_save_running_order(uuid,integer,uuid,uuid[]),public.caro_record_judge_score(uuid,uuid,integer,integer,uuid,jsonb,double precision,boolean,text),public.caro_complete_trial_event(uuid,text,uuid,text) to authenticated;
commit;
