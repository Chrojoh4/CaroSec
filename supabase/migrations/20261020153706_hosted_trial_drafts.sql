-- Hosted draft commands only. No publication, sanction, entries or results writes.
begin;
create function caro_private.write_trial_draft(p_id uuid,p_club uuid,p_revision integer,p_title text,p_start date,p_end date,p_timezone text,p_planning jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current_trial public.caro_trials; caller uuid:=auth.uid(); member_role text; item record; event jsonb; next_revision integer;
begin
  if caller is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in required' using errcode='42501'; end if;
  select role into member_role from public.caro_memberships where club_id=p_club and user_id=caller and active for share;
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
    if current_trial.club_id<>p_club or not caro_private.can_read_trial(p_club,p_id) then raise exception 'Trial access denied' using errcode='42501'; end if;
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
revoke all on function caro_private.write_trial_draft(uuid,uuid,integer,text,date,date,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function caro_private.write_trial_draft(uuid,uuid,integer,text,date,date,text,jsonb) to authenticated;
create function public.caro_save_trial_draft(p_id uuid,p_club uuid,p_revision integer,p_title text,p_start date,p_end date,p_timezone text,p_planning jsonb) returns jsonb
language sql security invoker set search_path='' as $$select caro_private.write_trial_draft(p_id,p_club,p_revision,p_title,p_start,p_end,p_timezone,p_planning);$$;
revoke all on function public.caro_save_trial_draft(uuid,uuid,integer,text,date,date,text,jsonb) from public,anon,authenticated;
grant execute on function public.caro_save_trial_draft(uuid,uuid,integer,text,date,date,text,jsonb) to authenticated;
commit;
