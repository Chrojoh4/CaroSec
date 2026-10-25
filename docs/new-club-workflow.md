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

Administrators use **Users & access** to search registered accounts and review system administrator status, active/inactive club memberships and trial assignments together. Membership and assignment changes retain the existing required reason and audit history. Administrator grants remain a separately controlled database operation.

Users & access now provides inline system-role and club-role/status controls with a reason and Save action. In Supabase Table Editor, use public.caro_users.system_role for staff/administrator and public.caro_memberships.role for owner/secretary/scorer. Staff is a system category, not a secretary grant: an active club membership plus trial assignment is still required. Email changes go through Authentication. No separate assistant role is supported.

Admin quick actions sits near the top of the sidebar and opens separate Users & access or Trial assignments screens. Administrative content is hidden on ordinary workspace/trial screens. Trial details & rounds now includes an Entry fees section (with a jump link) using the same premium-draft prices as Premium builder. Each screen has an explicit save and checks the premium revision; received entry terms and official price snapshots are not rewritten. Classes, streams & fees assigns these saved prices to rounds, with a link back to Trial details for amount edits. No additional database migration is required for this layout change.

Browser proof with fictional services verified: save 26 CAD in Trial details → Premium builder shows 26; save 28 in Premium builder → Trial details shows 28. Quick actions opens separate Users and Trial assignments screens, and ordinary trial screens omit administrator forms. No real trial data or permissions were changed during this check.

Trial details & rounds now uses chronological day tabs. Host/date/venue fields sit in a collapsible section. Each day groups drafts by CARO class and format, with a round-count control, independent judge assignment and collapsible full round cards. Class groups move within the selected day by drag handle or up/down arrows; individual rounds can also move within a class. Existing event IDs and other days’ assignments are preserved. Draft grouping of previously interleaved classes is marked unsaved and clears class/judge review flags; the user must review and save. Date-range changes retain out-of-range rounds visibly until corrected. Finalized source order remains unchanged, with read-only browsing and no reorder controls. No SQL change is required.

Two-day fictional browser verification covered per-round judge edits and summary updates, increasing round counts, switching days without losing pending edits, class arrow movement, save/reopen persistence, and finalized day browsing with disabled judge fields. Pure tests cover drag destination ordering and identity preservation. Native drag pointer automation could not confirm the browser gesture; arrow controls were verified as the accessible alternative.


### Proof current draft selections before saving
In Classes, streams & fees, choose streams and prices, then select **Preview current entry form and paper PDF — without saving**. The private online proof opens below the controls and offers a fillable paper PDF of the same selection snapshot. Inputs remain available above it; preview again after corrections. Unselected values stay flagged. This action does not save, finalize, publish, or change received entries. Use Save draft classes, streams and fees only after review. Fee amounts themselves come from the shared saved fee list in Trial details / Premium builder.
