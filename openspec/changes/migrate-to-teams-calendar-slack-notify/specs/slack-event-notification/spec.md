# Spec Delta

## Purpose

Tells the team in Slack whenever a leave event is created through the app, using a Slack Incoming Webhook URL kept in the workspace config.

## ADDED Requirements

### Requirement: Notify Slack on successful event creation
When an event is successfully created through the app's Add Event form, the system SHALL send one message to the Slack Incoming Webhook URL in the workspace config (`slackWebhookUrl`). Events created outside the app (directly in Teams/Outlook) SHALL NOT trigger notifications.

#### Scenario: Event created with webhook configured
- **WHEN** an event is created successfully and `slackWebhookUrl` is set
- **THEN** exactly one message is posted to that webhook

#### Scenario: Webhook not configured
- **WHEN** an event is created successfully and `slackWebhookUrl` is missing or empty
- **THEN** no Slack request is made and event creation completes normally

#### Scenario: Event created outside the app
- **WHEN** someone adds an event directly in the Teams/Outlook calendar
- **THEN** the app sends no Slack message for it

### Requirement: Slack message content
The Slack message SHALL include the event title (leave type and person), the from and to dates, the half-day part (First Half / Second Half) when applicable, the description when non-empty, the calendar name, and the name of the user who created it.

#### Scenario: Full-day message
- **WHEN** user "Dinesh" creates `PL: John` from 10/03/2026 to 12/03/2026 in calendar "Vacation"
- **THEN** the Slack message shows `PL: John`, dates 2026-03-10 to 2026-03-12, calendar "Vacation", and "created by Dinesh"

#### Scenario: Half-day message
- **WHEN** a Second Half event is created for 15/03/2026
- **THEN** the Slack message shows the single date 2026-03-15 and "Second Half"

### Requirement: Slack failures do not affect event creation
A failed or unreachable Slack webhook SHALL NOT block, delay the success handling of, or roll back the created calendar event. Request failures the browser can detect (network error, malformed URL) SHALL be logged to the browser console. Slack-side rejections (for example a revoked webhook) are not visible to the browser and are not reported.

#### Scenario: Webhook request fails
- **WHEN** the event is created but the Slack request fails at the network level
- **THEN** the event stays in the calendar, the modal closes, events reload, and an error is logged to the console

#### Scenario: Webhook revoked
- **WHEN** the event is created and the configured webhook has been revoked in Slack
- **THEN** the event stays in the calendar and the app behaves as on success
