begin;
alter table public.caro_trials add column submitted_on date;
alter table public.caro_premium_versions add column request_key uuid unique;
create function caro_private.record_sanction(p_trial uuid,p_revision integer,p_status text,p_submitted date,p_number text,p_evidence text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare trial public.caro_trials;caller uuid:=auth.uid();
begin
 if caller is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in required' using errcode='42501';end if;
 select * into trial from public.caro_trials where id=p_trial for update;
 if not found or not(caro_private.is_administrator() or caro_private.can_read_trial(trial.club_id,p_trial)) then raise exception 'Trial access denied' using errcode='42501';end if;
 if trial.application_state<>'finalized' then raise exception 'Finalize the application first';end if;
 if p_revision is null or p_revision<>trial.revision then raise exception 'Trial changed; reopen before recording approval' using errcode='40001';end if;
 if trial.is_practice then raise exception 'Practice trials do not record real CARO sanction actions';end if;
 if p_status is null or not((trial.sanction_status in ('not_submitted','rejected') and p_status='submitted') or (trial.sanction_status='submitted' and p_status in ('approved','rejected'))) then raise exception 'Invalid CARO status transition';end if;
 if p_submitted is null or p_submitted>(now() at time zone trial.timezone)::date then raise exception 'Record the actual submission date';end if;
 if p_evidence is null or length(btrim(p_evidence)) not between 5 and 5000 then raise exception 'Provide the submission or CARO decision evidence';end if;
 if p_status='approved' and (p_number is null or length(btrim(p_number)) not between 1 and 100) then raise exception 'Record the assigned CARO trial number';end if;
 update public.caro_trials set sanction_status=p_status,submitted_on=p_submitted,trial_number=case when p_status='approved' then btrim(p_number) else trial_number end,approval_evidence=btrim(p_evidence),revision=revision+1,updated_at=now() where id=p_trial;
 insert into public.caro_audit(club_id,trial_id,actor_id,action,reference,details) values(trial.club_id,p_trial,caller,'sanction.'||p_status,p_trial::text,jsonb_build_object('previous',trial.sanction_status,'revision',trial.revision+1,'submitted_on',p_submitted,'trial_number',p_number,'evidence',btrim(p_evidence)));
 return jsonb_build_object('revision',trial.revision+1,'sanction_status',p_status);
end;$$;
revoke all on function caro_private.record_sanction(uuid,integer,text,date,text,text) from public,anon,authenticated;
grant execute on function caro_private.record_sanction(uuid,integer,text,date,text,text) to authenticated;
create function public.caro_record_sanction(p_trial uuid,p_revision integer,p_status text,p_submitted date,p_number text,p_evidence text) returns jsonb
language sql security invoker set search_path='' as $$select caro_private.record_sanction(p_trial,p_revision,p_status,p_submitted,p_number,p_evidence);$$;
revoke all on function public.caro_record_sanction(uuid,integer,text,date,text,text) from public,anon,authenticated;
grant execute on function public.caro_record_sanction(uuid,integer,text,date,text,text) to authenticated;
create function caro_private.save_premium_review_copy(p_trial uuid,p_trial_revision integer,p_draft_revision integer,p_agreement text,p_reason text,p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare trial public.caro_trials;draft public.caro_premium_drafts;existing public.caro_premium_versions;caller uuid:=auth.uid();edition uuid;version_number integer;payload jsonb;snapshot jsonb;
begin
 if caller is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in required' using errcode='42501';end if;
 select * into trial from public.caro_trials where id=p_trial for update;
 if not found or not(caro_private.is_administrator() or caro_private.can_read_trial(trial.club_id,p_trial)) then raise exception 'Trial access denied' using errcode='42501';end if;
 if p_agreement is null or length(btrim(p_agreement)) not between 1 and 200 or p_reason is null or length(btrim(p_reason)) not between 5 and 1000 or p_request is null then raise exception 'Provide agreement version, review note and request reference';end if;
 payload:=jsonb_build_object('trialRevision',p_trial_revision,'draftRevision',p_draft_revision,'agreement',btrim(p_agreement),'reason',btrim(p_reason));
 select * into existing from public.caro_premium_versions where request_key=p_request;
 if found then
  if existing.trial_id<>p_trial or existing.reviewed_by<>caller or existing.snapshot->'request' is distinct from payload then raise exception 'Review reference already used for different content';end if;
  return jsonb_build_object('id',existing.id,'version',existing.version);
 end if;
 if p_trial_revision is null or p_trial_revision<>trial.revision then raise exception 'Trial changed; reopen before saving a review copy' using errcode='40001';end if;
 select * into draft from public.caro_premium_drafts where trial_id=p_trial for update;
 if not found or p_draft_revision is null or p_draft_revision<>draft.revision then raise exception 'Premium changed; reopen before saving a review copy' using errcode='40001';end if;
 if coalesce(length(btrim(draft.content->>'waiver')),0)=0 then raise exception 'Record the draft host agreement before saving a review copy';end if;
 select coalesce(max(version),0)+1 into version_number from public.caro_premium_versions where trial_id=p_trial;
 snapshot:=jsonb_build_object('kind','private_review_copy','publication_ready',false,'request',payload,'trial',jsonb_build_object('is_practice',trial.is_practice,'title',trial.title,'start_date',trial.start_date,'end_date',trial.end_date,'timezone',trial.timezone,'planning',trial.planning,'application_state',trial.application_state,'sanction_status',trial.sanction_status),'content',draft.content);
 insert into public.caro_premium_versions(club_id,trial_id,version,snapshot,agreement_version,reviewed_by,request_key) values(trial.club_id,p_trial,version_number,snapshot,btrim(p_agreement),caller,p_request) returning id into edition;
 insert into public.caro_audit(club_id,trial_id,actor_id,action,reference,details) values(trial.club_id,p_trial,caller,'premium.review_copy_saved',edition::text,jsonb_build_object('version',version_number,'publication_ready',false));
 return jsonb_build_object('id',edition,'version',version_number);
end;$$;
revoke all on function caro_private.save_premium_review_copy(uuid,integer,integer,text,text,uuid) from public,anon,authenticated;
grant execute on function caro_private.save_premium_review_copy(uuid,integer,integer,text,text,uuid) to authenticated;
create function public.caro_save_premium_review_copy(p_trial uuid,p_trial_revision integer,p_draft_revision integer,p_agreement text,p_reason text,p_request uuid) returns jsonb
language sql security invoker set search_path='' as $$select caro_private.save_premium_review_copy(p_trial,p_trial_revision,p_draft_revision,p_agreement,p_reason,p_request);$$;
revoke all on function public.caro_save_premium_review_copy(uuid,integer,integer,text,text,uuid) from public,anon,authenticated;
grant execute on function public.caro_save_premium_review_copy(uuid,integer,integer,text,text,uuid) to authenticated;
create or replace function caro_private.guard_publication() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.caro_trials where id=new.trial_id for update;
 if new.is_live and exists(select 1 from public.caro_premium_versions where id=new.premium_id and snapshot->>'kind'='private_review_copy') then raise exception 'Private review copies cannot be published';end if;
 if new.is_live and not exists(select 1 from public.caro_trials where id=new.trial_id and club_id=new.club_id and application_state='finalized' and sanction_status='approved' and not is_practice) then raise exception 'CARO approval is required before publication';end if;
 return new;
end;$$;
revoke all on function caro_private.guard_publication() from public,anon,authenticated;
commit;
