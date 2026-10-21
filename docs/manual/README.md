# CARO Secretary manual project

The current text walkthrough is [secretary-handbook.md](secretary-handbook.md). It distinguishes prepared source from deployed features; screenshots and actual browser acceptance remain pending.

Use the same fictional RallyPaws Practice Weekend throughout testing and screenshots. Canonical inputs are in `E:\CARO\fixtures\rallypaws-practice-trial.json`. This fixture is a reference dataset, not an import file supported by the current UI. No hosted trial has been created from it yet.

## Current setup walkthrough

1. Sign in at https://carosec.vercel.app/.
2. Under RallyPaws, select Create trial.
3. Enter the title, two dates and America/Vancouver timezone from the fixture.
4. Fill in its fictional officials, contact emails, venue and ring details.
5. Add the six draft events in fixture order. Review the event date on each row.
6. Select Save trial draft. Check for the saved confirmation.
7. Return to the workspace, reopen the trial and verify dates, venue and all six events.
8. Change one draft value, save and reopen again to verify editing persists.

These steps describe the implemented controls. Their execution against this fixture is pending browser access. Saving does not submit an application to CARO or open entries.

## Screenshot plan

Capture fresh browser images after each verified step. Keep the test-only trial title visible wherever possible. Avoid account email, credentials and unrelated records in manual screenshots. Use readable focused views rather than shrinking a whole long page onto one sheet.

| Image | View | Verification |
|---|---|---|
| 01 | RallyPaws workspace | Create trial visible |
| 02 | Trial name dates and timezone | Fixture values entered |
| 03 | Officials and venue | Fictional contacts only |
| 04 | Events and judges | Both trial days represented |
| 05 | Save confirmation and trial card | Save completed |
| 06 | Reopened trial | Saved values match |

## Manual growth plan

Follow docs/required-secretary-workflow.md for mandatory chapters and the end-to-end test sequence. Include an Activity journal chapter showing entry receipt, payment recording and a single-run withdrawal, along with waitlist promotion, judge score sheet printing and CARO summary reconciliation.

Include a separate Administrator chapter covering all-club trial access and admin-only functions after implementation. Use docs/administrator.md as the access specification. The sample trial should appear in the administrator's all-trials view as clearly labeled test data.

Build an editable manual and a PDF from verified browser captures. Use at least 12pt body text and natural page breaks; keep headings, instructions and their related screenshot together. Render and inspect every page before release.

Add chapters as hosted features become usable: sidebar navigation; application review and finalization; CARO submission and approval recording; premiums; online and paper entries; payment records; running orders and check-in; judge scores and corrections; reports and paperwork. Do not present planned controls as currently available.

## Prepared hosted walkthrough (not deployed or browser verified)

After the migration/deployment queue is completed, verify these steps before photographing them:

1. Select Start fictional practice trial under the intended club. Check TEST ONLY in its title, fictional contacts, dates and all six events before saving.
2. Open the saved application through the sidebar. Reorder a draft event and verify numbering, then restore the fixture order. Complete review flags and finalize only the test trial.
3. Open Premium builder. Save fees/policies, reopen, inspect the preview and create a private review copy. A review copy does not open entries.
4. Open CARO approval record. Use fictional evidence only in the isolated test environment; verify the submission/decision is recorded separately from finalization. Do not record fictional approval against a real trial.
5. Open Activity journal. Review application actions, source references, staff identity and the trial timezone. Load older pages if the sample has sufficient history.
6. Once hosted test entries exist, open Payments and adjustments, choose the exact entry reference and record a fictional transaction. Verify one ledger record after retry, an audit record and distinct original receipt/recording clocks. No money moves through this screen.
7. In Administration, verify all-club access and grant/revoke a secretary assignment with a reason. Demonstrate ordinary-user denial using a separate account, without capturing private account details.

The local practice desk already supports entries, mixed waitlists, per-run withdrawal/promotion/check-in, results and working reports. Keep local screenshots clearly labeled until equivalent hosted paths pass their own tests. Include [backup and recovery](../backup-recovery.md) in the local appendix.

Prepared hosted intake chapters now include Entry pricing and capacity, Paper / email entry, and Entries and waitlist. After applying/deploying the queued changes in an isolated test environment, record an approved fictional trial's signed form, verify its saved quote and source agreement, review each run, accept/waitlist separately and open Payments and adjustments from that exact entry. Verify one charge per acceptance and unchanged charges after withdrawal. The hosted lookup currently opens official CARO Quick Results; automatic inline lookup remains local. Public online intake is still closed.

The local Premium studio also has Download PDF, independently of browser printing. Its four-page normal sample and six-page long-content test were rendered and checked at 12pt body size, including natural section/paragraph breaks. Use this as the PDF chapter's local example; verify the browser control before taking its screenshot.

## Test coverage to add with each chapter

Use fictional entrants and explicit test identifiers; do not reuse CARO 1334 as a fictional entrant because it is a real lookup example. Cover duplicate submission, acceptance/waitlist, withdrawal, fee adjustments, move-ups and corrected results when those hosted commands are available. Keep actual payments and external submissions out of the practice workflow. Resetting or deleting saved practice data requires a separate decision; preserve the fixture as the reproducible baseline.
