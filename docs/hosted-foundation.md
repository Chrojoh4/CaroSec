# Hosted database and authentication foundation

For the current October 20 local implementation and unapplied migration order, read deployment-queue.md. The historical status below describes earlier deployment stages; it is not a claim that new local features have been deployed.

Updated October 19, 2026. The user reports applying the foundation SQL manually and supplied query output confirming RLS on all 12 tables. A live anonymous API smoke test confirms private-table access is denied and the public listing is readable with no published trials. The management connector still lacks CARO access. Historical preparation notes below describe earlier stages.

## First hosted staff screen

`hosted/` implements email/password sign-in, account creation, email confirmation callback, sign-out, club creation through `caro_create_club`, and RLS-filtered club/trial lists. Session storage is tab-scoped. The browser uses the official pinned Supabase client; no server secret is needed for this slice. User-supplied text is rendered with textContent. No staff role or membership can be set from the form. Closing a tab clears its stored session; sign-out clears displayed private rows.

`npm run build` bundles only this screen into three explicit public assets. `hosted/public-config.json` contains the already-public project URL/publishable key; optional Vercel public environment overrides are validated. Local desk APIs, records and environment files remain excluded. Root index.html remains the GitHub Pages holding page.

Before first account use, Supabase Authentication URL Configuration should use Site URL `https://carosec.vercel.app` and allow redirect URL `https://carosec.vercel.app/`. Keep email confirmation enabled. The user must enter their own account password; do not create credentials on their behalf. Hosted sign-in and club creation need a live user smoke test. Password recovery UI, staff invitations, hosted trial edits and public intake remain pending. The existing local planning/secretary program remains available separately.

Verification: 63 tests pass; production browser bundle builds; local and deployed sign-in pages visually inspected at 18px base type. The GitHub-linked Vercel deployment now serves staff sign-in at https://carosec.vercel.app/ (verified in browser). Live anonymous checks denied clubs, memberships, trials, entries, ledger, scores and audit access with HTTP401, while public listings returned HTTP200 with zero rows. These read-only checks did not create accounts, clubs or trial records. Live staff account/club workflow still requires the user to create and confirm their own account.

## Access confirmed

- The supplied project URL and publishable key are accepted by Supabase Auth.
- The authorized GitHub browser session can publish source; the separate GitHub connector is read-only.
- Supabase's management connection is installed and can list projects, but the CARO reference `rootupwvjwfterxhfwqx` is not in the authorized project list. Requests for that reference return a permission error. No other project's database was opened or changed.
- Vercel's management connection is not installed/connected as of this check. The user-created `https://carosec.vercel.app/` holding-page deployment was independently verified earlier.

Reconnect Supabase for the organization/account containing CARO and finish the Vercel connection before management changes. Do not change the global app permission mode to solve an account/project scope mismatch. No secret keys or database passwords belong in chat.

## Migration ready for review

`supabase/migrations/202610190001_caro_foundation.sql` creates only new `caro_*` tables and a `caro_private` helper schema. It is transactional and intentionally fails if these tables already exist rather than replacing data. Inspect target database metadata and existing migration history before applying it once through the migration tool. Do not run it against the older secretary project.

The foundation includes clubs, memberships, assigned trials, official events, frozen premium versions, dedicated public listing columns, private entries, append-only financial/result/audit history and signed-event locks. Public listings require approved finalized trials. Withdrawing approval hides listings. Authenticated clients have read-only access scoped by membership and assignment; all authoritative operational writes are reserved for forthcoming validated server commands. The sole client write RPC creates a new club and its caller ownership atomically. Additional memberships cannot be self-granted from the browser.

Scorer membership is reserved: this phase intentionally grants no private contacts or financial records to scorers. A later limited ringside projection must be implemented before enabling scorer UI. Server-side trusted access still needs explicit caller authorization, transactional expected revisions, audit insertion, capacity locking and retry/idempotency checks; these are not bypassed by merely having a server key. The application currently continues using its local adapter. The migration alone does not connect it.

Dates use DATE, actual events use timestamptz, and venue timezone values are validated against PostgreSQL's timezone list. No fixed offset conversions or real user/trial seeds are included. Career titles and historical tracking are not prerequisites and are not computed.

## Authentication adapter

`src/cloud/auth.js` uses the official Supabase JavaScript client. Server-side guards require a bearer token, verify it with Auth, reject anonymous/invalid users, and query trial permissions with the caller's JWT so RLS remains in force. No decoded JWT claim or submitted role is trusted for authorization. Each request has an isolated client with no shared session state. Browser client configuration takes explicit storage (use tab sessionStorage) and the PKCE client; actual login/callback screens and hosted command endpoints are still pending.

Only an explicit URL/publishable-key allowlist is exposed as public configuration. Server secrets never enter that object. The holding build does not bundle this adapter or publish any backend API.

## Testing

`npm ci` then `npm test` runs the normal domain suite plus embedded PostgreSQL and authentication tests. PGlite executes the migration against a disposable in-memory PostgreSQL instance with Supabase auth/role stubs; it does not contact or alter any hosted database. Tests cover club isolation, assigned-secretary access, denied role escalation and anonymous reads, forged cross-club references, publication gates, source locks, financial immutability and score sign-off. Authentication tests use stub clients, never credentials or network login.

These tests do not replace a live Supabase smoke test, advisor review and restore rehearsal after migration. Vercel secrets, login configuration and actual staff accounts also remain to be verified. Apply no production migration until CARO project access is established and the target is checked.

Official references:

- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/reference/javascript/auth-getuser
- https://supabase.com/docs/guides/auth/redirect-urls
- https://pglite.dev/docs/

## Connection follow-up

After Supabase installation was confirmed, both the management connector and the already-authenticated local CLI were checked again. Neither authorized project list includes rootupwvjwfterxhfwqx; a direct management request is denied. The CARO API URL/key check does not grant management access. The next required input is the account/organization owning CARO, or a reauthorization scoped to that project. No other project was queried or modified.

The Supabase skill security review moved the club bootstrap definer into caro_private behind a security-invoker public wrapper, added anonymous-session rejection, and pinned package versions with the lockfile. All 61 tests pass after the review. Current changelog changes relevant to this work were reviewed; no production migration or deployment was attempted.

## Organization mismatch identified in browser

The authorized Supabase browser session confirms that CARO rootupwvjwfterxhfwqx belongs to Chrojoh4's Org (organization tcmucrrcwrprpquhpfit), and the project is currently named Chrojoh4's Project. The management connector is authorized only for Chrojoh's (organization czhmgxjrxdhcesvsljaw). These are distinct organizations. Reauthorize the connection for Chrojoh4's Org; do not point the CARO app at the older secretary organization. The browser showed no existing migrations at inspection; no SQL was executed.

Authentication follow-up: user approved production URL configuration. Site URL changed from localhost to https://carosec.vercel.app; exact redirect https://carosec.vercel.app/ added through CARO dashboard. Staff account creation and signed-in club smoke test require the user to enter their own credentials.
