# Local changes waiting for deployment

October 20, 2026. No live updates were made during the browser-disabled local development session. These changes must be deployed and verified before they are described as available at carosec.vercel.app.

## Database order

Already applied by the user/dashboard: 202610190001_caro_foundation.sql and 20261020153706_hosted_trial_drafts.sql. Do not rerun them against existing tables/functions.

Prepared and tested locally, not applied:

1. 20261020171448_system_administrator.sql: private Administrator assignments, access helpers, cross-club RLS reads, staff directory, audited membership changes and last-owner/last-administrator guards. Promotes no account.
2. 20261020204450_application_finalization.sql: review flags, validated finalization, ordered official events and atomic audit. Depends on Administrator helpers. Does not record CARO approval or publish entries.
3. 20261020204852_premium_drafts.sql: private premium drafts, caller-scoped reads, allowed editable content and optimistic revisions. Does not create public premium editions or open entries.
4. 20261020205439_approval_and_premium_editions.sql: actual CARO submission/decision records, evidence and immutable private premium review copies. Review copies cannot be published as live entry editions.
5. 20261020210136_administrator_trial_assignments.sql: Administrator grant/revoke of trial assignments, active membership requirement and audit with no duplicate changes.
6. 20261020211500_trial_activity.sql: paginated trial-private journal combining audit, entry receipts and financial records. Stable timestamp/key pagination and indexes; no anonymous access.
7. 20261020212500_manual_finance.sql: protected manual payment/refund/waiver commands, entry revision locks, retry keys, staff identity, original receipt times and atomic audit. Does not move money or create charges/intake.
8. 20261020214000_entry_settings.sql: private event pricing/capacity mapping from saved premium fees, authoritative fee snapshots, agreement reference, source/revision checks and a lock after intake begins. Does not publish or receive entries.
9. 20261020221500_manual_intake.sql: staff paper/email intake, required signed-form evidence, normalized original receipt clock, participant/stream/exercise validation, duplicate detection, safe retries and immutable manual entry terms. Requires real approval or an explicitly private practice trial; does not accept runs or receive public online entries. Manual intake editions cannot be published.
10. 20261020223000_run_decisions.sql: protected per-run acceptance, waitlisting/promotion, check-in, rejection and withdrawal; capacity/event locks, one-time event charges, optimistic revisions, retry receipts and private entry review. Preserves judged/signed runs and financial history.
11. 20261020224500_trial_day.sql: durable running orders, minimal ringside read model, judge transcription/correction versions, elapsed times and reviewed sign-off tokens. Completion rejects missing results and stale reviews, then locks run/order/result changes.
12. 20261020230000_reporting.sql: append-only expenses and linked credits, actual paperwork dates, an append-only incident register, reviewed no-incidents declarations, calendar-based deadlines and a coherent private report snapshot. No official invoice or automatic CARO submission.
13. 20261020231500_lookup_quota.sql: current trial authorization and an atomic per-user allowance for optional public CARO lookup. Stores counts only, not queried IDs or registry history.

14. 20261020233000_public_premiums.sql: reviewed immutable public editions, frozen-term reconciliation, anonymous allowlisted projection and listing closure. Online publication remains explicitly disabled.
15. 20261020234500_practice_trials.sql: atomic private practice creation, irreversible mode, audit and publication/sanction guards. The practice flag is introduced by migration 1 and used by subsequent prepared functions.
16. 20261021000000_online_intake.sql: server-only quota, normalized online commit/retry and private receipt projection. No browser role may execute these endpoints. Does not enable online publication.

Inspect live schema/migration metadata before applying. The initial scripts were run manually, so migration history must be reconciled before blindly using a CLI push. Review security advisors and perform live smoke tests afterward. The first Administrator assignment is a separate confirmed action against the intended authenticated user ID.

## Hosted UI

Prepared: sidebar, Administration, application review/finalization, event reordering, downloadable preparation summary and a connected premium draft editor with preview and private HTML export. Trial source data is read from the saved application. Fee/policy draft content is stored separately. CSS is bundled as text for the self-contained premium export and copied as premium.css for the hosted preview. Public output is limited to index.html, staff.js, staff.css, premium.css, public-trial.html, public-trial.js and public-trial.css. The overview is now the Open trial destination; its preparation checks and counts use authorized saved data.

Also prepared: selected-trial links for CARO approval, journal, bookkeeping, pricing, manual intake, entry review, trial day and reports/paperwork. Entry review pages by timestamp/ID and links to the exact entry's financial screen. Bookkeeping shows the newest 100 entry references plus a selected older entry, up to 100 ledger rows and full server-computed balances. Trial day connects orders, judge records/corrections, sign-off and protected PDF downloads. Reports refresh saved data for working HTML/CSV exports and track expenses/paperwork. Pending retries reuse request keys. Public online entries remain closed. All thirteen queued migrations must precede the matching UI deployment.

The exported hosted premium HTML supports browser printing, but its new layout still needs browser/PDF visual QA before it is delivered as a checked PDF template. Current local judge-sheet PDFs have been rendered and inspected separately.

## Local operations

The full local desk also provides direct premium PDFs and official source-form links. Hosted staff intake, per-run decisions, trial day and reconciliation now have prepared commands/UI. Deploy the protected judge PDF and optional lookup Python functions with their dependencies; see hosted-pdf.md and hosted-lookup.md. The hosted application does not expose the unauthenticated loopback API. The direct CARO lookup check returned 403 here, so the official-page fallback remains important. Public premium publication/paper forms and online-intake source are now prepared; online enablement, exact official submission mapping and browser/serverless verification remain outstanding.

## Source packaging

Run `node scripts/prepare-release.js` to create an allowlisted source snapshot and SHA256 manifest under tmp/releases. It excludes environment files, live records, downloaded references, generated artifacts, caches and private SQL checks. The browser-safe Supabase publishable key is intentionally included in hosted/public-config.json. No server secret belongs in the release.

## Acceptance after deployment

- Existing user can sign in and reopen RallyPaws without losing saved trials.
- Ordinary staff cannot access Administration or another club by direct API call.
- A deliberately appointed Administrator can read all clubs and use protected membership commands.
- Application save/reorder/finalize produces stable official rounds and rejects later edits.
- CARO approval remains separate and is never inferred from finalization.
- Premium draft save/reopen preserves fees and policies; stale saves conflict; source fields stay tied to the application.
- Record a completed CARO submission and decision with evidence; verify this does not publish entries. Private review copies remain immutable and unpublishable.
- Grant/revoke a secretary assignment and verify immediate access changes. Journal pagination must retain tied timestamps without omissions or duplicates.
- A retry of the same financial request creates one ledger record; stale/new requests conflict; excess refunds/waivers fail. Original receipt time and recording time remain separate.
- Map every finalized event to premium pricing; verify forged client prices are ignored, duplicate/missing events fail, Working uses per-exercise pricing and saved setup becomes stale after premium edits. An existing entry locks setup changes.
- Receive a signed test paper/email entry, retry once, verify one entry/audit and no automatic charge. Test Team/Brace handlers, Working selections, duplicate dog/round rejection and original receipt time. Later draft edits must not change frozen entry terms.
- Accept one run and waitlist another in the same entry. Fill the event, reject an over-capacity promotion, release a space and promote explicitly. Withdraw without erasing charges; verify duplicate requests do not duplicate fees and judged/completed runs stay protected.
- Save a complete running order, transcribe Rally and Working independently, append a correction and reject stale result versions/sign-off reviews. Confirm completion locks further changes and PDF reprints are labeled.
- Verify the deployed PDF denies missing/foreign/revoked access and prints selected ranges without private contact/receipt/payment fields. Review each resulting PDF page.
- Record an expense, append a linked correction/credit and reject excess credits. Reconcile all balances from a full snapshot. Save actual paperwork dates, reject future/stale saves and verify dates in the trial timezone.
- Screens remain readable on desktop/mobile; inspect all exported PDF pages before delivery.
- Test the full practice scenario and capture fresh screenshots for the manual.

## Prepared deployment artifacts

`node scripts/prepare-database-update.js` writes a single-transaction SQL update and SHA-256 migration manifest under output/deployment. It excludes the two already-applied foundation scripts, promotes no user and never connects to a database. The same combined SQL is compiled/exercised by the Administrator database test. Reconcile actual live state before running it; do not rerun a partially applied update blindly.

Deploy the Python entry-form function and Node online-entry/entry-receipt functions alongside the protected judge PDF and optional lookup. See hosted-public-entry.md for the server-only configuration and explicit online-publication gate. No server credential is included.

The prepared application-transfer helper adds caro-application-helper.zip to the explicit public asset allowlist. It is a manually installed Chrome/Edge extension, with active-tab/scripting/session-storage permissions and no server credential. Hosted application fields can be exported to JSON; full official event/judge entry still needs browser verification. No new database migration is required for this helper.
