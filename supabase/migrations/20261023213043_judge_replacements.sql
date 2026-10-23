-- Judge replacements are append-only overlays; original event/application/editions stay immutable.
begin;
create table public.caro_judge_amendments(
 id uuid primary key default gen_random_uuid(),club_id uuid not null,trial_id uuid not null,event_id uuid not null,
 version integer not null check(version>0),previous_judge text not null,officiating_judge text not null,results_judge text not null,
 original_courses boolean not null,reason text not null,caro_reference text not null,public_notice text not null,
 actor_id uuid not null references auth.users(id),occurred_at timestamptz not null default now(),
 unique(event_id,version),foreign key(club_id,trial_id,event_id) references public.caro_events(club_id,trial_id,id)
);
create index caro_judge_amendments_trial on public.caro_judge_amendments(trial_id,event_id,version desc);
alter table public.caro_judge_amendments enable row level security;
revoke all on public.caro_judge_amendments from public,anon,authenticated,service_role;
grant select on public.caro_judge_amendments to authenticated;
create policy caro_judge_amendments_staff on public.caro_judge_amendments for select to authenticated using(caro_private.is_administrator() or caro_private.can_read_trial(club_id,trial_id));
create trigger caro_judge_amendments_immutable before update or delete on public.caro_judge_amendments for each row execute function caro_private.reject_rewrite();

create function caro_private.judge_assignment(p_event uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('officiatingJudge',coalesce(a.officiating_judge,e.judge_name),'resultsJudge',coalesce(a.results_judge,e.judge_name),'originalJudge',e.judge_name,'version',coalesce(a.version,0))
 from public.caro_events e left join lateral(select * from public.caro_judge_amendments where event_id=e.id order by version desc limit 1) a on true where e.id=p_event
$$;
revoke all on function caro_private.judge_assignment(uuid) from public,anon,authenticated,service_role;

create function caro_private.amend_judge(p_event uuid,p_version integer,p_request uuid,p_judge text,p_original_courses boolean,p_reason text,p_caro_reference text,p_notice text,p_reviewed boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare event public.caro_events;trial public.caro_trials;assignment jsonb;payload jsonb;receipt caro_private.trial_command_receipts;result jsonb;amendment uuid;credit text;
begin
 select * into event from public.caro_events where id=p_event;
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or event.id is null or not(caro_private.is_administrator() or caro_private.can_read_trial(event.club_id,event.trial_id)) then raise exception 'Trial access required' using errcode='42501';end if;
 select * into trial from public.caro_trials where id=event.trial_id for update;
 perform 1 from public.caro_events where id=p_event for update;
 if p_request is null or p_version is null or p_reviewed is distinct from true or p_original_courses is null or p_judge is null or length(btrim(p_judge)) not between 2 and 200 or p_reason is null or length(btrim(p_reason)) not between 5 and 1000 or p_caro_reference is null or length(btrim(p_caro_reference)) not between 5 and 1000 or p_notice is null or length(btrim(p_notice)) not between 5 and 1000 then raise exception 'Review the replacement, course attribution, reason, CARO communication reference and public notice';end if;
 payload:=jsonb_build_object('command','judge_amendment','event',p_event,'version',p_version,'judge',btrim(p_judge),'originalCourses',p_original_courses,'reason',btrim(p_reason),'caroReference',btrim(p_caro_reference),'notice',btrim(p_notice));
 select * into receipt from caro_private.trial_command_receipts where trial_id=trial.id and request_key=p_request;
 if receipt.request_key is not null then if receipt.actor_id<>auth.uid() or receipt.payload is distinct from payload then raise exception 'Request reference already used';end if;return receipt.result;end if;
 if trial.application_state<>'finalized' then raise exception 'Edit judges in trial details while the trial is a draft';end if;
 if exists(select 1 from public.caro_completed_events where event_id=p_event) or exists(select 1 from public.caro_scores where event_id=p_event) then raise exception 'Scored or completed rounds require a separately reviewed correction; replacement blocked';end if;
 assignment:=caro_private.judge_assignment(p_event);
 if (assignment->>'version')::integer<>p_version then raise exception 'Judge assignment changed. Refresh before saving' using errcode='40001';end if;
 if btrim(p_judge)=assignment->>'officiatingJudge' then raise exception 'Choose a different replacement judge';end if;
 credit:=case when p_original_courses then assignment->>'resultsJudge' else btrim(p_judge) end;
 insert into public.caro_judge_amendments(club_id,trial_id,event_id,version,previous_judge,officiating_judge,results_judge,original_courses,reason,caro_reference,public_notice,actor_id)
 values(event.club_id,trial.id,p_event,p_version+1,assignment->>'officiatingJudge',btrim(p_judge),credit,p_original_courses,btrim(p_reason),btrim(p_caro_reference),btrim(p_notice),auth.uid()) returning id into amendment;
 insert into public.caro_audit(club_id,trial_id,actor_id,action,reference,details) values(event.club_id,trial.id,auth.uid(),'trial.judge_amended',amendment::text,jsonb_build_object('eventId',p_event,'reason',btrim(p_reason),'previousJudge',assignment->>'officiatingJudge','officiatingJudge',btrim(p_judge),'resultsJudge',credit,'version',p_version+1,'notificationStatus','Secretary must notify affected entrants'));
 result:=jsonb_build_object('id',amendment,'version',p_version+1,'officiatingJudge',btrim(p_judge),'resultsJudge',credit);
 insert into caro_private.trial_command_receipts values(trial.id,p_request,auth.uid(),payload,result,now());return result;
end;$$;
create function public.caro_amend_judge(p_event uuid,p_version integer,p_request uuid,p_judge text,p_original_courses boolean,p_reason text,p_caro_reference text,p_notice text,p_reviewed boolean) returns jsonb
language sql security invoker set search_path='' as $$ select caro_private.amend_judge(p_event,p_version,p_request,p_judge,p_original_courses,p_reason,p_caro_reference,p_notice,p_reviewed) $$;
revoke all on function caro_private.amend_judge(uuid,integer,uuid,text,boolean,text,text,text,boolean),public.caro_amend_judge(uuid,integer,uuid,text,boolean,text,text,text,boolean) from public,anon,authenticated,service_role;
grant execute on function caro_private.amend_judge(uuid,integer,uuid,text,boolean,text,text,text,boolean),public.caro_amend_judge(uuid,integer,uuid,text,boolean,text,text,text,boolean) to authenticated;

create or replace function caro_private.event_desk(p_event uuid) returns jsonb
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
 payload:=jsonb_build_object('event',jsonb_build_object('id',event.id,'trialId',trial.id,'round',event.official_round,'date',event.local_date,'format',event.format,'level',event.level,'judge',caro_private.judge_assignment(event.id)->>'resultsJudge','officiatingJudge',caro_private.judge_assignment(event.id)->>'officiatingJudge','assignmentVersion',(caro_private.judge_assignment(event.id)->>'version')::integer,'fictional',trial.is_practice,'title',trial.title,'host',trial.planning->>'host','trialNumber',trial.trial_number,'timezone',trial.timezone),
  'orderRevision',coalesce(running.revision,-1),'runs',runs,'completed',closed);
 return payload||jsonb_build_object('reviewToken',encode(sha256(convert_to(payload::text,'UTF8')),'hex'));
end;$$;
create or replace function caro_private.record_judge_score(p_entry uuid,p_event uuid,p_entry_revision integer,p_version integer,p_request uuid,p_outcome jsonb,p_elapsed double precision,p_confirmed boolean,p_reason text) returns jsonb
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
 if (caro_private.judge_assignment(p_event)->>'version')::integer>0 then raise exception 'Judge assignment changed. Refresh and use the current result editor' using errcode='40001';end if;
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
 values(entry.club_id,entry.trial_id,p_entry,p_event,prior+1,caro_private.judge_assignment(event.id)->>'resultsJudge',true,normalized,nullif(btrim(p_reason),''),auth.uid(),p_elapsed) returning id into score_id;
 insert into public.caro_audit(club_id,trial_id,actor_id,action,reference,details) values(entry.club_id,entry.trial_id,auth.uid(),'score.recorded',score_id::text,jsonb_build_object('entryId',p_entry,'eventId',p_event,'version',prior+1,'reason',btrim(p_reason),'provenance','judge_provided_not_automatically_calculated'));
 result:=jsonb_build_object('id',score_id,'version',prior+1);insert into caro_private.trial_command_receipts values(entry.trial_id,p_request,auth.uid(),payload,result,now());return result;
end;$$;
create function caro_private.record_assigned_judge_score(p_entry uuid,p_event uuid,p_entry_revision integer,p_version integer,p_request uuid,p_outcome jsonb,p_elapsed double precision,p_confirmed boolean,p_reason text,p_assignment_version integer) returns jsonb
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
 payload:=jsonb_build_object('command','assigned_judge_score','assignmentVersion',p_assignment_version,'entry',p_entry,'event',p_event,'entryRevision',p_entry_revision,'version',p_version,'outcome',p_outcome,'elapsed',p_elapsed,'confirmed',p_confirmed,'reason',btrim(p_reason));
 select * into receipt from caro_private.trial_command_receipts where trial_id=entry.trial_id and request_key=p_request;
 if receipt.request_key is not null then if receipt.actor_id<>auth.uid() or receipt.payload is distinct from payload then raise exception 'Request reference already used';end if;return receipt.result;end if;
 if p_assignment_version is null or p_assignment_version<>(caro_private.judge_assignment(p_event)->>'version')::integer then raise exception 'Judge assignment changed. Refresh before transcribing' using errcode='40001';end if;
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
 values(entry.club_id,entry.trial_id,p_entry,p_event,prior+1,caro_private.judge_assignment(event.id)->>'resultsJudge',true,normalized,nullif(btrim(p_reason),''),auth.uid(),p_elapsed) returning id into score_id;
 insert into public.caro_audit(club_id,trial_id,actor_id,action,reference,details) values(entry.club_id,entry.trial_id,auth.uid(),'score.recorded',score_id::text,jsonb_build_object('entryId',p_entry,'eventId',p_event,'version',prior+1,'reason',btrim(p_reason),'provenance','judge_provided_not_automatically_calculated'));
 result:=jsonb_build_object('id',score_id,'version',prior+1);insert into caro_private.trial_command_receipts values(entry.trial_id,p_request,auth.uid(),payload,result,now());return result;
end;$$;

create function public.caro_record_assigned_judge_score(p_entry uuid,p_event uuid,p_entry_revision integer,p_version integer,p_request uuid,p_outcome jsonb,p_elapsed double precision,p_confirmed boolean,p_reason text,p_assignment_version integer) returns jsonb
language sql security invoker set search_path='' as $$select caro_private.record_assigned_judge_score(p_entry,p_event,p_entry_revision,p_version,p_request,p_outcome,p_elapsed,p_confirmed,p_reason,p_assignment_version)$$;
revoke all on function caro_private.record_assigned_judge_score(uuid,uuid,integer,integer,uuid,jsonb,double precision,boolean,text,integer),public.caro_record_assigned_judge_score(uuid,uuid,integer,integer,uuid,jsonb,double precision,boolean,text,integer) from public,anon,authenticated,service_role;
grant execute on function caro_private.record_assigned_judge_score(uuid,uuid,integer,integer,uuid,jsonb,double precision,boolean,text,integer),public.caro_record_assigned_judge_score(uuid,uuid,integer,integer,uuid,jsonb,double precision,boolean,text,integer) to authenticated;

create or replace function caro_private.report_snapshot(p_trial uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare trial public.caro_trials;config jsonb;events jsonb;entries jsonb;ledger jsonb;scores jsonb;expenses jsonb;audit jsonb;orders jsonb;completed jsonb;paperwork jsonb;incidents jsonb;
begin
 select * into trial from public.caro_trials where id=p_trial;
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or trial.id is null
  or not(caro_private.is_administrator() or caro_private.can_read_trial(trial.club_id,p_trial)) then raise exception 'Trial access required' using errcode='42501';end if;
 select snapshot->'configuration' into config from public.caro_premium_versions where trial_id=p_trial and snapshot->>'kind' in ('manual_entry_edition','public_entry_edition') order by version desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'round',e.official_round,'dayId',e.local_date,'format',e.format,'level',e.level,'judge',caro_private.judge_assignment(e.id)->>'resultsJudge','officiatingJudge',caro_private.judge_assignment(e.id)->>'officiatingJudge','stream',e.offerings->>'stream',
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
create or replace function caro_private.public_premium(p_slug text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare listing public.caro_public_trials;edition public.caro_premium_versions;
begin
 if p_slug is null or p_slug!~'^[a-z0-9][a-z0-9-]{2,79}$' then raise exception 'Published trial is unavailable';end if;
 select p.* into listing from public.caro_public_trials p join public.caro_trials t on t.id=p.trial_id where p.slug=p_slug and p.is_live and t.application_state='finalized' and t.sanction_status='approved' and not t.is_practice;
 if listing.id is null then raise exception 'Published trial is unavailable';end if;
 select * into edition from public.caro_premium_versions where id=listing.premium_id and snapshot->>'kind'='public_entry_edition' and snapshot->'publication_ready'='true'::jsonb;
 if edition.id is null then raise exception 'Published trial is unavailable';end if;
 return jsonb_build_object('kind','public_entry_edition','publicationReady',true,'slug',listing.slug,'premiumId',edition.id,'version',edition.version,'onlineEnabled',listing.online_enabled,
  'judgeAmendments',(select coalesce(jsonb_agg(jsonb_build_object('eventId',a.event_id,'round',e.official_round,'officiatingJudge',a.officiating_judge,'resultsJudge',a.results_judge,'notice',a.public_notice,'version',a.version,'recordedAt',a.occurred_at) order by e.official_round,a.version),'[]'::jsonb) from public.caro_judge_amendments a join public.caro_events e on e.id=a.event_id where a.trial_id=listing.trial_id),'configuration',edition.snapshot->'configuration','content',edition.snapshot->'content');
end;$$;
create or replace function caro_private.publication_preview(p_trial uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare trial public.caro_trials;config jsonb;content jsonb;manual public.caro_premium_versions;payload jsonb;field text;
begin
 select * into trial from public.caro_trials where id=p_trial;
 -- Verify current staff access and CARO approval before inspecting private terms.
 config:=caro_private.manual_entry_configuration(p_trial);
 if trial.is_practice or trial.title ilike '%TEST ONLY%' then raise exception 'Fictional practice trials cannot be published';end if;
 select p.* into manual from public.caro_entries e join public.caro_premium_versions p on p.id=e.premium_id where e.trial_id=p_trial order by e.created_at,e.id limit 1;
 if manual.id is not null then
  if manual.snapshot->>'kind' not in ('manual_entry_edition','public_entry_edition') or jsonb_typeof(manual.snapshot->'configuration') is distinct from 'object' then raise exception 'The original entry terms need review before publication';end if;
  config:=manual.snapshot->'configuration';content:=manual.snapshot->'content';
 else config:=caro_private.entry_setup_configuration(p_trial);select d.content into content from public.caro_premium_drafts d where d.trial_id=p_trial;end if;
 if coalesce(length(btrim(config->>'host')),0)=0 or coalesce(length(btrim(config->>'email')),0)=0 or coalesce(length(btrim(config->>'venue')),0)=0 or coalesce(length(btrim(config->>'address')),0)=0 or coalesce(length(btrim(config->>'secretary')),0)=0 then raise exception 'Complete public host, secretary, email and venue information';end if;
 for field in select unnest(array['payment','confirmations','refunds','moveups','waiver']) loop
  if coalesce(length(btrim(content->>field)),0)=0 then raise exception 'Complete public premium policy: %',field;end if;
 end loop;
 if content is null then raise exception 'The original entry terms need review before publication';end if;
 if config->>'trialNumber' is distinct from trial.trial_number then raise exception 'The trial reference changed; review the frozen terms';end if;
 if coalesce(length(btrim(content->>'waiver')),0)=0 or content->>'waiver'~*'DRAFT[[:space:]]+PLACEHOLDER' then raise exception 'Replace the placeholder host agreement';end if;
 if (config->>'closes')::date>trial.start_date then raise exception 'Online closing after the first trial date needs a separately reviewed late-entry workflow';end if;
 payload:=jsonb_build_object('configuration',config,'content',content,'trialRevision',trial.revision,'judgeAmendments',(select coalesce(jsonb_agg(jsonb_build_object('eventId',a.event_id,'round',e.official_round,'officiatingJudge',a.officiating_judge,'resultsJudge',a.results_judge,'notice',a.public_notice,'version',a.version,'recordedAt',a.occurred_at) order by e.official_round,a.version),'[]'::jsonb) from public.caro_judge_amendments a join public.caro_events e on e.id=a.event_id where a.trial_id=p_trial));
 return payload||jsonb_build_object('usesFrozenTerms',manual.id is not null,'reviewToken',encode(sha256(convert_to(payload::text,'UTF8')),'hex'));
end;$$;
commit;
