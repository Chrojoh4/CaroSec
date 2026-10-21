-- Explicit private practice mode. It can never become a real trial or listing.
begin;
create function caro_private.guard_practice_mode() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and old.is_practice and not new.is_practice then raise exception 'Practice mode cannot be removed';end if;
 if new.is_practice and new.sanction_status<>'not_submitted' then raise exception 'Practice trials cannot record real sanction decisions';end if;
 if tg_op='UPDATE' and new.is_practice and not old.is_practice then
  if old.application_state<>'draft' or exists(select 1 from public.caro_entries where trial_id=old.id) or exists(select 1 from public.caro_public_trials where trial_id=old.id) then raise exception 'Choose practice mode before finalizing or receiving entries';end if;
 end if;
 return new;
end;$$;
create trigger caro_practice_mode before insert or update on public.caro_trials for each row execute function caro_private.guard_practice_mode();
revoke all on function caro_private.guard_practice_mode() from public,anon,authenticated,service_role;

create function caro_private.save_practice_trial_draft(p_id uuid,p_club uuid,p_revision integer,p_title text,p_start date,p_end date,p_timezone text,p_planning jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;trial public.caro_trials;
begin
 -- The existing writer performs membership checks and serializes creation retries.
 result:=caro_private.write_trial_draft(p_id,p_club,p_revision,p_title,p_start,p_end,p_timezone,p_planning);
 select * into trial from public.caro_trials where id=p_id for update;
 if not trial.is_practice then
  update public.caro_trials set is_practice=true,revision=revision+1,updated_at=now() where id=p_id returning * into trial;
  insert into public.caro_audit(club_id,trial_id,actor_id,action,reference,details) values(p_club,p_id,auth.uid(),'trial.practice_marked',p_id::text,jsonb_build_object('revision',trial.revision));
 end if;
 return jsonb_build_object('id',p_id,'revision',trial.revision,'is_practice',true);
end;$$;
create function public.caro_save_practice_trial_draft(p_id uuid,p_club uuid,p_revision integer,p_title text,p_start date,p_end date,p_timezone text,p_planning jsonb) returns jsonb
language sql security invoker set search_path='' as $$select caro_private.save_practice_trial_draft(p_id,p_club,p_revision,p_title,p_start,p_end,p_timezone,p_planning)$$;
revoke all on function caro_private.save_practice_trial_draft(uuid,uuid,integer,text,date,date,text,jsonb),public.caro_save_practice_trial_draft(uuid,uuid,integer,text,date,date,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function caro_private.save_practice_trial_draft(uuid,uuid,integer,text,date,date,text,jsonb),public.caro_save_practice_trial_draft(uuid,uuid,integer,text,date,date,text,jsonb) to authenticated;
commit;
