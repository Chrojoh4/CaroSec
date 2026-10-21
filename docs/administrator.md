# System Administrator

Required by the user October 20, 2026. This is a system-wide role, distinct from a club owner. A local implementation is now prepared in `supabase/migrations/20261020171448_system_administrator.sql` and `hosted/administration.js`. It is not deployed and no account has been promoted.

## Implementation status

Implemented locally: private Administrator assignments; cross-club read policies on all 12 public tables; Administrator draft creation/editing using the existing validated command; staff directory; audited club membership changes with last-owner protection; recent administration audit; sidebar links for Clubs, Trials and Administration. The Administrator link and data are cleared on sign-out, and all admin RPCs check the current database assignment. Missing admin migration hides the admin area while normal club access continues.

The first Administrator grant remains a separate manual, confirmed database operation against an identified account. Browser promotion/revocation RPCs, trial assignment editing, application settings, reference/rule management, template management, archives and backup controls remain planned. Existing draft/financial/finalized guards are retained. Revocation does not erase data already downloaded into a browser, so the user should sign out/close staff sessions when ending access.

Verification: all 65 tests pass and npm run build succeeds. The Administrator test executes migrations in embedded PostgreSQL and verifies cross-club access, forbidden self-promotion, anonymous/forged claims, immediate role-check revocation, last-owner/last-administrator guards, finalized locks and audited membership changes. Browser rendering, live database verification and deployment remain pending because local browser use is disabled in Work settings. No changes were made in the Secretary Trial Management folder.

## Access

An active system Administrator can find and open every club and trial, including drafts, finalized trials and completed trials. The trial selector supports all clubs and filters for date, status and test trials. The current club and trial remain visible throughout navigation. Normal club owners retain access only to their own clubs; secretaries remain scoped to assigned trials.

The sidebar includes an Administration area visible only to system Administrators. Hiding a menu is not authorization: every administration page, database read, command and export must independently verify the signed-in user and active administrator assignment.

## Administration area

- All clubs and trials dashboard, including clearly labeled sample trials.
- Staff directory, club membership and trial assignment management.
- Administrator grants and revocations through a separate protected workflow.
- Application settings, reviewed CARO reference/rule versions and premium templates.
- Audit history, access changes, failed commands and support diagnostics without credentials.
- Test-data management, archive/restore workflows and private backup/export controls.

Administrative access permits normal authorized trial operations across clubs. It does not bypass finalization locks, signed results, immutable financial history, recorded CARO approval or expected-revision checks. Corrections require the corresponding amendment/reversal workflow and a reason. Never implement an unrestricted database editor or a silent unlock button.

## Permission storage and bootstrap

Use a dedicated private system-administrator table keyed by auth.users.id, with active state, grantor, grant/revoke timestamps and reason. Do not store system administration in club memberships, browser storage, user-editable metadata or an email comparison. Email may help locate an account during setup; authorization uses the immutable authenticated user ID.

The browser cannot insert or update this table. A private authorization helper derives the caller from auth.uid(), rejects anonymous sessions and checks the current active assignment on every request. Exposed wrappers remain SECURITY INVOKER. Any privileged internal command must explicitly authorize its caller, use an empty search_path and narrowly granted execution privileges. Extend existing RLS read predicates and write-command checks deliberately; do not turn RLS off or send service keys to the browser.

Bootstrap the first Administrator only after the user identifies the intended confirmed staff account. Do not automatically promote the first signup, first club owner, every RallyPaws member or a development sample account. Administrator assignment is a separate security-sensitive action requiring confirmation. Prevent revocation of the last active Administrator without a documented recovery process. Preserve append-only audit of grants, revocations and administrative mutations, including acting user, target club/trial, reason and UTC time. Administrator status must be revocable without waiting for a stale role claim to expire.

## Verification before release

1. An active Administrator can read trials in two unrelated clubs and use approved commands on either.
2. A normal owner cannot access another club or administration endpoints, including by direct URL/RPC.
3. An assigned secretary cannot change memberships or grant administrator status.
4. Anonymous, revoked and forged-metadata sessions cannot access administration.
5. Finalized-event, completed-result and financial-history locks still reject Administrator overwrites.
6. Grants and revocations are audited; last-administrator protection is tested under concurrent changes.
7. Administrative exports remain private; public listings expose only approved published columns.

Add a manual chapter using the same fictional practice trial after these screens and permissions are implemented and verified. No screenshot should present this planned area as already available.
