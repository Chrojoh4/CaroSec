# Cloud connection setup

User-supplied destinations, October 19, 2026:

- GitHub: https://github.com/Chrojoh4/CaroSec
- Supabase: https://rootupwvjwfterxhfwqx.supabase.co
- Supabase project reference: rootupwvjwfterxhfwqx
- Vercel: https://carosec.vercel.app/ - verified October 19, 2026; serves the static preparing-for-launch page.

The Supabase URL is recorded in .env.example. This is configuration preparation, not a working database connection. The current program still uses its local adapter. No credentials, schema changes, uploads or deployments were performed during this check.

## Remaining connection inputs

1. Supabase publishable key: supplied and saved with the project URL in ignored `.env.local`. Auth settings returned HTTP 200 using the supplied key on October 19, 2026. Repeat the read-only check with `npm run check:supabase`. This verifies the endpoint/key, not database permissions or the hosted app. The REST OpenAPI root required a secret key; no privileged key was requested to inspect it and no records were accessed.
2. Vercel deployment URL supplied and verified: https://carosec.vercel.app/. Use this exact HTTPS origin for production login configuration when implementing authentication.
3. An authorized database migration path (Supabase SQL editor or authenticated migration tooling). Project URL and publishable key do not confer schema administration.

Any server secret must stay in private environment settings, never chat, source or browser bundles. Do not provision a privileged key unless the selected hosted architecture actually needs one.

The GitHub connector remains read-only. The complete clean 49-file project was uploaded through the authorized signed-in browser on October 19, 2026 and every file hash matched the staged local package. Environment files, operational data, downloaded references and generated outputs were excluded. E:\CARO is not currently a Git checkout. The user created the Vercel project and the holding-page deployment is verified live.

## Implementation before hosted use

Implement authenticated staff access, shared persistence and club/trial authorization with tested database policies, then replace local filesystem storage/API assumptions and Python PDF generation with supported hosted equivalents. The loopback-only unauthenticated prototype must not be deployed as the public backend. Follow the existing date/timestamp contract and 16px/12pt readability requirements.

Reference: https://supabase.com/docs/guides/getting-started/api-keys

## Deployment verification

The Vercel home page returns HTTP 200 and displays the intended preparing-for-launch content. The local staff API, environment file and local backend source routes return HTTP 404. This is a verified holding-page deployment, not a live entry service or database-connected secretary. Remaining work is authenticated staff access, Supabase schema/policies and the hosted data/entry adapters. These notes were updated locally after deployment verification; GitHub documentation will be synchronized with the next source update.

## Hosted foundation progress

See hosted-foundation.md for the prepared database migration, official Supabase authentication adapter, local PostgreSQL policy tests and current access findings. The management connection can list projects but cannot see the CARO project reference; a correctly scoped Supabase connection and the Vercel connection are still needed. No live schema change or login deployment has occurred. All 61 unique tests pass; npm test now explicitly selects tests/*.test.js so staged upload copies under tmp are not counted twice.
