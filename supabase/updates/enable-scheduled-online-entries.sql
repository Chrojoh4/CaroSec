-- CARO: enable both entry methods for published real trials.
-- Run once after the existing public premium / online intake migrations.
-- Does not alter entry prices, waiver snapshots, approval or RLS policies.
begin;
do $update$
declare definition text; previous_gate text:='if p_online is true then raise exception ''Online intake is not enabled in this release'';end if;';
begin
 definition:=pg_get_functiondef('caro_private.publish_premium(uuid,text,text,uuid,boolean,boolean)'::regprocedure);
 if position(previous_gate in definition)>0 then
  execute replace(definition,previous_gate,'p_online:=true; -- Both entry methods follow the saved trial window.');
 elsif position('p_online:=true;' in definition)=0 then
  raise exception 'Publication function differs from the expected version. Stop and review before enabling.';
 end if;
end $update$;
with enabled as (
 update public.caro_public_trials p set online_enabled=true
 from public.caro_trials t where t.id=p.trial_id and p.is_live and not p.online_enabled
 and not t.is_practice and t.application_state='finalized' and t.sanction_status='approved'
 returning p.club_id,p.trial_id
)
insert into public.caro_audit(club_id,trial_id,actor_id,action,reference,details)
select club_id,trial_id,auth.uid(),'publication.online_enabled',trial_id::text,
jsonb_build_object('reason','Both entry methods enabled; saved dates and server validation enforce intake window') from enabled;
commit;
