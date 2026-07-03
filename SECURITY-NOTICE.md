# 🔐 CRITICAL SECURITY NOTICE

## Immediate Actions Required Before Launch

### 1. ⚠️ ROTATE ALL API KEYS IMMEDIATELY

Your `.env.local` file contains exposed API keys that must be rotated before launch:

#### OpenAI API Key
- **Current Status**: EXPOSED in `.env.local`
- **Action**: Go to https://platform.openai.com/api-keys
- **Steps**:
  1. Revoke the existing key: `YOUR_OPENAI_API_KEY`
  2. Create a new secret key
  3. Update `V0/.env.local` with the new key
  4. Set usage limits in OpenAI dashboard

#### Resend API Key
- **Current Status**: ROTATED (confirmed dead — API returns "invalid key" as of 2026-07-02). Value redacted below since this file is tracked in a public repo; the old key remains scrubbed from RESEND_SETUP.md, EMAIL-ISSUE-SOLVED.md, BETA-SIGNUP-DIAGNOSIS.md, and GTM/EMAIL-PROVIDER-ALTERNATIVES.md as of 2026-07-02.
- **Action**: none — already rotated. If a future audit needs the old value for git-history verification, it starts with `re_efPc...` (full value intentionally not repeated here).

#### PostHog API Key
- **Current Status**: verify rotation status before next audit.
- **Action**: Go to PostHog Project Settings
- **Steps**:
  1. Confirm whether the key on file (redacted, starts `phc_5dlU...`) has been rotated
  2. Create new project API key if not
  3. Update `NEXT_PUBLIC_POSTHOG_API_KEY` in `V0/.env.local`

#### MapTiler Token
- **Current Status**: NOT CONFIRMED ROTATED as of 2026-07-02. Value redacted here — do not re-paste it into any tracked file.
- **Action**: Go to https://cloud.maptiler.com/account/keys/
- **Steps**:
  1. Delete the existing token (value redacted — check `V0/.env.local` for current)
  2. Create new token
  3. Update `NEXT_PUBLIC_MAP_TILE_TOKEN` in `V0/.env.local`

#### Supabase Keys
- **Current Status**: 🔴 **NOT ROTATED as of 2026-07-02** — confirmed by direct comparison: the service role key on file here is byte-identical to the key currently active in `V0/.env.local`. **This is a live admin-privilege credential exposed in a public GitHub repo right now.** Value redacted below — do not re-paste the actual key into any tracked file.
- **Action**: Go to Supabase Project Settings → API **immediately**
- **Steps**:
  1. Rotate the **service role key** first — it has admin privileges and bypasses RLS (redacted here; starts `sb_secret_ogT1...`)
  2. Rotate the publishable key too (redacted here; starts `sb_publishable_PpDp...`) since it was also exposed in this file's git history
  3. Update both keys in `V0/.env.local` and in Vercel production env
  4. **CRITICAL**: treat the old key as burned even after rotation — it lived in a public repo's git history and cannot be un-published. Rotation, not deletion of this file, is what actually closes the exposure.

### 2. ✅ Security Improvements Implemented

The following security fixes have been applied:

- ✅ **Prompt Injection Protection**: All user inputs to AI prompts are now sanitized
- ✅ **XSS Protection**: Chat messages are sanitized before storage and display
- ✅ **Improved Rate Limiting**: IP + User ID tracking with better reset logic
- ✅ **Timezone Handling**: Race dates now properly handle timezone conversions
- ✅ **Input Validation**: All user-controlled fields are validated and sanitized

### 3. 📋 Pre-Launch Checklist

- [ ] Rotate ALL API keys listed above
- [ ] Verify `.env.local` is in `.gitignore` (already done ✅)
- [ ] Scan git history for accidentally committed secrets
- [ ] Test all features with new API keys
- [ ] Set up usage alerts for all API services
- [ ] Configure rate limiting on external services (OpenAI, Resend, etc.)
- [ ] Run security audit: `cd V0 && npm run security:audit`
- [ ] Run full test suite: `cd V0 && npm run test -- --run`
- [ ] Run E2E tests: `cd V0 && npm run test:e2e`
- [ ] Test production build: `cd V0 && npm run build:production`

### 4. 🔍 Git History Check

Run this command to check if any secrets were committed to git history:

```bash
git log -p | grep -E "sk-proj-|re_|phc_|sb_secret_|sb_publishable_" || echo "No secrets found in git history"
```

**Correction (2026-07-02): the claim below was false.** `.env.local` itself was never committed, but this file (`SECURITY-NOTICE.md`) was, with several live key values pasted in as plaintext — the Supabase service role key remains unrotated and matches production as of this date. A markdown file documenting a rotation TODO is still a tracked file; pasting the actual secret into it defeats the purpose. Going forward, describe exposed keys by prefix only (e.g. `sb_secret_ogT1...`), never in full, in any tracked file.

### 5. 📝 Security Files Created

- `V0/.env.local.template` - Safe template for environment variables
- `V0/lib/security.ts` - Security utilities for sanitization and validation
- This `SECURITY-NOTICE.md` - Instructions for key rotation

### 6. 🚀 Next Steps After Key Rotation

Once all keys are rotated:

1. Test the application locally
2. Run the full test suite
3. Perform E2E testing
4. Monitor API usage dashboards
5. Set up alerts for unusual activity

### 7. 📞 Support Resources

- **OpenAI**: https://help.openai.com/
- **Resend**: https://resend.com/docs
- **PostHog**: https://posthog.com/docs
- **MapTiler**: https://docs.maptiler.com/
- **Supabase**: https://supabase.com/docs

---

**REMINDER**: Do not launch until all API keys have been rotated and tested!
