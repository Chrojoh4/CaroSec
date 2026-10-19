# Download review — October 18, 2026

## Location and inventory

User downloads were found at `C:\Users\chroj\Downloads\Caro`, not the project directory. Originals remain there unchanged. Extraction and research notes are under `E:\CARO`. No Secretary Trial Management files were written.

| Download | PDF pages | Review status |
| --- | ---: | --- |
| Rally-Handbook-2025-v1.0.pdf | 79 | Cover/effective date and selected organization, entry and rule sections reviewed; full scoring catalog review pending. |
| Working-Handbook-2025-v1.0.pdf | 35 | Selected organization, FEO, selection, timing and judging sections reviewed; full exercise review pending. |
| Amendments-to-the-2025-Rally-Handbook.pdf | 9 | Effective date and initial amendments reviewed; full amendment-to-rule mapping pending. |
| CARO-Trial-Officials-Guide-2025.pdf | 34 | Secretary lifecycle, application, reporting and premium sections reviewed. Despite filename, cover says 2026, effective January 1, 2026. |
| CARO-Virtual-Trial-Guide-2025-v1.02 (2).pdf | 17 | Cover and contents reviewed; detailed virtual workflow review pending. |
| 2025-Rally-Changes.pdf | 2 | Change summary reviewed; does not substitute for handbook/amendments. |
| 2025-Working-Changes.pdf | 1 | Change summary reviewed; does not substitute for handbook. |
| Complete-Sign-Package-2025.pdf | 195 | Inventoried; text extraction is not a visual/sign verification. |
| Thumbnails-2025.pdf | 6 | Inventoried; visual review pending. |
| Working-Exercise-Signs-and-Cards.pdf | 42 | Inventoried; visual review pending. |
| Working-Signals-sheets-1 (1).pdf | 12 | Inventoried; visual review pending. |

All 11 files were text-extracted. File locations, SHA-256 checksums and page counts are in `source-extracts/manifest.json`. Several PDFs emitted recoverable object-pointer warnings; extraction succeeded. Pages 31–32 of the Officials Guide were also rendered and visually checked. Do not treat extraction as proof every diagram/table is correct or all rules have been verified. Exact source download URLs were not provided with these local files; previously discovered official publication pages remain the provenance links until URLs can be reconciled.

## Confirmed secretary workflow requirements

Page references below are PDF page numbers. Officials Guide page numbering matches PDF numbering.

| Source | Finding | Required architecture behavior |
| --- | --- | --- |
| Officials pp. 4–6 | Host must be a professional member in good standing. Applications are electronic; minimum lead time is six weeks for Rally/combined and three weeks for Working-only. Team and Brace count separately. Consecutive dates use one application. | Host professional-membership declaration/review, grouped multi-day application, separate event counts, date-based deadline checks. Distinguish application fee payment, trial-number assignment and actual approval. |
| Officials p. 4 | Nearby approved trials within 250 km on the same date require permission; ring requirements depend on discipline and Working exercise count. A smaller-ring pilot is explicitly limited to January–June 2026. | Record conflict/permission evidence and ring dimensions/surface. Do not activate an expired pilot for future events without a newer official extension. |
| Officials p. 7; Working PDF p. 11, section 2.6.2 | Working hosts may offer up to five exercises in a round, with one or multiple levels; entrants choose from what is offered. | Store offered exercises and allowed levels per round; entrants cannot select unavailable exercises/levels. Working level remains exercise-specific. |
| Officials p. 8 | For an unavoidable replacement judge using the original judge's course maps, results are recorded under the original judge's name. | Separate physically officiating judge, course designer, reporting judge and substitution evidence. Preserve original assignment and record replacement as an exception, rather than overwriting identity. Verify the exact current result-form representation before export. |
| Officials p. 10 | Secretary handles premium, entries/payments, accommodation communications, run order, score sheets, Judges Trial Records and results/fees submission. | Add accommodation request -> judge decision -> entrant notification status -> trial-day approved list. Separate draft message preparation from any actual sending. |
| Officials pp. 11, 29–30 | Rally course approvals are due at least three weeks before an in-person trial. Working layouts do not require course approval. Judge signs Trial Records. Copies of records are kept at least three months. | Document/task checklist with deadlines, course approval evidence, sign-off, and minimum retention safeguards. Do not build a course designer merely to satisfy secretary duties. |
| Officials p. 22, p. 30 | Post-trial package includes catalogue, Judges Trial Record, Titles Achieved Sheet, incident report if applicable, and fee form. Guide refers to a prescribed submission limit without giving its numeric value here. | Checklist and reviewed package; configure the deadline only after current forms/instructions establish it. Title-achievement declarations can be collected without a historical tracker. |
| Officials p. 22 | Bye dog is represented as Bye-Dog with CARO ID 2799. | Model bye participation explicitly; it must not create a real owned dog or ordinary lookup/eligibility record. Confirm export treatment for Team/Brace. |
| Officials pp. 31–32, Annex B | Premium cannot be published before official approval and assigned trial number. Annex defines premium and registration fields. | Block all public premium publication until both conditions are recorded. Draft preview stays private. Populate template from trial data and retain reviewed publication versions. |
| Working PDF p. 10, section 2.5.2 | FEO cannot mix with scored exercises in one round; declaring any exercise FEO makes the entire round FEO, including prior passes. | FEO is round-entry scope. Keep prior feedback but remove qualification effects for the entire entry; audit the declaration. |
| Working PDF p. 12, section 2.6.7 | One through five exercises have allotted times of three through seven minutes respectively. | Derive timer from number selected under the applicable bundle; distinguish recorded time and judge outcome. |
| Rally amendments PDF p. 1, effective December 14, 2025 | C-stream prerequisites and same-trial higher/lower-level results require validation; lower-level title failure can invalidate higher runs. Also specifies a refund when a bitch comes into season after closing. | Capture declarations and flag unresolved prerequisites; support pending eligibility and final review without requiring external history. Host refund text must not override mandatory amended provisions. |

## Corrections to the earlier preliminary design

1. The premium publication gate is stronger than avoiding an unsupported 'sanctioned' label: the guide prohibits publication until approval and number assignment. Private drafts remain allowed.
2. Judge identity is not a single mutable field in exception workflows. Original assignment, actual officiation and official reporting attribution need distinct records.
3. Submission paperwork includes reported titles without requiring the secretary application to compute career titles. Retain handler declarations and any evidence separately from official confirmation.
4. CARO's Spring 2026 virtual page says a title sheet is no longer needed there, while the Officials Guide lists it in post-trial paperwork. Treat this as a mode/event-specific instruction difference pending clarification; do not remove the in-person checklist item globally.
5. The small-ring pilot in this downloaded guide expired before this research date. It cannot be assumed current.

## Still needed, without blocking local application development

- Current blank trial forms/templates: catalogue, Rally and Working individual score sheets/cards, Judges Trial Record, incident, titles, fee submission; exact result submission deadline, fees and accepted file formats.
- Full handbook/amendment reconciliation, especially class/stream eligibility, accommodations, scoring and trial-day prerequisite handling. No verified executable scoring bundle is being declared by this review.
- The user subsequently supplied dog ID 1334. Live Quick Results and the public Rally response were inspected successfully; see application-premium-lookup.md. Working success data and a supported third-party integration contract remain unverified.

The supplied files remove the earlier download-access obstacle. Trial application, premium builder and standalone secretary development can proceed using these sources, while the remaining rule details are reviewed.

## Additional current forms retrieved October 18, 2026

See reference/manifest.json for seven original PDFs, source URLs and hashes, plus extracted text. These cover the 2026 trial fee schedule, catalogue, incident report, Rally/Working judge records and Rally/Working score sheets. No official artwork or form was modified. The current forms index retires the Titles Achieved Sheet; older references above are historical. Local reports link to these originals and retain a working-report label until exact export mapping is reviewed.
