# CARO Trial Secretary — working handbook

Prepared October 20, 2026. This describes the current local source, including hosted changes awaiting deployment. Browser steps and screenshots still require verification. Use the fictional RallyPaws Practice Weekend for training; do not use real entrant or payment information.

## Open a trial

Sign in, find your club, then choose **Open trial**. The trial overview shows saved preparation steps, entry orders, runs awaiting review, waitlists and balances. Select an unfinished step to open its screen. Use **Refresh overview** after changes made elsewhere.

The sidebar and selected-trial banner identify the current trial. Check them before recording entries, payments or scores. Switching screens can ask you to save or discard unfinished work. A saved confirmation means the operation completed; keep the same submission reference when retrying an interrupted request.

## Train with RallyPaws

Choose **Start fictional practice trial** under your club. The sample contains six rounds over April 17–18, 2027, including Regular, Team, Brace and Working. All officials and venue details are fictional. Review the input, save, reopen and verify it.

Practice mode is permanent. It permits private secretary testing without recording a CARO approval and blocks public publication. A practice trial cannot later be converted into a real trial. Existing editable local practice records are preserved when source fixtures change.

For the isolated local desk, run `npm run dev:practice` from `E:\CARO` and open `http://localhost:4322/`. Its records live in `E:\CARO\data\practice`. Disposable generated reports and the full weekend rehearsal are separate from these editable records.

## Prepare the application

In **Trial application**, enter host officials, contact details, trial dates, the venue and ring information. Set the trial's actual timezone. Add offered events and judges in the intended official round order. Each Working event needs explicit offered levels and exercise names; separate distinct exercise names with the indicated separators rather than mixing instructions into that field.

Review the application requirements before finalizing. Finalization fixes the official events and round numbers. It does not submit an application to CARO. Use the downloadable preparation summary for review or manual transfer to current official forms.

For a real trial, **CARO approval record** records actions already completed: the submission date, decision evidence and assigned trial number. Do not enter an approval merely to unlock testing; use a practice trial for that purpose.

## Build the premium and entry setup

In **Premium builder**, save the welcome, dates, schedule, fees, payment instructions, confirmation process, site policies, move-ups, refunds and reviewed host agreement. Trial identity, dates, officials and events come from the saved application. Replace placeholder agreements before publication. Private review copies are frozen review documents, not published entry editions.

In **Entry pricing and capacity**, map every official event to its applicable competitive and optional FEO fee. Check the pricing basis: an entry/group, a dog, or a selected Working exercise. Review event capacity and the agreement reference, then save.

For approved real trials, return to the premium publication controls. Review the exact public preview, select a unique lowercase link name, confirm the terms and publish. Share the resulting public premium link. It includes a paper/email entry download. Closing the public listing preserves received entries.

Online publication is currently disabled pending deployment acceptance and server configuration. Once enabled in a reviewed release, the same page presents the online entry form and a private receipt link. No automatic email or payment collection is implied.

After the first received entry, its prices and agreement remain frozen. Later private wording changes do not replace accepted entry terms. The overview does not ask you to overwrite frozen pricing.

## Receive and review entries

Use **Paper / email entry** to transcribe a signed form. Enter contact and dog information, preserving leading zeros in CARO IDs. Select the original receipt channel and time when known; leave the time unknown rather than inventing it. Record the signed-form evidence and entrant declarations.

Team uses two handlers and two dogs; Brace uses one handler with two dogs. Working selections require an offered exercise and level. The optional CARO lookup is assistance only. If it is unavailable, continue manually or open the official results page. Results do not populate a verified identity or establish eligibility automatically.

Submission creates an entry for review. It does not accept runs or record payment. In **Entries and waitlist**, review each selected run, then accept, waitlist or reject it. Capacity is enforced when accepting or promoting a run. A single entry can have accepted and waitlisted runs. Acceptance posts the applicable charge once.

Withdraw individual runs with a reason. Other runs remain intact. A withdrawal does not automatically erase charges or refund money; record any approved financial adjustment separately. Judged or signed-off runs cannot be withdrawn through this workflow.

## Record payments and adjustments

Use **Payments and adjustments** for an actual payment, refund or waiver. Check the entry reference, amount in Canadian dollars, method/reference and note. Record an original effective time only when known. The recording time remains separate.

Financial history is append-only. A correction is another documented transaction. Refunds cannot exceed recorded net payments, and waivers cannot exceed the remaining charge. Recording a payment does not move money through a payment service.

## Run the trial and record results

In **Trial day and judge sheets**, select the official round, review accepted participants and save the complete running order. Running order changes do not change official round numbers. Check in arrivals and print the necessary judge-sheet range. Reprints are labeled; verify names, dogs, class, judge, Working exercises and any FEO designation before handing sheets to officials.

Transcribe the judge-provided results. Rally and Working use separate result structures. Do not calculate a qualification or award a title from an assumed rule. Corrections retain the prior result and require a reason.

Before sign-off, refresh and compare every active run with the judge's signed records. Sign-off uses the reviewed current snapshot and locks further result/order/run changes for that round. Include empty offered rounds in the final review where appropriate.

## Reconcile and retain records

In **Reports and paperwork**, compare entry/run registers, latest results, charges, payments, refunds, waivers and expenses. Credits correct expenses without deleting the original. Resolve legacy identity or result warnings before preparing official paperwork.

Working reports and CSV files assist transfer. Use the linked current official CARO forms for the catalogue, Judge's Trial Records, fee schedule and any incident report. Exact submission-file compatibility is not certified. Use the private incident register for factual descriptions; append a correction with the original reference rather than replacing history. Leave the actual incident time blank when unknown. Recording an incident clears a previous no-incidents declaration. Review the incident status and record paperwork-sent and Data Entry confirmation dates only after those actions occur.

The **Activity journal** shows receipts, financial records, withdrawals and audit actions. Search applies to the full saved trial journal. Type and date filters retain stable pagination. Date filters use recording dates in the trial's timezone; original receipt times appear separately. Two source records may describe one action.

For local records, follow `E:\CARO\docs\backup-recovery.md`. Verify a backup and restore to a separate file; never overwrite the active records as an unreviewed recovery step. Hosted Supabase backup/recovery must be verified separately before beta.

## Administration

Only a deliberately appointed system Administrator can open **Administration** and access all clubs/trials. Ordinary account registration does not grant this role. Administrators can manage memberships and trial assignments with recorded reasons. Administrator access does not bypass finalized-trial, signed-result or append-only history protections.

## Browser verification still required

Capture the overview, application, finalized round order, private premium, entry pricing, public premium/paper download, manual receipt, mixed waitlist, payment history, running order, judge sheets, corrected results, sign-off, journal filters, reconciliation and Administration. Use fictional data and focused readable views. No screenshot is included here until it is captured from a verified browser session.
