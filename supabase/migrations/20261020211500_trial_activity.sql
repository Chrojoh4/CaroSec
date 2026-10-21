-- Private staff journal. Reads only; no entry/payment mutation or public access.
begin;
create index caro_audit_journal_page on public.caro_audit(trial_id,occurred_at desc,id desc);
create index caro_ledger_journal_page on public.caro_ledger(trial_id,occurred_at desc,id desc);
create index caro_entries_journal_page on public.caro_entries(trial_id,created_at desc,id desc);
create function caro_private.filtered_trial_activity(p_trial uuid,p_before timestamptz,p_key text,p_limit integer,p_query text,p_group text,p_from date,p_to date)
returns table(record_key text,recorded_at timestamptz,action text,reference text,actor_id uuid,summary jsonb)
language plpgsql stable security definer set search_path='' as $$
declare club uuid;zone text;
begin
  select club_id,timezone into club,zone from public.caro_trials where id=p_trial;
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or club is null
     or not (caro_private.is_administrator() or caro_private.can_read_trial(club,p_trial)) then
    raise exception 'Trial access required' using errcode='42501';
  end if;
  if p_limit is null or p_limit<1 or p_limit>100 or (p_before is null)<>(p_key is null) then
    raise exception 'Invalid journal page';
  end if;
  if p_query is null or length(p_query)>200 or p_group is null or p_group not in ('all','receipts','payments','withdrawals','results','incidents','administration') or (p_from is not null and p_to is not null and p_to<p_from) then raise exception 'Invalid journal filters';end if;
  return query
  select items.k,items.at,items.act,items.ref,items.actor,items.info from (
    select 'audit:'||a.id::text k,a.occurred_at at,a.action act,a.reference ref,a.actor_id actor,
      jsonb_build_object('source','audit','details',a.details,'channel',a.details->'channel','receivedAt',a.details->'receivedAt') info
      from public.caro_audit a where a.trial_id=p_trial and a.club_id=club
    union all
    select 'entry:'||e.id::text,e.created_at,'entry.received',e.id::text,null::uuid,
      jsonb_build_object('source','entry','channel',e.intake_channel,'amountCents',e.amount_cents,'receivedAt',e.details->'receivedAt','dog',e.details->'dog'->>'name','handler',e.details->'contact'->>'name')
      from public.caro_entries e where e.trial_id=p_trial and e.club_id=club
    union all
    select 'ledger:'||l.id::text,l.occurred_at,'finance.'||l.kind,l.entry_id::text,l.actor_id,
      jsonb_build_object('source','ledger','amountCents',l.cents,'method',l.method,'note',l.note,'receivedAt',to_jsonb(l)->'received_at')
      from public.caro_ledger l where l.trial_id=p_trial and l.club_id=club
   ) items where (p_before is null or (items.at,items.k)<(p_before,p_key))
  and (p_from is null or (items.at at time zone zone)::date>=p_from) and (p_to is null or (items.at at time zone zone)::date<=p_to)
  and (p_query='' or strpos(lower(items.act||' '||items.ref||' '||items.info::text),lower(p_query))>0)
  and (p_group='all' or (p_group='receipts' and items.act in ('entry.received','entry.submitted'))
   or (p_group='payments' and items.act like 'finance.%') or (p_group='withdrawals' and items.act like '%withdraw%')
   or (p_group='results' and (items.act like 'score.%' or items.act like 'event.%'))
   or (p_group='incidents' and items.act like 'incident.%')
   or (p_group='administration' and (items.act like 'trial.%' or items.act like 'sanction.%' or items.act like 'premium.%' or items.act like 'assignment.%')))
  order by items.at desc,items.k desc limit p_limit;
end;
$$;
create function caro_private.trial_activity(p_trial uuid,p_before timestamptz,p_key text,p_limit integer)
returns table(record_key text,recorded_at timestamptz,action text,reference text,actor_id uuid,summary jsonb)
language sql stable security invoker set search_path='' as $$select * from caro_private.filtered_trial_activity(p_trial,p_before,p_key,p_limit,'','all',null,null)$$;
revoke all on function caro_private.filtered_trial_activity(uuid,timestamptz,text,integer,text,text,date,date) from public,anon,authenticated,service_role;
grant execute on function caro_private.filtered_trial_activity(uuid,timestamptz,text,integer,text,text,date,date) to authenticated;
create function public.caro_filtered_trial_activity(p_trial uuid,p_before timestamptz default null,p_key text default null,p_limit integer default 50,p_query text default '',p_group text default 'all',p_from date default null,p_to date default null)
returns table(record_key text,recorded_at timestamptz,action text,reference text,actor_id uuid,summary jsonb)
language sql stable security invoker set search_path='' as $$select * from caro_private.filtered_trial_activity(p_trial,p_before,p_key,p_limit,p_query,p_group,p_from,p_to)$$;
revoke all on function public.caro_filtered_trial_activity(uuid,timestamptz,text,integer,text,text,date,date) from public,anon,authenticated,service_role;
grant execute on function public.caro_filtered_trial_activity(uuid,timestamptz,text,integer,text,text,date,date) to authenticated;
revoke all on function caro_private.trial_activity(uuid,timestamptz,text,integer) from public,anon,authenticated,service_role;
grant execute on function caro_private.trial_activity(uuid,timestamptz,text,integer) to authenticated;
create function public.caro_trial_activity(p_trial uuid,p_before timestamptz default null,p_key text default null,p_limit integer default 50)
returns table(record_key text,recorded_at timestamptz,action text,reference text,actor_id uuid,summary jsonb)
language sql stable security invoker set search_path='' as $$select * from caro_private.trial_activity(p_trial,p_before,p_key,p_limit)$$;
revoke all on function public.caro_trial_activity(uuid,timestamptz,text,integer) from public,anon,authenticated;
grant execute on function public.caro_trial_activity(uuid,timestamptz,text,integer) to authenticated;
commit;
