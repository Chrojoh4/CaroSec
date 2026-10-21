-- Optional staff lookup allowance. Stores counts, not queried dog IDs or result history.
begin;
create table caro_private.lookup_allowance(user_id uuid not null references auth.users(id),bucket timestamptz not null,requests integer not null check(requests between 1 and 20),primary key(user_id,bucket));
alter table caro_private.lookup_allowance enable row level security;
revoke all on caro_private.lookup_allowance from public,anon,authenticated,service_role;
create function caro_private.claim_lookup(p_trial uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare club uuid;caller uuid:=auth.uid();window_start timestamptz:=date_trunc('minute',now() at time zone 'UTC') at time zone 'UTC';admitted integer;
begin
 select club_id into club from public.caro_trials where id=p_trial;
 if caller is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or club is null or not(caro_private.is_administrator() or caro_private.can_read_trial(club,p_trial)) then raise exception 'Trial access required' using errcode='42501';end if;
 delete from caro_private.lookup_allowance where bucket<now()-interval '1 day';
 insert into caro_private.lookup_allowance(user_id,bucket,requests) values(caller,window_start,1)
 on conflict(user_id,bucket) do update set requests=caro_private.lookup_allowance.requests+1 where caro_private.lookup_allowance.requests<20 returning requests into admitted;
 return admitted is not null;
end;$$;
create function public.caro_claim_lookup(p_trial uuid) returns boolean language sql security invoker set search_path='' as $$select caro_private.claim_lookup(p_trial)$$;
revoke all on function caro_private.claim_lookup(uuid) from public,anon,authenticated,service_role;
grant execute on function caro_private.claim_lookup(uuid) to authenticated;
revoke all on function public.caro_claim_lookup(uuid) from public,anon,authenticated;
grant execute on function public.caro_claim_lookup(uuid) to authenticated;
commit;
