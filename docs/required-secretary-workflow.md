# Required CARO secretary workflow

Confirmed by the user October 20, 2026. These are required product functions, not optional enhancements. The hosted product is incomplete until they work together for a selected trial. Use the fictional RallyPaws practice trial for end-to-end verification and the screenshot manual.

## Navigation and delivery status

| Sidebar section | Required outcome | Current boundary |
|---|---|---|
| Dashboard | Selected trial, counts, balances, next actions and paperwork status | Hosted overview/counts/next actions prepared locally |
| Trial application | Officials, dates, venue, events/judges, review, finalization and separately recorded CARO approval | Hosted drafts live; finalization and CARO evidence prepared locally |
| Premium builder | Trial-derived content, fees, policies, reusable templates, reviewed versions, online entry and paper/PDF links | Local builder/direct PDF; hosted private drafts/review copies prepared; public publication and paper endpoint prepared; online enablement gated |
| Entries | Online form plus email/paper intake, CARO ID assistance, duplicate review and receipts | Full local intake; hosted paper/email intake prepared; hosted online form/server/receipt source prepared; deployment acceptance and enablement pending |
| Waitlist | Capacity by offered event, visible queue, acceptance decisions and change history | Local per-run statuses and reports; protected hosted run commands/review UI prepared |
| Payments | Amount due/received, payment method/reference, refunds, waivers and corrections in cents | Local ledger; protected hosted finance and complete balance summary prepared |
| Running order | Stable official round IDs, independently editable run order, check-in, handler/dog conflicts | Local and prepared hosted orders/check-in; richer conflict planning remains future work |
| Judge sheets | Printable blank/prepared score sheets for the correct discipline and event, including Working and Team/Brace | Checked shared PDF generator and protected hosted endpoint prepared; official mapping/deployed verification pending |
| Scores and results | Judge-provided scores, corrections, provenance and completed-record locks | Local and prepared hosted transcription, corrections and reviewed sign-off |
| CARO summaries | Current official required summaries/results/financial counts and paperwork package | Local/prepared hosted reconciliation, working reports and tracking; official format mapping remains required |
| Activity journal | Searchable chronological trial activity, including receipts, payments and withdrawn runs | Local search/print; paginated private hosted journal prepared; full-journal search, type and timezone date filters prepared |
| Administration | All-club/all-trial access, staff access management and administration audit | Local implementation prepared; not deployed or granted |

The sidebar must show the current club/trial context. Add only usable navigation destinations or clearly marked unavailable states. Do not present a local-only capability as a completed hosted feature.

## Activity journal

October 20 update: searchable local journal, original receipt/effective clocks, per-run withdrawals/waitlists and printable reports are implemented. Hosted journal, intake and financial/run decisions now have prepared RPCs using verified staff identity, UTC instants and atomic audit. These migrations/UI are not deployed or browser verified. See deployment-queue.md and local-progress-2026-10-20.md for current boundaries; this supersedes earlier pending statements.

Provide a trial-scoped chronological journal with filters for date range, entry/dog/handler, event/run, action and staff member. Include readable descriptions and links to the affected entry, payment or run. Staff access follows club/trial authorization; system Administrators can inspect every trial. No journal is public.

Required events include entry received (online/email/paper), entry accepted, waitlisted, waitlist promoted, rejected, checked in, payment received/recorded, refund, waiver, run withdrawn, whole entry withdrawn, move-up, running-order change, score correction, trial sign-off and publication changes.

Store server recording time in UTC/timestamptz and display it in the trial timezone with a DST-aware offset. For emailed/paper entries or manually recorded payments, preserve a separately entered received/effective time when known; do not pretend the data-entry time was the original receipt time. Display both when different. Identify the actor and intake channel; never infer online bank payment confirmation from a staff bookkeeping entry.

Each event needs a stable ID, club/trial, action, actor (or public intake identity type), affected entry and optional event/run/payment reference, reason, applicable amounts/status changes and recording time. Insert it in the same transaction as the corresponding successful change. Idempotent retries must not duplicate journal events. Failed changes must not appear as successful activity. Corrections append history; ordinary users and Administrators cannot rewrite it. Do not log passwords, tokens, full agreements or unnecessary personal data.

## Withdrawals and waitlists

A handler can withdraw one entered run while retaining other runs in the same entry. Record affected event, participant group, prior status, reason, actor and time. Preserve charges and payments; a withdrawal does not silently issue a refund or erase a ledger line. A refund/fee adjustment is a separate recorded decision under the applicable policy. Preserve judged results and signed records. A completed performance cannot be erased by withdrawing its entry.

Capacity and waitlist decisions must account for the affected event/run. Releasing a space must not oversubscribe the event or silently accept an unrelated waitlisted run. Record each promotion decision. Team/Brace participants remain attached to their shared performance; Working selections retain exercise-level detail. Local and prepared hosted commands now meet the per-run requirement; live deployment/concurrency acceptance is still required.

## Judge printing and CARO paperwork

Create discipline-appropriate judge score sheets, not just a results spreadsheet. Include trial reference/date, official event/round, judge, catalogue/run order, dog ID and name, handler, class/stream, relevant jump or exercise information, score/outcome spaces and applicable sign-off fields. Map exact scoring boxes and official summary fields to current CARO source forms before claiming official compatibility. Keep a practical printable fallback for trial-day use.

Retain at least 12pt printed body/form text, natural page breaks, repeated table headings and intact entrant blocks. Use the PDF skill to render and inspect every changed sheet/template with both normal and long sample data. Never shrink print to force a page count.

CARO summaries should distinguish entered, accepted, waitlisted, withdrawn, FEO, judged and qualifying totals where required by the verified form. Reconcile counts and fees against entry lines, final judge results and ledger records. Track required paperwork and evidence of manual submission; no automatic official submission or title award is implied.

## End-to-end acceptance

Using the same practice trial: prepare application and premium; submit an online and paper entry; retry and duplicate-check; fill an event and waitlist another run; record payment; withdraw one unjudged run; review space and promote a waitlisted run; print running order and judge sheets; record/correct results; sign off; reconcile CARO summaries. Verify each journal entry, balances, capacity, permissions, saved state after reopening and printed output. Update the manual only from verified screens.
