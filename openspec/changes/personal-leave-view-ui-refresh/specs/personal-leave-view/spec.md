# Spec Delta

## Purpose

Controls which leave events each signed-in user can see and add in the app. Everyone gets a Personal view with only their own leave, admins also get a Team view with everyone's leave, and company holidays and birthdays are shared with everyone.

## ADDED Requirements

### Requirement: Identify the signed-in user's events
The system SHALL treat a calendar event as belonging to the signed-in user when the name parsed from the event summary matches the user's first (given) name from their Microsoft profile, compared case-insensitively. The name is parsed with the existing summary rules: `TYPE: Name` or `TYPE - Name`, the type may be after the name, only the first name is used, and the existing full-name exception still applies. Optional holidays are titled `OPH` in the calendar. The type name `OH`, in the config or in a title, means the same type. When the user's profile cannot be read, no event SHALL be treated as theirs.

#### Scenario: Own event matched
- **WHEN** the signed-in user's given name is "Priya" and an event summary is "PL: priya"
- **THEN** the system treats the event as belonging to the signed-in user

#### Scenario: Half-day own event matched
- **WHEN** the signed-in user's given name is "Priya" and an event summary is "HSL: Priya"
- **THEN** the system treats the event as belonging to the signed-in user and counts it as half a day

#### Scenario: Other person's event
- **WHEN** the signed-in user's given name is "Priya" and an event summary is "PL: Arun"
- **THEN** the system does not treat the event as belonging to the signed-in user

#### Scenario: Optional holiday
- **WHEN** the workspace config lists the type as "OH" (with its limit) and the calendar event is titled "OPH: Priya"
- **THEN** the system treats the event as Priya's optional holiday (type OPH), counted against the OH limit

#### Scenario: Profile not readable
- **WHEN** the signed-in user's Microsoft profile cannot be read
- **THEN** no event is treated as the user's own, the Personal view is empty with an explanatory message, and no Team view is offered

### Requirement: Personal view shows only the user's own leave
The system SHALL give every signed-in user, admins included, a Personal view that contains only that user's own events in every place leave data appears: the leave list, upcoming leave, the balance cards, search and filter results, and downloads. Searching or clearing filters in the Personal view SHALL NOT reveal other people's events.

#### Scenario: Regular user
- **WHEN** a non-admin user signs in and the calendar has events for several people
- **THEN** the Personal view lists only that user's events

#### Scenario: Admin's Personal view
- **WHEN** an admin user opens the Personal view and the calendar has events for several people
- **THEN** the Personal view lists only the admin's own events, and the balance cards show the admin's own balance

#### Scenario: Clearing filters
- **WHEN** a user clears the search text and all filters in the Personal view
- **THEN** the list still contains only that user's events

#### Scenario: Downloading the list
- **WHEN** a user downloads the Personal leave list
- **THEN** the downloaded file contains only that user's events

#### Scenario: User with no events
- **WHEN** a user has no events in the selected range
- **THEN** the Personal view shows an empty-state message explaining that events must be titled `TYPE: <first name>`, and the balance cards show zero used

### Requirement: Team view is for admins only
The system SHALL offer a Team view, with everyone's events, only to admin users (as detected from the configured admin names). For non-admin users the system SHALL NOT render the Team view or its controls. That includes who's out, the team list, the per-person summary, the charts and the monthly report. The system SHALL NOT keep other people's events for non-admins beyond what is needed to build the shared birthdays list.

#### Scenario: Regular user has no Team view
- **WHEN** a non-admin user is signed in
- **THEN** there is no Team tab, and no team data or team controls are present on the page

#### Scenario: Regular user opens the Team address
- **WHEN** a non-admin user opens the app with the Team view address (e.g. `#team`)
- **THEN** the system shows the Personal view

#### Scenario: Admin has both views
- **WHEN** an admin user signs in
- **THEN** both the Personal and Team tabs are available, and the Personal view is shown first unless the Team view address is opened

#### Scenario: Team view content
- **WHEN** an admin opens the Team view and the calendar has events for several people
- **THEN** the Team view shows all people's events with their names

### Requirement: Holidays and birthdays visible to everyone
The system SHALL show the company holidays list and the birthdays list to every signed-in user, admin or not. The birthdays list SHALL be built from all birthday (`HBD`) events in the calendar, not only the signed-in user's events.

#### Scenario: Regular user opens birthdays
- **WHEN** a non-admin user opens the Birthdays list
- **THEN** the list shows the birthdays of everyone in the calendar

#### Scenario: Regular user opens holidays
- **WHEN** a non-admin user opens the Holidays list
- **THEN** the list shows the company holidays from the workspace config

### Requirement: Personal leave balance
The system SHALL show the signed-in user's own balance for each leave type that has a limit in the workspace config's event limits. The balance SHALL show the days used (taken or applied) in the current calendar year, the limit including any extra allowance configured for the user, and the days remaining. Remaining days below zero SHALL be shown as over the limit. The balance SHALL NOT change when the user changes the listed date range or type filters.

#### Scenario: Balance with extra allowance
- **WHEN** the PL limit is 18, the user has an extra PL allowance of 2, and the user has 5 PL days in the current year
- **THEN** the PL card shows 5 used, a limit of 20, and 15 remaining

#### Scenario: Over the limit
- **WHEN** the SL limit is 12 and the user has 13 SL days in the current year
- **THEN** the SL card shows 13 used and is marked as 1 day over the limit

#### Scenario: Near the limit
- **WHEN** the user has used more than 80% of a leave type's limit but less than all of it
- **THEN** the card for that type is visually marked as a warning

#### Scenario: Other range listed
- **WHEN** the user lists last year's leave in the Personal view
- **THEN** the balance cards still show the current year's balance

### Requirement: Non-admin users add leave only for themselves
For a non-admin user, the system SHALL create new events only with a title made from the chosen leave type and the signed-in user's own name, for example "PL: Priya" or "HPL: Priya". The system SHALL NOT let a non-admin user edit the event title, and it SHALL ignore any title value sent from the form for non-admins. Admin users SHALL keep the ability to edit the title.

#### Scenario: Regular user adds leave
- **WHEN** a non-admin user adds a full-day PL
- **THEN** the event is created with the title "PL: <their first name>"

#### Scenario: Title editing not available
- **WHEN** a non-admin user opens the Add Leave form, including its extra options
- **THEN** there is no control to edit the event title

#### Scenario: Tampered title ignored
- **WHEN** a non-admin user changes the title value in the page by other means and submits
- **THEN** the event is still created with the title "TYPE: <their first name>"

#### Scenario: Admin edits title
- **WHEN** an admin user opens the Add Leave form
- **THEN** the admin can edit the event title before adding the event

### Requirement: Visibility limit is disclosed as not a security control
The system documentation SHALL state that the Personal/Team separation is a display rule of the app. Users can still read the shared calendar in Outlook, Teams or Microsoft Graph with their group membership.

#### Scenario: README note
- **WHEN** an administrator reads the README section on leave visibility
- **THEN** it states that the views do not stop group members from reading the calendar directly, and that matching is by first name
