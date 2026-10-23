# Time-handling review

Reviewed October 18, 2026. Existing Secretary Trial Management sources were read only; no code or scripts were executed there and no files were changed there.

## Located in the existing secretary

`cwags_trial_management-master/src/lib/dateOnly.ts` parses database DATE values as calendar dates (local noon) to avoid the previous-day shift caused by UTC-midnight parsing. `src/lib/timezone.ts` declares UTC storage and has an explicit venue-timezone formatter. Its `timezone.test.ts` verifies that a UTC October 17 opening displays October 16 at 7 PM Pacific. Database migrations use timestamptz for actual events and DATE/time fields for calendar and local schedule values.

These are two related safeguards, not a universal instruction to add/subtract hours from every database value. The legacy createTrialDateTime helper accepts a timezone argument but constructs a computer-local Date without applying that argument; it was not copied into CARO.

## CARO assessment and correction

UTC ISO storage already exists for local operational/audit records. Trial dates and date-only deadline arithmetic already use explicit date strings and UTC formatting, so they do not need the legacy local-noon workaround. There is no Supabase database to repair yet.

Activity/edition/intake displays used unqualified browser locale formatting, which could show different days while travelling. Those now use a shared date-time module and the trial timezone. Reports show the zone and offset too; timestamps remain UTC in stored backups. The wizard's hardcoded Edmonton today check now uses the selected trial timezone. Entry-window day comparison uses formatToParts to construct a stable YYYY-MM-DD regardless of locale output punctuation. Invalid/missing zones cannot silently fall back to the machine timezone; an invalid zone being edited receives the existing validation response.

Calendar validation is shared between the application and operational records. No existing values were rewritten. Future Supabase column and write contracts are documented in database/model.md.

## Verification

Regression tests exercise invalid dates, explicit offset requirements, midnight differences, Newfoundland's half-hour zone, spring-forward and repeated fall-back times, venue-zone reports, and child processes running in UTC, Vancouver and Tokyo. Existing calendar dates and consecutive-day arithmetic remain identical across those machine zones. Browser check confirms activity records show the venue timezone. All 47 tests pass, including venue-midnight entry closing.


October 23, 2026 display update: keep IANA identifiers in stored data only. Trial banners omit the identifier; premium builders, setup selectors, journals, printable reports and PDF exports use neutral region names such as Pacific Time. Timestamp labels show the instant-specific GMT offset without a reference-city suffix. Calendar-date and UTC storage behavior remains unchanged. Previously downloaded files retain their original text and must be regenerated.
