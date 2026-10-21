# Fictional full-weekend rehearsal

Run `npm run rehearse:trial` from E:\CARO. It uses the same RallyPaws fixture as the editable practice workspace but writes only disposable artifacts under output/trial-rehearsal. It never changes data/practice/records.json, ordinary records, Supabase or external accounts. No money is received/refunded and no application, email or paperwork is sent.

## Starting point

Four fictional entries span six events: Regular Rally on both days, Team, Brace and Working. Maple has a paid order with one previously withdrawn run. Cedar has an existing fictional judge result. Willow is accepted in one round and waitlisted in another. All IDs and contacts are test data.

## Rehearsal sequence

1. Withdraw Maple's unjudged Intermediate run and explicitly promote Willow into that released space.
2. Record an independent fee waiver for Maple's two withdrawn runs and a separate refund record. Charges remain visible. Refunds and waivers are not automatic consequences of withdrawal.
3. Record fictional payments to settle the other entries and one CAD 35.00 expense.
4. Check in remaining unjudged runs; preserve Cedar's existing result. Save each round's running order.
5. Transcribe fictional judge-provided Rally scores and separate Working exercise outcomes. Correct Cedar's 190 to 191 with a reason, retaining both versions.
6. Record fictional judge sign-off for all six events. Subsequent result changes and withdrawals must fail.
7. Record fictional paperwork and Data Entry confirmation dates. Verify a checksum backup round trip.

## Expected results

- Four entry orders, seven active judged performances and two withdrawn runs.
- No remaining waitlisted or unrecorded active runs; all six events signed off.
- Eight stored score versions: seven latest results plus one superseded transcription.
- All entry balances, owing and credits zero; one CAD 35.00 recorded expense.
- Original charges/payments, separate waiver/refund, both withdrawal reasons and every sign-off remain in history.
- No automatic title/ribbon awards. Working exercise results remain separate from Rally run outcomes.

The reconciliation JSON, working HTML reports, run-register CSV, records and recovery envelope are in output/trial-rehearsal. These artifacts are for development and manual cross-checking, not an official CARO submission package.

The automated test checks the expected totals, score correction history, signed-record locks, journal counts and exact recovered state. It exercises domain behavior; it does not replace browser interaction, hosted database concurrency, permissions or PDF visual checks. Use this same sequence when those hosted workflows are connected, then capture the manual screenshots from the verified screens.
