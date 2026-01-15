# OpenAI API Key Fix - Step by Step

## Problem
The OpenAI API key on Vercel has quotes around it, causing authentication to fail.

## Solution

### Step 1: Get the Correct Key Value

From your `.env.local` file, copy the exact `OPENAI_API_KEY` value.

**IMPORTANT:** Copy ONLY the value (NO quotes!)

### Step 2: Update Vercel Environment Variable

1. Go to: https://vercel.com/dashboard
2. Select your "running-coach" project
3. Go to **Settings** → **Environment Variables**
4. Find `OPENAI_API_KEY` and click **Edit** (three dots menu)
5. **Delete everything in the value field**
6. Paste ONLY the raw value from `.env.local` (no quotes), for example:
   ```
   OPENAI_API_KEY_VALUE
   ```
7. Make sure these environments are checked:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
8. Click **Save**

### Step 3: Redeploy

1. Go to **Deployments** tab
2. Find the latest deployment
3. Click **three dots** → **Redeploy**
4. **Uncheck** "Use existing Build Cache"
5. Click **Redeploy**

### Step 4: Verify

Wait 2-3 minutes for deployment, then test:
```bash
curl "https://YOUR-DEPLOYMENT-URL/api/health?diagnostic=true"
```

Should show:
```json
{
  "checks": {
    "openai": {
      "prefix": "sk-proj-",
      "valid": true
    }
  }
}
```

## Common Mistakes to Avoid

❌ **DON'T** include quotes: `"OPENAI_API_KEY_VALUE"`
✅ **DO** paste raw value: `OPENAI_API_KEY_VALUE`

❌ **DON'T** add spaces before or after
✅ **DO** paste exactly as shown above

❌ **DON'T** forget to check all three environments
✅ **DO** enable for Production, Preview, AND Development
