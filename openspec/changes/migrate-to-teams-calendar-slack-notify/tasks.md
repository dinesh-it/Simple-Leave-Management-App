# Tasks

## 1. External setup and static config

- [x] 1.1 Document the Entra ID app registration in README: SPA redirect URIs for prod and localhost, the delegated scopes `User.Read Calendars.ReadWrite Calendars.ReadWrite.Shared Files.Read.All`, and admin consent. Verify the README has a "Microsoft 365 setup" section listing each step.
- [x] 1.2 Document `workspace-config.json` in README: every existing key plus `slackWebhookUrl` and `calendarLink`, with a sample, and how to share it and copy the sharing link. Also document creating the Slack Incoming Webhook and the known limitation that Slack-side failures are silent. Verify the sample JSON parses with `python3 -m json.tool`.
- [x] 1.3 In `js/data.js`, replace the Google `CLIENT_ID`/`CONFIG_DOC_ID` with `CLIENT_ID` (Azure app), `TENANT_ID` and `CONFIG_SHARE_URL`. Verify `grep -n "CONFIG_DOC_ID\|googleusercontent" js/` returns nothing.

## 2. MSAL sign-in and Graph helper

- [x] 2.1 Vendor a pinned UMD build of `@azure/msal-browser` as `js/plugins/msal-browser.min.js`, noting the version in a header comment. Verify that `msal.PublicClientApplication` is defined in the browser console after page load.
- [x] 2.2 Create `js/msgraph.js` with the MSAL instance (localStorage cache, tenant authority, redirect URI = current page), `getToken()` (silent first, popup fallback only for user actions), and `graphGet`/`graphPost`/`graphGetAll`, where `graphGetAll` follows `@odata.nextLink` and sends the `Prefer: outlook.timezone="India Standard Time"` header. Verify by calling `graphGet('/me')` from the console after sign-in and getting the profile back.
- [x] 2.3 In `index.html`, remove the `apis.google.com/js/api.js` loader, add script tags for `msal-browser.min.js`, `msgraph.js` and `slack.js` (before `main.js`), bump the `?v=` cache-busters, and change the "google workspace" login text to "Microsoft 365 / Teams". Verify the page loads with no console errors and no network requests to `googleapis.com`/`apis.google.com`.
- [ ] 2.4 Rewrite `handleClientLoad`/`initClient`/`handleAuthClick`/`handleSignoutClick`/`updateSigninStatus` in `js/main.js` to use MSAL: popup login, `handleRedirectPromise`/`getAllAccounts` for the cached session, and `logoutPopup` followed by reload. Verify against the specs/microsoft-sign-in scenarios: unauthenticated view, successful sign-in, silent re-sign-in after reload, cancelled popup stays signed out, and sign-out.
- [x] 2.5 Rewrite `validate_session` to try a silent token and, on failure, show "Session expired!" and switch to signed-out. Rewrite `updateLoginInfo` to use `givenName` from `GET /me`. Verify an admin-named user sees Monthly Report, a non-admin does not, and clearing the MSAL cache and then focusing the window after 3 minutes shows "Session expired!".

## 3. Workspace config from OneDrive

- [x] 3.1 Rewrite `setConfigFromDrive` to encode `CONFIG_SHARE_URL` as a share ID (`u!` + base64url), fetch the driveItem `@microsoft.graph.downloadUrl`, download it, and `JSON.parse` it into the existing globals plus new `slack_webhook_url` and `calendar_link`, keeping the config → `init()` → `loadCalendars` order. Verify the holiday list, type filters and company name render from the OneDrive file.
- [x] 3.2 Add the error paths: "Your workspace does not seem to have this app configured" for access or not-found errors, and a separate "invalid workspace config" error for JSON parse errors. In both cases, do not load calendars. Verify by testing with an unshared account and with a deliberately broken JSON file.

## 4. Teams/Outlook calendar read and write

- [x] 4.1 Rewrite the calendar-list part of `loadCalendars` to use `GET /me/calendars`, keeping the rules: `sci` cookie choice, else a name containing "vacation", else the first calendar. Clear a stale `sci` cookie that matches no listed calendar. Verify each specs/teams-calendar-events "Calendar selection" scenario manually, including switching calendars reloading events.
- [x] 4.2 Replace the `#calendar_iframe` Google embed with an "Open calendar" link shown only when `calendarLink` is configured, and remove the unused Google `cal_url` in `process_all_events`. Verify the link appears and opens in a new tab when the key is set, and nothing shows when it is absent.
- [x] 4.3 Rewrite `listEvents` to call `calendarView` for the from/to range (default: current year, to-date inclusive) through `graphGetAll`, and map results with a `toLegacyEvent` adapter (all-day → `{date}`, timed → `{dateTime}`, subject → `summary`) before `process_all_events`. Verify a range with more than 500 events loads completely (check the count in the all-events table against the Outlook count).
- [ ] 4.4 Check that reports are the same: create a test calendar with full-day (single and multi-day across a weekend), half-day `H`-prefixed, timed, recurring and holiday-adjacent events, and confirm the all-events table days, the monthly/weekly charts and the counts table match the expected business-day counts. Record the checked cases in the change notes.
- [x] 4.5 Rewrite `create_event` to `POST /me/calendars/{id}/events` with `isAllDay`, `subject`, `location`, text `body`, and `India Standard Time` start/end. Half-day events use end = start + 1 day with a `(First Half)`/`(Second Half)` description prefix. Keep the confirm dialog. Verify that full-day 10–12 Mar creates a 3-day all-day event, FH/SH create single-day events with the right prefix, and cancelling the confirm creates nothing.
- [x] 4.6 Replace `gapi_resp_process` with a Graph response handler: on 201, reload events and run the success callback; on error, show `error.message` and keep the modal open. Verify by creating an event in a read-only calendar and checking that the error alert appears and the modal stays open.

## 5. Slack notification

- [ ] 5.1 Create `js/slack.js` with `notify_slack_event_created(details)`. It builds a `text` fallback plus Block Kit fields (title, from–to, half-day part, description if non-empty, calendar name, "created by <login_name>"), POSTs `payload=` form-encoded with `mode: 'no-cors'`, and `console.error`s on rejection. It does nothing when `slack_webhook_url` is empty. Verify with a test webhook that the full-day and half-day messages match the specs/slack-event-notification content scenarios.
- [x] 5.2 Call `notify_slack_event_created` only from the successful-create path in `create_event`, without awaiting it before closing the modal or reloading. Verify that one Slack message is posted per created event, that cancelling or a failed create posts none, that no Slack request fires when `slackWebhookUrl` is missing, and that an unreachable webhook URL still completes creation with a console error.

## 6. End-to-end verification

- [ ] 6.1 Run the full flow in a browser against the real tenant: sign in, config load, calendar selection, reports, add FULL/FH/SH events, Slack posts, then sign out. Verify with `grep -rn "gapi\|google" js/main.js index.html js/data.js` that no Google references remain (other than harmless comments), and run `openspec validate migrate-to-teams-calendar-slack-notify --strict`.

## Implementation notes

- Tasks marked done were verified in headless Chrome against the real app code. MSAL was stubbed, and Microsoft Graph, the OneDrive download and the Slack webhook were mocked (45/45 checks). A separate load with the real MSAL 5.22.0 bundle confirmed that `msal.PublicClientApplication` is defined and that initialization runs with no errors and no requests to Google.
- Still open, because they need the live tenant (admin consent pending) or a real webhook: 2.4 (the real login popup and the redirect bridge), 4.4 (a real test calendar), 5.1 (a real Slack webhook) and 6.1.
- 4.4 cases already checked against mocks. The Graph events and their Google equivalents gave identical all-events rows and `cumulative_data`:
  - PL 10–12 Mar = 3
  - SL Fri 13 to Mon 16 Mar across a weekend = 2
  - HSL 18 Mar = 0.5 (new end = start + 1 matches old end == start)
  - WFH timed 09:00–13:00 = 1
  - PL 3–5 Mar around the Holi holiday on 4 Mar = 2
  - HBD on Sat 2 May, moved to Mon 4 May = 1
  - CO 6 Jul = 1
  - A cancelled occurrence is dropped.
- `js/data.js` holds placeholders for `CLIENT_ID`, `TENANT_ID` and `CONFIG_SHARE_URL` that must be filled in before a live run.
