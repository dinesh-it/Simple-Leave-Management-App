# Spec Delta

## Purpose

Defines the structure and behaviour of the signed-in leave app: the top bar and the Personal and Team views, what each view contains, the Add Leave form, the Help panel, and how the app adapts to small screens.

## ADDED Requirements

### Requirement: Sign-in screen
When no user is signed in, the system SHALL show only a sign-in screen with the company name and a Login action for the Microsoft 365 / Teams account. It SHALL hide the top bar actions and all leave data.

#### Scenario: Signed out
- **WHEN** the app is opened without an active Microsoft session
- **THEN** only the sign-in screen with a Login action is shown

### Requirement: Top bar
When a user is signed in, the system SHALL show one slim top bar with:
- the company name
- the view tabs, shown as underlined tabs (Personal for everyone, Team for admins only)
- the Add Leave action
- Holidays and Birthdays directly in the bar (icon and label on wide screens, icon only with a tooltip on narrower ones)
- a user menu shown as the user's initials, containing:
  - the user's name and their role (Admin or Member)
  - Open calendar, only when a calendar link is configured
  - Help / Legend
  - Logout

On screens narrower than 768px:
- the brand, Holidays, Birthdays and the user menu SHALL share the first row
- the tabs SHALL be on their own row below it
- Add Leave SHALL be a floating button

#### Scenario: Regular user top bar
- **WHEN** a non-admin user is signed in and a calendar link is configured
- **THEN** the top bar shows the company name, the Personal tab only, Add Leave, Holidays, Birthdays and the user's initials, and the user menu contains Open calendar, Help / Legend and Logout

#### Scenario: Admin top bar
- **WHEN** an admin user is signed in
- **THEN** the top bar shows both the Personal and Team tabs, and the user menu says Admin

#### Scenario: No calendar link
- **WHEN** the workspace config has no calendar link
- **THEN** the user menu has no Open calendar entry

#### Scenario: Logout
- **WHEN** the user chooses Logout in the user menu
- **THEN** the Microsoft session for the app ends and the sign-in screen is shown

#### Scenario: Phone
- **WHEN** the app is opened on a 375px-wide screen
- **THEN** the tabs, Holidays and Birthdays are visible without opening any menu, and Add Leave is a floating button

### Requirement: Switching views
The system SHALL show one view at a time and SHALL reflect the current view in the page address (`#personal` or `#team`), so that a view can be bookmarked and the browser back button switches views. The Personal view SHALL be the default.

#### Scenario: Admin switches to Team
- **WHEN** an admin selects the Team tab
- **THEN** the Team view is shown, the Personal view is hidden, and the address ends with `#team`

#### Scenario: Default view
- **WHEN** an admin opens the app without a view in the address
- **THEN** the Personal view is shown

### Requirement: Personal view layout
The Personal view SHALL show, from top to bottom:
1. The user's leave balance cards.
2. Side by side on wide screens: an "Upcoming" list of the user's leave from today onwards (the next 5), and a "Leave days per month" chart.
3. The "My leaves" list.

The "Leave days per month" chart SHALL show the user's own leave days for each month (Jan to Dec), stacked by leave type, in the leave type colours. Half days count as 0.5. Each day counts in the month it falls in. The chart SHALL use exactly the rows that My leaves shows (date range, type filter and search). Each bar SHALL show its number of days, and a month with more than one type SHALL also show its total.

The "My leaves" list SHALL have columns for leave type, start date, day of week, dates covered and total days. It SHALL be sortable by column, filterable by leave type and date range, searchable by text, and downloadable to Excel. The date range SHALL default to the current calendar year.

#### Scenario: Page order
- **WHEN** a signed-in user's Personal view finishes loading
- **THEN** the balance cards are first, then Upcoming and the monthly chart, then My leaves

#### Scenario: Monthly chart
- **WHEN** the user has 3 PL days in March, a half-day SL in May and a 4-day SL from 28 to 31 December
- **THEN** the chart shows 3 PL in March, 0.5 SL in May and 4 SL in December, and nothing in the other months

#### Scenario: Chart follows the filters
- **WHEN** the user deselects SL in the My leaves type filter
- **THEN** the chart no longer shows SL days

#### Scenario: No leave in range
- **WHEN** the chosen range has none of the user's leave
- **THEN** the chart area shows "No leave in this range"

#### Scenario: Date range filter
- **WHEN** the user picks a From and To date and applies them
- **THEN** My leaves is rebuilt for that range and the balance cards are unchanged

#### Scenario: Type filter
- **WHEN** the user deselects WFH in the type filter
- **THEN** WFH events are not shown in My leaves

#### Scenario: Nothing upcoming
- **WHEN** the user has no leave from today onwards
- **THEN** the Upcoming list shows "No upcoming leave"

### Requirement: Team view – who's out
The Team view SHALL show who is out today and who is out on each remaining working day of the current week, as two tabs ("Today", shown first, and "Later this week") of one Who's out card next to the month-wise chart. When no working day is left in the current week (on a Friday, at the weekend, or before a Friday holiday), the second tab SHALL be "Next week" and SHALL show Monday to Friday of the next week (holidays skipped). Each entry SHALL show the person's name and leave type and SHALL mark half days. Today's panel SHALL also show the number of people present in the office today: the configured total employees minus everyone with a leave or WFH event today (a half day counts as half), as the current "Today Present" gauge does.

#### Scenario: Out today
- **WHEN** Arun has SL today and Priya has a first-half PL today
- **THEN** today's panel lists Arun (SL) and Priya (PL, half day)

#### Scenario: Present count
- **WHEN** total employees is 10, one person has SL today and one person has a half-day PL today
- **THEN** today's panel shows 8.5 present

#### Scenario: Friday shows next week
- **WHEN** today is Friday and Meena has PL from Friday to the next Tuesday
- **THEN** the second tab is "Next week" and lists Monday to Friday of next week, with Meena out on Monday and Tuesday

#### Scenario: Weekend
- **WHEN** today is Saturday
- **THEN** the Today tab says it is not a working day and the "Next week" tab lists next week

#### Scenario: Nobody out
- **WHEN** nobody has leave today
- **THEN** today's panel says nobody is out

### Requirement: Team view – team leave list
The Team view SHALL show a list of everyone's leave with columns for leave type, name, start date, day of week, dates covered and total days. It SHALL be filterable by person, leave type and date range, searchable by text, sortable by column, and downloadable to Excel. The download SHALL contain exactly the rows that match the current filters. The date range SHALL default to the current calendar year. The leave types listed in the config's `removeEvents` SHALL start deselected in the type filter.

#### Scenario: Filter by person
- **WHEN** an admin selects "Arun" in the person filter
- **THEN** only Arun's events are listed

#### Scenario: Filtered download
- **WHEN** an admin filters to PL and downloads the list
- **THEN** the downloaded file contains only the PL rows shown

#### Scenario: Default type filter
- **WHEN** `removeEvents` contains "HBD" and "LOP"
- **THEN** the team list starts with HBD and LOP deselected in the type filter

### Requirement: Team view – per-person summary
The Team view SHALL show a summary table with one row per person and one column per leave type, giving the days taken in the Team view's current filters. Comp-off (CO) SHALL NOT be shown in the summary. For leave types with a limit, each cell SHALL show the remaining days on hover or focus. Cells above 80% of the person's limit (including their extra allowance) SHALL be marked as a warning, and cells at or over 100% as danger. Selecting a person's row SHALL put that person's name in the summary's Search person box and select that person in the team list's person filter, so the team list, the charts and the summary show only that person. Clearing or changing the Search person box SHALL reset the person filter to everyone, and choosing a person in the person filter SHALL put the name in the Search person box. A search box SHALL filter the summary rows by person name. The summary SHALL be downloadable to Excel, with the days per type and the days left for limited types, for the rows it shows.

#### Scenario: Warning colour
- **WHEN** a person has used 15 of 18 PL
- **THEN** that person's PL cell is marked as a warning

#### Scenario: Over limit
- **WHEN** a person has used 13 of 12 SL
- **THEN** that person's SL cell is marked as danger and its details say 1 over the limit

#### Scenario: Search a person
- **WHEN** an admin types "mee" in the summary's search box
- **THEN** only Meena's row is shown in the summary, and the team list is unchanged

#### Scenario: Select a person
- **WHEN** an admin selects Priya's row in the summary
- **THEN** "Priya" is put in the summary's Search person box and the person filter, and the team list and the summary show only Priya

#### Scenario: Clear the selected person
- **WHEN** the admin clears the Search person box after selecting Priya
- **THEN** the person filter goes back to everyone and the team list and summary show everyone again

#### Scenario: Download the summary
- **WHEN** an admin downloads the per person summary
- **THEN** an Excel file with one row per person shown, the days per type and the days left for limited types is downloaded

### Requirement: Team view – charts
The Team view SHALL show a month-wise chart (days per month, stacked by leave type) and a person-wise chart (days per person, stacked by leave type), both built from the team list's current filters. The month-wise bars SHALL show their numbers of days and stacks their totals, like the Personal chart. The person-wise chart SHALL show every person's name and only the total above each bar. Hovering a bar in any chart SHALL list its days per type and its total.

#### Scenario: Charts follow filters
- **WHEN** an admin filters the team list to SL
- **THEN** both charts show only SL days

#### Scenario: Many people
- **WHEN** the team list has 50 people
- **THEN** the person-wise chart shows all 50 names and one total above each bar, and hovering a bar shows that person's days per type and total

#### Scenario: No data
- **WHEN** the current filters match no events
- **THEN** the chart area shows a "No data" message instead of empty axes

### Requirement: Team view – monthly report
The Team view SHALL let an admin choose one or more months of the listed year and download an Excel report. For each chosen month, the report SHALL contain each person's leave dates per leave type, as the current monthly report does. When none of the chosen months has data, the system SHALL say so instead of downloading an empty file.

#### Scenario: Download last month
- **WHEN** an admin selects September and downloads
- **THEN** an Excel file with September's leave per person and type is downloaded

#### Scenario: No data in selected months
- **WHEN** the selected months contain no leave
- **THEN** the system shows "No records found" and does not download a file

### Requirement: Leave highlighting
In both the Personal and Team lists, the system SHALL visually distinguish leave that covers today, leave that starts tomorrow, and later leave, and SHALL show a legend for these markers next to each list.

#### Scenario: Highlighting
- **WHEN** a list contains an event covering today, one starting tomorrow and one next month
- **THEN** each of the three rows has a different highlight matching the legend

### Requirement: Help panel
The system SHALL provide a Help panel, opened from the top bar, with:
- the leave-type legend (PL, SL, OPH, WFH, ML, PTL, MTL, CO, RL, LOP)
- the half-day rule (an "H" prefix counts as half a day)
- the event naming rule (`TYPE: First name`)
- the meaning of the list highlights and balance colours

#### Scenario: Opening help
- **WHEN** the user opens Help
- **THEN** the legend, the half-day rule and the naming rule are shown

### Requirement: Add Leave form
The system SHALL provide an Add Leave form in a dialog with these fields:
- leave type
- a quick date choice (Today, Tomorrow, Yesterday, Other dates)
- a day choice: full, first half or second half
- for full days: a from date, a to date and the number of working days, kept in sync
- location and description

The form SHALL also:
- show the remaining balance for the selected type when it has a limit
- warn when the chosen dates fall on a holiday or weekend
- warn when the request goes past the remaining balance

Before creating the event, the system SHALL show a review of the title and dates inside the dialog. The event SHALL be created only after the user confirms. After the event is created, the dialog SHALL close and both views SHALL refresh.

#### Scenario: Remaining balance shown
- **WHEN** the user selects PL with 4 days remaining and chooses 2 days
- **THEN** the form shows that 2 days will remain after this request

#### Scenario: Request past the balance
- **WHEN** the user selects SL with 1 day remaining and chooses 3 days
- **THEN** the form shows that 2 days will be over the limit

#### Scenario: Half day
- **WHEN** the user picks First Half or Second Half
- **THEN** the form asks for a single date and hides the to date and number of days

#### Scenario: Review before create
- **WHEN** the user submits the form
- **THEN** the dialog shows the title, from and to dates, and creates the event only after the user confirms

#### Scenario: Weekend date
- **WHEN** the quick choice is Today and today is a Saturday
- **THEN** the form says today is a holiday and moves to the next working day

### Requirement: Light and dark appearance
The system SHALL follow the operating system's light or dark colour preference.

#### Scenario: Dark mode
- **WHEN** the operating system is set to dark mode
- **THEN** the app is shown in a dark colour scheme with readable text, tables, charts and highlights

### Requirement: Usable on small screens
The system SHALL lay out the signed-in app in a single column on screens narrower than 768px. On such screens:
- the tabs and the top bar actions SHALL stay reachable
- the balance cards SHALL wrap instead of overflowing
- the page SHALL NOT need horizontal scrolling, apart from inside tables

#### Scenario: Phone width
- **WHEN** the app is opened on a 375px-wide screen
- **THEN** the balance cards wrap, the tabs and actions are reachable, and the page body does not scroll sideways

### Requirement: Placeholder content removed
The system SHALL NOT show placeholder or developer text, such as "We can show some stats here - ideas are welcome".

#### Scenario: No placeholder text
- **WHEN** any signed-in user views either view
- **THEN** no placeholder or work-in-progress text is shown
