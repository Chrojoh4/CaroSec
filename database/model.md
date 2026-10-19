# PostgreSQL logical model

Design for a future Supabase project. No database has been provisioned and no SQL has been executed. Resolve handbook gates before converting rule-sensitive fields into constraints or seed data.

Baseline secretary operation requires no historical results. The historical_results, title_observations and progress_snapshots tables are optional future extensions and can be omitted from initial migrations. Entries should retain entrant-supplied eligibility declarations, their provenance, staff review status and any supporting evidence without claiming verification against unavailable CARO history.

## Tables

All mutable aggregate roots carry `id UUID`, `revision integer`, `created_at timestamptz`, `updated_at timestamptz`. Club-owned rows carry `club_id UUID NOT NULL`. Child relationships use `(club_id, parent_id)` composite foreign keys to unique `(club_id, id)` parent keys. Do not rely on RLS alone to prevent cross-club associations.

| Table | Main fields and relationships |
| --- | --- |
| clubs | name, contact, default_timezone |
| profiles | auth_user_id -> auth.users, display_name; private contact fields |
| club_memberships | club_id, user_id, role; unique club/user; invitation state |
| trial_assignments | club_id, trial_id, user_id, capability; limits access to selected trials |
| source_documents | canonical_url, title, retrieved_at, checksum, publication_date, effective_date, section references |
| rule_bundles | version, effective_from/to, review_status, content_hash, mode applicability |
| rule_bundle_sources | bundle_id, source_document_id; retain all amendments |
| event_definitions | bundle_id, discipline, level, format, stream configuration; approved combinations only |
| working_exercises | bundle_id, code, official_name, source_section; names not seeded until verified |
| judges | local identity, external_reference, verification_source; no invented CARO judge ID format |
| judge_authorizations | judge_id, discipline/level scope, validity interval, evidence |
| trials | club_id, name, sanction_reference TEXT, sanction_status, mode, timezone, venue, bundle_id, operational_status |
| trial_days | trial_id, local_date; unique trial/date |
| trial_applications | trial_id, state, finalized_at, official_snapshot JSONB, snapshot_hash; one active version |
| application_events | application_id, day_id, definition_id, assigned_judge_id, draft_position, official_round_number |
| schedule_slots | trial_id, event_id, ring, scheduled_start, execution_position; event unique; independent of official number |
| handlers | club-local contact record, optional profile link, imported provenance |
| dogs | club-local record, caro_dog_id TEXT, name, optional birth date, height and unit, provenance |
| dog_handler_links | dog_id, handler_id, relationship; ownership is separate from run handling |
| entry_orders | trial_id, submitting_handler_id, status, receipt_token_hash, policy/waiver version, submitted_at |
| event_entries | order_id, event_id, stream, status, pricing_snapshot, accepted_at; participant group for a single event |
| entry_participants | event_entry_id, dog_id, handler_id, participant_order; composition validated against rules |
| working_selections | event_entry_id, exercise_id, working_level; unique entry/exercise; validate event's offered exercises |
| move_up_requests | event_entry_id or working_selection_id, old/new destination snapshots, state, requested_at, approved_by, evidence |
| performance_attempts | event_entry_id, attempt_number, status, running_position; previous attempt retained |
| rally_result_revisions | attempt_id, revision_no, recorded_by, judge_id, score, elapsed_ms, outcome, rule_bundle_id, reason, reviewed_by, finalized_at |
| working_result_revisions | attempt_id, selection_id, revision_no, outcome, recorded_by, judge_id, rule_bundle_id, reason, finalized_at |
| fee_lines | order_id, event_entry_id nullable, amount_cents, currency, fee_kind, immutable description/policy snapshot |
| payments | payer, amount_cents, currency, method, external_reference, posted_at; no card details |
| payment_allocations | payment_id, fee_line_id, amount_cents; transactional over-allocation guard |
| financial_adjustments | fee/payment reference, kind, amount_cents, reason, actor; explicit refunds/waivers/reversals |
| expenses | trial_id, category, amount_cents, currency, incurred_at, evidence reference |
| historical_results | dog_id, source_system, source_key, imported_at, effective_date, payload, verification_status; unique source/key |
| title_observations | dog_id, official_title_code, source/evidence, recorded_at; not issued by this app |
| progress_snapshots | dog_id, bundle_id, inputs_hash, calculated_at, provisional output; rebuildable |
| export_packages | trial_id, format_version, result_revision_set, object_path, checksum, reviewed_by, status, generated_at |
| audit_events | club_id, actor_id, aggregate_id/type, action, before/after, reason, occurred_at, request_id |
| outbox_jobs | club_id, kind, payload_reference, idempotency_key, state, attempts, next_attempt_at; unique key |
| command_receipts | club_id, actor_id, command_kind, idempotency_key, request_hash, result_reference; unique scoped key |
| premium_templates | club_id, name, revision, section configuration, public branding, approved text references |
| premium_versions | club_id, trial_id, version, state, source_application_revision, source_trial_revision, fee_policy_revision, content_snapshot, public_field_projection, reviewed_by, published_at, supersedes_id, PDF object_path/checksum |
| entry_policy_acceptances | club_id, entry_order_id, premium_version_id, waiver_version, accepted_at, agreement evidence |
| dog_lookup_observations | club_id, entry_order_id, queried_caro_dog_id TEXT, status, source_url, fetched_at, source_as_of nullable, supported normalized fields if permitted, confirmed_by, confirmed_at; no ownership grant |
| judge_substitutions | club_id, event_id, original_assigned_judge_id, actual_officiating_judge_id, course_designer_id, official_reporting_judge_id, reason, evidence, reviewed_by; retain original application snapshot |
| accommodation_requests | club_id, trial_id, participant reference, restricted details/evidence, judge decision, decided_at, notification status; approved trial-day projection |
| trial_compliance_tasks | club_id, trial_id, task_type, source_section, due_at nullable, status, evidence, reviewed_by; application/course/report deadlines and document sign-off |

Entry participants additionally require an explicit participant_kind (competing/bye) with nullable real dog link for bye rows. Officials Guide p. 22 specifies Bye-Dog / 2799 for reporting; that sentinel is not an owned registry dog. Premium publication constraints require recorded official approval plus an assigned trial reference. Maintain at least the documented three-month record retention minimum; current post-trial submission deadlines and fees still need exact form verification.

## Database invariants to implement

- Unique official round number per application. Finalized application rows cannot change official number, event definition, date or judge; a snapshot and append-only amendment trail preserve the original.
- Nonnegative cents for charges and payments; adjustments explicitly encode signed effects. Currency is CAD initially. Derived balances are computed from ledger entries, not stored mutable totals.
- Score ranges, stream combinations, participant counts, exercise counts and title requirements are verified bundle rules, not guesses embedded in migrations.
- Finalized score revisions are immutable. A correction creates a new revision with reason and authorized sign-off; affected exports become superseded.
- Every authoritative write checks expected revision and inserts its audit record in the same transaction. Event acceptance locks capacity rows; payment allocation locks its source payment; retries use command receipts.
- Trial/event/entry lookup indexes start with club_id. Additional indexes cover trial/date, trial/status, entry/event, CARO ID, pending jobs and audit aggregate/time. CARO IDs are unique within a club only when present and normalized according to verified identifier rules; do not merge records automatically across clubs.

## RLS matrix (proposed)

| Principal | Access |
| --- | --- |
| Anonymous | Published non-sensitive trial projection only; entry submissions via validated server command, no table enumeration. |
| Handler | Own submitted receipts and permitted amendments through scoped commands; no shared registry read. |
| Assigned scorer | Assigned event participants and draft scores; no finances, membership management or broad contacts. |
| Assigned secretary | Assigned trial operations and its necessary registry records. |
| Club administrator | Club operations, memberships and reporting. |
| Application administrator | Explicit audited support capability; not a role editable in a public profile. |

Implement policies using server-verified auth.uid() and membership/assignment tables with careful recursion avoidance. Separate public views from private base tables, check function execution grants/search_path, and keep secret/service credentials server-only. Private storage paths include club/trial IDs and use matching policies. Production migration acceptance requires automated cross-club isolation and forged-reference tests.


## Date and timestamp contract (reviewed October 18, 2026)

- Store real events (`created_at`, `updated_at`, audit changes, payment-record timestamps, receipt submission times) as PostgreSQL `timestamptz`, with database-generated `now()` for authoritative hosted writes. Send ISO values with `Z` or an explicit offset; never send an offset-free wall clock as an instant. Preserve UTC instants in backups and machine-readable exports.
- Store trial days, dog birth dates, application submission dates and paperwork/confirmation dates as PostgreSQL `date`, exchanged as `YYYY-MM-DD`. Do not convert these through browser local midnight or `toISOString()` from a local Date constructor.
- Store venue timezone separately as a validated IANA identifier. Display real instants in this zone, showing zone/offset where time is displayed. Do not depend on Vercel, database session or secretary computer timezone. Daylight-saving offsets come from the zone on that event date, never a fixed hour adjustment.
- The current entry window is inclusive opening/closing calendar dates in the venue timezone. A future exact scheduled opening must become a separately validated instant, with explicit handling of nonexistent/repeated DST wall times. No wall-time-to-UTC converter is currently needed or implemented.
- Calendar deadline arithmetic uses UTC as an arithmetic coordinate for date strings only; the resulting value remains a date, not a trial-midnight instant.

This preserves the intent of the existing secretary's date-only and UTC/display fixes without importing its competition rules or copying its legacy wall-time conversion helper. No database or historical timestamp rewrite was performed.
