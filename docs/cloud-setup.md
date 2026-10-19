# Cloud connection setup

User-supplied destinations, October 19, 2026:

- GitHub: https://github.com/Chrojoh4/CaroSec
- Supabase: https://rootupwvjwfterxhfwqx.supabase.co
- Supabase project reference: rootupwvjwfterxhfwqx
- Vercel: user reports GitHub is linked; deployment URL not supplied or independently verified.

The Supabase URL is recorded in .env.example. This is configuration preparation, not a working database connection. The current program still uses its local adapter. No credentials, schema changes, uploads or deployments were performed during this check.

## Remaining connection inputs

1. Supabase publishable key: supplied and saved with the project URL in ignored `.env.local`. Auth settings returned HTTP 200 using the supplied key on October 19, 2026. Repeat the read-only check with `npm run check:supabase`. This verifies the endpoint/key, not database permissions or the hosted app. The REST OpenAPI root required a secret key; no privileged key was requested to inspect it and no records were accessed.
2. The Vercel project/deployment URL, to set the correct login redirect origins and inspect build settings.
3. An authorized database migration path (Supabase SQL editor or authenticated migration tooling). Project URL and publishable key do not confer schema administration.

Any server secret must stay in private environment settings, never chat, source or browser bundles. Do not provision a privileged key unless the selected hosted architecture actually needs one.

The GitHub connector could read the repository metadata, which reported size zero and no push permission for this connection. E:\CARO is not currently a Git checkout. GitHub publication access and an initial source commit remain pending; linking an empty repository to Vercel does not upload the local program.

## Implementation before hosted use

Implement authenticated staff access, shared persistence and club/trial authorization with tested database policies, then replace local filesystem storage/API assumptions and Python PDF generation with supported hosted equivalents. The loopback-only unauthenticated prototype must not be deployed as the public backend. Follow the existing date/timestamp contract and 16px/12pt readability requirements.

Reference: https://supabase.com/docs/guides/getting-started/api-keys
