# Beta readiness — October 20, 2026

The program is ready for continued local practice testing. It is not yet a hosted end-to-end beta. No percentage or date is reliable until the hosted intake and trial-day paths are exercised together.

## Implemented locally

- Application wizard, finalization locks, premium builder and separate online/paper entry presentation.
- Fictional RallyPaws practice scenario; isolated persistent records.
- Manual and online-style intake, receipt provenance and optional CARO lookup assistance.
- Per-run acceptance, waitlist promotion, withdrawal and check-in.
- Append-only payment/refund/waiver history, expenses and reconciliation.
- Running orders, manually transcribed judge results, correction revisions and completed-event locks.
- Judge working PDFs, official source-form links, working reports and activity journal.
- Backup validation and recovery to a new file.

## Prepared hosted changes, not deployed

Sidebar/context; Administrator controls; application finalization and CARO evidence; private premiums; public premium/paper-form publication; explicit private practice mode; trial overview; entry pricing; paper/email intake; per-run decisions; payments/expenses; running orders; judge results/corrections/sign-off; protected judge PDF; reconciliation/CSV/working reports; paperwork dates and incident/no-incidents review; and filtered private journal. Database commands have been executed against a disposable local PostgreSQL-compatible instance. The full Supabase deployment, browser UI and serverless behavior still require verification.

## Gates before a small hosted beta

1. Reconcile and apply the queued database migrations, deploy the matching UI and verify existing accounts/RallyPaws trials survive.
2. Explicitly identify the first Administrator account and verify all-club access plus ordinary staff denial. Revoke a secretary assignment and verify access disappears.
3. Deploy and verify the prepared public premium, paper form and online form/server/receipt code; configure its server-only credential and review the online-publication gate. Test duplicate submission and simultaneous last-space acceptance against the actual database.
4. Deploy and browser-test the prepared staff workflow from manual intake through sign-off/reconciliation and the protected judge PDF endpoint. Verify caller identity, idempotency, stale review rejection and permission revocation against the actual services.
5. Verify paper/email entry PDF and premium PDF against actual browser output, at readable sizes and natural page breaks. Recheck current official CARO export mappings before describing reports as submission-ready.
6. Exercise the entire fictional weekend in a separate hosted test environment: intake through post-trial reconciliation, corrections, receipts, access revocation and recovery. Do not mix real payments with test records.
7. Capture verified screenshots and complete the manual. Browser access is currently unavailable to the agent, so no screenshots are invented or presented as verified.

Historical tracking, automatic title awards, a payment gateway and automatic email delivery are not prerequisites for the first secretary beta. Entry links and downloadable email/print forms are prerequisites. All public intake must remain closed until its hosted path is complete and tested.
