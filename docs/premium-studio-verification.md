# Premium studio verification

October 18, 2026 — local development prototype, fictional data only.

Implemented and checked:

- Live trial, contact, venue, window, event, judge, pricing and policy rendering.
- Three colour palettes, browser draft storage, club template save/apply and JSON backup/restore controls.
- HTML export and browser print action with print-specific layout styles.
- Immutable reviewed-edition snapshots with numbering; duplicate unchanged editions rejected.
- Approval, trial-number, evidence, secretary review, sample and agreement-placeholder gates.
- Escaped user text, safe entry-link schemes, valid dates/timezones, nonnegative integer cents and distinct Working classification.

Automated: `npm test` passes 15 checks, covering the existing trial domain and new premium behavior. Syntax checks pass for the app and server modules. Local HTTP returns 200 for the studio.

Browser inspection: rendered studio verified in the in-app browser at http://localhost:4318. Edited title and event judge appeared in the live preview; title persisted on reload. Review screen displayed missing approval/evidence/review/sample/waiver items and disabled edition saving. Sample judge edit was restored after checking.

PDF pagination follow-up: printed the actual exported HTML through headless Chrome, rendered every page with Poppler, and inspected the page images using the PDF skill workflow. The original sample had an orphaned schedule note and a third page containing only contacts. Print layout now keeps short sections together, attaches notes to tables, keeps headings with content, and protects paragraph widows/orphans. Balanced event-row groups let longer schedules flow with repeated headers without a lone final event. Print spacing was adjusted without changing the web layout.

Verified output: output/pdf/sample-premium.pdf is two US Letter pages. Page 1 contains the full sample schedule and its note; page 2 starts with Entries & fees and includes venue, policies, agreement and contacts. A separate 36-event/long-agreement stress fixture was printed and visually checked across five pages; all 36 unique judge markers were present and continuation pages retained table headers. These checks cover the sample and stress fixture, not every possible user text or browser/printer setting.

Limits: import/export download dialogs and complete template round-trips have not been automated. Mobile rendering has not been visually verified. The application uses browser print-to-PDF; automatic in-app PDF generation remains future work. No cloud persistence, authentication, CARO submission, live entry form or dog-ID retrieval is implemented. The application wizard now manages the premium event list and uses the domain finalization snapshot; formal amendments are not implemented.

Run `npm run dev` and open http://localhost:4318 to continue. Stop the server with Ctrl+C. Browser drafts live on that origin; changing between localhost and 127.0.0.1 uses separate browser storage. Export a project backup before switching devices or clearing site data.


Connected application follow-up: 23 automated checks pass. New tests cover legacy migration without inherited approval, consecutive dates and deadline arithmetic, premium projection, frozen trial and official snapshots, approval prerequisites, invalid event dates and backup tampering. Browser checks confirmed title propagation to the premium, persistence after reload, disabled finalization for incomplete data and disabled recorded submission before finalization. The sample title change was restored. No live application was submitted and no sample was finalized in the browser. Full manual backup/restore downloads and the HTML summary download dialog remain unautomated.


Secretary implementation follow-up (October 18, 2026): earlier limits above about live-style entry forms and dog-ID retrieval are superseded by the local secretary release. Forty tests pass. Browser checks covered submission, acceptance, payment bookkeeping, judge score, completed-record lock and post-trial checklist persistence against an isolated fictional records file. The updated sample entry PDF contains 44 canonical interactive fields and matching widgets/appearance streams across four pages; a filled test value was verified in both the field tree and widget, and every widget stays within page bounds. All sample pages were rendered and visually checked. A separate 20-event/long-agreement PDF stress test produced 11 pages and 92 fields; all pages were rendered and inspected, event groups remained together and agreement continuations flowed without clipping. Cloud authentication, persistence and publication remain pending Supabase/Vercel. Owned QA servers were stopped after verification.


Readability revision: all on-screen type declarations have a 16px minimum; printed premium/reports and fillable entry body/labels/values use 12pt. Decorative PDF header/folio metadata uses 10-11pt. Supporting text was darkened and controls have 44px minimum height. The sample premium was reprinted to four pages, and the entry form to seven pages with 44 canonical fields. Rendered page checks caught and corrected a schedule heading separated from its table. Agreement and signature now start together. Current page counts supersede earlier compact versions. All 40 existing tests passed after these changes.
