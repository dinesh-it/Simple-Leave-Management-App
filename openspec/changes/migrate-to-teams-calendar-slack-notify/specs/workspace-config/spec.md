# Spec Delta

## Purpose

Loads workspace-specific settings (leave types, limits, admins, holidays, Slack webhook) from a shared OneDrive/SharePoint file, so that workspace data and secrets stay out of the repository.

## ADDED Requirements

### Requirement: Load config from OneDrive/SharePoint file
After sign-in, and before loading calendars, the system SHALL read the workspace config from a JSON file stored in OneDrive or SharePoint. The file is identified by a sharing link set in the app's static configuration and is read with the signed-in user's permissions.

#### Scenario: Config loaded
- **WHEN** a signed-in user has read access to the config file and it contains valid JSON
- **THEN** the system applies the config and proceeds to load calendars

#### Scenario: No access to config
- **WHEN** the signed-in user cannot read the config file (not shared, not found, or permission denied)
- **THEN** the system shows the alert "Your workspace does not seem to have this app configured" and does not load calendars

#### Scenario: Invalid JSON
- **WHEN** the config file content is not valid JSON
- **THEN** the system shows an error saying the workspace config is invalid and does not load calendars

### Requirement: Supported config keys
The system SHALL support these config keys with the same meaning as the existing Google Docs config: `typeFilter`, `removeEvents`, `totalEmps`, `eventLimits`, `adminNames`, `showFuelGauge`, `holidayList`, `companyName`, `userExtraAllowance`. It SHALL also support `slackWebhookUrl` (string, optional) and `calendarLink` (string URL, optional).

#### Scenario: Existing keys applied
- **WHEN** the config contains `holidayList` and `typeFilter`
- **THEN** the holidays list and leave-type filters in the UI reflect those values

#### Scenario: Optional keys absent
- **WHEN** the config omits `slackWebhookUrl` and `calendarLink`
- **THEN** the app works normally, sends no Slack notifications, and shows no external calendar link

#### Scenario: Calendar link present
- **WHEN** the config contains `calendarLink`
- **THEN** the system shows a link that opens that URL in a new tab, in place of the former embedded calendar
