-- Staff-only paper/email intake. No public entry endpoint or automatic acceptance.
begin;
create function caro_private.entry_text(value jsonb,key text,label text,max_length integer) returns text
language plpgsql immutable set search_path='' as $$
declare result text;
begin
 if jsonb_typeof(value->key) is distinct from 'string' then raise exception '% is required',label;end if;
 result:=btrim(value->>key);
 if length(result) not between 1 and max_length then raise exception 'Check % (maximum % characters)',label,max_length;end if;
 return result;
end;$$;
create function caro_private.entry_dog(value jsonb,p_label text,p_owner text,p_date date) returns jsonb
language plpgsql immutable set search_path='' as $$
declare dog jsonb;birthday text;owner_name text;caro_id text;
begin
 caro_id:=caro_private.entry_text(value,'caroId',p_label||' CARO ID',40);
 if caro_id='2799' or value->'bye'='true'::jsonb then raise exception 'Bye participants require a separate secretary arrangement';end if;
 birthday:=caro_private.entry_text(value,'birthDate',p_label||' birth date',10);
 if birthday!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or birthday::date>p_date then raise exception 'Check dog birth date';end if;
 owner_name:=coalesce(nullif(btrim(value->>'owner'),''),p_owner);
 if value ? 'owner' and jsonb_typeof(value->'owner') not in ('string','null') then raise exception 'Check owner name';end if;
 if length(owner_name)>100 then raise exception 'Check owner name';end if;
 dog:=jsonb_build_object('name',caro_private.entry_text(value,'name',p_label||' name',100),'caroId',caro_id,
  'breed',caro_private.entry_text(value,'breed',p_label||' breed',100),'birthDate',birthday,
  'height',caro_private.entry_text(value,'height',p_label||' height',40),'jumpHeight',caro_private.entry_text(value,'jumpHeight',p_label||' jump height',40),
  'owner',owner_name,'veteran',coalesce(value->'veteran'='true'::jsonb,false),'bye',false);
 return dog;
end;$$;
create function caro_private.entry_setup_configuration(p_trial uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare trial public.caro_trials;settings public.caro_entry_settings;draft public.caro_premium_drafts;edition public.caro_premium_versions;
 event public.caro_events;price jsonb;events jsonb:='[]';levels text[];exercises jsonb;names text[];level_name text;
begin
 select * into trial from public.caro_trials where id=p_trial;
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or trial.id is null
  or not(caro_private.is_administrator() or caro_private.can_read_trial(trial.club_id,p_trial)) then raise exception 'Trial access required' using errcode='42501';end if;
 if trial.application_state<>'finalized' or (not trial.is_practice and trial.sanction_status<>'approved') then raise exception 'Record CARO approval before receiving hosted entries';end if;
 select * into settings from public.caro_entry_settings where trial_id=p_trial;
 select * into draft from public.caro_premium_drafts where trial_id=p_trial;
 if settings.trial_id is null or draft.trial_id is null or settings.premium_draft_revision<>draft.revision then raise exception 'Save and review current entry pricing before intake';end if;
 for event in select * from public.caro_events where trial_id=p_trial order by official_round loop
  select value into price from jsonb_array_elements(settings.pricing) where value->>'event_id'=event.id::text;
  if price is null then raise exception 'Entry pricing is missing an official event';end if;
  levels:='{}';exercises:='[]';
  foreach level_name in array (case when event.format='Working' then array['Rookie','Elite','Expert'] else array['B','C'] end) loop
   if coalesce(event.offerings->>'stream','')~*('(^|[^A-Za-z])'||level_name||'([^A-Za-z]|$)') then levels:=array_append(levels,level_name);end if;
  end loop;
  if cardinality(levels)=0 then raise exception 'Review offered streams/levels before intake';end if;
  if event.format='Working' then
   select array_agg(name order by ordinal) into names from (select btrim(value) name,ordinality ordinal from regexp_split_to_table(coalesce(event.offerings->>'exercises',''),E'[·,;\n]+') with ordinality as split(value,ordinality) where length(btrim(value))>0) parts;
   if coalesce(cardinality(names),0) not between 1 and 5 then raise exception 'Review one to five offered Working exercises';end if;
   for i in 1..cardinality(names) loop exercises:=exercises||jsonb_build_array(jsonb_build_object('id','exercise-'||i,'name',names[i]));end loop;
  end if;
  events:=events||jsonb_build_array(jsonb_build_object('id',event.id,'round',event.official_round,'dayId',event.local_date,'format',event.format,'level',event.level,'judge',event.judge_name,
    'levels',levels,'exercises',exercises,'basis',price->>'basis','capacity',(price->>'capacity')::integer,'fee',price->'fee','feoFee',price->'feoFee'));
 end loop;
 return jsonb_build_object('fictional',trial.is_practice,'id',p_trial,'title',trial.title,'trialNumber',trial.trial_number,'host',trial.planning->>'host','date',trial.start_date,'endDate',trial.end_date,'timezone',trial.timezone,
  'secretary',trial.planning->>'secretary','email',trial.planning->>'email','venue',trial.planning->>'venue','address',trial.planning->>'address',
  'opens',settings.opens_on,'closes',settings.closes_on,'waiver',draft.content->>'waiver','payment',draft.content->>'payment','confirmations',draft.content->>'confirmations',
  'premiumVersion',settings.agreement_version,'setupRevision',settings.revision,'premiumDraftRevision',draft.revision,'events',events);
end;$$;
create function caro_private.manual_entry_configuration(p_trial uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare trial public.caro_trials;config jsonb;
begin
 select * into trial from public.caro_trials where id=p_trial;
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or trial.id is null
 or not(caro_private.is_administrator() or caro_private.can_read_trial(trial.club_id,p_trial)) then raise exception 'Trial access required' using errcode='42501';end if;
 if trial.application_state<>'finalized' or (not trial.is_practice and trial.sanction_status<>'approved') then raise exception 'Record CARO approval before receiving hosted entries';end if;
 select p.snapshot->'configuration' into config from public.caro_entries e join public.caro_premium_versions p on p.id=e.premium_id
 where e.trial_id=p_trial and p.snapshot->>'kind' in ('manual_entry_edition','public_entry_edition') and jsonb_typeof(p.snapshot->'configuration')='object' order by e.created_at,e.id limit 1;
 if config is null then select p.snapshot->'configuration' into config from public.caro_public_trials l join public.caro_premium_versions p on p.id=l.premium_id where l.trial_id=p_trial and l.is_live and p.snapshot->>'kind'='public_entry_edition' limit 1;end if;
 return coalesce(config,caro_private.entry_setup_configuration(p_trial));
end;$$;
revoke all on function caro_private.entry_setup_configuration(uuid) from public,anon,authenticated,service_role;
create function public.caro_manual_entry_configuration(p_trial uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select caro_private.manual_entry_configuration(p_trial)$$;

create function caro_private.validate_entry_details(p_trial uuid,config jsonb,p_input jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare trial public.caro_trials;contact jsonb;dog jsonb;partner jsonb;selections jsonb:='[]';line jsonb;event jsonb;exercise jsonb;chosen jsonb;selected jsonb;fee jsonb;ids jsonb;
 event_id text;seen text[]:='{}';exercise_ids text[];units integer;amount bigint:=0;line_amount bigint;needs_partner boolean;feo boolean;
begin
 select * into trial from public.caro_trials where id=p_trial;
 contact:=jsonb_build_object('name',caro_private.entry_text(p_input->'contact','name','Handler name',100),'email',caro_private.entry_text(p_input->'contact','email','Email',150),
   'phone',caro_private.entry_text(p_input->'contact','phone','Phone',60),'address',caro_private.entry_text(p_input->'contact','address','Mailing address',350));
 if contact->>'email'!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Check the handler email';end if;
 dog:=caro_private.entry_dog(p_input->'dog','Dog',contact->>'name',trial.start_date);
 if jsonb_typeof(p_input->'selections') is distinct from 'array' or jsonb_array_length(p_input->'selections') not between 1 and jsonb_array_length(config->'events') then raise exception 'Select offered events';end if;
 select exists(select 1 from jsonb_array_elements(p_input->'selections') s join jsonb_array_elements(config->'events') e on e->>'id'=s->>'eventId' where e->>'format' in ('Team','Brace')) into needs_partner;
 if needs_partner then
  partner:=jsonb_build_object('handler',caro_private.entry_text(p_input->'partner','handler','Partner handler',100),
   'dog',caro_private.entry_dog(p_input->'partner'->'dog','Partner dog',coalesce(nullif(btrim(p_input->'partner'->>'handler'),''),contact->>'name'),trial.start_date));
  if partner->'dog'->>'caroId'=dog->>'caroId' then raise exception 'Team and Brace need different dogs';end if;
 end if;
 for line in select value from jsonb_array_elements(p_input->'selections') loop
  event_id:=line->>'eventId';select value into event from jsonb_array_elements(config->'events') where value->>'id'=event_id;
  if event is null or event_id=any(seen) then raise exception 'Choose each offered event once';end if;seen:=array_append(seen,event_id);
  perform 1 from public.caro_events locked where locked.id=(event->>'id')::uuid for update;
  if exists(select 1 from public.caro_completed_events completed where completed.event_id=(event->>'id')::uuid and completed.trial_id=p_trial) then raise exception 'A selected event is complete';end if;
  if event->>'format'='Team' and lower(partner->>'handler')=lower(contact->>'name') then raise exception 'Team uses two different handlers';end if;
  if event->>'format'='Brace' and partner->>'handler'<>contact->>'name' then raise exception 'Brace uses one handler for both dogs';end if;
  feo:=coalesce(line->'feo'='true'::jsonb,false);fee:=case when feo then event->'feoFee' else event->'fee' end;
  if fee is null or fee='null'::jsonb then raise exception 'FEO is not offered for this event';end if;
  selected:='[]';
  if event->>'format'='Working' then
   if jsonb_typeof(line->'exercises') is distinct from 'array' or jsonb_array_length(line->'exercises') not between 1 and jsonb_array_length(event->'exercises') then raise exception 'Select offered Working exercises';end if;
   exercise_ids:='{}';
   for exercise in select value from jsonb_array_elements(line->'exercises') loop
    select value into chosen from jsonb_array_elements(event->'exercises') where value->>'id'=exercise->>'id';
    if chosen is null or (exercise->>'id')=any(exercise_ids) or exercise->>'level' is null or not ((event->'levels') ? (exercise->>'level')) then raise exception 'Check selected exercise and level';end if;
    exercise_ids:=array_append(exercise_ids,exercise->>'id');selected:=selected||jsonb_build_array(jsonb_build_object('id',exercise->>'id','level',exercise->>'level'));
   end loop;
  elsif not ((event->'levels') ? (line->>'stream')) or line->>'stream' is null then raise exception 'Choose an offered stream';end if;
  units:=case when event->>'basis'='exercise' then jsonb_array_length(selected) when event->>'basis'='dog' and event->>'format' in ('Team','Brace') then 2 else 1 end;
  line_amount:=units::bigint*(fee->>'cents')::bigint;amount:=amount+line_amount;
  if amount>2147483647 then raise exception 'Entry amount exceeds the supported limit';end if;
  ids:=jsonb_build_array(dog->>'caroId');if event->>'format' in ('Team','Brace') then ids:=ids||jsonb_build_array(partner->'dog'->>'caroId');end if;
  selections:=selections||jsonb_build_array(jsonb_build_object('eventId',event_id,'stream',case when event->>'format'='Working' then null else line->>'stream' end,'feo',feo,'exercises',selected,
   'units',units,'unitCents',(fee->>'cents')::integer,'amountCents',line_amount,'participantIds',ids,'status','submitted'));
 end loop;
 if exists(select 1 from public.caro_entries prior cross join lateral jsonb_array_elements(case when jsonb_typeof(prior.details->'selections')='array' then prior.details->'selections' else '[]'::jsonb end) old
   join jsonb_array_elements(selections) fresh on old->>'eventId'=fresh->>'eventId'
   where prior.trial_id=p_trial and coalesce(old->>'status',prior.status) not in ('withdrawn','rejected')
   and (old->'participantIds') ?| array(select jsonb_array_elements_text(fresh->'participantIds'))) then raise exception 'A selected dog already has an entry for that round';end if;
 return jsonb_build_object('contact',contact,'dog',dog,'partner',partner,'selections',selections,'amountCents',amount);
end;$$;
revoke all on function caro_private.validate_entry_details(uuid,jsonb,jsonb) from public,anon,authenticated,service_role;

create function caro_private.record_manual_entry(p_trial uuid,p_setup_revision integer,p_channel text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare trial public.caro_trials;config jsonb;entry public.caro_entries;edition public.caro_premium_versions;key text;request_hash text;
 contact jsonb;dog jsonb;partner jsonb;selections jsonb:='[]';line jsonb;event jsonb;exercise jsonb;chosen jsonb;selected jsonb;fee jsonb;ids jsonb;
 event_id text;seen text[]:='{}';exercise_ids text[];units integer;amount bigint:=0;line_amount bigint;needs_partner boolean;feo boolean;
 received timestamptz;received_text text;evidence text;accommodation text;version_number integer;validated jsonb;
begin
 select * into trial from public.caro_trials where id=p_trial for update;
 -- Configuration verifies current caller membership and approval, even for retries.
 config:=caro_private.manual_entry_configuration(p_trial);
 if jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text)>200000 or p_channel is null or p_channel not in ('paper','email') then raise exception 'Invalid manual intake';end if;
 if p_input->>'trialId' is distinct from p_trial::text then raise exception 'Entry belongs to a different trial';end if;
 key:=caro_private.entry_text(p_input,'idempotencyKey','Submission reference',100);
 request_hash:=encode(sha256(convert_to(p_input::text||p_channel||coalesce(p_setup_revision::text,''),'UTF8')),'hex');
 select * into entry from public.caro_entries where trial_id=p_trial and idempotency_key=key;
 if entry.id is not null then
  if entry.request_hash<>request_hash then raise exception 'Submission reference already used with different content';end if;
  return jsonb_build_object('entryId',entry.id,'quoteCents',entry.amount_cents,'status',entry.status,'channel',entry.intake_channel);
 end if;
 if p_setup_revision is null or p_setup_revision<>(config->>'setupRevision')::integer then raise exception 'Entry setup changed. Reopen the form.' using errcode='40001';end if;
 if p_input->'agree' is distinct from 'true'::jsonb or p_input->'eligibilityDeclared' is distinct from 'true'::jsonb then raise exception 'Confirm the agreement evidence and eligibility declaration';end if;
 evidence:=caro_private.entry_text(p_input,'intakeEvidence','Signed agreement / intake evidence',1000);
 validated:=caro_private.validate_entry_details(p_trial,config,p_input);contact:=validated->'contact';dog:=validated->'dog';partner:=validated->'partner';selections:=validated->'selections';amount:=(validated->>'amountCents')::bigint;
 received_text:=p_input->>'receivedAt';received:=null;
 if coalesce(received_text,'')<>'' then
  if received_text!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,3})?(Z|[+-][0-9]{2}:[0-9]{2})$' then raise exception 'Received time needs seconds and an explicit UTC offset';end if;
  received:=received_text::timestamptz;if not isfinite(received) or received>now() then raise exception 'Received time cannot be in the future';end if;
 end if;
 accommodation:=coalesce(p_input->>'accommodation','');if length(accommodation)>2000 or (p_input ? 'accommodation' and jsonb_typeof(p_input->'accommodation') not in ('string','null')) then raise exception 'Check the accommodation note';end if;
 select p.* into edition from public.caro_entries e join public.caro_premium_versions p on p.id=e.premium_id where e.trial_id=p_trial and p.snapshot->>'kind' in ('manual_entry_edition','public_entry_edition') and jsonb_typeof(p.snapshot->'configuration')='object' order by e.created_at,e.id limit 1;
 if edition.id is null then select p.* into edition from public.caro_public_trials l join public.caro_premium_versions p on p.id=l.premium_id where l.trial_id=p_trial and l.is_live and p.snapshot->>'kind'='public_entry_edition' limit 1;end if;
 if edition.id is null then
  select coalesce(max(version),0)+1 into version_number from public.caro_premium_versions where trial_id=p_trial;
  insert into public.caro_premium_versions(club_id,trial_id,version,snapshot,agreement_version,reviewed_by) values(trial.club_id,p_trial,version_number,
    jsonb_build_object('kind','manual_entry_edition','publication_ready',false,'configuration',config,'content',(select content from public.caro_premium_drafts where trial_id=p_trial)),config->>'premiumVersion',auth.uid()) returning * into edition;
 end if;
 insert into public.caro_entries(club_id,trial_id,premium_id,idempotency_key,request_hash,receipt_token_hash,intake_channel,details,amount_cents,agreement_version,agreement_accepted_at)
 values(trial.club_id,p_trial,edition.id,key,request_hash,replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),p_channel,
  jsonb_build_object('contact',contact,'dog',dog,'partner',partner,'selections',selections,'accommodation',accommodation,'intakeEvidence',evidence,'receivedAt',to_char(received at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'originalSignatureTime',null,'staffAttestationAt',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),amount::integer,config->>'premiumVersion',now()) returning * into entry;
 insert into public.caro_audit(club_id,trial_id,actor_id,action,reference,details) values(trial.club_id,p_trial,auth.uid(),'entry.received',entry.id::text,
  jsonb_build_object('channel',p_channel,'receivedAt',to_char(received at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'quoteCents',amount,'premiumId',edition.id));
 return jsonb_build_object('entryId',entry.id,'quoteCents',entry.amount_cents,'status',entry.status,'channel',p_channel);
end;$$;
create function public.caro_record_manual_entry(p_trial uuid,p_setup_revision integer,p_channel text,p_input jsonb) returns jsonb
language sql security invoker set search_path='' as $$select caro_private.record_manual_entry(p_trial,p_setup_revision,p_channel,p_input)$$;
revoke all on function caro_private.entry_text(jsonb,text,text,integer),caro_private.entry_dog(jsonb,text,text,date),caro_private.manual_entry_configuration(uuid),caro_private.record_manual_entry(uuid,integer,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function caro_private.manual_entry_configuration(uuid),caro_private.record_manual_entry(uuid,integer,text,jsonb) to authenticated;
revoke all on function public.caro_manual_entry_configuration(uuid),public.caro_record_manual_entry(uuid,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.caro_manual_entry_configuration(uuid),public.caro_record_manual_entry(uuid,integer,text,jsonb) to authenticated;
create or replace function caro_private.guard_publication() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.caro_trials where id=new.trial_id for update;
 if new.is_live and exists(select 1 from public.caro_premium_versions where id=new.premium_id and snapshot->>'kind'='private_review_copy') then raise exception 'Private review copies cannot be published';end if;
 if new.is_live and exists(select 1 from public.caro_premium_versions where id=new.premium_id and snapshot->>'kind'='manual_entry_edition') then raise exception 'Manual intake snapshots cannot be published';end if;
 if new.is_live and not exists(select 1 from public.caro_trials where id=new.trial_id and club_id=new.club_id and application_state='finalized' and sanction_status='approved') then raise exception 'CARO approval is required before publication';end if;
 return new;
end;$$;
revoke all on function caro_private.guard_publication() from public,anon,authenticated;
commit;
