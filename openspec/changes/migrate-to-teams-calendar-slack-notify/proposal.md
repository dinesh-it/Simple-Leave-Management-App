# Proposal

## Why

The team now schedules and tracks leave in Microsoft Teams (Microsoft 365 / Outlook calendars) instead of Google Workspace, so the Google Calendar–based leave app no longer points at the calendar people actually use. People also want to hear about new leave in Slack as soon as it is entered, without having to open the app.

## What Changes

- **BREAKING** Replace Google sign-in (`gapi.auth2`) with Microsoft identity platform sign-in (MSAL.js, SPA flow) using a Microsoft 365 work account.
- **BREAKING** Replace Google Calendar reads and writes with Microsoft Graph calendar APIs. The calendar picker, event listing (reports, charts, counts, birthdays) and the "Add Event" form all work against Teams/Outlook calendars.
- **BREAKING** Replace the Google Docs workspace config (`CONFIG_DOC_ID`) with a JSON config file stored in OneDrive/SharePoint and read through Microsoft Graph with the signed-in user's permissions.
- Add a `slackWebhookUrl` key to the OneDrive workspace config. Because only signed-in workspace users can read it, it stays out of the repository.
- After an event is created successfully through the app's Add Event form, post a message to the configured Slack Incoming Webhook with the event type, person, dates, half-day info and description.
- A Slack failure or a missing webhook never blocks or rolls back event creation. It is only logged.
- Remove the Google Calendar embed iframe and Google-specific strings ("google workspace" login text). An optional configurable calendar link replaces the embed.
- Keep existing leave semantics unchanged: summary format `TYPE: Name`, half-day `H` prefix, business-day counting, holiday list and allowance limits.

## Capabilities

### New Capabilities
- `microsoft-sign-in`: Sign-in/sign-out with a Microsoft 365 account, session validation, and the signed-in user's name for admin detection.
- `workspace-config`: Loading the workspace JSON config (leave types, limits, admins, holidays, Slack webhook, etc.) from a OneDrive/SharePoint file via Microsoft Graph.
- `teams-calendar-events`: Listing selectable Teams/Outlook calendars, reading events for a date range, and creating full-day and half-day leave events through Microsoft Graph.
- `slack-event-notification`: Posting a Slack message via the configured Incoming Webhook whenever an event is created through the app.

### Modified Capabilities
<!-- None: no existing specs under openspec/specs/. -->

## Impact

- **Code**: `js/main.js` changes throughout: auth (`handleClientLoad`, `initClient`, `updateSigninStatus`, `validate_session`, `handleAuthClick`, `handleSignoutClick`, `updateLoginInfo`), calendars (`loadCalendars`, `listEvents`, `get_dataTime`, `process_all_events`, `create_event`, `gapi_resp_process`) and config (`setConfigFromDrive`). `js/data.js` swaps Google IDs for Azure AD client/tenant IDs and the OneDrive config share link. `index.html` swaps the Google `api.js` loader for MSAL.js and updates the login text and calendar embed area.
- **Dependencies**: Add `@azure/msal-browser` (vendored under `js/plugins/` to match the current plugin approach). Remove the Google API client.
- **External setup**: An Azure AD (Entra ID) app registration (SPA platform, redirect URI = app URL) with delegated Graph permissions `User.Read`, `Calendars.ReadWrite`, `Calendars.ReadWrite.Shared`, `Files.Read.All`. The workspace config JSON goes in OneDrive/SharePoint and is shared with app users. A Slack Incoming Webhook is created for the target channel.
- **Data**: Existing leave history in Google Calendar is not migrated by this change. Reports only show events that exist in the selected Teams/Outlook calendar.
- **Security**: The Slack webhook URL is visible to any signed-in user who can read the config file. This is an accepted trade-off for a static frontend.
