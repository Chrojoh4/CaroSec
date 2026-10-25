# CARO fee and FEO workflow review — 2026-10-25

C-WAGS source was consulted read-only at `E:\Secretary Trial Management\Secretary Trial Management\cwags_trial_management-master\src\app\dashboard\trials\create\page.tsx` (default regular/FEO prices and FEO-for-all switch) and `create/levels/page.tsx` (class inheritance and overrides). No C-WAGS files or data were changed, and no C-WAGS competition or financial rules were imported.

## Secretary flow

1. At the top of **Trial details & rounds**, enter the regular Rally price and FEO price, then explicitly select **Offer FEO for this trial** when appropriate. Team, Brace and Working have their own fee cards and charging units. Named Add-price buttons appear for missing relevant defaults. Save fee amounts. Premium builder edits these same fee records and FEO default.
2. **Classes, streams & fees** automatically fills the round prices. Novice/Intermediate show B automatically. Advanced and higher retain B/C choices. Each round has an explicit **Offer FEO for this round** switch. FEO is a host offering, separate from Rally streams.
3. Use **Offer FEO on all rounds** for bulk availability, or **Apply trial defaults to all rounds** to reset explicit round exceptions to current defaults. These are draft controls until saved. Existing explicit round FEO exceptions survive ordinary navigation and premium price updates.
4. Expand **Price and capacity exceptions** only when a round differs. Choose another fee row or charging unit, and set capacity there. No repeated price mapping is required when a unique default exists. Ambiguous defaults or unconfirmed Team/Brace units are visibly flagged.
5. Proof the current choices using the preview button or sidebar; return without losing unsaved selections. Paper proofs and the online proof use the same defaults/selected prices. Save draft classes, streams and fees when satisfied. Finalized official entry setup retains its review/save gate and first-entry locks.

## Compatibility and protection

The canonical source remains `caro_premium_drafts.content.fees`. Fee rows now retain a `kind` (regular/feo/team/brace/working/custom); FEO defaults also retain an explicit `offered` Boolean. The existing SQL fee validator accepts these extra fee-row properties; an actual migration-backed database test verifies preservation through premium and draft-offering saves. No new SQL is required.

Recognizable legacy labels (Competitive Rally, Regular, FEO, Team, Brace, Working) supply unique defaults for proofing. The editable Use this price as control provides an explicit role when a custom name is used. A legacy FEO amount alone does not enable FEO; an existing explicit round assignment remains honored. Disabled FEO defaults retain their amount for later use but are omitted from newly rendered private premium fee tiles. Original fee labels, amounts and units are preserved unless the secretary edits them.

This does not rewrite past trials, ledger charges, received-entry prices, public editions or frozen agreements. Protected RPCs still validate authorization, revisions, B/C restrictions and Working charging units. Defaults are host configuration, not evidence of entrant eligibility or CARO approval. CARO handbook section 1.4.3 gives hosts discretion over FEO offerings and fees.

## Verification

157 JavaScript/database tests; five private PDF checks including FEO on/off, price population, unauthorized access and fill/save/reopen fields. Fictional browser checks cover trial price change into rounds and premium; a round FEO exception through proofing, save and reopen; premium price change back into round defaults; final fee layout. Every generated PDF page was rendered and visually checked. No live trial data was changed during these checks.
