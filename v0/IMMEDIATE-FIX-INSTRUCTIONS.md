# Immediate Fix: Replace Chat Route

## Problem
The chat route from commit 87b6677 uses middleware patterns incompatible with Next.js 16 App Router, causing persistent 405 errors despite multiple fix attempts.

## Solution
Replace `app/api/chat/route.ts` with a clean, modern implementation.

## Steps

1. **Backup current route:**
   ```bash
   cd v0
   cp app/api/chat/route.ts app/api/chat/route.ts.backup
   ```

2. **Replace with working version** (see chat-test/route.ts for reference)

3. **Key changes needed:**
   - Remove `withChatSecurity` wrapper
   - Remove `validateAndSanitizeInput` (do basic validation inline)
   - Remove `ApiRequest` type usage
   - Use standard `Request` type only
   - Simplify to core functionality

4. **Deploy and test**

## Why This is Necessary

The 87b6677 version was built for Next.js Pages Router and uses:
- Complex middleware wrappers
- Custom request types (ApiRequest)
- Nested async function patterns
- Server-side only imports

All of these are problematic with App Router's edge runtime requirements.

## Alternative: Use chat-test Endpoint

Point your frontend to `/api/chat-test` instead of `/api/chat` as a temporary workaround while we rebuild the main endpoint.
