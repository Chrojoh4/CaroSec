-- Editable system access for Supabase Table Editor and the CARO administrator screen.
-- Club roles remain per club in caro_memberships. No existing account is promoted.
begin;
create table public.caro_users (
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text,
 system_role text not null default 'staff' check(system_role in ('staff','administrator')),
 access_reason text not null default 'Supabase Table Editor access change' check(length(btrim(access_reason)) between 5 and 1000),
 updated_at timestamptz not null default now()
);
alter table public.caro_users enable row level security;
revoke all on public.caro_users from public,anon,authenticated,service_role;
grant select on public.caro_users to authenticated;
create policy administrator_users_read on public.caro_users for select to authenticated using((select caro_private.is_administrator()));
insert into public.caro_users(user_id,email,system_role,access_reason)
 select u.id,u.email,case when exists(select 1 from caro_private.system_administrators a where a.user_id=u.id and a.active) then 'administrator' else 'staff' end,'Supabase Table Editor access change' from auth.users u;

create function caro_private.sync_user_account() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.caro_users(user_id,email) values(new.id,new.email)
 on conflict(user_id) do update set email=excluded.email,updated_at=now();
 return new;
end;$$;
revoke all on function caro_private.sync_user_account() from public,anon,authenticated;
create trigger caro_user_account after insert or update of email on auth.users for each row execute function caro_private.sync_user_account();

-- AFTER keeps the mirror available while legacy administrator triggers synchronize it.
create function caro_private.apply_user_access_after() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' or new.system_role is distinct from old.system_role then
  perform pg_catalog.pg_advisory_xact_lock(774213008);
  if new.system_role='administrator' then
   if not exists(select 1 from caro_private.system_administrators where user_id=new.user_id and active) then
    insert into caro_private.system_administrators(user_id,active,granted_by,reason) values(new.user_id,true,auth.uid(),new.access_reason)
    on conflict(user_id) do update set active=true,granted_by=excluded.granted_by,reason=excluded.reason,granted_at=now(),revoked_at=null;
   end if;
  else
   update caro_private.system_administrators set active=false,revoked_at=now(),reason=new.access_reason where user_id=new.user_id and active;
  end if;
 end if;
 return new;
end;$$;
revoke all on function caro_private.apply_user_access_after() from public,anon,authenticated;
create function caro_private.validate_user_access() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then
  if exists(select 1 from auth.users where id=old.user_id) then raise exception 'Manage the account in Authentication; do not delete its access row'; end if;
  return old;
 end if;
 if tg_op='UPDATE' and new.user_id<>old.user_id then raise exception 'Account identity cannot be changed'; end if;
 if new.email is distinct from (select u.email::text from auth.users u where u.id=new.user_id) then raise exception 'Change account email through Authentication'; end if;
 new.updated_at:=now();return new;
end;$$;
revoke all on function caro_private.validate_user_access() from public,anon,authenticated;
create trigger validate_caro_user before insert or update or delete on public.caro_users for each row execute function caro_private.validate_user_access();
create trigger apply_caro_user after insert or update on public.caro_users for each row execute function caro_private.apply_user_access_after();
create function caro_private.sync_administrator_user() returns trigger
language plpgsql security definer set search_path='' as $$
declare account uuid;enabled boolean;
begin
 account:=case when tg_op='DELETE' then old.user_id else new.user_id end;
 enabled:=case when tg_op='DELETE' then false else new.active end;
 update public.caro_users set system_role=case when enabled then 'administrator' else 'staff' end
 where user_id=account and system_role is distinct from case when enabled then 'administrator' else 'staff' end;
 return coalesce(new,old);
end;$$;
revoke all on function caro_private.sync_administrator_user() from public,anon,authenticated;
create trigger sync_administrator_user after insert or update or delete on caro_private.system_administrators for each row execute function caro_private.sync_administrator_user();

create function caro_private.administrator_system_access(p_user uuid,p_expected text,p_role text,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare previous text;
begin
 perform pg_catalog.pg_advisory_xact_lock(774213008);
 if not caro_private.is_administrator() then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_role is null or p_role not in ('staff','administrator') or p_reason is null or length(btrim(p_reason)) not between 5 and 1000 then raise exception 'Choose system access and provide a reason';end if;
 select system_role into previous from public.caro_users where user_id=p_user for update;
 if not found then raise exception 'Account not found';end if;
 if p_expected is distinct from previous then raise exception 'Access changed; reload before saving' using errcode='40001';end if;
 update public.caro_users set system_role=p_role,access_reason=btrim(p_reason) where user_id=p_user;
end;$$;
revoke all on function caro_private.administrator_system_access(uuid,text,text,text) from public,anon,authenticated;
grant execute on function caro_private.administrator_system_access(uuid,text,text,text) to authenticated;
create function public.caro_administrator_system_access(p_user uuid,p_expected text,p_role text,p_reason text) returns void
language sql security invoker set search_path='' as $$select caro_private.administrator_system_access(p_user,p_expected,p_role,p_reason);$$;
revoke all on function public.caro_administrator_system_access(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.caro_administrator_system_access(uuid,text,text,text) to authenticated;
-- Keep owner protection when memberships are edited directly in Table Editor too.
create function caro_private.guard_club_owner_access() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(774213008);
 if old.role='owner' and old.active and (tg_op='DELETE' or new.role<>'owner' or not new.active) and not exists(
  select 1 from public.caro_memberships where club_id=old.club_id and user_id<>old.user_id and role='owner' and active
 ) then raise exception 'Keep at least one active club owner';end if;
 if tg_op='DELETE' then return old;end if;
 if new.club_id<>old.club_id or new.user_id<>old.user_id then raise exception 'Membership identity cannot be changed; create a separate membership';end if;
 return new;
end;$$;
revoke all on function caro_private.guard_club_owner_access() from public,anon,authenticated;
create trigger keep_club_owner before update or delete on public.caro_memberships for each row execute function caro_private.guard_club_owner_access();
commit;
