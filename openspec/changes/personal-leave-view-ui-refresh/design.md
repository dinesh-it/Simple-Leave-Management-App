# Design

## Context

The app is static files served over http: `index.html`, `css/app.css`, `js/main.js` (about 1,900 lines of globals), and classic scripts `js/data.js`, `js/msgraph.js` and `js/slack.js`. It is built on jQuery 1.12, jQuery UI (datepickers, autocomplete), Bootstrap 3, DataTables 1.10 with yadcf (tables and column filters), Highcharts (charts) and d3 with liquid-fill (gauges). moment and moment-business-days handle the date math with company holidays, and ExcellentExport 3 handles Excel downloads.

Data flow today:
1. `msal_init` restores the session.
2. The workspace config is loaded from OneDrive.
3. `/me` is read, which sets `login_name` and `admin_login`.
4. The group calendar is found.
5. `listEvents` fetches `calendarView`.
6. `process_all_events` builds the table rows `[type, name, date, "Mon, Day", dates, days]`, the `cumulative_data` used by the monthly report, and the birthdays.
7. The table's filter events trigger `calculate_counts`, which builds the counts table, the charts and the gauges.

The uncommitted first pass of this change added an own-events filter, balance cards and a Bootstrap 3 restyle on top of that code. This design replaces that first pass.

`msgraph.js` and `slack.js` have no jQuery dependency, and ExcellentExport is a standalone UMD library with a data-array API (`ExcellentExport.convert`).

Requirements are in `specs/personal-leave-view/spec.md` and `specs/app-layout/spec.md`. The motivation is in proposal.md.

## Goals / Non-Goals

**Goals:**
- One clean code base on Bootstrap 5.3 and plain ES modules, with no build step, no runtime CDN, and no jQuery.
- Keep the leave math (summary parsing, business-day counting, half days, balances, monthly report data) giving the same numbers as today, and cover it with tests.
- Make the Personal/Team separation structural: the Team view is never built for non-admins.

**Non-Goals:**
- Changing Microsoft Graph permissions, the Entra app registration, the workspace config schema, `msgraph.js` or `slack.js`.
- Real data isolation (per-user calendars or a backend).
- Approve/deny, editing or deleting events.
- Fixing first-name collisions (see Risks).
- Translations; supporting browsers without ES modules.

## Decisions

### 1. Dependencies, vendored like today
- **Added** under `vendor/`:
  - Bootstrap 5.3.x: `bootstrap.min.css` and `bootstrap.bundle.min.js` (includes Popper).
  - Bootstrap Icons: CSS and woff2 font.
  - Chart.js 4.x UMD build.

  Exact versions are pinned and recorded in a `vendor/VERSIONS.md` file. The files are downloaded once during implementation from npm (via jsdelivr), as the current `js/plugins` files are.
- **Kept:**
  - `msal-browser` and `msal-redirect-bridge` 5.22.0, for sign-in.
  - `moment-with-locales` and `moment-business-days`. They keep the day counts identical, because `businessDiff`, `businessAdd` and `nextBusinessDay` with the configured holidays drive every count.
  - `excellentexport` 3.
- **Removed:** jQuery, jQuery UI, DataTables, yadcf, Highcharts, d3, liquid-fill, Bootstrap 3 CSS/JS and the glyphicons fonts.

*Alternatives:*
- Use a CDN: rejected, so the app keeps working where CDNs are blocked and matches the current self-hosting.
- Replace moment with our own business-day helpers: rejected for now. Any small difference in counting would change people's balances. moment is isolated in `leave.js`, so it can be swapped later behind the tests.
- Keep DataTables 2: rejected per the user's choice of plain JS. The tables needed here (sort, filter, "show more", export) are small.

### 2. Code structure: ES modules under `js/app/`
`index.html` loads the classic scripts first, because they define globals and the MSAL bridge has to run before anything else: `data.js`, `msgraph.js`, `slack.js`, moment, moment-business-days, excellentexport, bootstrap.bundle and chart.js. It then loads `<script type="module" src="js/app/main.js">`.

| Module | Responsibility |
|---|---|
| `main.js` | Boot: MSAL init, sign-in state, load config, `/me`, admin detection, find the calendar, first load, routing |
| `config.js` | Load and parse `workspace-config.json` and apply defaults (same keys as today) |
| `calendar.js` | Group lookup, `fetchEvents(from, to)`, `createEvent(...)` (wraps `graph_*` and `to_legacy_event`) |
| `leave.js` | Pure leave math: `splitSummary`, `eventSpan`, `daysDiff`, `toRow`, `isOwnEvent`, `computeBalance`, `birthdays`, `whosOut`, `monthlyReport`, `personSummary`. Ported from `main.js` with the same rules (including the existing full-name exception and the `H` half-day prefix) |
| `state.js` | Small store: `user`, `isAdmin`, `config`, `ownEvents`, `teamEvents` (admins only), `yearOwnEvents`. Views subscribe and re-render when it changes |
| `views/personal.js` | Balance cards, Upcoming, My leaves |
| `views/team.js` | Who's out, team list and filters, summary, charts, monthly report |
| `components/table.js` | Sortable, filterable table with row highlighting and "show more" |
| `components/ui.js` | `esc()`, alert and toast helpers, modal helpers, the loading indicator |
| `add-leave.js` | Add Leave dialog logic |
| `export.js` | Excel export from row arrays |

`js/main.js` and the old `css/app.css` are deleted. The new styles go in `css/app.css` and are rewritten.

*Why modules:* each piece can be tested and read on its own, and there are no globals between them. Module scripts need http serving, which MSAL already requires.

### 3. Personal/Team separation in the data layer
After each `fetchEvents`:
- `ownEvents` = the events where `isOwnEvent` is true, kept for everyone.
- `teamEvents` = all events, kept only when `isAdmin`.
- The birthdays list is built from all events before anything is dropped. For non-admins the full array then goes out of scope.

The Personal view only ever reads `ownEvents`, and the Team view only reads `teamEvents`. `views/team.js` is loaded with a dynamic `import()` only when `isAdmin`, and its DOM section is created by that module. For a non-admin the page contains no Team markup at all.

`isAdmin` and the user name are settled before the first fetch. If `/me` fails, the user is a non-admin with no name, so `isOwnEvent` returns false and the app fails closed.

*Alternative:* one data set filtered by CSS or a table filter, as in the first pass. Rejected because admins would still get a mixed table, and the data would be in the DOM for non-admins.

### 4. Date ranges and the balance snapshot
- Each view has its own From/To range, defaulting to the current year, and fetches its own range. Ranges are cached by `from|to`, so switching tabs does not refetch.
- The balance always comes from `yearOwnEvents`, a current-year fetch made at boot, as in the first-pass design. Adding an event refetches the current year and the visible ranges.
- `?from=` / `?to=` URL parameters (MM/DD/YYYY, as today) set the initial range of the open view. `?search=` pre-fills the open view's text search.

### 5. Rendering and escaping
- Views render with template literals into their containers. Event summaries, locations and names come from the calendar and can contain HTML, so every value from the calendar or the config goes through `esc()`. The old code inserted them unescaped.
- There is no virtual DOM. Lists re-render on state or filter changes, which is fine for the size of the data (hundreds of events a year).

### 6. Table component
- Input: column definitions (key, label, sort value, optional class and hide-on-xs flag), rows, a row-class function (today/tomorrow/future), and an initial sort.
- Clicking a column header sorts the table, with `aria-sort` set.
- Text search runs over the visible columns.
- External filters (type checkboxes, person select, range) are applied before the component gets the rows.
- The first 50 rows are shown, with a "Show more" button for the rest.
- The table returns the filtered rows, so the Excel export, the summary and the charts all use exactly the rows that match.

### 7. Excel export
`export.js` builds sheets from row arrays with `ExcellentExport.convert({format: 'xlsx', filename}, [{name, from: {array}}])`, so a download never depends on what is currently rendered. The monthly report keeps today's layout: for each month, a header, then one row per person with their dates per type. It is built from `leave.monthlyReport` (the former `cumulative_data`). If the vendored ExcellentExport cannot write xlsx, it falls back to the current `.xls` HTML-table export.

### 8. Charts
The chart code is in `components/charts.js`, shared by both views. Chart.js bar charts, `stacked: true`, one dataset per leave type with a fixed colour per type, so a type has the same colour in both charts:
- **Month-wise:** Jan–Dec, days per type.
- **Person-wise:** vertical bars, one per person (most days first), days per type. At the top of the Team view, the month-wise chart takes the left half next to the Who's out card (Today / Later this week tabs), and the person-wise chart is full width below them.

Both are built from the team list's filtered rows. The Personal view has the same month-wise chart for the user's own rows, built from what My leaves shows. Chart instances are destroyed and recreated when the filters change. Chart colours read Bootstrap CSS variables, so dark mode stays readable.

### 9. Who's out
`leave.whosOut(teamEvents, date)` returns `[{name, type, half}]` for each working day from today to Friday, using the same spans as the list. The present count is `totalEmps` minus the number of people out (a half day counts as 0.5), counting every type except `HBD` and `-`, as the old gauge did. It replaces the gauges and `today_events` bookkeeping. `showFuelGauge` is no longer read.

### 10. Add Leave dialog
- A Bootstrap 5 modal using native `<input type="date">`.
- The quick choices, the holiday/weekend checks, the from/to/days sync and the remaining-balance hints are ported from `bind_events`, using `leave.js` and moment-business-days.
- Submitting switches the dialog to a review step showing the title, from, to and part of day, with Confirm / Back buttons. This replaces `window.confirm`.
- For non-admins, the title field is not rendered, and the title is rebuilt as `[H]TYPE: <name>` in `add-leave.js` right before `createEvent`, ignoring any form value.
- After a successful create, the dialog posts to Slack (`notify_slack_event_created`, unchanged) and refreshes the state.

### 11. Navigation, layout and styling
- **Top bar:** one slim, sticky Bootstrap `navbar`:
  - Left: the brand, then the Personal/Team tabs as underlined `nav` links (Team for admins only).
  - Right:
    - Add Leave (`btn-primary`)
    - Holidays and Birthdays as quiet icon+label buttons (icon only below `xl`)
    - a round avatar with the user's initials, whose dropdown holds the name, Admin/Member, Open calendar, Help / Legend and Logout

  There is no collapsing hamburger menu. Below `md`, the tabs wrap onto their own row and Add Leave becomes a floating button in the bottom-right corner, so nothing is hidden behind a toggle. This replaced a first version with six outlined buttons, which was too busy.
- **Routing:** the hash (`#personal` / `#team`) is the source of truth, and `hashchange` switches views. A non-admin's `#team` is rewritten to `#personal`.
- **Content:** a `container-xl`. Cards use `.card`, and balance cards sit in a `row row-cols-2 row-cols-md-4 g-3` grid.
- **Modals:** Holidays, Birthdays, Help (an offcanvas on the right), Add Leave, Monthly report.
- **Errors and notices:** shown with a toast or an alert modal instead of `alert()`.
- **Theme:** `<html data-bs-theme>` is set from `matchMedia('(prefers-color-scheme: dark)')` and updated when it changes. Custom colours (the highlights, the type colours) are CSS variables with dark variants.
- **Doctype:** the page gets `<!doctype html>` (standards mode). This is required by Bootstrap 5, and its absence caused the quirks-mode card bug in the first pass.

### 12. Tests and verification
- `leave.js` is pure and takes moment as an import. `tests/leave.test.mjs` runs with `node --test`. It loads the vendored moment files through `createRequire` and covers:
  - summary parsing: `TYPE: Name`, `Name - TYPE`, `H` prefix, `HBD`, the full-name exception
  - spans and day counts across weekends and holidays
  - year clipping
  - balance with extra allowance
  - `isOwnEvent`
  - `whosOut`
  - `monthlyReport`
- UI behaviour is verified with a headless browser and a stubbed `msgraph.js`, as in the first pass, for both roles and at 375px.

## Risks / Trade-offs

- [Rewrite changes leave counts people rely on] → Port the math as is into `leave.js` and pin it with tests built from the current code's outputs before deleting `main.js`. Compare the counts table of the old and new builds on the same stubbed data.
- [Not a security boundary: group members can read the whole calendar in Outlook / Teams / Graph] → Documented in the README (spec requirement).
- [First-name matching: same-first-name colleagues see each other's leave, nicknames see nothing, and a non-admin sharing an admin's first name gets the Team view] → Unchanged from today and documented. The empty state explains the naming rule.
- [Bigger change than the first pass, regressions in less-used features (monthly report, holidays "show past")] → Every existing feature is listed in the tasks with a check, and the old/new comparison runs on stubbed data.
- [Dropped features (day-wise chart, gauges, global regex search) may be missed] → Listed as removed in the proposal and README, and easy to add back as Chart.js charts.
- [Module scripts and modern CSS exclude very old browsers] → Acceptable: MSAL 5 already requires modern browsers.

## Migration Plan

- Deploy as static files as before. There are no config or Entra changes. `showFuelGauge` can be left in the config, it is ignored.
- The `index.html` asset URLs carry new version query strings, so browsers load the new files.
- Rollback: redeploy the previous commit (the old files are removed in the same change, so a rollback restores them together).
