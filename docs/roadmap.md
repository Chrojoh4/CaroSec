# Delivery roadmap

## 1. Architecture foundation — delivered

Research register, logical model, access design, domain vocabulary, finalization and scheduling invariants, application/repository separation, and local behavioral checks. Run `npm test` and `npm run demo` without cloud services.

## 2. Rule verification and local web shell — partially delivered

Delivered locally: five-step application wizard, shared trial record feeding the premium, multi-day dates/events, draft numbering, domain-backed finalization locks, separate external sanction status and readable application summary export. Staff attestations gate local finalization; automated class/stream and judge authorization verification remain pending.

First-release scope is standalone trial-secretary operation. Historical results, title tracking and registry synchronization are not launch dependencies. Capture entrant declarations and distinguish reviewed declarations from externally verified eligibility.

Core scope includes a trial application wizard and premium builder, sharing trial/event data. Implement draft/review/finalization and externally recorded approval, then a versioned web/PDF premium with reusable club templates and stale-content detection. See application-premium-lookup.md and download-review.md. All public premium publication requires recorded CARO approval and an assigned trial number.

Use the user-supplied official documents catalogued in download-review.md to resolve applicable R1–R5 requirements in research.md (R4 is optional tracking scope). Obtain remaining current blank forms and reconcile rules before activating qualification or eligibility decisions. Select supported framework versions from official docs at implementation time. Build the secretary navigation, trial list and draft application editor with fictional fixtures and the existing core.

Acceptance: all six Rally levels visible; Working is separate; unsupported class combinations unavailable; draft event reordering renumbers application events; finalized events retain identities while schedules reorder. The interface clearly labels fictional local data and provisional rules.

## 3. Persistent accounts and club isolation

When the user creates Supabase: add versioned migrations, Supabase Auth, repository adapter, RLS, private file storage and seed only reviewed reference data. User supplies configuration through secret settings. No C-WAGS database connection is needed.

Acceptance: two-club access tests pass through actual database policies; assigned trial permissions work; concurrent edits return conflicts; audit and state persist atomically; backup/restore rehearsal succeeds. Test and production environments are separate.

## 4. Entries and finances

Public trial projection and scoped intake, handler/dog records, participant groups, Working selections, capacity/waitlists, fee snapshots, manual payment/refund ledger, move-ups and confirmations. Outbound email requires explicit setup; no payment gateway assumed.

Add dog-ID entry assistance: inspect CARO Quick Results using an appropriate example ID, verify the actual supported request and returned fields, and implement an adapter if reuse is supported. Until then, provide the official lookup link and manual declarations. Lookup outages or absent history must not block entry. Premium version and checkout fees remain synchronized.

Acceptance: duplicate/retried submissions do not double charge or double accept; concurrent final spaces cannot oversubscribe; withdrawals and move-ups preserve history; balances reconcile in cents; private contacts and accommodations never leak publicly.

The premium must offer both an online entry link and a separate downloadable fillable/printable entry PDF with email-return instructions. Provide manual intake for emailed/paper entries using the same event, capacity, fee and payment records, including duplicate review and intake-channel provenance. This separate form is not yet implemented.

## 5. Trial-day operations

Running order, conflict detection, score entry, verified rule validation, review/sign-off, correction revisions, printable sheets and result packages matching verified official templates. Title progress is optional future scope, only if requested and once R4 and historical provenance are resolved.

Acceptance: Rally and Working are tested independently; Team/Brace participants remain attached to one performance; exercise move-ups retain individual history; disconnected saves never display as successful; stale edits cannot overwrite scores; corrections supersede affected export snapshots. Sample exports are reviewed against the actual CARO template.

## 6. Virtual workflows and hosting

Virtual availability windows, private submission references, exercise-specific move-ups, review queues and combined historical tracking. When the user creates Vercel, configure environment scopes, preview isolation, health monitoring and rollback.

Acceptance: trial-local deadlines convert correctly across timezones; private submissions use access-controlled storage; preview cannot send real notifications or modify production; smoke checks and restoration steps are documented. CARO submission remains human-reviewed until an authorized integration exists.

## Implementation status - October 18, 2026

The local operations slice now implements the intake/finance and trial-day workflows above: public-style entry/receipt, optional live dog-ID lookup, fillable email/print PDF, paper/email intake with evidence, immutable fee snapshots, capacity/waitlist decisions, check-in, payments/refunds/waivers, expenses, running orders, manual judge results and correction history, completed-record locks, reviewed move-ups, accommodation decisions, incident notes and paperwork deadlines. This supersedes earlier statements that the separate entry form and lookup are not implemented. Catalogue deduplicates dogs across days. Reports are working HTML/CSV, not certified CARO submission exports.

40 domain/repository tests pass; the isolated local browser scenario covered entry submission, acceptance, payment bookkeeping, scoring and completed-record lock. The sample entry PDF has four pages and 44 canonical fields/widgets with appearance streams; all pages rendered and visually reviewed.

Next required infrastructure: user-created Supabase and Vercel. Add Auth, club/trial membership and RLS, database transactions, protected agreements/attachments, hosted intake safeguards, preview isolation and deployment checks. Exact official export mapping, external email/payment services and virtual video workflows remain separate work; none is implied by a local test.
