# Trial application, premium builder and dog-ID information

These are core product requirements requested by the user. A local premium studio now implements editable preview, templates, draft persistence, backup/restore, HTML export, browser print/PDF styling and reviewed edition snapshots. Sample and long-content PDF pagination have been rendered and visually verified. A five-step local application wizard now feeds the premium, with finalization locks, recorded external submission/approval and an HTML preparation summary. Public hosting, automatic in-app PDF generation and the live CARO connector remain future work.

## One trial record feeds the workflow

Trial application wizard -> local application review/finalization -> recorded CARO submission and approval -> premium builder -> public entry -> secretary operations -> reviewed result package.

Application finalization is not sanction approval. Draft premiums may be prepared privately beforehand; ALL public premium publication requires recorded CARO approval and an assigned trial number (Officials Guide, Annex B, PDF p. 31). Changes to official event details require a recorded amendment and a new premium revision. See download-review.md for local source findings.

## Trial application feature

The wizard collects organizer/professional-member contact, host organization, chairperson, secretary, venue, trial dates and timezone, mode, and offered events with assigned judges. Each offered event is a separate row, including Brace; retain definition, day, stream availability and any Working exercise offerings. Validate combinations and judge authorizations against verified rules when available.

Draft event order assigns official round numbers. Show those numbers explicitly in the review screen. Finalization locks the official snapshot while preserving a separately editable running schedule. Produce a reviewable application summary for manual transfer to CARO's application service. Exact official form fields, attachments and export formats must be checked against the current official form before declaring compatibility. Do not send an application automatically or represent the local wizard as CARO's sanctioning service.

Track preparation status separately from external submission status: draft/finalized locally; not_submitted/submitted/approved/rejected externally. Save submission date, reference, confirmation evidence and amendment history. Do not collect CARO account passwords. Professional membership declarations are not automatically verified by this software.

## Premium builder

Generate an editable preview from saved trial details, then produce a public web premium and downloadable PDF from the same versioned content. A future PDF renderer must undergo visual QA. Provide reusable club templates and event-specific overrides. Do not copy another host's policy or waiver text as a universal CARO requirement.

| Section | Content and source |
| --- | --- |
| Trial identity | Host name/logo, dates, official trial reference(s), approval status, CARO rules link; from trial/application snapshot. |
| Contacts and venue | Chair, secretary, contact email, venue/address, directions and accessibility notes. Only designated public contacts appear. |
| Offered events | Day, level, format, stream, round number, judge, Working offerings; generated from application events. Running order displayed separately and labeled tentative where appropriate. |
| Entry windows | Opening, closing, timezone, capacity/full condition, late/day-of entry policy and online entry link. |
| Fees | Regular/FEO/Team/Working pricing where offered, per-event/per-dog/per-exercise units, discounts, payment methods and confirmation policy. Pricing must match entry checkout. |
| Changes | Host-reviewed move-up, withdrawal, cancellation/refund and waiting-list policies with deadlines. |
| Trial-day details | Doors, check-in, briefing/start times, ring/floor information, crating, parking, facilities, awards and volunteer information. |
| Rules and consent | Links to current CARO rules, host-specific site policies, approved waiver version and entry agreement. Secretary supplies or approves required wording. |

Required behavior:

- Save draft -> preview -> validate -> secretary review -> publish immutable version. Retain previous versions and a change summary.
- Generate repeated dates, fees, addresses and event details from single stored fields. Catch opening after closing, closing after the first event unless an explicit late/day-of policy applies, missing timezone/contact/reference and absent judge assignments.
- Trial and application revisions are dependencies. Changes to dates, events, judges, fees or entry policies mark the premium stale and require review before republishing. A finalized application cannot be changed through the premium editor.
- Published entry forms use the same event IDs, fee policy and premium version. Record which premium/waiver version each entrant accepted. Material changes after entries require an explicit notice/acknowledgment policy; publication itself sends no messages.
- Preserve public links to old editions with a superseded label; the current premium link resolves to the latest published edition. Snapshot PDF content and checksum.
- Render only explicitly public fields; never include entrant records, accommodation notes, private staff contacts or lookup history.

## Online and downloadable entry options

Confirmed requirement: each published premium provides **Enter Online** and **Download Entry Form (PDF)** actions. The PDF is a separate entry form, not just a download of the premium. It should be fillable electronically and also print cleanly for handwritten completion, with instructions to email the completed form to the secretary. Postal/in-person delivery instructions appear only if the host offers them.

Generate both entry options from the same published trial/event and fee data. Include trial reference/date, handler and dog details, CARO dog ID, event/round selections, streams, Working exercise/level selections, accommodations request instructions, fee calculation fields, payment instructions and the host-approved agreement with signature/date. Do not assume electronic typed acknowledgment meets every host's signature requirement; display the approved submission/signature instructions. Keep sensitive accommodation evidence out of the public premium and provide the host's designated submission instructions.

The secretary needs a manual-entry workflow to record emailed or paper submissions against the same event IDs, capacity, prices, waiver version and payment ledger used by online entries. Record intake channel (online/email/paper), receipt time and review status. Flag possible duplicate submissions by dog/trial/round for review rather than double-entering or charging automatically. Receiving an email is not automatically an accepted entry or payment confirmation.

Implementation status: the current studio has an editable online-entry URL and HTML premium export. The separate fillable entry PDF, its download action and manual-entry intake are required next features and are not implemented yet. Apply the PDF skill's fillable-field validation and page-render review when generating that form.

## Dog-ID lookup during entry

When an entrant enters a CARO dog ID, retain it as text, preserving leading zeros. Offer lookup information beside that dog's entry. IDs select records; they do not establish ownership or authenticate the entrant.

Desired live flow:

1. After ID entry and explicit lookup action (or a debounced supported lookup), request a single dog's publicly available information through a server-side adapter.
2. Show the returned identity, if supplied, so the entrant can confirm it is the intended dog. Do not assume the public service returns name, breed, owner, titles or every historical result until the response is inspected.
3. Display supported result fields with source and retrieval time. Keep official reported values separate from handler declarations, local trial scores and any future calculated summary.
4. Let the entrant confirm information before copying supported identity fields into the form. A changed ID clears the previous lookup and any unconfirmed suggestions; late responses for an old ID cannot populate the new dog's entry.
5. Give the secretary the same source/status information for review. Do not automatically select classes, approve move-ups or award titles from a lookup until completeness and applicable rules are verified.

### Current evidence and integration boundary

Verified October 18, 2026 using the user-provided example ID 1334. The live CARO Quick Results page loaded in the browser and returned nine Rally rows and no Working rows. The visible results contain trial date/number, round, judge, level, category, score, stream, status and host. This sample did not expose a dog name, owner, contact information or awarded titles. Do not prefill those identity fields from this response.

The page's public DogResultsData configuration explicitly exposes these GET bases:

- https://app.canadianrallyo.ca/api/dog-results/rally/
- https://app.canadianrallyo.ca/api/dog-results/working/

Appending the entered text ID 1334 returned HTTP 200 and a JSON array for Rally; Working returned HTTP 404 with a JSON message saying no results were found for the provided ID. The browser displayed the equivalent empty Working message. This verifies these public requests for one known ID, not a supported third-party API contract or a guarantee about all response types. Do not assume every 404 means a valid empty result; validate the error body.

Observed Rally fields: trial_start_date, trial_number, round_number, judge_name, event_level, score, status, stream, trial_host_name, event_category. All nine sample statuses were History, dates ranged from 2006 to 2008, and two judge values were Unknown Judge zzz. Two trial/round combinations had multiple different scores. Preserve every source row; do not deduplicate solely by trial and round, treat History as a qualifying flag, count the unknown placeholder as a real distinct judge, or infer titles/current eligibility from these legacy records. No freshness timestamp, completeness guarantee or stable result-row ID was supplied.

Before production activation, validate permitted reuse and obtain a supported contract where possible. Build the lookup through a server-side adapter with timeouts, bounded payloads, cache expiry, request limits and independent Rally/Working statuses. The Working success schema is still unverified because this example has no Working rows. No credentials or authenticated CARO access were used. Do not enumerate IDs or mirror the registry.

First entry integration can show the returned public Rally table alongside the entered ID and a retrieval timestamp. Keep dog identity fields manual unless a separate verified source supplies them. Display both discipline statuses independently; a failed Working lookup must not hide available Rally rows. Allow manual entry if either service is unavailable. Retain the official Quick Results link for users to check the source; no supported prefilled page parameter has been discovered.

This provides entry assistance without requiring a career tracker. Automatic class selection, title calculations and historical prerequisite verification remain outside this lookup.

### Connector contract (planned)

`lookupDogResults({ caroDogId })` returns `{ status, queriedDogId, sourceUrl, fetchedAt, sourceAsOf, identity?, results?, warnings }`.

Statuses: available, no_results, unavailable, unsupported. SourceAsOf is null when the source does not supply it; fetchedAt is not proof results are current. Results must retain source identifiers when supplied, event dates, disciplines, levels/formats/streams and outcomes only where the actual response supports them. Do not synthesize missing fields or a complete-history assertion.

Record lookup observations separately from authoritative local registry data. Keep a minimal snapshot or normalized supported fields for the particular entry only if reuse is permitted; otherwise retain a link and user-confirmed declarations. Store returned data as untrusted input, escape it in the UI, and never use it as an authorization credential. Expire cache entries and keep the entry process usable when CARO is offline.

This is entry assistance, not a requirement to build a career tracker. The standalone secretary remains fully usable without external results.

## Acceptance criteria

- A secretary can prepare a trial application, finalize its official event snapshot, record approval, and create a premium without retyping the event schedule.
- Premium preview and entry checkout agree on event IDs, units, fees and closing dates. Official round numbering survives running-order changes.
- Premium publication is versioned; source changes mark it stale; all entrants retain the version they accepted.
- Valid leading-zero IDs remain unchanged. An ID edit cannot display another lookup's response; a mismatch requires correction/confirmation.
- Available, no-results, timeout and unsupported responses are distinguishable, and none prevents manual entry submission solely because history is unavailable.
- Anonymous ID entry cannot expose private local dog/handler records or claim ownership of an existing record.
- No history-dependent eligibility or title conclusion is made from an unverified/incomplete response.


## Official application helper - current implementation

The hosted trial editor now exports a strictly projected application-transfer JSON and links the official web application and Chrome/Edge helper ZIP. See `hosted/caro-helper/README.md` for installation and verified limits. The helper fills recognized visible host/contact controls; matching date/location bindings are conditional on the controls actually being present. It preserves existing values by default, skips unknown options, excludes secret/member-evidence/entrant records, and blocks practice-trial packets. Ordered event descriptions remain available for reviewed entry using CARO's own selectors. Automatic member lookup, judge IDs, event-row creation and submission are not implemented. The live five-step workflow remains pending browser verification.
