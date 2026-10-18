# Personal Cal Link imports

This optional local preview uses Cal Link's own iCal/Outlook export. Sign in
directly on Berkeley's website, open an event, and download its `.ics` file.
Yums does not receive the CalNet password or session cookies.

Enable the preview in the local server's environment:

```powershell
$env:YUMS_ENABLE_LOCAL_IMPORTS = "true"
$env:APP_ORIGIN = "http://localhost:3000"
npm run dev --workspace apps/web -- --hostname 127.0.0.1 --port 3000
```

Open [the import page](http://localhost:3000/import). Choose the downloaded
calendar file, check the original event's food offer, and keep the selected
events. A generic Free category means free admission, not necessarily food;
Cal Link exports can omit the separate Free Food perk.

Parsing happens entirely in the browser. Reviewed entries stay in that tab's
session storage until cleared or the tab is closed. No import endpoint, cloud
database write, public-feed insertion, or account-save action is provided.
Imported entries are snapshots and must be re-exported to reflect changes.
Anyone using the same browser tab can see them; clear imports before sharing it.

The route is disabled unless explicitly enabled with a configured HTTP
loopback origin. It must remain disabled in the hosted pilot. Keep the local
server bound to loopback. Calendar exports must remain outside Git.

Only individual dated Cal Link events with UTC times and canonical Cal Link
event links are supported. Duplicate, expired, cancelled, recurring, all-day,
and unsupported-date entries are omitted. Files are limited to 512 KB and 250
events. Links and attachments in calendar files are never fetched automatically.

This is a personal review tool. Publishing campus-only content or enabling a
shared importer requires a separate approved workflow.
