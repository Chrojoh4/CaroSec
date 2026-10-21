-- Staff per-run decisions. Trial/event/entry locks serialize capacity and sign-off.
begin;
alter table public.caro_ledger add column event_id uuid;
alter table public.caro_ledger add foreign key(club_id,trial_id,event_id) references public.caro_events(club_id,trial_id,id);
create unique index caro_single_run_charge on public.caro_ledger(entry_id,event_id) where kind='charge' and event_id is not null;
create table caro_private.trial_command_receipts(
 trial_id uuid not null references public.caro_trials(id),request_key uuid not null,actor_id uuid not null references auth.users(id),
 payload jsonb not null,result jsonb not null,recorded_at timestamptz not null default now(),primary key(trial_id,request_key)
);
alter table caro_private.trial_command_receipts enable row level security;
revoke all on caro_private.trial_command_receipts from public,anon,authenticated,service_role;
create trigger caro_run_receipt_immutable before update or delete on caro_private.trial_command_receipts for each row execute function caro_private.reject_rewrite();
create function caro_private.change_run_status(p_entry uuid,p_event uuid,p_revision integer,p_request uuid,p_status text,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare entry public.caro_entries;club uuid;trial uuid;line jsonb;lines jsonb;event jsonb;prior text;position integer;capacity integer;accepted integer;
 payload jsonb;receipt caro_private.trial_command_receipts;result jsonb;aggregate text;charge integer:=0;action_name text;stamp text;
begin
 select club_id,trial_id into club,trial from public.caro_entries where id=p_entry;
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or trial is null
  or not(caro_private.is_administrator() or caro_private.can_read_trial(club,trial)) then raise exception 'Trial access required' using errcode='42501';end if;
 perform 1 from public.caro_trials where id=trial for update;
 perform 1 from public.caro_events where id=p_event and trial_id=trial for update;
 select * into entry from public.caro_entries where id=p_entry for update;
 if p_request is null or p_status is null or p_status not in ('accepted','waitlisted','checked_in','rejected','withdrawn') or p_reason is null or length(p_reason)>1000 then raise exception 'Invalid run decision';end if;
 payload:=jsonb_build_object('command','run_status','entry',p_entry,'event',p_event,'revision',p_revision,'status',p_status,'reason',btrim(p_reason));
 select * into receipt from caro_private.trial_command_receipts where trial_id=trial and request_key=p_request;
 if receipt.request_key is not null then
  if receipt.actor_id<>auth.uid() or receipt.payload is distinct from payload then raise exception 'Request reference was already used for a different decision';end if;return receipt.result;
 end if;
 if p_revision is null or p_revision<>entry.revision then raise exception 'Entry changed. Refresh before deciding a run.' using errcode='40001';end if;
 if jsonb_typeof(entry.details->'selections') is distinct from 'array' then raise exception 'Legacy entry needs review before run decisions';end if;
 select value,(ordinality-1)::integer into line,position from jsonb_array_elements(entry.details->'selections') with ordinality where value->>'eventId'=p_event::text;
 if line is null then raise exception 'Run not found in this entry';end if;
 if exists(select 1 from public.caro_completed_events where event_id=p_event) or exists(select 1 from public.caro_scores where entry_id=p_entry and event_id=p_event) then raise exception 'This run has a result or completed Trial Record';end if;
 prior:=coalesce(line->>'status',entry.status);
 if not ((prior='submitted' and p_status in ('accepted','waitlisted','rejected','withdrawn')) or (prior='waitlisted' and p_status in ('accepted','rejected','withdrawn'))
   or (prior='accepted' and p_status in ('checked_in','withdrawn')) or (prior='checked_in' and p_status='withdrawn')) then raise exception 'That run status change is not available';end if;
 if p_status in ('rejected','withdrawn') and length(btrim(p_reason))=0 then raise exception 'Record a reason for rejection or withdrawal';end if;
 select offered into event from public.caro_premium_versions edition cross join lateral jsonb_array_elements(coalesce(edition.snapshot->'configuration'->'events','[]'::jsonb)) offered
   where edition.id=entry.premium_id and offered->>'id'=p_event::text;
 if event is null then raise exception 'Entry source pricing needs review';end if;
 if p_status='accepted' then
  if not exists(select 1 from public.caro_trials where id=trial and application_state='finalized' and (is_practice or sanction_status='approved')) then raise exception 'CARO approval is required before accepting a run';end if;
  capacity:=(event->>'capacity')::integer;
  if capacity is null or capacity not between 1 and 1000 then raise exception 'Review the saved event capacity';end if;
  select count(*) into accepted from public.caro_entries other cross join lateral jsonb_array_elements(case when jsonb_typeof(other.details->'selections')='array' then other.details->'selections' else '[]'::jsonb end) selection
   where other.trial_id=trial and selection->>'eventId'=p_event::text and coalesce(selection->>'status',other.status) in ('accepted','checked_in');
  if accepted>=capacity then raise exception 'This event is full. Keep the run waitlisted.';end if;
  if exists(select 1 from public.caro_ledger where entry_id=p_entry and kind='charge' and event_id is null) then raise exception 'Review legacy entry-wide charges before accepting a run';end if;
  if not coalesce((line->>'chargePosted')::boolean,false) then
   charge:=(line->>'amountCents')::integer;
   if charge is null or charge<0 then raise exception 'Review the saved run fee';end if;
   if charge>0 then insert into public.caro_ledger(club_id,trial_id,entry_id,event_id,kind,cents,note,actor_id,request_key)
    values(club,trial,p_entry,p_event,'charge',charge,'Accepted run fee snapshot',auth.uid(),p_request);end if;
   line:=line||jsonb_build_object('chargePosted',true);
  end if;
 end if;
 stamp:=to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 line:=line||jsonb_build_object('status',p_status,'statusChangedAt',stamp,'statusReason',btrim(p_reason));
 if p_status='waitlisted' then line:=line||jsonb_build_object('waitlistedAt',stamp);end if;
 if p_status='withdrawn' then line:=line||jsonb_build_object('withdrawnAt',stamp,'withdrawalReason',btrim(p_reason));end if;
 select jsonb_agg(value||jsonb_build_object('status',coalesce(value->>'status',entry.status)) order by ordinality) into lines from jsonb_array_elements(entry.details->'selections') with ordinality;
 lines:=jsonb_set(lines,array[position::text],line);
 select case when bool_and(value->>'status'='checked_in') then 'checked_in'
  when bool_or(value->>'status' in ('accepted','checked_in')) then 'accepted' when bool_or(value->>'status'='submitted') then 'submitted'
  when bool_or(value->>'status'='waitlisted') then 'waitlisted' when bool_and(value->>'status'='rejected') then 'rejected' else 'withdrawn' end into aggregate from jsonb_array_elements(lines);
 update public.caro_entries set details=jsonb_set(details,'{selections}',lines),status=aggregate,revision=revision+1,updated_at=now() where id=p_entry;
 action_name:=case when prior='waitlisted' and p_status='accepted' then 'run.waitlist_promoted' else 'run.'||p_status end;
 insert into public.caro_audit(club_id,trial_id,actor_id,action,reference,details) values(club,trial,auth.uid(),action_name,p_entry::text,
  jsonb_build_object('entryId',p_entry,'eventId',p_event,'previous',prior,'status',p_status,'reason',btrim(p_reason),'chargedCents',charge,'revision',entry.revision+1));
 result:=jsonb_build_object('entryId',p_entry,'eventId',p_event,'status',p_status,'entryStatus',aggregate,'revision',entry.revision+1,'chargedCents',charge);
 insert into caro_private.trial_command_receipts(trial_id,request_key,actor_id,payload,result) values(trial,p_request,auth.uid(),payload,result);
 return result;
end;$$;
create function public.caro_change_run_status(p_entry uuid,p_event uuid,p_revision integer,p_request uuid,p_status text,p_reason text default '') returns jsonb
language sql security invoker set search_path='' as $$select caro_private.change_run_status(p_entry,p_event,p_revision,p_request,p_status,p_reason)$$;
revoke all on function caro_private.change_run_status(uuid,uuid,integer,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function caro_private.change_run_status(uuid,uuid,integer,uuid,text,text) to authenticated;
revoke all on function public.caro_change_run_status(uuid,uuid,integer,uuid,text,text) from public,anon,authenticated;
grant execute on function public.caro_change_run_status(uuid,uuid,integer,uuid,text,text) to authenticated;
create function caro_private.entry_review(p_entry uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare entry public.caro_entries;events jsonb;scored jsonb;completed jsonb;
begin
 select * into entry from public.caro_entries where id=p_entry;
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or entry.id is null
  or not(caro_private.is_administrator() or caro_private.can_read_trial(entry.club_id,entry.trial_id)) then raise exception 'Trial access required' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'round',official_round,'date',local_date,'format',format,'level',level,'judge',judge_name) order by official_round),'[]'::jsonb)
  into events from public.caro_events where trial_id=entry.trial_id;
 select coalesce(jsonb_agg(distinct event_id),'[]'::jsonb) into scored from public.caro_scores where entry_id=p_entry;
 select coalesce(jsonb_agg(event_id),'[]'::jsonb) into completed from public.caro_completed_events where trial_id=entry.trial_id;
 return jsonb_build_object('entry',jsonb_build_object('id',entry.id,'trial_id',entry.trial_id,'status',entry.status,'revision',entry.revision,'details',entry.details,'amount_cents',entry.amount_cents,
  'intake_channel',entry.intake_channel,'created_at',to_char(entry.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),'events',events,'scoredEvents',scored,'completedEvents',completed,
  'entryEvents',coalesce((select snapshot->'configuration'->'events' from public.caro_premium_versions where id=entry.premium_id),'[]'::jsonb));
end;$$;
create function public.caro_entry_review(p_entry uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select caro_private.entry_review(p_entry)$$;
revoke all on function caro_private.entry_review(uuid) from public,anon,authenticated,service_role;
grant execute on function caro_private.entry_review(uuid) to authenticated;
revoke all on function public.caro_entry_review(uuid) from public,anon,authenticated;
grant execute on function public.caro_entry_review(uuid) to authenticated;
commit;
