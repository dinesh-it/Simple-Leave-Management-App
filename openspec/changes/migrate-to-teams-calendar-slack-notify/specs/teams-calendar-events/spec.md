# Spec Delta

## Purpose

Reads leave events from, and creates leave events in, Microsoft Teams / Outlook calendars, so that all existing reports, charts and the Add Event form work against Microsoft 365.

## ADDED Requirements

### Requirement: Calendar selection
The system SHALL list the calendars the signed-in user can access in Microsoft 365, including calendars shared with them, in the calendar picker. It SHALL remember the user's choice in the browser across visits.

#### Scenario: Remembered calendar
- **WHEN** the user previously selected a calendar and it is still in the list
- **THEN** that calendar is pre-selected and its events are loaded

#### Scenario: Default calendar by name
- **WHEN** no calendar was previously selected and a calendar's name contains "vacation" (case-insensitive)
- **THEN** that calendar is selected by default

#### Scenario: Fallback default
- **WHEN** no calendar was previously selected and no calendar name contains "vacation"
- **THEN** the first calendar in the list is selected

#### Scenario: User changes calendar
- **WHEN** the user picks a different calendar in the picker
- **THEN** the system remembers the choice and reloads events from that calendar

### Requirement: List events for a date range
The system SHALL fetch all events (with recurring events expanded into single occurrences) from the selected calendar between the chosen from and to dates, inclusive of the whole to-date. By default the range is the current calendar year. The system SHALL follow result paging until every event in the range has been fetched.

#### Scenario: Default range
- **WHEN** events load without from/to URL parameters
- **THEN** the system fetches events from January 1 to December 31 of the current year

#### Scenario: More events than one page
- **WHEN** the range has more events than a single Microsoft Graph response returns
- **THEN** the system fetches all remaining pages before rendering reports

#### Scenario: Reports unchanged in meaning
- **WHEN** events with subjects like `PL: John` or `HSL - Priya` are fetched
- **THEN** the all-events table, counts, charts, fuel gauge and birthdays list show the same leave type, person, dates and business-day counts as the Google Calendar version did for equivalent events

#### Scenario: All-day event end date
- **WHEN** an all-day event is stored in Microsoft 365 with an exclusive end date (midnight of the day after the last day)
- **THEN** the system counts days exactly as for Google all-day events, without adding or losing a day

### Requirement: Create full-day and half-day leave events
The Add Event form SHALL create an event in the selected calendar with subject = the entered title, location, description, and the configured time zone (Asia/Kolkata). The system SHALL show a confirmation with title, from and to before creating the event.

#### Scenario: Full-day leave
- **WHEN** the user submits a FULL day event from 10/03/2026 to 12/03/2026 and confirms
- **THEN** an all-day event covering 10, 11 and 12 March 2026 is created in the selected calendar, the modal closes, and events reload

#### Scenario: Half-day leave
- **WHEN** the user submits a First Half (FH) or Second Half (SH) event for a date and confirms
- **THEN** an all-day event for that single date is created, with its description prefixed by `(First Half)` or `(Second Half)` respectively

#### Scenario: User cancels confirmation
- **WHEN** the user dismisses the confirmation dialog
- **THEN** no event is created and no Slack notification is sent

#### Scenario: Creation fails
- **WHEN** Microsoft Graph returns an error for the create request
- **THEN** the system shows the error message, keeps the modal open, and sends no Slack notification
