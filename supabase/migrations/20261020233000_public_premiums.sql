-- Approved public premium projection. Private review/manual snapshots remain unpublishable.
begin;
alter table public.caro_public_trials add column online_enabled boolean not null default false;
create unique index caro_one_live_trial on public.caro_public_trials(trial_id) where is_live;
create function caro_private.publication_preview(p_trial uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare trial public.caro_trials;config jsonb;content jsonb;manual public.caro_premium_versions;payload jsonb;field text;
begin
 select * into trial from public.caro_trials where id=p_trial;
 -- Verify current staff access and CARO approval before inspecting private terms.
 config:=caro_private.manual_entry_configuration(p_trial);
 if trial.is_practice or trial.title ilike '%TEST ONLY%' then raise exception 'Fictional practice trials cannot be published';end if;
 select p.* into manual from public.caro_entries e join public.caro_premium_versions p on p.id=e.premium_id where e.trial_id=p_trial order by e.created_at,e.id limit 1;
 if manual.id is not null then
  if manual.snapshot->>'kind' not in ('manual_entry_edition','public_entry_edition') or jsonb_typeof(manual.snapshot->'configuration') is distinct from 'object' then raise exception 'The original entry terms need review before publication';end if;
  config:=manual.snapshot->'configuration';content:=manual.snapshot->'content';
 else config:=caro_private.entry_setup_configuration(p_trial);select d.content into content from public.caro_premium_drafts d where d.trial_id=p_trial;end if;
 if coalesce(length(btrim(config->>'host')),0)=0 or coalesce(length(btrim(config->>'email')),0)=0 or coalesce(length(btrim(config->>'venue')),0)=0 or coalesce(length(btrim(config->>'address')),0)=0 or coalesce(length(btrim(config->>'secretary')),0)=0 then raise exception 'Complete public host, secretary, email and venue information';end if;
 for field in select unnest(array['payment','confirmations','refunds','moveups','waiver']) loop
  if coalesce(length(btrim(content->>field)),0)=0 then raise exception 'Complete public premium policy: %',field;end if;
 end loop;
 if content is null then raise exception 'The original entry terms need review before publication';end if;
 if config->>'trialNumber' is distinct from trial.trial_number then raise exception 'The trial reference changed; review the frozen terms';end if;
 if coalesce(length(btrim(content->>'waiver')),0)=0 or content->>'waiver'~*'DRAFT[[:space:]]+PLACEHOLDER' then raise exception 'Replace the placeholder host agreement';end if;
 if (config->>'closes')::date>trial.start_date then raise exception 'Online closing after the first trial date needs a separately reviewed late-entry workflow';end if;
 payload:=jsonb_build_object('configuration',config,'content',content,'trialRevision',trial.revision);
 return payload||jsonb_build_object('usesFrozenTerms',manual.id is not null,'reviewToken',encode(sha256(convert_to(payload::text,'UTF8')),'hex'));
end;$$;
create function public.caro_publication_preview(p_trial uuid) returns jsonb language sql stable security invoker set search_path='' as $$select caro_private.publication_preview(p_trial)$$;

create function caro_private.publish_premium(p_trial uuid,p_review_token text,p_slug text,p_request uuid,p_reviewed boolean,p_online boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare trial public.caro_trials;preview jsonb;config jsonb;edition public.caro_premium_versions;payload jsonb;version_number integer;edition_id uuid;listing_id uuid;
begin
 select * into trial from public.caro_trials where id=p_trial for update;
 preview:=caro_private.publication_preview(p_trial);config:=preview->'configuration';
 if p_online is true then raise exception 'Online intake is not enabled in this release';end if;
 if p_reviewed is distinct from true or p_online is null or p_request is null or p_slug is null or p_slug!~'^[a-z0-9][a-z0-9-]{2,79}$' then raise exception 'Review the public premium and choose a lowercase link slug';end if;
 payload:=jsonb_build_object('reviewToken',p_review_token,'slug',p_slug,'online',p_online);
 select * into edition from public.caro_premium_versions where request_key=p_request;
 if edition.id is not null then
  if edition.trial_id<>p_trial or edition.reviewed_by<>auth.uid() or edition.snapshot->>'kind'<>'public_entry_edition' or edition.snapshot->'request' is distinct from payload then raise exception 'Publication request reference already used';end if;
  return jsonb_build_object('id',edition.id,'version',edition.version,'slug',p_slug);
 end if;
 if p_review_token is distinct from preview->>'reviewToken' then raise exception 'The reviewed premium changed. Refresh and review again.' using errcode='40001';end if;
 select coalesce(max(version),0)+1 into version_number from public.caro_premium_versions where trial_id=p_trial;
 insert into public.caro_premium_versions(club_id,trial_id,version,snapshot,agreement_version,reviewed_by,request_key)
 values(trial.club_id,p_trial,version_number,jsonb_build_object('kind','public_entry_edition','publication_ready',true,'request',payload,'configuration',config,'content',preview->'content'),config->>'premiumVersion',auth.uid(),p_request) returning id into edition_id;
 update public.caro_public_trials set is_live=false where trial_id=p_trial and is_live;
 insert into public.caro_public_trials(club_id,trial_id,premium_id,slug,title,host_name,venue,public_email,start_date,end_date,timezone,opens_on,closes_on,is_live,online_enabled)
 values(trial.club_id,p_trial,edition_id,p_slug,trial.title,config->>'host',config->>'venue',config->>'email',trial.start_date,trial.end_date,trial.timezone,(config->>'opens')::date,(config->>'closes')::date,true,p_online)
 on conflict(slug) do update set premium_id=excluded.premium_id,title=excluded.title,host_name=excluded.host_name,venue=excluded.venue,public_email=excluded.public_email,start_date=excluded.start_date,end_date=excluded.end_date,timezone=excluded.timezone,opens_on=excluded.opens_on,closes_on=excluded.closes_on,is_live=true,online_enabled=excluded.online_enabled
 where caro_public_trials.trial_id=p_trial returning id into listing_id;
 if listing_id is null then raise exception 'This link slug is unavailable';end if;
 insert into public.caro_audit(club_id,trial_id,actor_id,action,reference,details) values(trial.club_id,p_trial,auth.uid(),'premium.published',edition_id::text,jsonb_build_object('version',version_number,'slug',p_slug,'onlineEnabled',p_online,'usesFrozenTerms',preview->'usesFrozenTerms'));
 return jsonb_build_object('id',edition_id,'version',version_number,'slug',p_slug);
end;$$;
create function public.caro_publish_premium(p_trial uuid,p_review_token text,p_slug text,p_request uuid,p_reviewed boolean,p_online boolean default false) returns jsonb
language sql security invoker set search_path='' as $$select caro_private.publish_premium(p_trial,p_review_token,p_slug,p_request,p_reviewed,p_online)$$;

create function caro_private.close_public_trial(p_trial uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare trial public.caro_trials;changed integer;
begin
 select * into trial from public.caro_trials where id=p_trial for update;
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or trial.id is null or not(caro_private.is_administrator() or caro_private.can_read_trial(trial.club_id,p_trial)) then raise exception 'Trial access required' using errcode='42501';end if;
 update public.caro_public_trials set is_live=false where trial_id=p_trial and is_live;get diagnostics changed=row_count;
 if changed>0 then insert into public.caro_audit(club_id,trial_id,actor_id,action,reference,details) values(trial.club_id,p_trial,auth.uid(),'premium.closed',p_trial::text,jsonb_build_object('listings',changed));end if;
 return changed;
end;$$;
create function public.caro_close_public_trial(p_trial uuid) returns integer language sql security invoker set search_path='' as $$select caro_private.close_public_trial(p_trial)$$;

create function caro_private.public_premium(p_slug text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare listing public.caro_public_trials;edition public.caro_premium_versions;
begin
 if p_slug is null or p_slug!~'^[a-z0-9][a-z0-9-]{2,79}$' then raise exception 'Published trial is unavailable';end if;
 select p.* into listing from public.caro_public_trials p join public.caro_trials t on t.id=p.trial_id where p.slug=p_slug and p.is_live and t.application_state='finalized' and t.sanction_status='approved' and not t.is_practice;
 if listing.id is null then raise exception 'Published trial is unavailable';end if;
 select * into edition from public.caro_premium_versions where id=listing.premium_id and snapshot->>'kind'='public_entry_edition' and snapshot->'publication_ready'='true'::jsonb;
 if edition.id is null then raise exception 'Published trial is unavailable';end if;
 return jsonb_build_object('kind','public_entry_edition','publicationReady',true,'slug',listing.slug,'premiumId',edition.id,'version',edition.version,'onlineEnabled',listing.online_enabled,
  'configuration',edition.snapshot->'configuration','content',edition.snapshot->'content');
end;$$;
create function public.caro_public_premium(p_slug text) returns jsonb language sql stable security invoker set search_path='' as $$select caro_private.public_premium(p_slug)$$;

revoke all on function caro_private.publication_preview(uuid),caro_private.publish_premium(uuid,text,text,uuid,boolean,boolean),caro_private.close_public_trial(uuid) from public,anon,authenticated,service_role;
grant execute on function caro_private.publication_preview(uuid),caro_private.publish_premium(uuid,text,text,uuid,boolean,boolean),caro_private.close_public_trial(uuid) to authenticated;
revoke all on function public.caro_publication_preview(uuid),public.caro_publish_premium(uuid,text,text,uuid,boolean,boolean),public.caro_close_public_trial(uuid) from public,anon,authenticated;
grant execute on function public.caro_publication_preview(uuid),public.caro_publish_premium(uuid,text,text,uuid,boolean,boolean),public.caro_close_public_trial(uuid) to authenticated;
grant usage on schema caro_private to anon;
revoke all on function caro_private.public_premium(text),public.caro_public_premium(text) from public,anon,authenticated,service_role;
grant execute on function caro_private.public_premium(text),public.caro_public_premium(text) to anon,authenticated,service_role;
commit;
