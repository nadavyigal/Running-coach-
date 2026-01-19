# Admin Dashboard Quick Start Guide

## Access URL
```
http://localhost:3000/admin/dashboard
```

## Configuration (Required)

Add your admin email to `.env.local`:

```env
ADMIN_EMAILS=your-email@example.com
```

For multiple admins:
```env
ADMIN_EMAILS=admin1@example.com,admin2@example.com,admin3@example.com
```

## Dashboard Features

### 📊 Key Metrics

| Metric | Description |
|--------|-------------|
| **Total Users** | All registered users in the system |
| **Active Users (7d)** | Users who recorded at least one run in the last 7 days |
| **Total Runs** | All runs across all users |
| **Runs This Week** | Runs recorded since Sunday of current week |
| **Average Runs Per User** | Total runs ÷ total users |
| **Onboarding Completion** | Percentage of users who completed onboarding |

### 👥 User Management

View recent users with:
- Name & Email
- Onboarding Status (✓ Complete / ⊗ Pending)
- Run Count
- Goal Count
- Last Activity Date
- Join Date

**Note**: Limited to 100 most recent users

### 🔗 External Analytics

Quick access to:
- **PostHog**: Behavioral analytics, feature flags, session recordings
- **Google Analytics**: Traffic sources, demographics, conversion tracking

## Security

### Multi-Layer Protection

1. **Middleware** - Intercepts requests at edge
2. **Server Layout** - Validates authentication server-side
3. **Email Whitelist** - Only configured emails can access

### Access Control Flow

```
User navigates to /admin/dashboard
          ↓
     Is authenticated?
          ↓
     Is email in ADMIN_EMAILS?
          ↓
     ✅ Allow access

     ❌ Redirect to home page
```

## Common Tasks

### Add New Admin
1. Open `.env.local`
2. Add email to `ADMIN_EMAILS` (comma-separated)
3. Restart dev server

### Remove Admin
1. Open `.env.local`
2. Remove email from `ADMIN_EMAILS`
3. Restart dev server

### View User Activity
1. Navigate to admin dashboard
2. Check "Recent Users" table
3. Sort by "Last Activity" to see active users

### Check System Health
1. View "Active Users (7d)" metric
2. Compare with "Total Users" for engagement rate
3. Monitor "Onboarding Completion" for funnel health

## Troubleshooting

### Can't Access Dashboard

**Problem**: Redirected to home page immediately

**Solutions**:
1. Verify your email is in `ADMIN_EMAILS`
2. Ensure you're logged in with that email
3. Check for typos in environment variable
4. Restart dev server after changes

### Metrics Show Zero

**Problem**: All metrics display 0

**Solutions**:
1. Check Supabase connection
2. Verify migrations are applied
3. Ensure database has data
4. Check RLS policies

### User Emails Show Placeholder

**Problem**: Emails show as "user-xxxxx@***.com"

**Solutions**:
1. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`
2. Check service role key has correct permissions
3. Verify auth.users access (may require server-side query)

### Page Loads Slowly

**Problem**: Dashboard takes long to load

**Solutions**:
1. Check network connection to Supabase
2. Monitor database query performance
3. Consider adding pagination for large datasets
4. Check for slow queries in Supabase dashboard

## API Queries

The dashboard makes these Supabase queries:

```typescript
// Total users count
supabase.from('profiles').select('*', { count: 'exact', head: true })

// Active users (with runs in last 7 days)
supabase.from('runs')
  .select('profile_id')
  .gte('completed_at', sevenDaysAgo)

// Total runs count
supabase.from('runs').select('*', { count: 'exact', head: true })

// Runs this week
supabase.from('runs')
  .select('*', { count: 'exact', head: true })
  .gte('completed_at', weekStart)

// Recent users
supabase.from('profiles')
  .select('id, auth_user_id, name, onboarding_complete, created_at')
  .order('created_at', { ascending: false })
  .limit(100)
```

## Performance Tips

### Optimize Loading
- Queries run in parallel where possible
- User stats fetched concurrently
- Count queries use `head: true` for efficiency

### Database Indexes
Ensure indexes exist on:
- `profiles.created_at` (for sorting)
- `runs.completed_at` (for date filtering)
- `runs.profile_id` (for joins/counts)
- `goals.profile_id` (for counts)

## Development

### Local Testing
```bash
# Start dev server
cd v0
npm run dev

# Open dashboard
open http://localhost:3000/admin/dashboard
```

### Type Checking
```bash
npm run build
```

### Linting
```bash
npm run lint
```

## Production Deployment

1. **Set Environment Variables** in hosting provider (Vercel, etc.):
   ```
   ADMIN_EMAILS=production-admin@example.com
   ```

2. **Verify Analytics Links**:
   - Update PostHog URL if using different workspace
   - Update Google Analytics property ID

3. **Test Access**:
   - Verify admin can access dashboard
   - Verify non-admin is blocked

4. **Monitor Performance**:
   - Set up alerts for slow queries
   - Monitor dashboard access logs
   - Track error rates

## Future Enhancements

Potential improvements:
- [ ] Real-time metrics with auto-refresh
- [ ] User detail modal with full history
- [ ] Export users to CSV
- [ ] Advanced filtering and search
- [ ] Chart visualizations for trends
- [ ] Admin action logs
- [ ] Bulk user operations
- [ ] Custom date ranges for metrics
- [ ] Pagination for user list
- [ ] Mobile-optimized responsive table

## Support

Need help?
- Check [v0/app/admin/README.md](../app/admin/README.md) for detailed docs
- See [admin-dashboard-testing.md](admin-dashboard-testing.md) for test cases
- Review Supabase logs for database issues
- Check browser console for client errors

---

**Quick Reference**: `/admin/dashboard` → Metrics + User List + Analytics Links
