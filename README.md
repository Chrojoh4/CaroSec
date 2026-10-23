# CARO Trial Management

October 20 local development: `npm run dev:practice` opens the isolated fictional RallyPaws workspace at http://localhost:4322/ with separate records. `npm run sample:trial` creates disposable test reports. See [local progress](docs/local-progress-2026-10-20.md) and [deployment queue](docs/deployment-queue.md) for the distinction between live features and prepared local changes.

`npm run rehearse:trial` runs the complete fictional trial-day and reconciliation scenario; see [rehearsal instructions](docs/trial-rehearsal.md).

See [beta readiness](docs/beta-readiness.md) for the remaining hosted acceptance gates and [backup recovery](docs/backup-recovery.md) for recovery to a separate local file. Current local database and domain suite: 126 passing tests. No live deployment is implied by the source build.

Prepared hosted additions now include a trial overview, private practice mode, approved public premium/paper-form publication, filtered activity journal and server-only online-entry/receipt source. Online publication stays gated until live acceptance. See [public entry architecture](docs/hosted-public-entry.md).

Hosted staff foundation: `npm ci` then `npm run build` produces staff sign-in, account registration, club setup and RLS-filtered trial lists for Vercel. The browser-safe configuration lives in `hosted/public-config.json`; no secret key is bundled. Set Supabase Auth Site URL to `https://carosec.vercel.app` and allow `https://carosec.vercel.app/` as a redirect. See `docs/hosted-foundation.md` for verified scope and remaining hosted work. The local secretary and PDF tools below continue separately.

Independent secretary software for the Canadian Association of Rally Obedience, inspired by the workflows of the existing C-WAGS system. All new work lives in `E:\CARO`.

This project includes a local trial application wizard, premium builder, online-style entry form, fillable entry PDF and secretary desk. No Supabase or Vercel account is needed for local testing. Shared public entry processing and secure staff accounts require those services. No production or C-WAGS records are included.

## Trial application

Run `npm run dev` from `E:\CARO`, then open `http://localhost:4318`.

The application opens with five steps: Host & officials, Dates & venue, Events & judges, Review & finalize, and CARO approval. Consecutive dates, event-specific dates, separate Team/Brace events and Working offerings share one trial record. The local prototype supports up to 31 consecutive days and 150 events; these are software limits, not CARO rules.

Draft edits automatically feed the premium. Finalization uses the domain snapshot and locks the trial's people, dates, venue, event definitions, official round numbers and judges. Record completed CARO submission/approval separately; no external submission or payment occurs. A readable HTML preparation summary can be downloaded for review/manual transfer. The exact official form compatibility is not claimed.

Class/stream combinations, judge authorizations and host professional membership require explicit staff review, not automated registry verification. Supplied handbook guidance sets the displayed lead-time dates. Virtual applications and amendments to finalized applications are not implemented. Keep a backup before finalizing.

Older premium-only browser projects and backups are migrated to draft trial records while retaining saved editions. Previously declared approval must be recorded again through the application workflow. Invalid saved data is preserved rather than silently overwritten.

## Premium studio

Run `npm run dev` from `E:\CARO`, then open `http://localhost:4318`.

- Trial details, events and judges come from the application. Edit fees, entry windows, policies and the host agreement in the studio with a live preview.
- Choose forest, ocean or berry palettes; reuse a saved club template.
- Browser-local draft saving, JSON backup/restore and immutable reviewed editions.
- Export a standalone HTML premium, or use **Print / PDF** and select **Save as PDF** in your browser. Turn on background graphics for the full colour design; disable browser headers/footers. Sample and long-content PDFs have been rendered and visually checked. Preview substantially different content or print settings again. The checked large-print sample is in `output/pdf/sample-premium.pdf`.
- A review checklist blocks approved editions without CARO approval, trial number, approval evidence, reviewed agreement and completed secretary review. Fictional samples remain drafts.

This is a single-trial local development prototype. Browser storage is not shared or backed up automatically; use **Backup project**. Edition saving does not publish online or submit to CARO. The application wizard now uses the domain finalization lock; the premium cannot edit its source event list or sanction status. This is local browser storage, not authenticated multiuser persistence.

## Read first

- [Research and verification gaps](docs/research.md)
- [Architecture and decisions](docs/architecture.md)
- [Relational data model](database/model.md)
- [Delivery plan and acceptance criteria](docs/roadmap.md)
- [Trial application, premium builder and dog-ID lookup](docs/application-premium-lookup.md)
- [Review of the supplied CARO downloads](docs/download-review.md)

## Run locally

From `E:\CARO`, with Node.js 22 or newer:

```powershell
npm test
npm run demo
```

No installation is required. The demo creates a fictional trial in memory, finalizes its application, changes its running order, and rejects a change to its locked judge assignment. Nothing is persisted.

## Structure

```text
src/domain/           CARO concepts and application lock invariants
src/application/      Authorized use cases and optimistic concurrency
src/ports/            Persistence contract
src/adapters/memory/  Disposable local repository
tests/                Behavioral checks
docs/                 Research, design, phased delivery
database/             Future PostgreSQL model; no deployed migrations
```

The proposed web layer is Next.js with TypeScript, using Supabase Auth/PostgreSQL and Vercel when the user creates those projects. The current dependency-free JavaScript modules provide a framework-independent starting point. Framework versions and adapter details will be selected and checked against official documentation when implementation begins.

The baseline product is a standalone trial secretary. It must operate without trial history, registry integration or title tracking. Local entry intake, manual payment bookkeeping and judge-provided result recording are implemented. Hosted public intake, actual payment processing and verified official submission exports remain future work. The user supplied the handbooks, amendments and supporting PDFs after initial web retrieval failed; these are inventoried and partially reviewed in docs/download-review.md. Detailed rule reconciliation remains necessary before official computation. CARO's existing registry remains the authoritative source of dog IDs, recorded results and titles. An optional read-only adapter uses the public Quick Results endpoints observed on October 18, 2026, with manual fallback; no supported integration contract is assumed. Historical imports and title progress are optional future features, not launch requirements.

## Secretary desk and entry forms

See [local operations and cloud handoff](docs/local-operations.md) for the workflow, storage, backups, verification and deployment boundary. The desk handles online-style and emailed/paper intake, acceptance/waitlists, check-in, cent-based fee ledgers, manual payment/refund records, running orders, Rally/Working judge results, correction history, signed-record locks, move-ups, accommodations and post-trial paperwork tracking. There is no outbound email or payment gateway.

Prepared entry forms have both an online link and a downloadable fillable/printable PDF with email-return instructions. The seven-page large-print sample has 44 interactive fields and has been rendered and visually checked. The form generator requires Python with ReportLab; it uses the bundled runtime by default or `CARO_PYTHON`.

Project planning stays in browser storage; operational records persist atomically in `data/records.json`. These are separate stores with separate backup buttons. This server binds only to loopback and has no login: do not expose it publicly. Supabase Auth, club policies and durable hosted transactions must replace the local adapter before Vercel launch.

## Hosted build safety

`npm run build` produces the hosted staff login and club workspace. Vercel uses `vercel.json` with the `public` output directory; it does not run the local secretary server or publish its APIs. GitHub Pages can use the root holding page. Hosted trial editing and entry processing remain in development. Keep Vercel Root Directory at the repository root. Source code in GitHub does not imply online entries are ready.

Downloaded CARO reference documents, generated previews, local records and actual environment files are intentionally excluded from source upload. Python/ReportLab is required only for local PDF generation.

## Hosted foundation preparation

The user applied the foundation SQL and confirmed RLS on all 12 tables; see [hosted-foundation.md](docs/hosted-foundation.md) for access status and boundaries. The database policy tests use disposable embedded PostgreSQL. Run `npm ci` before `npm test` to install the pinned dependencies. This supersedes earlier no-install instructions for the dependency-free local version. The hosted staff screen is separate from the local application/secretary desk.

Official application transfer helper: the trial editor exports reviewed details for CARO’s real online form. See hosted/caro-helper/README.md. First-page fields are mapped; automatic event/judge selection and complete browser verification remain pending.

Judge replacement amendments and deployment requirements: [judge replacements](docs/judge-replacements.md).
