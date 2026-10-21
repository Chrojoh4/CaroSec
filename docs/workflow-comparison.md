# Secretary workflow comparison

Reviewed 2026-10-20. References were read only: C-WAGS on E: and SDDA in K:\TrialManager. No scripts, credentials or competition rules were reused.

## Common operating pattern

Both reference secretaries keep the active trial in navigation and provide direct access to entries, running orders, score sheets, scoring, results, financial records and activity. SDDA also separates the official workbook and closeout. C-WAGS includes application and premium preparation before entry operations.

## CARO changes in this pass

- Opening a trial hides the global club/trial lists. All clubs and trials returns to the workspace.
- Add a club is collapsible and opens automatically only for an empty workspace.
- Current trial navigation has an active page indicator and practice identification.
- The premium editor shows saved host, dates, timezone, venue, officials and rounds before editable policies. These source values already feed the preview; missing policies and fees require host decisions.
- The overview offers direct entry, finance, trial-day, reports and journal actions.
- Entry setup and manual intake explain prerequisites and provide buttons to resolve them.
- Local locking is labelled trial details and rounds. The preparation summary is not the official CARO application. The official online form and limited transfer helper remain separate.

## Remaining work

- Hosted practice creation currently supplies a draft, not preloaded competitors. Build a retry-safe, explicitly practice-only training-data loader without replacing existing entries or settings.
- Separate running orders, judge sheets and scoring into direct navigation destinations within the current trial-day functionality.
- Verify official application transfer beyond the first visible form page with authorized browser access. Do not invent later-page control identifiers or claim submission.
- Restore selected trial/page safely across reloads and provide coherent return navigation from all editors.
- Review full browser workflow with real club authorization, then update handbook screenshots and PDF.
- Confirm deployed database migration state and public intake configuration separately from local source changes.

CARO retains its own event formats, Working exercise pricing, approval requirements, trial-local dates, audit history and completed-round locks. Reference-program title trackers and competition rules are not assumed to apply.
