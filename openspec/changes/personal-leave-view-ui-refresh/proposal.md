# Proposal

## Why

Leave data is personal, but every signed-in user can see the whole team's leave: the event list, the per-person counts, the charts and the "who is out today" gauges. A first pass hid other people's events from non-admins, but admins still got one mixed page where their own leave and the team's leave sat in the same table. The page is also hard to use. The user's own balance is buried under gauges and an info board, and the layout breaks on phones. On top of that, the stack (Bootstrap 3, jQuery 1.12, jQuery UI, DataTables with yadcf, Highcharts, d3 gauges) is outdated, and Highcharts needs a paid license for company use. That makes a clean redesign on the current code impractical, so the app gets a full redesign on a current stack, with two clearly separated views.

## What Changes

- **BREAKING (behaviour)**: The app has two views.
  - **Personal** is shown to everyone. It contains only the signed-in user's own leave, also for admins.
  - **Team** is shown only to admins (users matched by `adminNames` in the workspace config) and contains everyone's leave.
  - Admins switch between the two with tabs, and Personal is the default. Non-admins have no Team tab and never get other people's leave data.
- Personal view:
  - "My leave balance" cards for each limited leave type: used, remaining and limit, including `userExtraAllowance`, for the current calendar year.
  - Upcoming leave.
  - A "My leaves" list with type and date-range filters, an empty state, and Excel download.
- Team view (admins):
  - "Who's out" for today and this week.
  - A team leave list with filters by person, type and date range, plus text search.
  - A per-person summary of used and remaining days, with near-limit and over-limit warnings.
  - Month-wise and person-wise charts.
  - The Excel monthly report.
- The company holidays and birthdays lists stay available to everyone.
- Non-admins can only add leave for themselves: the event title always uses their own name. Admins can still edit the title.
- **BREAKING (stack)**: The app is rewritten on Bootstrap 5.3 and plain modern JavaScript (ES modules), still as static files with no build step.
  - jQuery, jQuery UI, DataTables, yadcf, Highcharts, d3 and the liquid-fill gauges are removed.
  - Charts use Chart.js, dates use the browser's native date inputs, and tables use a small built-in table component.
- Removed features:
  - The day-of-week ("Day wise") chart.
  - The liquid-fill gauges, replaced by the "Who's out" panel. The `showFuelGauge` config key is ignored.
  - The global regex search bar, replaced by per-view filters and text search.
  - The placeholder and developer texts on the page.
- The leave-type legend and usage notes move into a Help panel. The app follows the system light/dark setting.

## Capabilities

### New Capabilities
- `personal-leave-view`: who can see and add which leave. Covers matching an event to the signed-in user, the Personal view showing only the user's own leave (also for admins), the Team view being for admins only, the personal balance, holidays and birthdays for everyone, adding leave only for yourself (non-admins), and the "not a security control" disclosure.
- `app-layout`: the structure and behaviour of the signed-in app. Covers the top bar and view tabs, the contents of the Personal and Team views (who's out, team list and filters, per-person summary, charts, monthly report), the Add Leave form, the Help panel, and small-screen behaviour.

### Modified Capabilities
<!-- openspec/specs/ has no main specs yet; the related microsoft-sign-in capability exists only in the change migrate-to-teams-calendar-slack-notify. This change relies on its "Admin detection from signed-in user" requirement and does not change it. -->
- None

## Impact

- `index.html`: replaced by a new Bootstrap 5 shell. The MSAL popup redirect bridge at the top of the page is kept as is.
- `js/main.js` (about 1,900 lines) and `css/app.css`: replaced by ES modules under `js/app/` and a new stylesheet.
- `js/msgraph.js`, `js/slack.js` and `js/data.js` keep their current role and API.
- Vendored libraries:
  - Added: Bootstrap 5.3 (CSS and bundle JS), Bootstrap Icons and Chart.js 4.
  - Removed: jQuery, jQuery UI, DataTables, yadcf, Highcharts, d3, liquid-fill gauge, Bootstrap 3 CSS/JS and the glyphicons fonts.
  - Kept: MSAL, moment, moment-business-days and ExcellentExport.
- Browser support: current evergreen browsers only (ES modules, CSS custom properties). The app already requires them for MSAL.
- No change to Microsoft Graph permissions, the Entra app registration or the workspace config format. `showFuelGauge` becomes unused.
- **Not a security boundary**: users are still members of the Microsoft 365 group and can read the full calendar in Outlook / Teams or through Graph. The views limit what the app shows, not what Graph returns. This is documented in the README.
