# Optional hosted CARO-ID assistance

Prepared only; not deployed. The paper/email entry form can call /api/dog-results with its trial and the ID exactly as typed. The proxy accepts numeric IDs for the observed public CARO API. Other entry IDs remain valid for manual intake; an optional lookup failure does not alter them or block submission.

The caller JWT is delegated to a trial-authorized Supabase allowance RPC. Owners, assigned secretaries and system Administrators can request assistance. A private counter permits 20 requests per authenticated user per UTC minute, including cache reads. On the next authorized request it removes counter buckets older than one day. It stores no queried dog IDs or result history. Direct quota-table access is denied. This avoids relying on per-instance counters for authorization or limits.

The proxy sends only the dog ID to the observed public Rally/Working endpoints, in parallel. It does not forward Supabase tokens or trial details to CARO. Returned fields are allowlisted/bounded, cached in memory for ten minutes when both disciplines respond successfully, and labeled with retrieval time and unknown source-as-of time. Outages and schema failures are not cached or interpreted as a confirmed absence of results. No dog identity, owner, title or eligibility is inferred or automatically filled from results.

Five Python contract checks run in the Node test suite, covering authorization/allowance, numeric ID preservation, source schemas, privacy, caching and outages. Database checks prove the authorized per-user allowance stops after 20 requests in a fixed minute. These are local checks; deployed function and CARO availability still require verification.

## Current source limitation

October 20, 2026: the direct read-only HTTP check for the user-supplied example 1334 returned HTTP 403 for both observed public endpoints in this environment. No result count or absence was inferred. The earlier October 18 browser observation of nine legacy Rally records remains a historical observation, not a guarantee of current server access. The current adapter reports unavailable and preserves the [official Quick Results fallback](https://canadianrallyo.ca/quick-results/). Confirm CARO's supported integration/access before relying on server-side lookup in production. No registry data is written and 1334 is never a fictional entrant.
