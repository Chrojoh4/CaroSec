# Local secretary development October 20 2026

## Isolated practice workspace

Run `npm run dev:practice` from E:\CARO, then open http://localhost:4322/. The first run creates fictional RallyPaws records in data/practice/records.json. Later starts reuse saved practice records rather than reset them. The browser planning draft uses a separate practice storage key. Ordinary data/records.json and ordinary planning drafts are not overwritten. This loopback server has no login and must stay local.

The practice scenario includes four fictional entry orders across six Regular, Team, Brace and Working events, online/paper/email intake, a payment record, a waitlist, one withdrawn run, explicit promotion and a judge result. Names/IDs are marked test-only. No external payment, submission, email or live database write occurs.

`npm run sample:trial` separately regenerates disposable output/sample-trial artifacts, including records JSON, a minimal judge packet JSON and working HTML reports. These output files are not the practice server's editable records. Regeneration does not reset data/practice/records.json.

## Printing and summaries

Reports now includes a downloadable judge working PDF, with one sample run per page, Team/Brace partners and selected Working exercises. The seven-page normal sample was rendered and every page inspected. Body text is 12pt. These are secretary working layouts, not a claim of official CARO scoring-form compatibility. Unchanged supplied CARO score sheets, judge records, catalogue and 2026 fee schedule are separately available from the local Reports screen; confirm current source versions before official use.

The trial reconciliation report separates event acceptance/waitlisting, withdrawals, FEO, recorded/unrecorded results, judge-reported outcomes and sign-off. It uses the latest correction rather than counting score revisions as extra performances. Financial totals reconcile charges, payments, refunds, waivers, owing/credits, expenses and net recorded cash. It does not calculate an official CARO invoice or mix Working exercise passes with Rally qualifying-run totals.

## Journal and receipt times

The journal resolves entry/payment references and trial isolation. Manual entry and finance forms accept an optional original received/effective timestamp with seconds and an explicit UTC offset or Z. Values are normalized to UTC, reject invalid/future clocks, and remain separate from server recording time. Unknown original times remain unknown. Online receipt time is server assigned; an entrant cannot backdate it through input. The current local actor is explicitly unauthenticated; verified hosted staff identity remains future integration work.

## Verification and boundaries

101 tests pass, including Administrator access, application locks, private premium copies, activity pagination, manual financial retries and recovery rehearsal; the hosted bundle builds. Read-only HTTP smoke checks returned 200 for the isolated practice workspace, desk and shared modules. Judge PDF and unchanged official form download routes returned valid PDF bytes. This is endpoint verification, not browser interaction testing. Local operational screens still require browser smoke testing when access is restored. Changes are local, not deployed. No files were written in the Secretary Trial Management project.

## Per-run statuses

Entries can now hold accepted and waitlisted runs simultaneously. Per-run acceptance/promotion checks the target event capacity, charges only newly accepted lines, and appends journal activity. Check-in and scoring reject unaccepted runs. Running orders, judge packets and summaries use the line's status with a compatible fallback for older entry-wide records. The local desk has a Waitlist tab and per-run action buttons. Whole-entry check-in rejects mixed accepted/unaccepted orders. A completed or judged run cannot be withdrawn or reassigned by these commands.

The regenerated practice scenario keeps Willow accepted in round 1 and waitlisted in round 2, so the mixed-state workflow remains visible for testing. Previously saved practice records are intentionally not reset; regenerate disposable output fixtures or use a new isolated records file when a fresh scenario is needed.

## Recovery and hosted preparation

`npm run records:backup` creates checksum-protected local backup envelopes, verifies them and restores only to new files. See backup-recovery.md. The Reports raw JSON download remains a separate export format. No active records are replaced during recovery.

The prepared hosted UI now includes selected-trial navigation, application finalization, private premium drafts/review copies, CARO decision evidence, Administrator membership/trial assignments, a paged private journal and a manual financial record screen. Their migrations have passed local database security/behavior tests but have not been applied live. Hosted public entry publication/intake and hosted per-run trial-day commands still need implementation. See beta-readiness.md and deployment-queue.md.

## Full fictional rehearsal

`npm run rehearse:trial` completes the same fictional weekend into output/trial-rehearsal without changing editable practice data. Seven judged performances, two withdrawals, no waiting/unrecorded runs, six event sign-offs, one retained correction and zero entry balances are checked automatically. Working outcomes remain separate. See trial-rehearsal.md. The run register, printable waitlist and withdrawal reports are available in the local Reports tab. Hosted entry setup now maps finalized events to saved premium prices/capacities and locks after intake; it remains a prepared migration/UI, not live intake.

## Direct premium PDF and hosted intake preparation

The local Premium studio has a direct Download PDF action. The ReportLab export uses 12pt body text, separates both entry links, preserves short policy paragraphs and moves the events section when too little space remains. Four normal pages and six long-content stress pages were rendered and inspected. The endpoint returned valid PDF bytes, rejected malformed input and left practice records unchanged. UTF-8 text and font sizes were checked. This is independent of browser Print/PDF and does not certify the hosted HTML layout. The fictional premium's officials and entry dates now match the canonical trial source; saved practice data is preserved.

Prepared hosted commands/UI now receive paper/email entries, freeze authoritative entry prices/agreement terms, detect duplicate dog/round submissions, preserve original receipt times and safely replay requests. Entries remain submitted until a separate decision. Per-run acceptance/waitlist/promotion/check-in/rejection/withdrawal uses event capacity locks and one-time fee charges, preserves withdrawn selections and protects scored/completed runs. Entry review and financial deep links are connected locally. These changes are not applied/deployed or browser verified. Public online intake, hosted running order/scoring and screenshot manual remain outstanding.

## Prepared hosted trial day and reports

Hosted trial-day commands/UI now save complete running orders, transcribe Rally/Working judge results, preserve correction versions and complete events only against the reviewed current snapshot. The review token remains stable across database session timezones. Signed events retain their locks. The protected Python judge-sheet endpoint delegates caller authorization to Supabase and projects only judge-sheet data; seven Python checks run within the Node test suite. Runtime/bundle settings and dependencies are prepared but not deployed.

Hosted reporting now reads one coherent trial snapshot, retains latest result versions, flags incomplete legacy data and keeps Working exercise counts separate. Working HTML/CSV exports reuse the checked domain projections. Expenses and linked credits are append-only; over-crediting fails. Actual paperwork dates use calendar dates and reject future/stale saves. Public online intake, deployed browser/function QA, exact official export mapping and manual screenshots remain pending.

Optional hosted CARO-ID lookup is now prepared with a trial-authorized per-user database allowance and bounded, source-labeled read-only results. Five additional Python checks cover authorization, schemas, privacy, caching and outages. Direct reads of the supplied example 1334 returned 403 in this environment; unavailability is preserved and manual/official-page fallback stays available. No absence, identity, title or eligibility is inferred. See hosted-lookup.md.


## Public publication, practice and online-entry source

Latest local checkpoint: 114 tests; production build prepared. The trial overview shows counts, balances and next actions. Explicit practice mode allows private intake/acceptance without fake CARO sanction evidence, cannot be removed, and cannot publish. Public premium review/publish/close commands freeze the terms used by received entries. Staff paper intake uses the same published edition. Anonymous public projection contains only premium information.

The public premium page and interactive email/paper PDF endpoint are prepared. PDF body/fields are 12pt; the final seven-page six-round practice form was rendered and inspected, with move-up/refund policies starting together and signatures intact. A misleading semicolon in the sample Working description was removed so it creates one fictional exercise rather than an instruction as a second exercise. Existing editable practice records were not reset.

Online form, private receipt view, server-only Node handlers, quota and database commit/replay are implemented and locally checked. Shared SQL validation protects both paper and online selections; client prices are ignored. Receipt secrets are hashed in storage and use browser fragments. Publishing online remains hard-gated until server configuration and live acceptance. No secret was supplied or requested in chat.

Journal filters now search all saved activity with type and trial-timezone recording dates; stable pagination and UTC-midnight boundaries are tested. Reports link the supplied official CARO source forms without claiming exact output compatibility. A combined 16-migration update is generated and tested as one transaction; no live SQL or deployment occurred. See hosted-public-entry.md and deployment-queue.md. Browser/manual screenshots, official transfer mapping and deployed acceptance remain outstanding.

Hosted incident register and post-trial declarations are now prepared. Incident records retain actual versus recording time, staff identity and safe retry references. History is append-only; recording an incident resets the no-incidents declaration and advances paperwork revision. Reports preserve unknown actual times, print a private incident register and include reviewed incident status in reconciliation. Contradictory no-incidents declarations and future actual times are rejected. Latest full suite: 114 passing tests.
