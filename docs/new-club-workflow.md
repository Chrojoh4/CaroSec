# Standard secretary workflow for new clubs

Use the C-WAGS/SDDA operating sequence as the interaction template, while keeping organization-specific rules and records separate.

1. Create the host club and trial identity, dates, venue and officials.
2. Add class rounds in their intended CARO application order.
3. Open Classes, streams and fees. Enter fee amounts here, then select each round's offered streams/Working levels, competitive/FEO prices, charging unit and capacity. Save while still a draft.
4. Prepare the premium: source identity and fee amounts come from saved setup; the host supplies dates, policies and agreement. Review the online and fillable paper proofs from its testing links.
5. Review CARO requirements and lock the trial's official round source. Complete the official CARO application separately; record actual submission and approval. Locking does not submit it.
6. Review the prefilled official event prices/capacities and agreement reference. Save the reviewed entry setup. Draft choices alone never open intake.
7. Publish the approved premium/paper form when ready. Online publication remains gated until its hosted acceptance requirements are met.
8. Receive and review entries, manage per-run waitlists/withdrawals, and record payments separately.
9. Use Running orders, Judge score sheets and Score entry/sign-off. Respect signed-record locks and append-only corrections.
10. Reconcile results, incidents, fees and CARO paperwork. Retain the activity journal and immutable editions.

Administrator club memberships and explicit trial assignments control staff access. A secretary may serve several clubs; an invitation does not replace authorization. Judge replacements use the separate audited amendment workflow.

Implementation and migration: `20261024202758_draft_offerings.sql` follows all earlier migrations. No real trial settings are changed by applying the migration. The host must select and save the intended offerings. Existing incomplete trials are not silently filled with assumed fees or streams.
