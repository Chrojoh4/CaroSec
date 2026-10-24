-- Read-only account directory. No accounts, memberships or trial records are changed.
begin;
create function caro_private.administrator_users() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not caro_private.is_administrator() then raise exception 'Administrator access required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'user_id',u.id,'email',u.email,'administrator',exists(select 1 from caro_private.system_administrators a where a.user_id=u.id and a.active),
  'memberships',coalesce((select jsonb_agg(jsonb_build_object('club_id',m.club_id,'club_name',c.name,'role',m.role,'active',m.active) order by c.name,m.club_id)
    from public.caro_memberships m join public.caro_clubs c on c.id=m.club_id where m.user_id=u.id),'[]'::jsonb),
  'assignments',coalesce((select jsonb_agg(jsonb_build_object('trial_id',t.id,'title',t.title,'club_name',c.name,'role',m.role,'active',m.active) order by t.start_date,t.id)
    from public.caro_trial_assignments ta join public.caro_trials t on t.id=ta.trial_id join public.caro_clubs c on c.id=ta.club_id
    join public.caro_memberships m on m.club_id=ta.club_id and m.user_id=ta.user_id where ta.user_id=u.id),'[]'::jsonb)
 ) order by u.email,u.id) from auth.users u),'[]'::jsonb);
end;$$;
revoke all on function caro_private.administrator_users() from public,anon,authenticated;
grant execute on function caro_private.administrator_users() to authenticated;
create function public.caro_administrator_users() returns jsonb
language sql security invoker set search_path='' as $$select caro_private.administrator_users();$$;
revoke all on function public.caro_administrator_users() from public,anon,authenticated;
grant execute on function public.caro_administrator_users() to authenticated;
commit;
