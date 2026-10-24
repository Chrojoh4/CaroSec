# Remembered premium answers

The premium builder fills unanswered reusable fields from the signed-in user’s last saved premium in the same club. Defaults are stored in public.caro_premium_user_defaults, keyed by user, club and practice status. RLS exposes only the caller’s own defaults; clients cannot insert/update them directly. The existing authorized premium-save operation triggers remembering the whitelisted content in the same transaction.

Reusable fields: welcome, day-of policy, order note, payment, confirmations, facilities, accommodations, awards, move-ups, refunds, site rules, host agreement wording, colour theme and fees. Prior fees and agreement wording must be reviewed; no approval or agreement acceptance is copied. Entry dates, schedule, capacity, officials, event/class details, venue/address identity, publication links, approval and trial numbers remain tied to the current trial or require new decisions.

Only absent keys are filled. Existing text, intentionally blank strings and empty fee arrays are preserved. Defaults are cloned and editing them does not alter the source premium. Autofill marks the draft unsaved and shows a review notice. The current trial is excluded as a defaults source. Practice and real trials have separate defaults. Frozen editions and received entry pricing remain untouched.

The migration seeds defaults from the latest currently stored draft last updated by each user in each club/practice scope. It cannot reconstruct a user’s earlier answers if another person subsequently overwrote that draft. Future saves retain each user’s own latest answers separately.

Apply output/deployment/premium-defaults-20261024/apply-premium-defaults.sql once in CARO using Run; it includes RLS. It changes no existing draft content or trial record. Before installation, the editor still works and displays that remembered answers are unavailable. Reopening a premium after installation picks up the feature. Tests cover allowlisted fields, mutable copies, preserved blanks/fees, excluded dates/source identity and user/anonymous isolation.
