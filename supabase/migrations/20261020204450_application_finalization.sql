-- Apply after system_administrator migration. No CARO approval/publication is granted.
begin;
create function caro_private.finalize_trial_draft(p_id uuid,p_club uuid,p_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); trial public.caro_trials; key text; event jsonb; ordinal bigint;
begin
 if caller is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in required' using errcode='42501'; end if;
 select * into trial from public.caro_trials where id=p_id and club_id=p_club for update;
 if not found or not (caro_private.is_administrator() or caro_private.can_read_trial(p_club,p_id)) then raise exception 'Trial access denied' using errcode='42501'; end if;
 if trial.application_state<>'draft' then raise exception 'Application is already finalized'; end if;
 if p_revision is null or trial.revision<>p_revision then raise exception 'Another change was saved; reload before finalizing' using errcode='40001'; end if;
 if trial.end_date-trial.start_date>30 then raise exception 'Trial supports at most 31 consecutive days'; end if;
 foreach key in array array['host','organizer','organizerEmail','memberReference','secretary','email','chair','chairEmail','venue','address','surface'] loop
  if jsonb_typeof(trial.planning->key) is distinct from 'string' or coalesce(length(btrim(trial.planning->>key)),0)=0 then raise exception 'Complete required application field: %',key; end if;
 end loop;
 foreach key in array array['organizerEmail','email','chairEmail'] loop
  if (trial.planning->>key) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Check application email: %',key; end if;
 end loop;
 foreach key in array array['ringWidth','ringLength'] loop
  if coalesce(trial.planning->>key,'') !~ '^[0-9]+(\.[0-9]+)?$' then raise exception 'Enter positive ring dimensions'; end if;
  if (trial.planning->>key)::numeric<=0 then raise exception 'Enter positive ring dimensions'; end if;
 end loop;
 foreach key in array array['professionalConfirmed','judgesConfirmed','classesConfirmed','nearbyConfirmed'] loop
  if trial.planning->key is distinct from 'true'::jsonb then raise exception 'Complete the application review: %',key; end if;
 end loop;
 if jsonb_typeof(trial.planning->'events') is distinct from 'array' then raise exception 'Add offered events'; end if;
 if jsonb_array_length(trial.planning->'events') not between 1 and 150 then raise exception 'Add 1 to 150 offered events'; end if;
 if exists(select 1 from public.caro_events where trial_id=p_id) then raise exception 'Existing official events require review before finalization'; end if;
 for event,ordinal in select value,ordinality from jsonb_array_elements(trial.planning->'events') with ordinality loop
  if jsonb_typeof(event) is distinct from 'object' or coalesce(length(btrim(event->>'id')),0)=0 or coalesce(length(btrim(event->>'judge')),0)=0 or coalesce(length(btrim(event->>'stream')),0)=0 then raise exception 'Each event needs its identity, judge and stream or levels'; end if;
  if (event->>'dayId')::date not between trial.start_date and trial.end_date then raise exception 'Event date is outside the trial'; end if;
  if (event->>'format'='Working') is distinct from (event->>'level'='Working') then raise exception 'Check Working event classification'; end if;
  if event->>'level' not in ('Novice','Intermediate','Advanced','Excellent','Versatility','Versatility Excellent','Working') then raise exception 'Unsupported event class'; end if;
  if event->>'format'='Working' and coalesce(length(btrim(event->>'exercises')),0)=0 then raise exception 'List offered Working exercises and levels'; end if;
  insert into public.caro_events(club_id,trial_id,local_key,official_round,local_date,format,level,judge_name,offerings)
  values(p_club,p_id,event->>'id',ordinal,(event->>'dayId')::date,event->>'format',event->>'level',btrim(event->>'judge'),jsonb_build_object('stream',event->>'stream','exercises',event->>'exercises'));
 end loop;
 update public.caro_trials set application_state='finalized',revision=revision+1,updated_at=now(),planning=planning||jsonb_build_object('finalizedAt',now(),'finalizedBy',caller) where id=p_id;
 insert into public.caro_audit(club_id,trial_id,actor_id,action,reference,details) values(p_club,p_id,caller,'application.finalized',p_id::text,jsonb_build_object('revision',trial.revision+1,'events',jsonb_array_length(trial.planning->'events')));
 return jsonb_build_object('id',p_id,'revision',trial.revision+1,'application_state','finalized');
end;$$;
revoke all on function caro_private.finalize_trial_draft(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function caro_private.finalize_trial_draft(uuid,uuid,integer) to authenticated;
create function public.caro_finalize_trial_draft(p_id uuid,p_club uuid,p_revision integer) returns jsonb
language sql security invoker set search_path='' as $$select caro_private.finalize_trial_draft(p_id,p_club,p_revision);$$;
revoke all on function public.caro_finalize_trial_draft(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.caro_finalize_trial_draft(uuid,uuid,integer) to authenticated;
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
    elsif item.key in ('professionalConfirmed','judgesConfirmed','classesConfirmed','nearbyConfirmed') then
      if jsonb_typeof(item.value)<>'boolean' then raise exception 'Review flags must be boolean'; end if;
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
