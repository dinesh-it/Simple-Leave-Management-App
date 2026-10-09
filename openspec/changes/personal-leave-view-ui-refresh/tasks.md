# Tasks

**Setup for the checks below:**
- Serve the app locally (`python3 -m http.server 5173`, open `http://localhost:5173/`).
- Headless checks use Playwright with `js/msgraph.js` replaced by a stub that has fake sign-in and calendar data:
  - an admin (given name in `adminNames`) and a non-admin
  - events for at least three people
  - half-day, multi-day across a weekend, `HBD`, today, tomorrow and previous-year events
- The real-account pass is done by the user.

## 1. Baseline and vendored libraries

- [x] 1.1 Before changing any code, record the current build's outputs on the stubbed data: rows, counts table, own counts, birthdays and monthly report. Save them as `tests/fixtures/baseline.json`, for comparison in 2.6 and 9.2. Verify the file lists the rows for every stub event.
- [x] 1.2 Download and pin Bootstrap 5.3.x (CSS and bundle JS), Bootstrap Icons (CSS and woff2) and Chart.js 4.x (UMD) into `vendor/`, and record versions and source URLs in `vendor/VERSIONS.md`. Verify each file loads with HTTP 200 from the local server.

## 2. Core logic (`js/app/leave.js`, `config.js`, `calendar.js`, `state.js`)

- [x] 2.1 Port the summary parsing, event spans, day counts and row building into `leave.js` (`splitSummary`, `eventSpan`, `daysDiff`, `toRow`), with the same rules as `main.js`: `:`/`-` separators, type before or after the name, `H` half days, the `HBD` exception, the full-name exception, and first name only. Verify with `node --test tests/leave.test.mjs`, covering each rule.
- [x] 2.2 Add `isOwnEvent`, `computeBalance` (current year, half days, ignores filters), `userLimit` (with extra allowance), `birthdays`, `whosOut` and `personSummary` to `leave.js`. Verify with tests for the balance scenarios in the spec (18+2 with 5 used → 15 remaining; 13 of 12 SL → 1 over) and for an unreadable profile matching nothing.
- [x] 2.3 Add `monthlyReport` to `leave.js`, the former `cumulative_data`, giving dates per person, month and type. Verify with a test against the baseline from 1.1.
- [x] 2.4 Create `config.js` to load the workspace config through `graph_share_id`, apply the same keys and defaults as `apply_workspace_config`, and set up moment holidays. Verify that a malformed config shows an error and stops loading, and that a missing key falls back to its default.
- [x] 2.5 Create `calendar.js` with the group lookup (`calendarGroupId` or by name), `fetchEvents(from, to)` (not cancelled, mapped with `to_legacy_event`) and `createEvent`. Create `state.js` holding `ownEvents`, admin-only `teamEvents`, `yearOwnEvents` and per-range caching. Verify in the stubbed browser that a non-admin's state never holds `teamEvents` and holds only own events.
- [x] 2.6 Verify parity: for the same stub data, `toRow` and `personSummary` results equal the baseline rows and counts from 1.1, apart from documented fixes. Write any intentional difference into this task.
  Rows, the per-person counts, the own balances, the birthdays and the monthly report data match the baseline exactly (`tests/leave.test.mjs`). Intentional differences:
  - Highlights: "today" now means the leave covers today, and "tomorrow" means it starts on the next calendar day. The old check matched the day-of-month inside the dates text, which missed some ranges and could mark the wrong rows.
  - Birthdays use the event's real date. The old code used the start date after it had been moved to the next business day.
  - Month-wise chart: each leave day is counted in the month it falls in. The old chart put every day of a multi-day leave into its start month. The day-wise chart and the gauges are removed.
  - Monthly report: months are listed in calendar order (the old order was the order of the first event in each month).
  - Balance: computed from the current year only and independent of the filters. The old value depended on the first table draw.

- [x] 2.7 Support optional holidays:
  - The calendar titles them `OPH: Name`, the workspace config calls the type `OH`. Treat both names as one type, `OPH`, in titles and in all config keys (typeFilter, removeEvents, eventLimits, userExtraAllowance).
  - Add OPH to the default types, the Add Leave form, the Help legend and the colours.

  Verify with `node --test` (OH config + OPH events) and the browser check (OPH card counted against the OH limit, Add Leave posts `OPH: <name>`).

## 3. App shell, sign-in and navigation

- [x] 3.1 Write the new `index.html`:
  - `<!doctype html>`, the MSAL redirect bridge kept first and unchanged, the classic scripts, then `js/app/main.js` as a module, with version query strings.
  - The sign-in screen, a sticky top bar (brand, Personal tab, Team tab placeholder, actions, user dropdown with Logout), the view containers, and the modals/offcanvas for Holidays, Birthdays, Help, Add Leave and Monthly report.
  - Verify the page loads with no console errors and no 404s.
- [x] 3.2 Implement the boot flow in `main.js`: MSAL init and restoring the session, Login, the config, `/me` with admin detection (fail closed), the calendar lookup, the current-year fetch, then the first render. Verify both stub roles reach the Personal view, and a failing `/me` stub gives the empty Personal view and no Team tab.
- [x] 3.3 Add hash routing (`#personal` / `#team`, Personal by default, back button). Load `views/team.js` with dynamic `import()` only for admins, and rewrite a non-admin's `#team` to `#personal`. Verify that a non-admin opening `/#team` sees Personal with no Team markup in the DOM, and that an admin's tab switching updates the hash and the back button works.
- [x] 3.4 Fill in the Holidays modal (past dates hidden with a "Show past" toggle, colour by weekday/past), the Birthdays modal (everyone, sorted by next date, weekend/holiday marked), the Help offcanvas (legend, half-day rule, naming rule, colour meanings) and the Calendar action (hidden without `calendarLink`). Verify each one as a non-admin.
- [x] 3.5 Add `ui.js` helpers: `esc()`, toasts, the alert modal and the loading indicator. Replace every `alert()` and `confirm()`. Verify that an event titled `PL: <img src=x onerror=alert(1)>` renders as text in every list.
- [x] 3.6 Implement Logout through the user menu (`msal_logout`, then show the sign-in screen). Verify with the stub.

## 4. Personal view (`views/personal.js`)

- [x] 4.1 Add the balance cards: one per `eventLimits` type, with used, remaining or "N over limit", "of <limit>", a progress bar, and warning (>80%) / danger (≥100%) styles, from `yearOwnEvents` only. Verify the spec scenarios, and that changing the range does not change the cards.
- [x] 4.2 Add the Upcoming list (next 5 own leaves from today, with today/tomorrow badges) and "No upcoming leave". Verify with and without upcoming stub events.
- [x] 4.3 Add "My leaves" with the table component (`components/table.js`): sort, text search, type checkboxes, From/To date inputs and Apply, the today/tomorrow/future highlight and legend, pagination (10 rows per page), and the empty state with the naming rule. Verify only own rows for both roles, and that search and clearing filters never show others.
- [x] 4.4 Add Excel download of My leaves from the filtered rows (`export.js`). Verify the downloaded file has exactly the visible filtered rows.

- [x] 4.5 Add a "Leave days per month" chart to the Personal view, next to Upcoming:
  - own leave days per month, stacked by type, built from the rows My leaves shows
  - the chart code (`components/charts.js`) is shared with the Team view's charts

  Verify with the browser check: 3 PL in Mar, 0.5 SL in May, 4 SL in Dec for the stub user; the SL filter removes SL; an empty range shows the empty message.

## 5. Team view (`views/team.js`, admins only)

- [x] 5.1 Add the Who's out card, with Today and Later this week as tabs: today (names, types, half-day marks, present count = `totalEmps` minus people out) and each remaining working day of the week, with "Nobody is out". Verify the spec scenarios with today's stub events.
- [x] 5.2 Add the team list: person select, type checkboxes (`removeEvents` deselected), From/To, text search, sort, highlight, pagination and filtered Excel download. Verify the person filter, the default type filter and that the download matches the filter.
- [x] 5.3 Add the per-person summary from the filtered rows: days per type, remaining on hover/focus, warning/danger against each person's limit, and selecting a row sets the person filter. Verify the spec scenarios.
- [x] 5.4 Add the Chart.js month-wise (stacked) and person-wise (stacked) charts, at the top of the Team view (month-wise next to the Who's out card, person-wise full width below), from the filtered rows, with fixed colours per type and a "No data" state. Verify that the charts change with the SL filter and show "No data" for an empty filter.
- [x] 5.5 Add the Monthly report dialog: month checkboxes for the listed year (last month preselected), xlsx download built from `monthlyReport`, and "No records found" when empty. Verify a file is downloaded for a month with data and none for an empty month.

- [x] 5.6 Show next week in the second Who's out tab when this week has no working day left (Friday, weekend, before a Friday holiday), labelled "Next week". Verify with `node --test` (Wed, Fri, Sat, Sun, Thursday before a holiday, next week with a holiday) and the browser check on a Friday and a Saturday.

- [x] 5.7 Place the Team leaves list and the per-person summary side by side (two thirds / one third, from `xl`), and replace "Show more" with pagination in the table component (50 rows per page in the Team list, 10 in My leaves). Verify with the browser check: side by side at 1280px, page 2 of a 60+ row team list and of My leaves, back to page 1 after a filter change, summary and download still cover all matching rows.

- [x] 5.8 Add a person search box to the per-person summary, and give its rows the same height as the Team leaves rows (the "N left" note on the same line). Verify with the browser check: "mee" shows only Meena, clearing it shows everyone, and the first rows of both tables are equally high.

- [x] 5.9 Leave comp-off (CO) out of the per-person summary (no column, no row for CO only), and narrow the gap between the side-by-side Team cards to 8px. Verify with the browser check: a CO event is listed in Team leaves but not in the summary, and the gaps measure 8px.

- [x] 5.10 Add a Download (Excel) to the per-person summary (days per type, days left for limited types, the rows shown), and make clicking a person put the name in the summary's Search person box and the Team leaves Person filter (kept in step both ways, clearing shows everyone). Verify with the browser check: the downloaded file has the header and values, clicking Priya fills both and lists only Priya, clearing Search person shows everyone, choosing in the Person filter fills Search person.

- [x] 5.11 Readable charts with many people: every name on the person-wise axis (no skipping, slanted), only totals on the person-wise bars, a number on every month-wise segment, and tooltips listing the days per type and the total of a bar. Verify with the browser check on 27 and 50 people: all names, one total per person bar, all month segments numbered.

## 6. Add Leave (`add-leave.js`)

- [x] 6.1 Build the dialog with leave type, the quick date choices (Today/Tomorrow/Yesterday/Other, moving to the next working day on holidays or weekends), full/first half/second half, from/to/days kept in sync with native date inputs, location and description. Verify each control, including a Saturday "Today".
- [x] 6.2 Add the remaining-balance hint and the after-request hint ("N remaining" / "N over limit (LOP)") using `computeBalance` and `userLimit`, plus holiday/weekend warnings on the from and to dates. Verify the spec scenarios (PL 4 remaining, 2 days → 2 remain; SL 1 remaining, 3 days → 2 over).
- [x] 6.3 Add the review step (title, from, to, part of day, Confirm/Back) and create through `calendar.createEvent`. Then post to Slack, close the dialog, show a toast and refresh the year and visible ranges. Verify the stub receives one correct event, and a cancelled review creates none.
- [x] 6.4 Lock the title for non-admins: no title field, and the title rebuilt as `[H]TYPE: <name>` just before create. Admins get an editable title. Verify that a non-admin with a forged title value still posts `TYPE: <name>`, and that an admin's edited title is kept.

## 7. Styling, theme and small screens

- [x] 7.1 Write the new `css/app.css` on Bootstrap 5 variables: highlight colours, type colours, cards and the sticky navbar, with dark variants. Set `data-bs-theme` from `prefers-color-scheme` and follow changes. Verify both themes with headless screenshots, with text, tables, charts and highlights readable.
- [x] 7.2 Make the layout work on small screens: the navbar collapses below `md`, tabs stay visible, balance cards go 2 per row on phones, and tables scroll inside their card. Verify at 375px: `scrollWidth <= innerWidth`, and the tabs and all actions are reachable.
- [x] 7.3 Do an accessibility pass: buttons and icons have labels, tabs use `role="tablist"` and `aria-selected`, sortable headers use `aria-sort`, and focus goes to the dialog on open. Verify keyboard-only use of the tabs, Add Leave and the table sort.

- [x] 7.4 Redesign the top bar as a clean app bar:
  - brand, underlined Personal/Team tabs, Add Leave, Holidays and Birthdays in the bar, and an initials avatar menu (name, role, Open calendar, Help / Legend, Logout)
  - below `md`: tabs on their own row and a floating Add Leave button

  Verify at 1280px and 375px that every action is reachable and the tabs are visible without opening a menu, with screenshots in light and dark.

## 8. Removing old code and docs

- [x] 8.1 Delete `js/main.js` and the unused vendored files: jQuery, jQuery UI, DataTables, yadcf, Highcharts, d3, liquid-fill, Bootstrap 3 CSS/JS, `css/fonts` glyphicons, `css/plugins` and the jQuery UI images. Verify that `grep -rn "jquery\|DataTable\|highcharts\|d3\." index.html js/app` finds nothing and the app still loads without 404s.
- [x] 8.2 Update `README.md`:
  - Personal/Team views and who sees what.
  - The "not a security control" and first-name caveats.
  - The new stack and the `vendor/VERSIONS.md` note.
  - `showFuelGauge` no longer used.
  - How to run the tests (`node --test`).
  - "Running locally" unchanged.

  Verify the README renders in a Markdown preview.

## 9. Verification

- [x] 9.1 Run the headless browser checks for a non-admin, an admin and a failing profile, at 1280px and 375px, in light and dark. They should cover every scenario in `specs/personal-leave-view/spec.md` and `specs/app-layout/spec.md` that can be automated, with no page errors. Verify all checks pass, and save screenshots to the scratchpad for review.
- [x] 9.2 Compare the new Team summary and monthly report against `tests/fixtures/baseline.json` on the same stub data. Verify they match, or that each difference is listed in 2.6.
- [x] 9.3 Run `node --test` and `openspec validate personal-leave-view-ui-refresh --strict`. Verify both pass.
- [ ] 9.4 Hand over to the user for a real-account check: sign in as an admin and as a non-admin against the real calendar and config, and add one test leave and delete it in Outlook. Verify the user confirms, or record the issues found as follow-ups.
