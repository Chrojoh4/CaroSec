# Local secretary operations and cloud handoff

Verified October 18, 2026. All code, records and generated files are under `E:\CARO`.

## Start and prepare

Run `npm run dev` in this folder with Node 22 or newer. Open `http://localhost:4318`. Python with ReportLab is required for entry PDF generation; the bundled runtime is detected or set `CARO_PYTHON` to its executable. No npm packages need installation.

Complete the trial application, record external approval, review the premium and save a matching edition. Secretary desk → Entry setup pins the offered events, agreement, pricing and capacity into an entry configuration. Fictional samples can exercise the entire local workflow without asserting CARO approval. Changed configuration creates a new snapshot; existing entries retain their original fees and agreement reference. Do not publish multiple snapshots as one live trial without reconciling them.

The premium and desk provide an online-style entry link and a separate fillable/printable PDF. The PDF includes email-return instructions and does not send itself. Local URLs work only on this computer. The sample agreement is a clearly marked placeholder and must be replaced and reviewed for an actual trial.

## Intake through trial day

- Entrants provide handler/dog details and offered selections. CARO IDs remain strings so leading zeros survive. Optional public results lookup is informational; outages or absent history do not block manual entry. Results do not supply a verified dog identity or career title.
- Submit creates a pending entry and receipt. Acceptance or waitlisting is a staff decision. Capacity is enforced on acceptance. Repeated requests and duplicate dog/event combinations are checked.
- Paper/email intake uses the same selections and fee validation, with staff-recorded signed-entry evidence. There is no email sending or attachment repository yet.
- Acceptance posts one fee charge. Record actual payments, refunds, approved waivers and expenses as bookkeeping. The program takes no payment. Withdrawal retains the ledger; scored performances retain their history.
- Ringside running orders retain official round numbers. Save judge-provided outcomes, scores and time, with confirmation. Corrections append revisions and require reasons. Completing a Trial Record requires sign-off evidence and locks results/order. Empty events can close with evidence that no dogs ran.
- Move-ups require explicit prerequisite review and evidence, apply only before judging, and retain original selections and fee adjustments. Working level changes preserve selected exercises.
- Accommodation decisions record the assigned judge's decision and whether staff informed the entrant. Incidents and these decisions stay in private staff records. Optional ribbon requests are handler declarations, never app-awarded titles.

## Reports and official paperwork

Download working HTML reports or CSV for the catalogue, running orders, results and finances. Catalogue deduplicates CARO IDs across entries and days, retaining owner information. Judge working records include revision provenance. CSV neutralizes spreadsheet formula prefixes.

Use the current official CARO forms linked from Reports for submission. Local reports are not certified substitutes. Track paperwork sent date, Data Entry confirmation and incidents. Records are due 14 days after the final day; payment is due seven days after Data Entry confirmation. Retain records at least six months under the longer current FAQ guidance. See research.md for the official sources and older-document discrepancies. No paperwork or payment is automatically submitted.

## Storage, backup and recovery

Planning data and premium editions use this browser's local storage. **Backup project** downloads that unit; its existing restore action restores planning only. Operational data uses `data/records.json`; **Backup all local records** downloads the separate operational unit. Keep both in a private backed-up location. Records may contain contact and accommodation information.

For local operational recovery, stop the server, preserve the current `data/records.json` under a different filename, then replace it with a trusted matching-schema records backup and restart. Do not edit a running file or combine independent backups manually. There is no in-app operational restore yet. An unrecognized schema causes an error rather than overwriting the original file. Writes serialize through one server process with expected revisions and atomic file replacement; this is not a distributed database.

Use `CARO_PORT` for an alternate port and `CARO_RECORDS_FILE` for an isolated test file within this project. QA used `tmp/qa-records-20261018.json`; its entries and payment references are fictional. It does not populate the default records file.

## Verified and remaining

40 automated tests pass across application locking, entries, concurrency, finance, Working/Rally recording, move-ups and reports. Browser verification exercised entry submission, acceptance, payment bookkeeping, result recording and signed-record lock. The entry sample PDF has seven rendered pages and 44 canonical fields with matching widgets and appearance streams. Sections start naturally and fields remain on their pages. The premium sample and long premium were also visually checked.

The next infrastructure work requires the user's Supabase and Vercel projects. The current server binds only to loopback and has no staff authentication. Do not expose it publicly. Before hosted use, implement Supabase Auth, club/trial membership policies, RLS, transactional capacity/idempotency/ledger constraints, protected storage, backups and restore rehearsal, hosted intake abuse controls, and isolated Vercel preview/production configuration. Replace local filesystem PDF storage with suitable generation/object storage. Keep secrets in environment settings, never in source or chat.

Exact official submission export mapping, authorized email delivery, payment services and virtual video workflows remain additional features. Historical tracking is optional. None prevents local secretary workflow testing; none is represented as a deployed production service.

Readability update: screen text/controls have a 16px minimum; printed body and input values use 12pt, with darker supporting text. The premium sample now has four pages and the entry form seven. Natural section breaks take precedence over page count. These current figures supersede the earlier smaller-print samples.
