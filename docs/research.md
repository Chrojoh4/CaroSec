# CARO research register

Research date: October 18, 2026 (America/Edmonton). Initial web research used official CARO pages; direct website requests failed. The user subsequently supplied 11 PDFs in C:\Users\chroj\Downloads\Caro. See [download review](download-review.md) for inventory, checksums, section findings and remaining verification gaps. The main source documents are now available locally; full rule reconciliation and current-form verification remain pending. A crawled page may lag live changes.

## Verified from accessible official page content

| Finding | Design consequence | Source |
| --- | --- | --- |
| Rally has Novice, Intermediate, Advanced, Excellent, Versatility and Versatility Excellent. Working has ten exercises assessed separately at Rookie, Elite and Expert. | Separate Rally performance and Working exercise-result models. | [Rally vs Working](https://canadianrallyo.ca/rally-vs-working/5/) |
| Every offered event, including Brace, is separately listed on the trial application. Application order assigns round numbers; finalization locks those numbers and judges. Actual trial running order can differ. | Immutable official application identity; separate mutable schedule. | [Official trial application](https://app.canadianrallyo.ca/trialapplication) |
| The handbook index lists 2025 Rally and Working books effective April 1, 2025; Rally amendments effective December 14, 2025; a virtual guide v1.02; and an officials guide published January 2026. | Track documents and amendments as a versioned rule bundle, not a single handbook year. The index does not prove no later update exists. | [Handbook index](https://canadianrallyo.ca/handbook-signs/) |
| CARO restricts alteration of its copyrighted signs without prior permission. | Link to official assets initially; do not modify or rebrand signs. | [Handbook index](https://canadianrallyo.ca/handbook-signs/) |
| Spring 2026 virtual instructions distinguish Rally, Team and Working submissions, identify streams B/C, CARO dog IDs and move-ups, and provide separate submission dates. | Model participants, stream, move-up history and virtual submission windows. Do not generalize one trial's available streams or deadlines to all trials. | [Virtual trial](https://canadianrallyo.ca/virtual-trial/) |
| The virtual page says titles are now recorded automatically. | Show local progress as provisional; reconcile with official records. | [Virtual trial](https://canadianrallyo.ca/virtual-trial/) |
| Membership is not required to compete, although it provides class-dependent benefits. | Membership is distinct from account, dog registration and entry eligibility. | [CARO home](https://canadianrallyo.ca/) |
| Owners are encouraged to compare personal tracking with official results; virtual and in-person results count toward titles. | Record provenance and reconcile imported history; support both modes. | [Tracking sheets](https://canadianrallyo.ca/tracking-sheets/) |

## Research conclusions versus proposed product choices

Scope clarification from the user: historical trial records may be unavailable. The baseline is trial-secretary software with no dependency on those records. Accept CARO IDs and entrant declarations for review; do not infer verified eligibility or title progress from absent history. Any title announcement based on a handler declaration must be labeled as such. Historical tracking is optional future scope.

CARO operates an existing account, registration and results service. This project is secretary software, not an assumed replacement for that system. We have not discovered a documented integration contract or obtained API access. Manual reviewed imports/exports are the initial integration boundary.

The C-WAGS README was consulted read-only for workflow inspiration: trial setup, entry processing, running order, score entry, finances, printable reports and audit history. Its rules, database, authentication implementation, credentials and records have not been copied. Its workspace instructions do not override the user's explicit requirement to create this independent project in E:\CARO.

## Verification gates before production rules

| Gate | Required evidence | Consequence until verified |
| --- | --- | --- |
| R1: Rule bundle | Main PDFs and amendments now supplied locally and checksummed; selected sections cited in download-review.md. Reconcile every applicable rule/amendment and source URL before activating an executable bundle. | No verified executable rule bundle is shipped yet. |
| R2: Classes and participation | Confirm stream availability by level/format/mode, Team/Brace composition, membership effects, age, registration, jump heights, accommodations, judge restrictions and move-ups. | Catalog entries are vocabulary only, not proof a combination is legal. No eligibility engine. |
| R3: Scoring | Verify score ranges, qualifying thresholds, disqualifications, times/ties, exercise outcomes, placements, noncompetitive entries and corrections. | No numeric qualification or placement calculation. |
| R4: Titles (optional future scope) | Verify prerequisites, Q/pass counts, judge diversity, repeats, stream interaction, championship rules and historical transition dates if tracking is added. | No title award or history-based eligibility claim; not a dependency for baseline secretary operations. |
| R5: Officials workflow | Verify sanctioning deadlines, professional membership, trial limits, fees, incidents, retention, result deadlines and exact submission templates. | No claim of a CARO-compliant export or sanction submission. |
| R6: Integration | Obtain an authorized API specification or approved file formats and sample anonymized files. | No login scraping, registry synchronization or automated CARO submission. |

The application round lock is implemented from the official application instructions. Finalization here means the local application snapshot is frozen; it is not approval or submission by CARO. Rule-sensitive features must require a verified bundle applicable to the trial's date and mode before activation.

## Outstanding product assumptions

Confirmed scope additions: trial application wizard, premium builder and dog-ID results assistance during entry. See [detailed feature requirements](application-premium-lookup.md). External results remain optional enrichment and do not make historical tracking a launch dependency.

- First release serves host clubs and secretaries, with an application administrator; it does not administer CARO membership.
- In-person secretary operations come first. Virtual event support is designed into the data model and implemented after its rules are verified.
- Email confirmations, payment processing and automatic external submissions are later integrations. Fees and recorded payments can be handled locally first.
- English is the initial working language; UI strings should be externalized for future French support.

These are implementation proposals, not CARO mandates.

## Premium examples researched

Host-published examples inform document structure and configurable policies; they do not replace current CARO rules.

- [RUFF Athletics Facility, November 9, 2025](https://www.ruffaf.com/carotrials/): host/judge/reference, entry dates, offered events, fees, FEO, payment instructions and facilities. Its refund section references April despite the November heading; avoid copying inconsistent prose. Use shared stored dates and explicit review.
- [The Agility Connection, April 25–26, 2026](https://theagilityconnection.net/wp-content/uploads/2026/02/April-25-26-2026-Rally-premium.pdf): daily offerings, Team pricing units, payments, move-ups, awards, facilities and entry link. The cover closing year differs from the body and the venue address varies across sections. These inconsistencies support deriving repeated fields from one source.
- [Dogs All Day, October 25, 2025](https://www.dogsalldaykinburn.ca/wp-content/uploads/2025/09/CARO-Premium-October-25th-2025-1.pdf): check-in/briefing, ordered offerings, regular/FEO fees, site policies, changes, move-ups and waiver. Policies vary by host; use editable reviewed sections, not universal defaults copied from this example.

[CARO Quick Results](https://canadianrallyo.ca/quick-results/) exposes a dog-ID input and Fetch Results action in accessible indexed content. Direct retrieval still failed. Automatic lookup is a planned integration pending inspection of the real response/endpoint; no real dog was queried. Provide the official link and manual fallback in the meantime.


## Live dog-ID verification — October 18, 2026

The user supplied CARO ID 1334 for testing. The live public Quick Results page and its exposed Rally/Working request URLs were successfully inspected. Nine Rally records were returned; Working returned a validated no-results message. No dog-name/owner/title fields were returned in this example. See application-premium-lookup.md for observed fields, endpoints and legacy-data limitations. This resolves the earlier inability to inspect the lookup; it does not establish a supported third-party integration contract or a Working success schema. Public results were only read; nothing was submitted or altered in CARO's registry.

## Current official forms and post-trial reconciliation - October 18, 2026

The current [Trial Forms index](https://canadianrallyo.ca/trial-forms/) explicitly says the Titles Achieved Sheet is no longer needed. This supersedes older checklist references for this implementation; title history is not a dependency. [Hosting a Trial](https://canadianrallyo.ca/hosting-a-trial/) states records are due to Data Entry within 14 days, with payment within seven days after confirmation. The current [Trial FAQ](https://canadianrallyo.ca/trial-faq/) says retain records for six months, longer than the downloaded officials guide's three months; use at least six months pending clarification.

Seven current official forms were downloaded unchanged into docs/reference; manifest.json records URLs, SHA-256 and retrieval times. The January 15, 2026 fee schedule says 24 entries or fewer incur no run fee; 25 or more incur $2 per non-FEO run on all applicable runs, plus GST/HST. Counting details for Working/Team/Brace and tax treatment remain staff-reviewed on the official form. Data Entry verifies before payment; do not issue an inferred invoice. Catalogue lists each dog once across consecutive days and includes owner, name, ID and breed. Official judge records and score sheets remain authoritative; local working reports do not claim exact official compatibility.


## Official application transfer - October 20, 2026

The official https://app.canadianrallyo.ca/trialapplication is a five-step Livewire web application, not a downloadable application PDF. A read-only public HTML request returned HTTP 200. Step 1 exposes professional-member email, host name/website, chair/name/email, and secretary/name/email; exact IDs and model bindings were recorded in the transfer helper. Its initial public model also declares date and structured location keys, discipline flags and event/judge collections. Those model keys alone do not verify later-page controls or enum IDs. No membership lookup, event creation, application submission or private request was performed.

The independent Chrome/Edge helper transfers only matching visible controls after the operator imports a selected-trial packet and confirms review. It never mutates Livewire internals, calls private APIs, advances steps or submits. Full event-row/judge automation remains unverified until the later official pages can be inspected through authorized browser access. Missing fields/select options are left for the operator. Do not describe the preparation summary as an official application or certify a completed five-page integration yet.

## Judge replacement workflow — October 23, 2026

The saved 2025 Trial Officials Guide, PDF page 8, requires CARO to be informed of trial changes and distinguishes attending replacements from results attribution when original approved course maps are used. The current indexed [Handbook index](https://canadianrallyo.ca/handbook-signs/) still lists this guide as published January 2026. Direct retrieval failed on this date; no newer PDF revision was verified. See judge-replacements.md for implementation boundaries, including the staff-reviewed new-course path and the prohibition on amendments after scoring begins. Judge eligibility and course approval remain externally verified, not calculated by the application.
