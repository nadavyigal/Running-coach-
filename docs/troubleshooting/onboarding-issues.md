# Onboarding Troubleshooting Guide

## Overview
This guide provides solutions for common onboarding issues in the Run-Smart application. It covers both user-facing problems and developer debugging procedures.

## Table of Contents
1. [Common User Issues](#common-user-issues)
2. [Network and Connectivity Problems](#network-and-connectivity-problems)
3. [Database and Storage Issues](#database-and-storage-issues)
4. [AI Service Problems](#ai-service-problems)
5. [Form Validation Errors](#form-validation-errors)
6. [Developer Debugging](#developer-debugging)
7. [Error Recovery Procedures](#error-recovery-procedures)

## Common User Issues

### Issue: Onboarding Wizard Won't Progress
**Symptoms**: User cannot move to next step in onboarding wizard
**Causes**: 
- Required fields not completed
- Form validation errors
- Network connectivity issues
- Database storage problems

**Solutions**:
1. Check that all required fields are filled (marked with asterisk *)
2. Look for red error messages below form fields
3. Try refreshing the page
4. Check internet connection
5. Clear browser cache and try again

### Issue: AI Chat Not Responding
**Symptoms**: AI coach doesn't respond to messages
**Causes**:
- OpenAI API service unavailable
- Network connectivity issues
- Rate limiting exceeded
- Token budget exceeded

**Solutions**:
1. Check internet connection
2. Wait a few minutes and try again (rate limiting)
3. Use "Quick Start" option to skip AI chat
4. Fallback to guided form-based onboarding

### Issue: Can't Complete Onboarding
**Symptoms**: User gets stuck at final step or can't finish onboarding
**Causes**:
- Plan generation service unavailable
- Database save failures
- Analytics tracking errors
- Session conflicts

**Solutions**:
1. Check network connection
2. Try refreshing the page
3. Clear browser storage and restart
4. Contact support if problem persists

## Network and Connectivity Problems

### Issue: Offline Mode Activated
**Symptoms**: App shows offline indicator, features limited
**Causes**:
- No internet connection
- Network timeout
- Server unavailable

**Solutions**:
1. Check internet connection
2. Wait for automatic retry (30 seconds)
3. Manually retry by refreshing page
4. Use offline mode features if available

### Issue: Slow Loading Times
**Symptoms**: Onboarding steps take long to load
**Causes**:
- Poor network connection
- Server overload
- Large data transfers

**Solutions**:
1. Check network speed
2. Wait for loading to complete
3. Try refreshing page
4. Contact support if persistent

### Issue: API Timeout Errors
**Symptoms**: "Request timeout" or "Service unavailable" errors
**Causes**:
- Network latency
- Server overload
- Rate limiting

**Solutions**:
1. Wait 1-2 minutes and retry
2. Check internet connection
3. Try again during off-peak hours
4. Use fallback options if available

## Database and Storage Issues

### Issue: Data Not Saving
**Symptoms**: User data disappears after page refresh
**Causes**:
- Browser storage full
- Database corruption
- Permission issues
- IndexedDB errors

**Solutions**:
1. Clear browser storage (Settings > Privacy > Clear Data)
2. Check available disk space
3. Try different browser
4. Contact support for data recovery

### Issue: ChunkLoadError - Loading Chunks Failed
**Symptoms**: "ChunkLoadError: Loading chunk app/layout failed" or similar chunk timeout errors
**Causes**:
- Corrupted Next.js build cache
- Webpack chunk loading timeouts
- Network connectivity issues during chunk loading
- Browser cache conflicts

**Solutions**:
1. **Clear Next.js cache**: Delete `.next` directory and restart dev server
2. **Clear browser cache**: Hard refresh (Ctrl+Shift+R) or clear all browser data
3. **Restart development server**: Stop and restart `npm run dev`
4. **Use cache clearing script**: Run `clear-cache-and-restart.ps1` (Windows)
5. **Check network connection**: Ensure stable internet connection
6. **Try incognito mode**: Test in private browsing to avoid cache issues

**Technical Fix (Developers)**:
- The app now includes `ChunkErrorBoundary` component that automatically reloads the page when chunk errors occur
- Enhanced `next.config.mjs` with optimized webpack settings and chunk loading timeouts
- Automatic error recovery with graceful fallback UI

### Issue: Session Conflicts
**Symptoms**: Multiple onboarding sessions detected
**Causes**:
- Incomplete previous sessions
- Browser crashes
- Multiple tabs open

**Solutions**:
1. Choose "Continue Previous Session" or "Start New Session"
2. Close other tabs with the app
3. Clear browser storage and restart
4. Contact support if conflicts persist

### Issue: Database Health Check Failed
**Symptoms**: "Storage system unavailable" error
**Causes**:
- Database corruption
- Storage permissions
- Browser limitations

**Solutions**:
1. Clear browser storage
2. Check browser permissions
3. Try different browser
4. Contact support for technical assistance

## AI Service Problems

### Issue: OpenAI API Unavailable
**Symptoms**: AI chat shows "Service unavailable" error
**Causes**:
- OpenAI service outage
- API key issues
- Rate limiting
- Token budget exceeded

**Solutions**:
1. Wait for service to resume
2. Use fallback to guided form-based onboarding
3. Try again later
4. Contact support if persistent

### Issue: Chat API Validation Errors
**Symptoms**: "Invalid JSON" or "Request body cannot be empty" errors in chat
**Causes**:
- Malformed request data
- Missing required fields (messages, currentPhase)
- Incorrect content-type headers
- Empty or invalid JSON payload

**Solutions**:
1. **Refresh the page** to reset the chat session
2. **Clear browser cache** and restart the session
3. **Try different browser** if problem persists
4. **Check network connection** for data corruption during transmission

**Technical Details (Developers)**:
- Enhanced request validation in `/api/onboarding/chat`
- Improved error messages with fallback options
- Better JSON parsing with error handling
- Automatic fallback to form-based onboarding on API failures

### Issue: AI Responses Too Slow
**Symptoms**: Long delays in AI responses
**Causes**:
- High API latency
- Complex requests
- Server load

**Solutions**:
1. Wait for response (up to 30 seconds)
2. Use "Quick Start" option
3. Try simpler questions
4. Use fallback form-based onboarding

### Issue: AI Not Understanding
**Symptoms**: AI gives irrelevant or incorrect responses
**Causes**:
- Unclear user input
- Context confusion
- Prompt issues

**Solutions**:
1. Rephrase question more clearly
2. Provide more context
3. Use guided form-based onboarding
4. Contact support for assistance

## Form Validation Errors

### Issue: Required Fields Not Filled
**Symptoms**: Red error messages under form fields
**Causes**:
- Missing required information
- Invalid input format
- Age restrictions

**Solutions**:
1. Fill all fields marked with asterisk (*)
2. Check input format (e.g., age must be number)
3. Ensure age is within valid range (13-100)
4. Complete all required steps

### Issue: Invalid Input Format
**Symptoms**: "Invalid format" error messages
**Causes**:
- Wrong data type
- Special characters
- Length restrictions

**Solutions**:
1. Check input format requirements
2. Remove special characters if needed
3. Ensure proper data type (text, number, etc.)
4. Follow field-specific guidelines

### Issue: Age Validation Failed
**Symptoms**: Age field shows error
**Causes**:
- Age outside valid range
- Non-numeric input
- Missing age

**Solutions**:
1. Enter age between 13-100
2. Use only numbers
3. Complete age field before proceeding

## Developer Debugging

### Debug Procedures for Developers

#### 1. Check Browser Console
```javascript
// Open browser developer tools (F12)
// Check Console tab for error messages
// Look for:
// - Network errors
// - JavaScript errors
// - Database errors
// - API response errors
```

#### 2. Verify Network Connectivity
```javascript
// Test API endpoints
fetch('/api/onboarding/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ test: true })
})
.then(response => console.log('API Status:', response.status))
.catch(error => console.error('API Error:', error));
```

#### 3. Check Database Health
```javascript
// Test database connectivity
import { dbUtils } from '@/lib/db';

const checkDatabase = async () => {
  try {
    const health = await dbUtils.checkHealth();
    console.log('Database Health:', health);
  } catch (error) {
    console.error('Database Error:', error);
  }
};
```

#### 4. Monitor AI Service Status
```javascript
// Check OpenAI API status
const checkAIService = async () => {
  try {
    const response = await fetch('/api/onboarding/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        messages: [{ role: 'user', content: 'test' }],
        currentPhase: 'motivation'
      })
    });
    console.log('AI Service Status:', response.status);
  } catch (error) {
    console.error('AI Service Error:', error);
  }
};
```

#### 5. Debug Session Management
```javascript
// Check session state
const debugSession = () => {
  const session = localStorage.getItem('onboarding-session');
  console.log('Current Session:', session);
  
  const conflicts = sessionStorage.getItem('session-conflicts');
  console.log('Session Conflicts:', conflicts);
};
```

### Common Debug Commands

#### Check Environment Variables
```bash
# Verify OpenAI API key is set
echo $OPENAI_API_KEY

# Check other required environment variables
echo $NEXT_PUBLIC_ANALYTICS_ID
echo $DATABASE_URL
```

#### Test API Endpoints
```bash
# Test onboarding chat endpoint
curl -X POST http://localhost:3000/api/onboarding/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}],"currentPhase":"motivation"}'

# Test plan generation endpoint
curl -X POST http://localhost:3000/api/generate-plan \
  -H "Content-Type: application/json" \
  -d '{"goal":"habit","age":25,"experience":"beginner"}'

# Test recovery API endpoints
curl -X GET http://localhost:3000/api/recovery/score
curl -X POST http://localhost:3000/api/recovery/sleep \
  -H "Content-Type: application/json" \
  -d '{"duration":8,"quality":"good","deepSleep":25}'

# Test device integration endpoints
curl -X GET http://localhost:3000/api/devices
curl -X POST http://localhost:3000/api/devices/connect \
  -H "Content-Type: application/json" \
  -d '{"deviceType":"applewatch","deviceId":"test-device"}'

# Test health endpoint for app status
curl -X GET http://localhost:3000/api/health
```

#### Monitor Logs
```bash
# Check application logs
npm run dev 2>&1 | grep -i error

# Check network requests
# Use browser Network tab in Developer Tools
```

## Error Recovery Procedures

### For Users

#### Step 1: Basic Troubleshooting
1. Refresh the page
2. Check internet connection
3. Clear browser cache
4. Try different browser

#### Step 2: Advanced Recovery
1. Clear all browser data for the site
2. Restart browser completely
3. Try incognito/private mode
4. Disable browser extensions temporarily

#### Step 3: Contact Support
If problems persist:
1. Note the exact error message
2. Record steps that led to the problem
3. Include browser and device information
4. Contact support with detailed information

### For Developers

#### Step 1: Environment Check
1. Verify all environment variables are set
2. Check API keys are valid
3. Confirm database connection
4. Test network connectivity

#### Step 2: Code Debugging
1. Add console.log statements to track flow
2. Check error boundaries are working
3. Verify error handling hooks
4. Test fallback mechanisms

#### Step 3: Data Recovery
1. Check database integrity
2. Verify session storage
3. Test data migration
4. Implement data recovery procedures

### Emergency Procedures

#### Complete Reset
If all else fails:
1. Clear all application data
2. Reset to factory defaults
3. Reinstall application
4. Start fresh onboarding

#### Fallback Mode
If AI services are completely unavailable:
1. Enable guided form-based onboarding
2. Disable AI features temporarily
3. Use static goal templates
4. Implement manual goal creation

## Prevention and Best Practices

### For Users
1. Complete onboarding in one session
2. Ensure stable internet connection
3. Don't close browser during process
4. Save progress regularly if possible

### For Developers
1. Implement comprehensive error handling
2. Add retry mechanisms with exponential backoff
3. Provide clear user feedback
4. Test error scenarios regularly
5. Monitor error rates and patterns
6. Keep dependencies updated

## Support Contact Information

### Technical Support
- **Email**: support@run-smart.com
- **Phone**: 1-800-RUN-SMART
- **Hours**: 24/7 for critical issues

### Bug Reports
- **GitHub Issues**: https://github.com/run-smart/app/issues
- **Internal JIRA**: ONBOARDING-RELIABILITY project

### Documentation
- **API Docs**: `/docs/api/onboarding-endpoints.md`
- **User Guide**: `/docs/user-guide/onboarding-features.md`
- **Developer Guide**: This troubleshooting guide

---

*Last Updated: 2025-07-23*
*Version: 1.1*
*Maintained by: Development Team*

## Recent Updates
- Added ChunkLoadError troubleshooting and automatic error recovery
- Enhanced Chat API error handling and validation
- Added new API endpoints for recovery metrics and device integration
- Improved developer debugging tools and commands 