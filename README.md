# Simple-Leave-Management-App

* This app uses a shared Microsoft 365 (Teams / Outlook) calendar and Microsoft Graph to give user a simple web interface for leave management
* Dont consider this application as an Office portal, this app simply present the calendar events in a different way with some filters and option
* It has very limited features and features getting added day by day
* Authentication and security is based on the permissions you have for your shared calendar
* It uses Microsoft 365 sign in (MSAL.js) for login and session - So user no need to have a seperate login credentials
* Whenever an event is created from the app, a message is posted to Slack (optional)
* App does not have a approve/deney etc.. options yet. (Will be added soon)
* Depends on `js/data.js` for the app registration ids and a workspace config file in OneDrive (see below)
* Code is very bad as of now - Improvements and PR's are welcome

## Microsoft 365 setup

1. **Register the app** in the Microsoft Entra admin center (https://entra.microsoft.com):
   *Identity > Applications > App registrations > New registration*
   * Supported account types: *Accounts in this organizational directory only (Single tenant)*
   * Redirect URI: platform **Single-page application (SPA)**, the exact URL the app is opened from,
     e.g. `https://leave.example.com/`. For local testing also add `http://localhost:5173/`
     (add it with and without the trailing slash to be safe). Do not use the "Web" platform
     (sign in fails with `AADSTS9002326`) and do not create a client secret.
2. **API permissions** > Add a permission > Microsoft Graph > **Delegated**:
   `User.Read`, `Group.ReadWrite.All`, `Files.Read.All`
   (`Group.ReadWrite.All` is needed for the Microsoft 365 group calendar, the `Calendars.*` permissions do not cover group calendars)
3. **Admin consent**: a tenant admin clicks *Grant admin consent for &lt;org&gt;* on the API permissions page
   (or opens `https://login.microsoftonline.com/<TENANT_ID>/adminconsent?client_id=<CLIENT_ID>` once).
   `Group.ReadWrite.All` always needs admin consent, until consent is granted users see "Need admin approval".
4. Copy *Application (client) ID* and *Directory (tenant) ID* from the app's Overview page into `js/data.js`
   (`CLIENT_ID`, `TENANT_ID`).
5. The leave calendar is the calendar of a Microsoft 365 group, every user of the app must be a member of that group.
   The app only uses the group named by `calendarName` in the workspace config (default `Shared Vacation (IN)`),
   or the group with the id `calendarGroupId` when it is set.

## Workspace config (OneDrive)

The workspace settings live in a JSON file, e.g. `workspace-config.json`, in OneDrive or SharePoint.
Share it (read only) with the users of the app, copy the sharing link and set it as `CONFIG_SHARE_URL` in `js/data.js`.
Only signed in users who can open the file can use the app.

```json
{
    "companyName": "Company",
    "typeFilter": ["PL", "SL", "ML", "PTL", "MTL", "RL", "WFH", "CO", "LOP", "HBD", "-"],
    "removeEvents": ["-", "HBD", "MTL", "PTL", "ML", "RL", "LOP"],
    "totalEmps": 27,
    "eventLimits": { "PL": 18, "SL": 12 },
    "adminNames": { "DINESH": 1 },
    "showFuelGauge": false,
    "holidayList": { "2026-01-26": "Republic Day" },
    "userExtraAllowance": { "Dinesh": { "PL": 2 } },
    "slackWebhookUrl": "https://hooks.slack.com/services/XXX/YYY/ZZZ",
    "calendarName": "Shared Vacation (IN)",
    "calendarLink": "https://outlook.office.com/calendar/view/month"
}
```

* The keys are the same as the old Google Docs config, the content can be copied as is.
* `slackWebhookUrl` (optional): Slack Incoming Webhook to post to whenever an event is created from the app.
  Create it from a Slack app with *Incoming Webhooks* enabled, for the target channel.
  Leave it out to disable Slack messages.
* `calendarName` (optional): display name of the Microsoft 365 group whose calendar the app reads and writes, default `Shared Vacation (IN)`.
* `calendarGroupId` (optional): object id of that group, skips the lookup by name.
* `calendarLink` (optional): URL opened by the calendar button (Outlook / Teams calendar), the button is hidden without it.

Notes on Slack:
* Only events created from the app's Add Event form are posted, not events added directly in Outlook / Teams.
* The webhook URL is readable by every user who can open the config file, keep the file's sharing limited and
  rotate the webhook if it leaks.
* Browsers can not read Slack's response (Slack does not allow CORS), so a revoked / invalid webhook fails silently,
  only network errors are logged in the browser console. Creating the event is never affected.

## Running locally

The app is static files, but it has to be served over http (not opened as a `file://` page) for Microsoft sign in:

```
python3 -m http.server 5173
```

and open `http://localhost:5173/` (this URL must be a registered redirect URI).
