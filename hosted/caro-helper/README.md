# CARO official application transfer helper

This independent helper fills matching visible contact/venue fields on https://app.canadianrallyo.ca/trialapplication. It never submits or finalizes an application, looks up a member, chooses a judge, or creates event rows. CARO remains the official application service.

## Install in Chrome or Edge

1. Download and extract caro-application-helper.zip to a folder you will retain.
2. Open chrome://extensions or edge://extensions. Enable Developer mode.
3. Choose Load unpacked and select the extracted folder containing manifest.json.
4. In CARO Secretary, save the trial and download its official-application transfer JSON.
5. Open the official application in Chrome/Edge, click this extension, and import that JSON file.
6. Review the trial, check the confirmation and choose Fill this page's matching fields. Existing values stay unchanged unless you explicitly choose replacement.
7. Use CARO's own Find and Next controls, reviewing each page. Reopen the helper and fill matching visible fields on the next page. Choose member/judge identities and add event rows in CARO itself, preserving the listed order.
8. Review the entire official application before using CARO's final submission control.

The first-page field IDs/bindings were read from CARO's public application on October 20, 2026. Date/location keys also appear in its public initial form model, but their later-page controls and event selectors still require live browser verification. A field absent from the current page is skipped; an unknown select option is left for manual selection. Full five-page automatic completion is not yet verified.

Only the file you import is held in extension session storage; it clears when the browser session ends. Forget imported application clears it sooner. No CARO password, login cookie, Supabase token or server key is collected. The helper receives active-tab permission only when you open it and refuses to fill another origin/path. Practice-trial packets are blocked from filling the official site.

This is a manually installed development helper, not a browser-store release or CARO-endorsed integration.
