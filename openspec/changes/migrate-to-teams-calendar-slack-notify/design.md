# Design

## Context

The app is a static frontend with no backend: `index.html` plus jQuery, and almost all logic in `js/main.js`. It currently depends on Google in three places:

1. **Auth**: `gapi.auth2` popup sign-in (`initClient`, `handleAuthClick`, `validate_session`, `updateLoginInfo` using `getGivenName()`).
2. **Config**: `setConfigFromDrive` reads a Google Doc (`CONFIG_DOC_ID` in `js/data.js`), concatenates its paragraph text, and `JSON.parse`s it into globals (`Type_Filter`, `HolidayList`, `admin_names`, …).
3. **Calendar**: `calendarList.list` fills `#cal_list` (choice saved in cookie `sci`); `events.list` feeds `process_all_events`, which reads `event.summary`, `event.start/end.{date|dateTime}`; `create_event` calls `events.insert` and `gapi_resp_process` checks `status == 'confirmed'`. A Google Calendar embed iframe goes into `#calendar_iframe`.

All reporting logic (`process_all_events`, `split_summary`, business-day math, charts) is independent of the provider once events are shaped as `{summary, start, end}`. See proposal.md for motivation, and specs/ for the required behavior.

## Goals / Non-Goals

**Goals:**
- Swap the provider layer (auth, config fetch, calendar list/read/write) with minimal changes to the reporting code.
- Stay a static site: no server, no build step, vendored libraries like the existing `js/plugins/`.
- Add the Slack notification as a fire-and-forget side effect of a successful create.

**Non-Goals:**
- Migrating historical events from Google Calendar to Microsoft 365.
- Microsoft 365 group or Teams channel calendars that are not in the user's `/me/calendars` list. Users must add the shared leave calendar to their Outlook/Teams calendar list.
- Event deletion/editing, approvals, and Slack notifications for events created outside the app.
- Supporting Google and Microsoft side by side.

## Decisions

### D1. Auth: MSAL.js (`@azure/msal-browser`) with popup flow
- Vendor the UMD build of `@azure/msal-browser` 5.22.0 (`msal-browser.min.js`) plus its `msal-redirect-bridge.min.js` into `js/plugins/`. Load them with plain `<script>` tags in place of `apis.google.com/js/api.js`. MSAL v5 popups need the redirect page to call `broadcastResponseToMainFrame()`. `index.html` does this itself when its URL carries an auth response (`state=`) and then skips app init, so the registered redirect URI stays the app URL.
- `PublicClientApplication` with `clientId` and `authority = https://login.microsoftonline.com/<TENANT_ID>` from `js/data.js`, `redirectUri = window.location.origin + window.location.pathname`, and `cache.cacheLocation = 'localStorage'` so the session survives reloads (spec: returning user signed in silently).
- `loginPopup` on Login, matching today's popup UX. Logout uses `clearCache()`, which signs the user out of this app only and keeps the browser's Microsoft session, like Google `signOut` did. `acquireTokenSilent`, falling back to `acquireTokenPopup` on `InteractionRequiredAuthError` only when the user triggered the action. On focus or revalidation, a silent failure means signed out ("Session expired!").
- Scopes: `User.Read Calendars.ReadWrite Calendars.ReadWrite.Shared Files.Read.All`.
- Given name comes from `GET /me` (`givenName`), not from the ID token, so `updateLoginInfo` keeps working with admin names.
- *Alternatives*: redirect flow (it would reload the page mid-flow and complicate init ordering), or Microsoft Graph Toolkit (heavy, web-components based, a poor fit for the jQuery code).

### D2. Graph access: small `fetch` wrapper, no Graph SDK
- New file `js/msgraph.js` holds `msalInstance`, `getToken()`, `graphGet(url)`, `graphPost(url, body)`, and `graphGetAll(url)`, which follows `@odata.nextLink` until done (spec: paging).
- Every call adds `Authorization: Bearer <token>` and `Prefer: outlook.timezone="India Standard Time"`, so times come back in IST as they do today.
- *Alternative*: `@microsoft/microsoft-graph-client`, which adds a dependency and needs a custom auth provider for a handful of GETs and one POST.

### D3. Keep the reporting code; normalize Graph events at the edge
- `listEvents` calls `GET /me/calendars/{id}/calendarView?startDateTime=…&endDateTime=…&$top=500&$select=subject,start,end,isAllDay,body,location&$orderby=start/dateTime`. `calendarView` expands recurrences, like `singleEvents: true`.
- A `toLegacyEvent(graphEvent)` adapter returns `{summary: subject, start, end, description}`:
  - All-day: `start = {date: 'YYYY-MM-DD'}` and `end = {date: 'YYYY-MM-DD'}`. Graph's all-day end is exclusive midnight of the next day, the same convention as Google, so the day counts in `days_diff` and `getAllBuisnessDates` do not change.
  - Timed: `{dateTime: <value>}`. Graph returns a zone-less local time string in the preferred time zone, which `moment()` parses as local time.
- `process_all_events` stays unchanged apart from removing the unused Google `cal_url`.
- *Alternative*: rewriting the reporting code against Graph shapes. That touches far more code for no behavior change.

### D4. Creating events
- `POST /me/calendars/{id}/events` with `isAllDay: true`, `subject`, `location: {displayName}`, `body: {contentType: 'text', content: desc + ' ' + description}`, `start/end: {dateTime: 'YYYY-MM-DDT00:00:00', timeZone: 'India Standard Time'}`.
- Graph rejects all-day events whose `end == start`, so half-day (FH/SH) events use `end = start + 1 day`. This still counts as 1 day before the `H` prefix halves it, the same as the current same-date Google events.
- Success means HTTP 201. `gapi_resp_process` becomes a Graph-aware handler: on an error it shows `error.message`, and on success it reloads the list and runs the callback (close the modal, then notify Slack).
- The calendar picker lists `/me/calendars`, filtered to those with `canEdit` for the Add Event path. Calendars that are shared but not editable still show for viewing.

### D5. Config: JSON file via a OneDrive sharing link
- `js/data.js` replaces `CONFIG_DOC_ID` with `CONFIG_SHARE_URL` (a OneDrive/SharePoint sharing link to `workspace-config.json`).
- Encode the share ID as `'u!' + base64url(CONFIG_SHARE_URL)`, call `GET /shares/{shareId}/driveItem?$select=id,name,@microsoft.graph.downloadUrl`, then do an unauthenticated `fetch(downloadUrl)` and `JSON.parse` the result.
- We don't call `/content` directly because it answers with a 302 redirect that browsers reject for authenticated cross-origin requests. The pre-signed `downloadUrl` avoids that.
- It is a plain `.json` file rather than a Word doc: there is no paragraph-concatenation hack, and it is easy to edit in OneDrive. The JSON keys are the same as the current Google Doc, plus `slackWebhookUrl` and `calendarLink`, so the existing config content can be copied across unchanged.
- `setConfigFromDrive` keeps its role and ordering (config first, then `init()` and `loadCalendars`) and adds a separate "invalid config" error for JSON parse failures.

### D6. Slack: browser POST to the Incoming Webhook with `no-cors`
- New file `js/slack.js` with `notify_slack_event_created(details)`. It runs only after a 201 create and only when `slack_webhook_url` is set.
- Slack webhooks do not answer CORS preflights, so the request must be a "simple" request: `fetch(url, {method: 'POST', mode: 'no-cors', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: 'payload=' + encodeURIComponent(JSON.stringify(msg))})`. The response is opaque, so only network-level failures show up (`.catch` → `console.error`). This matches the spec's failure requirement.
- Message: a `text` fallback plus simple Block Kit `section` fields (title, from–to, half-day part, description, calendar name, "created by <login_name>").
- It does not wait on the UI: the modal closes and events reload regardless of the Slack result.
- *Alternatives*: a serverless relay or Power Automate. The user chose the config-stored webhook for zero infrastructure.

### D7. UI touch points (`index.html`)
- Swap the Google script tag for `js/plugins/msal-browser.min.js` and `js/msgraph.js` / `js/slack.js`, and call `handleClientLoad()` from the existing `$(document).ready`.
- Change the sign-in text from "google workspace" to "Microsoft 365 / Teams".
- Replace the `#calendar_iframe` embed with an "Open calendar" link when `calendarLink` is configured. Outlook has no generic embed like Google's.
- Keep the `sci` cookie for the selected calendar. Graph calendar IDs are longer but still fit in a cookie. Old Google IDs in the cookie won't match any listed calendar, so selection falls back to the defaults. Clear the cookie when no listed calendar matches it.

## Risks / Trade-offs

- [Slack webhook URL visible to every signed-in user with config access] → Accepted. Limit the config file's sharing to the leave-app users, and rotate the webhook if it leaks.
- [Slack-side failures (revoked webhook) are silent because of the opaque `no-cors` response] → Accepted. Document it in the README. Symptoms show up as missing Slack posts.
- [Writing to calendars shared by another user through `/me/calendars/{id}/events` may fail for some sharing setups] → Show the Graph error clearly. If it becomes a problem, route by `calendar.owner.address` to `/users/{owner}/calendars/{id}/events`, which is a local change inside `msgraph.js`.
- [`Files.Read.All` / `Calendars.ReadWrite.Shared` may need tenant admin consent] → Include admin-consent steps in the setup docs, and have a tenant admin grant consent once for the app registration.
- [Time zone differences between Google `Asia/Kolkata` and Graph `India Standard Time`] → Use the Windows zone name consistently in both the `Prefer` header and create payloads. Check the day counts against a known set of events.
- [MSAL UMD bundle dropped in newer major versions] → Pin a vendored version. Moving to ES modules later is a separate change.
- [Leave history is lost from reports after the switch] → Communicate the cutover date. Optionally import past events into the Outlook calendar manually, out of scope here.

## Migration Plan

1. Register the Entra ID app: SPA platform, redirect URI = the production app URL (and localhost for testing), delegated scopes as in D1, admin consent granted.
2. Create `workspace-config.json` in OneDrive/SharePoint by copying the JSON from the current Google Doc and adding `slackWebhookUrl` (plus an optional `calendarLink`). Share it with app users and copy the sharing link.
3. Create the Slack Incoming Webhook for the target channel.
4. Update `js/data.js` with `CLIENT_ID`, `TENANT_ID`, `CONFIG_SHARE_URL`, and bump the `?v=` cache-busters in `index.html`.
5. Deploy the static files (the `LIVE` branch).
6. **Rollback**: redeploy the previous commit. The Google Doc config and Google Calendar are left untouched, so a rollback restores the old behavior immediately.

## Open Questions

- Should created leave events be marked `showAs: "oof"` (Out of Office) in Outlook/Teams? This can be added later without changing the specs.
