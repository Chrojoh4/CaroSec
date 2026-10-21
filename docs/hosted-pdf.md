# Prepared hosted judge PDF endpoint

The new endpoint is source-only until deployment. It uses the file-based Python handler format documented in [Vercel's Python /api reference](https://vercel.com/docs/functions/runtimes/python/api-directory), alongside the existing static JavaScript frontend. Dependencies and bundle exclusions follow the [Python runtime reference](https://vercel.com/docs/functions/runtimes/python). Verified October 20, 2026. No new service/project is provisioned.

## Request and authorization

Trial day posts an event UUID, current review token and print range to /api/judge-sheets. The staff access token goes only in the Authorization header. It is not put in URLs, PDF metadata, logs or local records. A token's shape does not grant access: the function delegates it to Supabase's protected caro_event_desk RPC, where the verified caller must currently be a club owner, assigned secretary or system Administrator. Anonymous, expired and unauthorized requests fail closed.

The server uses the browser-safe publishable key and project URL from the existing public config, or matching explicit environment configuration. No Supabase secret/service key is required. RPC requests target the configured HTTPS Supabase project; redirects are rejected. Database errors are returned as short service messages without internal SQL or credentials.

The PDF uses a minimal allowlist: trial/event identity, judge, current run order, handler/dog IDs/names, jump information and selected Working exercises. Contact addresses, emails, receipt tokens and financial records are not projected. The review token prevents printing from a stale event screen. An empty round produces an explicit verification sheet. Completed events print a working-reprint warning. A request prints up to 100 runs, preserving absolute running-order numbers; choose further ranges for larger events.

## Rendering and runtime

The same ReportLab generator serves local and prepared hosted sheets. Body/form values are 12pt; decorative footer text is 10pt. Comments/signatures and entrant blocks use natural breaks. These are working sheets, not a claim of exact official CARO-form compatibility.

The function writes only temporary PDFs and removes them after reading. Local checks place all temporary files under CARO/tmp. requirements.txt pins the tested ReportLab runtime; .python-version selects Python 3.12. Private local records, references, environment files and caches are excluded from upload/function bundles. The public static output remains limited to four browser assets. CSP now allows same-origin fetches for this protected endpoint.

## Development checks and deployment acceptance

The Node suite includes seven Python authorization/projection/PDF checks. The bundled workspace Python already has the dependencies. On a separate development machine, create a virtual environment inside CARO and install requirements-dev.txt, then point CARO_PYTHON to that environment's executable before running npm test. Do not install development PDF inspection packages into the production function requirements.

Local checks cover missing/denied authorization, malformed/range limits, stale review, private-field stripping, selected Working exercises, completed reprints and empty rounds. The generator's ordinary/stress layouts have been rendered locally. After applying the trial-day migration and deploying, verify the actual protected API with two clubs, revoked staff access, a real signed-in test session and a deployed print download. Browser/serverless runtime checks are pending; local build success does not confirm the function deployed.
