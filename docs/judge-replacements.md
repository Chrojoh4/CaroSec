# Judge replacements after trial setup is locked

Implemented locally October 23, 2026. Hosted browser acceptance and live migration remain pending.

Open the selected trial and choose **Judge replacements**. Draft trials continue to use Trial details and rounds. For a locked trial, choose one affected round, enter the replacement attending judge, staff reason, CARO communication/course approval reference, and a public notice. Repeat for each affected round; each save is atomic and preserves history.

Choose whether the same approved courses are being used or the replacement judge has supplied approved courses. The first option preserves the current course/results-credit judge. The second credits the replacement. These are reviewed staff declarations, not automated judge accreditation or course approval. Confirm eligibility and course changes with CARO before recording the amendment. Practice records must use clearly fictional references.

The original application, event assignment and published entry edition remain unchanged. The current public premium displays a dated amendment section and the current attending judge in its round table. A new public-premium review includes the amendments in its review token. Existing entries, prices, agreements, payments and waitlist status remain unchanged.

The trial-day desk and regenerated judge working sheets distinguish the attending judge from the judge credited on results. New result records use the reviewed attribution. Stale scoring clients are rejected after a replacement; reopen the round before transcribing. Printed copies already distributed cannot update themselves: replace them or attach the notice. Original private premium downloads, paper-entry editions and archived copies retain their original source; attach the downloaded amendment notice when circulating them.

Use **Download entrant notice text** and **Download affected-entry notification list** for each amendment. The private CSV includes all entries selecting the round, including waitlisted and withdrawn runs, so the secretary can decide who needs notification. It includes email addresses and a blank notification timestamp column. No email is sent, and delivery is not marked complete automatically. Keep the completed notification list with trial records.

Scored or signed-off rounds cannot be amended through this screen. This conservative restriction prevents reassignment of historical results; a separately reviewed correction process is required. The module does not support mid-round replacement after scoring starts, date changes, cancellation, or automatic CARO submission.

## Database and release

Apply `supabase/migrations/20261023213043_judge_replacements.sql` only after all earlier migrations are present. This single new migration adds append-only, RLS-protected history and authenticated mutation functions, and updates authorized desk/report/public-premium projections. It promotes no account and exposes no entrant data publicly. Deploy the matching frontend and judge PDF code after the migration; the new frontend uses the assignment-version-aware result endpoint.

The connected Supabase account did not list project `rootupwvjwfterxhfwqx` on October 23. No migration was applied to another project. The file is prepared and tested locally, not a claim of live availability.

## Rule provenance

The downloaded **2025 Trial Officials Guide**, page 8, sections Trial Cancellation or Changes / Judge Unable to Attend, says the host must inform CARO of changes. It permits replacement use of approved courses and says results use the original judge when the original judge designed the maps. The guide is listed as published January 2026 at https://canadianrallyo.ca/handbook-signs/ . The official index was available through search on October 23; direct page retrieval failed, so a newly downloaded revision was not verified. Keep the rule source and confirm any newer CARO instructions before a real amendment.
