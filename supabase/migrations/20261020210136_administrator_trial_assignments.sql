begin;
create function caro_private.administrator_trial_assignment(p_trial uuid,p_user uuid,p_assigned boolean,p_reason text) returns boolean
language plpgsql security definer set search_path='' as $$
declare trial public.caro_trials;caller uuid:=auth.uid();member public.caro_memberships;changed integer;
begin
 perform pg_catalog.pg_advisory_xact_lock(774213008);
 if not caro_private.is_administrator() then raise exception 'Administrator access required' using errcode='42501';end if;
 if p_assigned is null or p_reason is null or length(btrim(p_reason)) not between 5 and 1000 then raise exception 'Provide assignment status and a reason';end if;
 select * into trial from public.caro_trials where id=p_trial for update;
 if not found then raise exception 'Trial not found';end if;
 select * into member from public.caro_memberships where club_id=trial.club_id and user_id=p_user for share;
 if p_assigned and (member.user_id is null or not member.active or member.role not in ('owner','secretary','scorer')) then raise exception 'Staff member needs an active membership in the trial club';end if;
 if p_assigned then
  insert into public.caro_trial_assignments(club_id,trial_id,user_id) values(trial.club_id,p_trial,p_user) on conflict(trial_id,user_id) do nothing;
 else
  delete from public.caro_trial_assignments where trial_id=p_trial and user_id=p_user;
 end if;
 get diagnostics changed=row_count;
 if changed=0 then return false;end if;
 insert into caro_private.administration_audit(actor_id,action,target_user,club_id,reason,details) values(caller,case when p_assigned then 'trial.assignment_granted' else 'trial.assignment_revoked' end,p_user,trial.club_id,btrim(p_reason),jsonb_build_object('trial_id',p_trial));
 return true;
end;$$;
revoke all on function caro_private.administrator_trial_assignment(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function caro_private.administrator_trial_assignment(uuid,uuid,boolean,text) to authenticated;
create function public.caro_administrator_trial_assignment(p_trial uuid,p_user uuid,p_assigned boolean,p_reason text) returns boolean
language sql security invoker set search_path='' as $$select caro_private.administrator_trial_assignment(p_trial,p_user,p_assigned,p_reason);$$;
revoke all on function public.caro_administrator_trial_assignment(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.caro_administrator_trial_assignment(uuid,uuid,boolean,text) to authenticated;
commit;
