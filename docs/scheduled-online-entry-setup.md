# Scheduled online entries

The published HTML premium always links to the paper/email PDF and online entry page. The online page counts down to the opening date at midnight in the trial timezone. It accepts new submissions through the entire closing date and shows a closed notice afterward. Server-side checks remain authoritative; changing the browser clock cannot allow an early/late submission. Paper form downloads remain available while the public listing is live.

## Deployment steps

1. In the CARO Supabase project rootupwvjwfterxhfwqx, run the SQL-only file supabase/updates/enable-scheduled-online-entries.sql after the existing public/online intake migrations. It is safe to rerun. It enables both methods for existing live, approved real trials and for subsequent publication. It does not change approval, prices, agreement snapshots, entry status or RLS.
2. In Vercel project carosec, Settings > Environment Variables, configure SUPABASE_SECRET_KEY for Production (and Preview only if that environment should use the same project). Obtain the server secret directly from the CARO Supabase API settings. Never paste it into chat, GitHub, or any variable with a public prefix. SUPABASE_URL may explicitly be https://rootupwvjwfterxhfwqx.supabase.co. Redeploy after changing variables.
3. Open the published premium signed out. Verify both links, the full round list, prices and waiver, opening countdown and paper PDF. Verify a real authorized test submission/receipt within the open window before inviting entrants. Do not fabricate CARO approval or use a practice trial for public intake.

The agent could not apply this update: the connected Supabase account does not expose CARO and no Vercel management connection was available. Local PostgreSQL regression tests validate the update, approval checks and anonymous access restrictions. Live credentials and end-to-end submission remain unverified until the deployment steps above are completed.
