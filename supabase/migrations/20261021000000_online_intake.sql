-- Server-only intake boundary. Browser roles cannot invoke commit or receipts.
-- Publication still blocks online_enabled=true until hosted verification.
begin;
create table caro_private.online_allowance(bucket text primary key,window_start timestamptz not null,used integer not null check(used>0));
alter table caro_private.online_allowance enable row level security;
revoke all on caro_private.online_allowance from public,anon,authenticated,service_role;
create function public.caro_claim_online_request(p_bucket text,p_limit integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare count_used integer;window_now timestamptz:=date_trunc('minute',now());
begin
 if p_bucket is null or p_bucket!~'^[a-f0-9]{64}$' or p_limit not in (10,30) then raise exception 'Invalid request allowance';end if;
 delete from caro_private.online_allowance where window_start<now()-interval '1 day';
 insert into caro_private.online_allowance(bucket,window_start,used) values(p_bucket,window_now,1)
 on conflict(bucket) do update set window_start=window_now,used=case when online_allowance.window_start=window_now then least(online_allowance.used+1,1000) else 1 end returning used into count_used;
 return count_used<=p_limit;
end;$$;

create function public.caro_online_receipt(p_receipt_hash text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare entry public.caro_entries;trial public.caro_trials;edition public.caro_premium_versions;
begin
 if p_receipt_hash is null or p_receipt_hash!~'^[a-f0-9]{64}$' then return null;end if;
 select * into entry from public.caro_entries where receipt_token_hash=p_receipt_hash and intake_channel='online';
 if entry.id is null then return null;end if;select * into trial from public.caro_trials where id=entry.trial_id;select * into edition from public.caro_premium_versions where id=entry.premium_id;
 return jsonb_build_object('entryId',entry.id,'trialTitle',trial.title,'timezone',trial.timezone,'status',entry.status,'quoteCents',entry.amount_cents,'agreementVersion',entry.agreement_version,
 'receivedAt',to_char(entry.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'dogName',entry.details->'dog'->>'name','agreement',jsonb_build_object('waiver',edition.snapshot->'configuration'->'waiver','payment',edition.snapshot->'configuration'->'payment','refunds',edition.snapshot->'content'->'refunds','confirmations',edition.snapshot->'configuration'->'confirmations'),
 'runs',(select jsonb_agg(jsonb_build_object('round',event.official_round,'date',event.local_date,'format',event.format,'level',event.level,'status',coalesce(line->>'status',entry.status),'feo',line->'feo','amountCents',line->'amountCents') order by event.official_round) from jsonb_array_elements(entry.details->'selections') line join public.caro_events event on event.id=(line->>'eventId')::uuid and event.trial_id=entry.trial_id));
end;$$;
create function public.caro_online_entry_replay(p_slug text,p_request text,p_hash text,p_receipt_hash text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare entry public.caro_entries;
begin
 select e.* into entry from public.caro_entries e join public.caro_public_trials l on l.trial_id=e.trial_id where l.slug=p_slug and e.idempotency_key=p_request and e.intake_channel='online';
 if entry.id is null then return null;end if;
 if entry.request_hash is distinct from p_hash or entry.receipt_token_hash is distinct from p_receipt_hash then raise exception 'Submission reference already used with different information';end if;
 return public.caro_online_receipt(p_receipt_hash);
end;$$;
create function public.caro_commit_online_entry(p_slug text,p_premium uuid,p_request text,p_hash text,p_receipt_hash text,p_details jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare listing public.caro_public_trials;trial public.caro_trials;edition public.caro_premium_versions;config jsonb;validated jsonb;details jsonb;entry_id uuid;replay jsonb;today date;
begin
 if p_request is null or length(p_request) not between 1 and 100 or p_hash is null or p_hash!~'^[a-f0-9]{64}$' or p_receipt_hash is null or p_receipt_hash!~'^[a-f0-9]{64}$' or jsonb_typeof(p_details) is distinct from 'object' or octet_length(p_details::text)>200000 then raise exception 'Invalid online entry';end if;
 select t.* into trial from public.caro_trials t join public.caro_public_trials l on l.trial_id=t.id where l.slug=p_slug for update of t;
 if trial.id is null then raise exception 'Online entry is unavailable';end if;
 replay:=public.caro_online_entry_replay(p_slug,p_request,p_hash,p_receipt_hash);if replay is not null then return replay;end if;
 select * into listing from public.caro_public_trials where slug=p_slug;
 if trial.is_practice or trial.application_state<>'finalized' or trial.sanction_status<>'approved' or not listing.is_live or not listing.online_enabled then raise exception 'Online entry is unavailable';end if;
 if listing.premium_id is distinct from p_premium then raise exception 'The reviewed premium changed. Reload before submitting.' using errcode='40001';end if;
 select * into edition from public.caro_premium_versions where id=p_premium and snapshot->>'kind'='public_entry_edition' and snapshot->'publication_ready'='true'::jsonb;
 if edition.id is null then raise exception 'Online entry is unavailable';end if;
 today:=(now() at time zone trial.timezone)::date;
 if today<listing.opens_on or today>listing.closes_on then raise exception 'The online entry window is closed. Contact the secretary.';end if;
 config:=edition.snapshot->'configuration';validated:=caro_private.validate_entry_details(trial.id,config,p_details);
 if p_details ? 'accommodation' and (jsonb_typeof(p_details->'accommodation') is distinct from 'string' or length(p_details->>'accommodation')>2000) then raise exception 'Check accommodation request';end if;
 details:=(validated-'amountCents')||jsonb_build_object('accommodation',coalesce(p_details->>'accommodation',''),'receivedAt',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'intakeEvidence','','originalSignatureTime',null);
 insert into public.caro_entries(club_id,trial_id,premium_id,idempotency_key,request_hash,receipt_token_hash,intake_channel,details,amount_cents,agreement_version,agreement_accepted_at)
 values(trial.club_id,trial.id,p_premium,p_request,p_hash,p_receipt_hash,'online',details,(validated->>'amountCents')::integer,config->>'premiumVersion',now()) returning id into entry_id;
 insert into public.caro_audit(club_id,trial_id,actor_id,action,reference,details) values(trial.club_id,trial.id,null,'entry.received',entry_id::text,jsonb_build_object('channel','online','actor','Online entrant (self-declared)','quoteCents',validated->'amountCents','premiumId',p_premium));
 return public.caro_online_receipt(p_receipt_hash);
end;$$;
revoke all on function public.caro_claim_online_request(text,integer),public.caro_online_receipt(text),public.caro_online_entry_replay(text,text,text,text),public.caro_commit_online_entry(text,uuid,text,text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.caro_claim_online_request(text,integer),public.caro_online_receipt(text),public.caro_online_entry_replay(text,text,text,text),public.caro_commit_online_entry(text,uuid,text,text,text,jsonb) to service_role;
commit;
