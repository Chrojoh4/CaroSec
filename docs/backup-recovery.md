# Local backup and recovery

Run these commands from E:\CARO. Backups contain private entry details and receipt tokens. Keep them in private storage; never upload them to GitHub or the public website. The SHA256 checksum detects accidental file changes; it is not an authenticity signature or encryption.

## Create and verify

```powershell
npm run records:backup -- create data/practice/records.json data/backups/practice-2026-10-20.json
npm run records:backup -- verify data/backups/practice-2026-10-20.json
```

Use a new destination filename each time. The command refuses to replace any existing file. It validates the record schema and references before producing a versioned recovery envelope. All paths must resolve inside CARO, including directory junctions and symlinks.

The Reports button's JSON download is a raw local-records export. The recovery command uses a separate envelope with a checksum. To convert a raw download, save it inside CARO and use it as the source of `create`.

## Rehearse recovery

```powershell
npm run records:backup -- restore data/backups/practice-2026-10-20.json data/recovered/practice-2026-10-20.json
```

This creates a separate recovered copy; it never changes the active records file. Compare the recovered trial, entries, ledger, scores and journal before deciding to use it. Stop the local server before changing its records configuration. Start the ordinary loopback server with the recovered copy explicitly selected:

```powershell
$env:CARO_RECORDS_FILE='data/recovered/practice-2026-10-20.json'
$env:CARO_PORT='4323'
npm run dev
```

After stopping that server, remove these process configuration variables if returning to ordinary development:

```powershell
Remove-Item Env:CARO_RECORDS_FILE
Remove-Item Env:CARO_PORT
```

The special practice planning prefill endpoint is available only for data/practice/records.json. A recovered copy can still be inspected through the secretary desk; it does not reset the separate browser planning draft. Keep the server local. This recovery tool does not back up Supabase, Auth users, hosted private files or browser planning storage.

Automated recovery tests preserve the complete fictional scenario, detect changes, reject broken references, verify a recovered copy and confirm overwrite refusal. Windows sandbox path resolution can reject realpath with EPERM; run the tests in an authorized local terminal with normal filesystem access rather than removing the path checks.
