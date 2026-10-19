# CARO project boundary

- All edits, generated files, dependency installation, caches, logs and tests belong under `E:\CARO`.
- Never write to `E:\Secretary Trial Management` or its descendants. The C-WAGS application may be consulted read-only; do not execute its scripts or reuse its credentials or data.
- This is an independent CARO application. Do not copy C-WAGS competition rules.
- Supabase and Vercel projects will be created by the user later. Do not provision or deploy services without their instruction.
- Record authoritative rule sources, effective dates and verification gaps in docs/research.md. Unverified rules must not produce official eligibility, qualification or title decisions.
- Run `npm test` after changing executable domain or application behavior. No dependencies are required for the architecture scaffold.

- Readability is a core user requirement: use at least 16px for screen text, labels and controls, and 12pt for printed body text and form values. Use darker supporting text, generous spacing and natural section breaks. Do not shrink type to reduce page count; render and inspect changed PDFs. Small decorative page folios may use 10pt.

- Time handling: preserve calendar dates as YYYY-MM-DD; store actual events as UTC instants (future database timestamptz). Display events and enforce day-based windows in the explicit trial IANA timezone, with DST-aware offsets. Never apply a fixed offset or depend on the computer/server timezone. See docs/time-handling-review.md.
