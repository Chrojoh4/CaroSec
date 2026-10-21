# Prepared public premiums and online entries

October 20, 2026: source implementation and local PostgreSQL/domain checks only. Nothing in this document means the live site or database was updated.

Staff review `caro_publication_preview`, then publish the exact review token with a retry reference. Public editions are immutable and distinct from private review copies and manual-intake editions. The public page is `/public-trial.html?trial=chosen-slug`; its paper/email form is `/api/entry-form?trial=chosen-slug`. Closing a listing hides both anonymous projections. Real CARO approval is required. Explicit practice trials cannot be published.

Before any entries, a new edition can use updated saved setup. After entries arrive, publication and subsequent intake use the original frozen terms. Paper/email intake shares the public edition when one exists. Private draft edits cannot replace the agreement or event prices already received. Legacy entries without canonical terms block publication pending review.

The public page prints at 12pt with repeated table headings and protected row breaks. The interactive paper PDF uses 12pt body and field values; only decorative folios are smaller. Partner fields appear only when Team or Brace is offered. Policies and signature blocks stay together where possible. The single-round form and seven-page RallyPaws practice form were rendered and visually inspected locally; browser printing remains unverified.

## Online server boundary

The source includes `/api/online-entry` and `/api/entry-receipt`, plus the public form and private receipt view. Publishing currently rejects `online_enabled=true`; this gate is intentional until deployment acceptance passes.

`SUPABASE_SECRET_KEY` is a **server-only Vercel environment variable**. It is not the publishable key, must not have a public prefix, and must never be pasted into chat or committed. Configure it directly in Vercel when enabling the server integration. The existing project URL is read from browser-safe configuration unless `SUPABASE_URL` is set. Without the server secret the endpoints return 503 and do not construct a database client. No staff session or Authorization header is forwarded into the privileged client.

The Node boundary validates declarations, source selections and prices using the existing entry domain. The database independently repeats shared participant/event validation, recalculates prices, locks the trial/events, checks current approval/publication/window, detects overlapping dogs, and inserts one submitted entry with no charge, acceptance, payment or email. Public and authenticated browser roles cannot invoke server commit, quota or receipt functions.

Submission retries use a stable input hash and random request reference. The client generates a separate 256-bit receipt secret; the database stores its SHA-256 hash. The receipt secret appears in the URL fragment and POST body, never a query string. A matching retry can recover its receipt after the entry window closes. Changed content or receipt secrets conflict rather than producing a second submission. Receipts expose only that entry's status, runs, quote and frozen agreement/policies, including after a public listing closes.

Vercel requests use its client-IP header, validated as an IP address and HMAC-hashed before the quota RPC. Local handler tests use a loopback bucket and ignore arbitrary forwarded headers. Separate per-minute entry/receipt limits run before intake. Raw IPs and queried receipt secrets are not stored or logged by these handlers. Provider logging/configuration still requires live review.

## Required acceptance before enabling

1. Apply/reconcile the prepared migrations and deploy matching assets/functions in a test environment. Verify server-only key configuration and bundle isolation.
2. Create a separately identified real-workflow test trial with authorized approval evidence; practice trials remain barred from publication. Do not invent a real CARO approval for a practice trial.
3. Verify receipt recovery, forged prices, duplicate dogs, Team/Brace handlers, Working selections, closed windows at venue midnight, changed editions, completed events and simultaneous submissions against actual Supabase.
4. Verify request quotas, function failures, secret-free browser bundles, private receipts and publication/approval withdrawal behavior. Inspect actual PDF and mobile/desktop browser output.
5. Review and remove the publishing gate through a deliberate source change only after those checks pass. The current publisher always sends `p_online:false`.

Automatic emails, payment collection, registry identity confirmation and title tracking are separate integrations.
