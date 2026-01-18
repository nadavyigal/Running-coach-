# Admin Dashboard

The admin dashboard provides analytics, metrics, and user management capabilities for RunSmart AI.

## Access

The admin dashboard is available at `/admin/dashboard` and is protected by authentication.

### Configuration

Admin access is controlled by email whitelist in the environment configuration:

```env
# .env.local
ADMIN_EMAILS=admin@example.com,another-admin@example.com
```

**Multiple admins can be added by separating emails with commas.**

## Features

### Metrics Overview

The dashboard displays key metrics:

- **Total Users**: All registered users
- **Active Users (7d)**: Users who recorded a run in the last 7 days
- **Total Runs**: All recorded runs across all users
- **Runs This Week**: Runs recorded in the current week
- **Average Runs Per User**: Total runs divided by total users
- **Onboarding Completion**: Percentage of users who completed onboarding

### User List

View recent users with:
- Name and email
- Onboarding completion status
- Run and goal counts
- Last activity date
- Join date

### External Analytics

Quick links to:
- **PostHog Analytics**: Behavioral analytics, feature flags, and session recordings
- **Google Analytics**: Traffic sources, demographics, and conversion metrics

## Security

The admin dashboard is protected at multiple levels:

1. **Middleware Protection**: `/admin/*` routes check authentication before rendering
2. **Layout Protection**: Server-side authentication check in the layout
3. **Email Whitelist**: Only specified emails can access admin features

Non-admin users attempting to access `/admin/dashboard` will be automatically redirected to the home page.

## Development

### Adding New Admin Features

To add new admin pages:

1. Create a new route under `app/admin/`
2. Admin authentication is inherited from the dashboard layout
3. Use the Supabase client for data queries

Example:
```tsx
// app/admin/reports/page.tsx
'use client'

import { createClient } from '@/lib/supabase/client'

export default function AdminReports() {
  // Your admin page logic
}
```

### Testing

To test admin access:

1. Sign up with an email listed in `ADMIN_EMAILS`
2. Navigate to `/admin/dashboard`
3. Verify metrics are displayed correctly
4. Check user list loads properly

To test protection:

1. Sign up with a non-admin email
2. Attempt to navigate to `/admin/dashboard`
3. Should be redirected to `/`

## Notes

- The user list is limited to the 100 most recent users
- Email addresses may show as placeholders if the service role key is not configured
- All queries use Row-Level Security (RLS) policies from Supabase
