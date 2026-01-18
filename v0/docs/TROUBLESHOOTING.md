# Troubleshooting Guide - RunSmart AI

This guide covers common issues and their solutions for the RunSmart AI application.

## Table of Contents
- [Build & Development Issues](#build--development-issues)
- [Authentication Issues](#authentication-issues)
- [Sync Issues](#sync-issues)
- [Database Issues](#database-issues)
- [Admin Dashboard Issues](#admin-dashboard-issues)
- [Performance Issues](#performance-issues)
- [Deployment Issues](#deployment-issues)
- [Browser-Specific Issues](#browser-specific-issues)

---

## Build & Development Issues

### Issue: `npm run dev` fails with module not found

**Symptoms:**
```
Error: Cannot find module '@/lib/db'
Module not found: Can't resolve '@/components/ui/button'
```

**Solutions:**

1. **Reinstall dependencies:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Check path aliases in `tsconfig.json`:**
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@/*": ["./*"],
         "@/lib/*": ["./lib/*"],
         "@/components/*": ["./components/*"]
       }
     }
   }
   ```

3. **Restart TypeScript server** (in VSCode):
   - `Cmd/Ctrl + Shift + P`
   - Type "TypeScript: Restart TS Server"

### Issue: Build fails with TypeScript errors

**Symptoms:**
```
Type error: Property 'xyz' does not exist on type 'ABC'
```

**Solutions:**

1. **Check for type mismatches:**
   ```typescript
   // Incorrect
   const user: User = await getUser() // Returns User | undefined

   // Correct
   const user = await getUser()
   if (!user) return
   ```

2. **Update type definitions:**
   ```bash
   npm install --save-dev @types/node @types/react
   ```

3. **Skip type checking temporarily** (not recommended for production):
   ```json
   // next.config.js
   typescript: {
     ignoreBuildErrors: true
   }
   ```

### Issue: Hot reload not working

**Symptoms:**
- Changes don't reflect in browser
- Need to manually refresh

**Solutions:**

1. **Check file watcher limits** (Linux/Mac):
   ```bash
   echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   ```

2. **Restart dev server:**
   ```bash
   # Stop server (Ctrl+C)
   rm -rf .next
   npm run dev
   ```

3. **Check for syntax errors** in your code

### Issue: Port 3000 already in use

**Symptoms:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solutions:**

1. **Use different port:**
   ```bash
   PORT=3001 npm run dev
   ```

2. **Kill process on port 3000:**
   ```bash
   # Mac/Linux
   lsof -ti:3000 | xargs kill -9

   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   ```

---

## Authentication Issues

### Issue: Cannot sign up - "User already registered"

**Symptoms:**
- Signup form shows error
- User already exists message

**Solutions:**

1. **Use different email address**

2. **If testing, delete user from Supabase:**
   - Go to Supabase Dashboard → Authentication → Users
   - Find and delete test user
   - Or use SQL:
     ```sql
     DELETE FROM auth.users WHERE email = 'test@example.com';
     ```

3. **Check if user is in different auth provider** (if multiple enabled)

### Issue: Email verification not received

**Symptoms:**
- Signed up but no verification email
- Cannot log in

**Solutions:**

1. **Check spam folder**

2. **Verify email settings in Supabase:**
   - Go to Authentication → Email Templates
   - Check SMTP settings
   - Test email configuration

3. **Resend verification:**
   ```typescript
   const { error } = await supabase.auth.resend({
     type: 'signup',
     email: 'user@example.com',
   })
   ```

4. **For development, disable email verification:**
   - Supabase Dashboard → Authentication → Settings
   - Disable "Enable email confirmations"

### Issue: "Session expired" errors

**Symptoms:**
- Logged out unexpectedly
- API calls return 401 Unauthorized

**Solutions:**

1. **Refresh session:**
   ```typescript
   const { useAuth } = '@/lib/auth/auth-context'
   const { refreshSession } = useAuth()

   await refreshSession()
   ```

2. **Check session expiry settings:**
   - Supabase Dashboard → Authentication → Settings
   - JWT expiry (default: 1 hour)
   - Refresh token expiry (default: 30 days)

3. **Clear cookies and re-login:**
   - Browser DevTools → Application → Cookies
   - Delete all cookies for your domain
   - Log in again

### Issue: "Failed to fetch profile" error

**Symptoms:**
- Authentication successful but profile not loading
- Console shows profile fetch error

**Solutions:**

1. **Check profile exists:**
   ```sql
   SELECT * FROM profiles WHERE auth_user_id = 'your-user-id';
   ```

2. **Verify database trigger:**
   ```sql
   -- Check if trigger exists
   SELECT * FROM information_schema.triggers
   WHERE trigger_name = 'on_auth_user_created';
   ```

3. **Manually create profile:**
   ```sql
   INSERT INTO profiles (auth_user_id, email, created_at, updated_at)
   VALUES ('your-auth-user-id', 'user@example.com', now(), now());
   ```

---

## Sync Issues

### Issue: Sync status shows "Error"

**Symptoms:**
- Red sync indicator
- Data not uploading to Supabase

**Solutions:**

1. **Check browser console for errors:**
   - Open DevTools → Console
   - Look for sync-related errors

2. **Verify internet connection:**
   ```bash
   # Test Supabase connectivity
   curl https://your-project.supabase.co/rest/v1/
   ```

3. **Check Supabase environment variables:**
   ```typescript
   console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
   console.log('Anon Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
   ```

4. **Manually trigger sync:**
   ```typescript
   import { SyncService } from '@/lib/sync/sync-service'

   const syncService = SyncService.getInstance()
   await syncService.syncIncrementalChanges()
   ```

5. **Check RLS policies:**
   ```sql
   -- Verify user can insert runs
   SELECT * FROM pg_policies
   WHERE tablename = 'runs' AND cmd = 'INSERT';
   ```

### Issue: Sync is slow or times out

**Symptoms:**
- Sync takes minutes instead of seconds
- Timeout errors in console

**Solutions:**

1. **Check network speed:**
   - Run speed test
   - Switch to faster network

2. **Reduce batch size** (temporarily):
   ```typescript
   // In sync-service.ts
   const BATCH_SIZE = 50 // Reduced from 100
   ```

3. **Check data volume:**
   ```typescript
   const runCount = await db.runs.count()
   console.log('Total runs:', runCount)
   ```

4. **Clear old data** (if too much):
   ```typescript
   // Delete runs older than 2 years
   const twoYearsAgo = new Date()
   twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)

   await db.runs.where('completedAt').below(twoYearsAgo).delete()
   ```

### Issue: Data not appearing in Supabase

**Symptoms:**
- Sync shows success
- Local data exists
- Cloud table is empty

**Solutions:**

1. **Verify profile_id is set:**
   ```typescript
   const { profileId } = useAuth()
   console.log('Profile ID:', profileId)
   ```

2. **Check data transformation:**
   ```typescript
   // Log what's being uploaded
   const mappedData = syncService.mapRunToSupabase(run, profileId)
   console.log('Mapped data:', mappedData)
   ```

3. **Check unique constraint:**
   ```sql
   -- Ensure no conflicts
   SELECT profile_id, local_id, COUNT(*)
   FROM runs
   GROUP BY profile_id, local_id
   HAVING COUNT(*) > 1;
   ```

4. **Manually insert test record:**
   ```sql
   INSERT INTO runs (profile_id, local_id, type, distance, duration, completed_at)
   VALUES ('your-profile-id', 999, 'test', 1000, 600, now());
   ```

---

## Database Issues

### Issue: IndexedDB quota exceeded

**Symptoms:**
```
QuotaExceededError: The quota has been exceeded
```

**Solutions:**

1. **Check storage usage:**
   ```typescript
   if (navigator.storage && navigator.storage.estimate) {
     const estimate = await navigator.storage.estimate()
     console.log('Usage:', estimate.usage, 'Quota:', estimate.quota)
   }
   ```

2. **Clear old data:**
   ```typescript
   // Delete runs older than 1 year
   const oneYearAgo = new Date()
   oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

   await db.runs.where('completedAt').below(oneYearAgo).delete()
   ```

3. **Request more storage** (Chrome):
   ```typescript
   if (navigator.storage && navigator.storage.persist) {
     const persisted = await navigator.storage.persist()
     console.log('Persisted:', persisted)
   }
   ```

### Issue: Database corrupted or not opening

**Symptoms:**
```
Error: Database corrupted
Failed to open database
```

**Solutions:**

1. **Reset database:**
   ```typescript
   // In browser console
   await db.delete()
   await db.open()
   ```

2. **Clear browser data:**
   - Browser Settings → Privacy → Clear Browsing Data
   - Select "Indexed Database"
   - Clear for your site

3. **Check browser support:**
   ```typescript
   if (!window.indexedDB) {
     console.error('IndexedDB not supported')
   }
   ```

### Issue: Dexie version mismatch

**Symptoms:**
```
VersionError: An attempt was made to open a database using a lower version
```

**Solutions:**

1. **Increment database version:**
   ```typescript
   // In db.ts
   this.version(2).stores({ // Increment version
     // ... schema
   })
   ```

2. **Add migration:**
   ```typescript
   this.version(2).stores({
     runs: '++id, type, completedAt, updatedAt',
   }).upgrade(tx => {
     // Migration logic
   })
   ```

3. **Reset database** (loses data):
   ```typescript
   await db.delete()
   await db.open()
   ```

---

## Admin Dashboard Issues

### Issue: Cannot access /admin/dashboard - redirected to home

**Symptoms:**
- Navigate to `/admin/dashboard`
- Immediately redirected to `/`

**Solutions:**

1. **Check admin email configuration:**
   ```bash
   # In .env.local
   ADMIN_EMAILS=your-email@example.com
   ```

2. **Verify you're logged in with admin email:**
   ```typescript
   const { user } = useAuth()
   console.log('Logged in as:', user?.email)
   ```

3. **Check middleware is running:**
   ```typescript
   // In middleware.ts
   console.log('[Middleware] Checking admin access for:', request.url)
   ```

4. **Restart dev server** after changing `ADMIN_EMAILS`:
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

### Issue: Admin dashboard metrics show 0

**Symptoms:**
- Dashboard loads
- All metrics display 0

**Solutions:**

1. **Check Supabase connection:**
   ```typescript
   const supabase = createClient()
   const { data, error } = await supabase.from('profiles').select('count')
   console.log('Count:', data, 'Error:', error)
   ```

2. **Verify data exists:**
   ```sql
   SELECT COUNT(*) FROM profiles;
   SELECT COUNT(*) FROM runs;
   ```

3. **Check RLS policies allow reading:**
   ```sql
   -- Test as your user
   SET request.jwt.claim.sub = 'your-auth-user-id';
   SELECT * FROM runs LIMIT 1;
   ```

4. **Check browser console for errors**

### Issue: User list not loading

**Symptoms:**
- Dashboard loads
- User list shows "Loading..." forever

**Solutions:**

1. **Check network requests:**
   - DevTools → Network tab
   - Look for failed requests to Supabase

2. **Verify profiles table exists:**
   ```sql
   SELECT * FROM profiles LIMIT 10;
   ```

3. **Check component error boundary:**
   - Look for error in console
   - Check React error boundary

---

## Performance Issues

### Issue: App is slow or laggy

**Symptoms:**
- UI feels sluggish
- Long delays between actions

**Solutions:**

1. **Check browser performance:**
   - DevTools → Performance tab
   - Record and analyze

2. **Optimize database queries:**
   ```typescript
   // Add indexes
   this.version(2).stores({
     runs: '++id, type, completedAt, [type+completedAt]',
   })
   ```

3. **Reduce data loaded:**
   ```typescript
   // Limit results
   const recentRuns = await db.runs
     .orderBy('completedAt')
     .reverse()
     .limit(100)
     .toArray()
   ```

4. **Clear browser cache:**
   - DevTools → Application → Storage
   - Clear site data

### Issue: High memory usage

**Symptoms:**
- Browser tab uses excessive RAM
- Browser becomes unresponsive

**Solutions:**

1. **Limit loaded data:**
   ```typescript
   // Pagination
   const PAGE_SIZE = 20
   const runs = await db.runs
     .offset(page * PAGE_SIZE)
     .limit(PAGE_SIZE)
     .toArray()
   ```

2. **Clean up subscriptions:**
   ```typescript
   useEffect(() => {
     const subscription = observable.subscribe()

     return () => subscription.unsubscribe() // Cleanup
   }, [])
   ```

3. **Check for memory leaks:**
   - DevTools → Memory tab
   - Take heap snapshots
   - Compare before/after

---

## Deployment Issues

### Issue: Vercel build fails

**Symptoms:**
```
Build failed with exit code 1
Type error: ...
```

**Solutions:**

1. **Test build locally:**
   ```bash
   npm run build
   ```

2. **Check environment variables:**
   - Vercel Dashboard → Settings → Environment Variables
   - Ensure all required vars are set

3. **Check Node version:**
   ```json
   // package.json
   "engines": {
     "node": ">=18.0.0"
   }
   ```

4. **Clear Vercel cache:**
   ```bash
   vercel --force
   ```

### Issue: Environment variables not working in production

**Symptoms:**
- Features work locally
- Fail in production
- "undefined" in console

**Solutions:**

1. **Check variable prefix:**
   ```env
   # Client-side variables MUST have prefix
   NEXT_PUBLIC_SUPABASE_URL=...

   # Server-only variables don't need prefix
   OPENAI_API_KEY=...
   ```

2. **Verify variables in Vercel:**
   - Settings → Environment Variables
   - Check "Production" environment is selected

3. **Redeploy after adding variables:**
   ```bash
   vercel --prod
   ```

### Issue: Supabase connection fails in production

**Symptoms:**
- Works locally
- 401/403 errors in production

**Solutions:**

1. **Check Site URL in Supabase:**
   - Authentication → URL Configuration
   - Add production domain

2. **Verify API keys:**
   - Settings → API
   - Copy correct keys to Vercel

3. **Check CORS settings** (if using custom domain)

---

## Browser-Specific Issues

### Issue: Safari - IndexedDB not working

**Symptoms:**
- Works in Chrome/Firefox
- Fails in Safari

**Solutions:**

1. **Check Safari version** (needs 12.2+)

2. **Enable IndexedDB in Safari:**
   - Safari → Preferences → Privacy
   - Uncheck "Prevent cross-site tracking" (for testing)

3. **Use polyfill:**
   ```bash
   npm install idb
   ```

### Issue: Firefox - Service worker not registering

**Symptoms:**
- PWA works in Chrome
- Doesn't install in Firefox

**Solutions:**

1. **Check HTTPS:**
   - Service workers require HTTPS (or localhost)

2. **Check service worker scope:**
   ```javascript
   if ('serviceWorker' in navigator) {
     navigator.serviceWorker.register('/sw.js', { scope: '/' })
   }
   ```

3. **Enable service workers in Firefox:**
   - `about:config`
   - Set `dom.serviceWorkers.enabled` to `true`

---

## Getting Help

If you can't resolve your issue:

1. **Check browser console** for errors
2. **Check Supabase logs** (Dashboard → Logs)
3. **Review documentation** in `/docs`
4. **Search GitHub issues**
5. **Create new issue** with:
   - Clear description of problem
   - Steps to reproduce
   - Error messages/screenshots
   - Environment details (browser, OS, etc.)

---

## Debug Mode

Enable debug logging:

```typescript
// Add to .env.local
NEXT_PUBLIC_DEBUG=true

// In code
if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
  console.log('Debug info:', data)
}
```

## Useful Commands

```bash
# Clear all caches
rm -rf .next node_modules package-lock.json
npm install
npm run dev

# Reset Supabase local
npx supabase db reset

# Check database size
npx supabase db size

# View Supabase logs
npx supabase logs
```

---

**Document Version**: 1.0
**Last Updated**: 2026-01-18

**Note**: If you encounter an issue not covered here, please contribute by submitting a PR to update this guide!
