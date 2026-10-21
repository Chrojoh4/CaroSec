-- Audited manual bookkeeping; no payment gateway or automatic money movement.
begin;
alter table public.caro_ledger add column request_key uuid;
alter table public.caro_ledger add column received_at timestamptz;
create unique index caro_ledger_request on public.caro_ledger(entry_id,request_key) where request_key is not null;
create function caro_private.record_finance(p_entry uuid,p_revision integer,p_request uuid,p_kind text,p_cents integer,p_method text,p_note text,p_received timestamptz)
returns public.caro_ledger language plpgsql security definer set search_path='' as $$
declare entry public.caro_entries; result public.caro_ledger; remaining bigint;
begin
  select * into entry from public.caro_entries where id=p_entry;
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or entry.id is null
    or not (caro_private.is_administrator() or caro_private.can_read_trial(entry.club_id,entry.trial_id)) then
    raise exception 'Trial access required' using errcode='42501';
  end if;
  perform 1 from public.caro_trials where id=entry.trial_id for update;
  select * into entry from public.caro_entries where id=p_entry for update;
  if p_request is null or p_kind is null or p_kind not in ('payment','refund','waiver') or p_cents is null or p_cents<=0
    or p_method is null or length(btrim(p_method)) not between 1 and 60
    or p_note is null or length(btrim(p_note)) not between 1 and 500
    or p_received>now() or (p_received is not null and not isfinite(p_received)) then raise exception 'Invalid manual financial record'; end if;
  select * into result from public.caro_ledger where entry_id=p_entry and request_key=p_request;
  if result.id is not null then
    if result.kind<>p_kind or result.cents<>p_cents or result.method<>btrim(p_method) or result.note<>btrim(p_note)
      or result.received_at is distinct from p_received then raise exception 'Request key was already used with different details'; end if;
    return result;
  end if;
  if p_revision is null or entry.revision<>p_revision then raise exception 'Entry changed. Refresh before recording money.' using errcode='40001'; end if;
  if p_kind='refund' then
    select coalesce(sum(case kind when 'payment' then cents when 'refund' then -cents else 0 end),0)
      into remaining from public.caro_ledger where entry_id=p_entry;
    if p_cents>remaining then raise exception 'Refund exceeds net recorded payments'; end if;
  elsif p_kind='waiver' then
    select coalesce(sum(case kind when 'charge' then cents when 'waiver' then -cents else 0 end),0)
      into remaining from public.caro_ledger where entry_id=p_entry;
    if p_cents>remaining then raise exception 'Waiver exceeds remaining recorded charges'; end if;
  end if;
  insert into public.caro_ledger(club_id,trial_id,entry_id,kind,cents,note,method,actor_id,request_key,received_at)
    values(entry.club_id,entry.trial_id,p_entry,p_kind,p_cents,btrim(p_note),btrim(p_method),auth.uid(),p_request,p_received) returning * into result;
  update public.caro_entries set revision=revision+1,updated_at=now() where id=p_entry;
  insert into public.caro_audit(club_id,trial_id,actor_id,action,reference,details)
    values(entry.club_id,entry.trial_id,auth.uid(),'finance.'||p_kind,result.id::text,
      jsonb_build_object('entryId',p_entry,'amountCents',p_cents,'receivedAt',p_received,'requestKey',p_request));
  return result;
end;
$$;
revoke all on function caro_private.record_finance(uuid,integer,uuid,text,integer,text,text,timestamptz) from public,anon,authenticated,service_role;
grant execute on function caro_private.record_finance(uuid,integer,uuid,text,integer,text,text,timestamptz) to authenticated;
create function public.caro_record_finance(p_entry uuid,p_revision integer,p_request uuid,p_kind text,p_cents integer,p_method text,p_note text,p_received timestamptz default null)
returns public.caro_ledger language sql security invoker set search_path='' as $$
  select caro_private.record_finance(p_entry,p_revision,p_request,p_kind,p_cents,p_method,p_note,p_received);
$$;
revoke all on function public.caro_record_finance(uuid,integer,uuid,text,integer,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.caro_record_finance(uuid,integer,uuid,text,integer,text,text,timestamptz) to authenticated;
create function caro_private.entry_finance_summary(p_entry uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare entry public.caro_entries; charges bigint; payments bigint; refunds bigint; waivers bigint;
begin
  select * into entry from public.caro_entries where id=p_entry;
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or entry.id is null
    or not (caro_private.is_administrator() or caro_private.can_read_trial(entry.club_id,entry.trial_id)) then
    raise exception 'Trial access required' using errcode='42501';
  end if;
  select coalesce(sum(cents) filter(where kind='charge'),0),coalesce(sum(cents) filter(where kind='payment'),0),
    coalesce(sum(cents) filter(where kind='refund'),0),coalesce(sum(cents) filter(where kind='waiver'),0)
    into charges,payments,refunds,waivers from public.caro_ledger where entry_id=p_entry;
  return jsonb_build_object('entryId',entry.id,'revision',entry.revision,'charges',charges,'payments',payments,'refunds',refunds,'waivers',waivers,
    'balance',charges+refunds-payments-waivers);
end;
$$;
revoke all on function caro_private.entry_finance_summary(uuid) from public,anon,authenticated,service_role;
grant execute on function caro_private.entry_finance_summary(uuid) to authenticated;
create function public.caro_entry_finance_summary(p_entry uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select caro_private.entry_finance_summary(p_entry)$$;
revoke all on function public.caro_entry_finance_summary(uuid) from public,anon,authenticated;
grant execute on function public.caro_entry_finance_summary(uuid) to authenticated;
commit;
