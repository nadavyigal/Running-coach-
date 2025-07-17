# Analytics Events Documentation

This document describes all analytics events tracked in the Running Coach application for Epic 4.5: Analytics for Habit Formation.

## Event Structure

All events include the following base user context properties:

- `user_id`: Number - Database ID of the current user
- `user_experience`: String - User's running experience level ('beginner', 'intermediate', 'advanced')
- `user_goal`: String - User's primary goal ('habit', 'distance', 'speed')
- `days_per_week`: Number - User's target running days per week
- `onboarding_complete`: Boolean - Whether user has completed onboarding
- `current_streak`: Number - User's current consecutive days streak
- `cohort_id`: Number - ID of user's community cohort (if joined)
- `timestamp`: String - ISO timestamp of the event

## Reminder Events

### `reminder_triggered`
**Description**: Fired when a scheduled reminder notification is shown to the user.
**Properties**: None (base user context only)

### `reminder_set`
**Description**: Fired when user sets a new reminder time.
**Properties**:
- `time`: String - The reminder time in HH:mm format

### `reminder_disabled`
**Description**: Fired when user disables reminder notifications.
**Properties**: None (base user context only)

### `reminder_snoozed`
**Description**: Fired when user snoozes a reminder notification.
**Properties**:
- `minutes`: Number - Number of minutes the reminder was snoozed for

### `reminder_clicked`
**Description**: Fired when user clicks on a reminder notification or action.
**Properties**:
- `source`: String - Source of the click ('toast_action', 'notification', etc.)

## Plan Adjustment Events

### `plan_adjusted`
**Description**: Fired when the training plan is automatically adjusted.
**Properties**:
- `reason`: String - Reason for adjustment ('nightly', 'post-run')

## Session Completion Events

### `plan_session_completed`
**Description**: Fired when user completes and saves a run session.
**Properties**:
- `session_type`: String - Type of workout ('easy_run', 'interval', 'long_run', 'other')
- `distance_km`: Number - Distance covered in kilometers
- `duration_seconds`: Number - Duration of the session in seconds
- `pace_seconds_per_km`: Number - Average pace in seconds per kilometer
- `calories_burned`: Number - Estimated calories burned
- `had_gps_tracking`: Boolean - Whether GPS tracking was active
- `workout_id`: Number - ID of the associated workout (if any)

## Chat Events

### `chat_message_sent`
**Description**: Fired when user sends a message to the AI coach.
**Properties**:
- `message_length`: Number - Character length of the message
- `conversation_length`: Number - Total number of messages in the conversation
- `is_first_message`: Boolean - Whether this is the first message in the conversation

## Route Selection Events

### `route_selected`
**Description**: Fired when user selects a route from the route selector.
**Properties**:
- `route_id`: String - ID of the selected route
- `route_name`: String - Name of the selected route
- `distance_km`: Number - Route distance in kilometers
- `difficulty`: String - Route difficulty level ('Easy', 'Moderate', 'Hard')
- `elevation_m`: Number - Total elevation gain in meters
- `estimated_time_minutes`: Number - Estimated completion time in minutes

## Engagement Events

### `onboard_complete`
**Description**: Fired when user completes the onboarding process.
**Properties**:
- `rookieChallenge`: Boolean - Whether user signed up for rookie challenge

## Feedback Events

### `positive_feedback_shown`
**Description**: Fired when positive feedback or success toast is shown to user.
**Properties**:
- `feedback_type`: String - Type of feedback ('streak_milestone', 'achievement', 'encouragement')
- `milestone_days`: Number - Days milestone reached (if applicable)

## Implementation Notes

### PostHog Configuration
- Events are sent to PostHog with the configured API key
- PostHog is initialized with `person_profiles: 'identified_only'`
- Events are only sent when `window` is defined (client-side)

### Error Handling
- Database errors during user context retrieval are handled gracefully
- Events still fire with undefined user context if database is unavailable
- PostHog errors are logged but don't prevent app functionality

### Testing
- All events are covered by unit tests in `analytics.test.ts`
- Tests verify proper event names, properties, and error handling
- PostHog is mocked in tests to verify tracking calls

### Performance
- User context is fetched fresh for each event to ensure accuracy
- Events are fire-and-forget to avoid blocking UI interactions
- No client-side caching of analytics data

## QA Testing Checklist

### Reminder Events
- [ ] Set reminder time → `reminder_set` fired with time
- [ ] Disable reminders → `reminder_disabled` fired
- [ ] Reminder notification appears → `reminder_triggered` fired
- [ ] Snooze reminder → `reminder_snoozed` fired with minutes
- [ ] Click reminder action → `reminder_clicked` fired with source

### Plan Adjustment Events
- [ ] Complete run triggers adjustment → `plan_adjusted` fired with reason 'post-run'
- [ ] Nightly adjustment occurs → `plan_adjusted` fired with reason 'nightly'

### Session Completion Events
- [ ] Save run from record screen → `plan_session_completed` fired with all metrics
- [ ] GPS tracking on/off reflected in `had_gps_tracking`
- [ ] Different workout types tracked in `session_type`

### Chat Events
- [ ] Send message to AI coach → `chat_message_sent` fired with message details
- [ ] First message marked as `is_first_message: true`
- [ ] Conversation length increments correctly

### Route Selection Events
- [ ] Select route from modal → `route_selected` fired with route details
- [ ] All route properties included (distance, difficulty, elevation)

### Engagement Events
- [ ] Complete onboarding → `onboard_complete` fired
- [ ] Rookie challenge setting reflected in properties

### User Context
- [ ] All events include user_id, experience, goal, etc.
- [ ] Streak updates reflected in current_streak
- [ ] Cohort membership reflected in cohort_id

### Error Scenarios
- [ ] Events still fire if database is unavailable
- [ ] No errors thrown if PostHog is unavailable
- [ ] Events work in both development and production environments