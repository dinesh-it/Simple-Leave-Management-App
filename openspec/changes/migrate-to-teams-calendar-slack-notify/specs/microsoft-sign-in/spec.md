# Spec Delta

## Purpose

Lets workspace members sign in to the leave app with their Microsoft 365 work account, so that all calendar and config access uses their own Microsoft permissions.

## ADDED Requirements

### Requirement: Sign in with Microsoft 365 account
The system SHALL authenticate users with the Microsoft identity platform using the configured application (client) ID and tenant, and SHALL request only the delegated permissions needed to read the user profile, read and write calendars (including calendars shared with the user), and read the shared workspace config file.

#### Scenario: Unauthenticated visit
- **WHEN** a user opens the app without an active Microsoft session
- **THEN** the system shows the Login button and a sign-in prompt referring to the Microsoft 365 / Teams account, and hides the reports, filters and Add Event controls

#### Scenario: Successful sign-in
- **WHEN** the user clicks Login and completes Microsoft sign-in
- **THEN** the system hides the Login button, shows the Logout button labelled with the user's first name, loads the workspace config, and then loads calendars

#### Scenario: Returning user with cached session
- **WHEN** a user who signed in earlier reopens the app and the Microsoft session is still valid
- **THEN** the system signs them in silently, without prompting for credentials

#### Scenario: Sign-in cancelled or failed
- **WHEN** the user closes the Microsoft sign-in window or sign-in returns an error
- **THEN** the system stays in the signed-out state and shows an error message

### Requirement: Sign out
The system SHALL let the signed-in user sign out, which clears the app's Microsoft session and returns the app to the signed-out state.

#### Scenario: User signs out
- **WHEN** the signed-in user clicks the Logout button
- **THEN** the system ends the Microsoft session for the app and reloads in the signed-out state

### Requirement: Session validation before actions
The system SHALL check that a valid Microsoft access token can be obtained, silently where possible, when the window regains focus after more than 3 minutes and before creating an event.

#### Scenario: Token renewed silently
- **WHEN** the access token has expired but the Microsoft session is still valid
- **THEN** the system gets a new token without user interaction and the action continues

#### Scenario: Session expired
- **WHEN** no token can be obtained silently
- **THEN** the system shows a "Session expired!" alert, cancels the pending action, and switches to the signed-out state

### Requirement: Admin detection from signed-in user
The system SHALL find the signed-in user's first (given) name from their Microsoft profile and SHALL treat the user as an admin when that name, upper-cased, matches a key in the configured admin names.

#### Scenario: Admin user
- **WHEN** a user whose given name matches a configured admin name signs in
- **THEN** the Monthly Report control is shown

#### Scenario: Non-admin user
- **WHEN** a user whose given name does not match any configured admin name signs in
- **THEN** the Monthly Report control stays hidden
