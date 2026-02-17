# Garmin Connect Developer Program - Copy-Paste Application

## Form URL: https://www.garmin.com/en-US/forms/GarminConnectDeveloperAccess/

---

## SECTION 1: Company Information

### Company name: *
```
RunSmart AI
```

### Contact name: *
```
Nadav Yigal
```

### Job Title: *
```
Founder & CEO
```

### Contact phone number (include country code): *
```
+972-XX-XXX-XXXX
```
> Replace with your actual phone number

### Primary Sales Region: *
**Select:** `EUROPE/AFRICA/MIDDLE EAST`
> Israel falls under EMEA region

### Technical Support Language Preference: *
**Select:** `English`

### Company website: *
```
https://runsmart-ai.com
```

### Link to Privacy Statement/Policy: *
```
https://runsmart-ai.com/privacy
```

---

## SECTION 2: Client or Third-Party Integration

### Do you intend to integrate on behalf of a client or third-party company? *
**Select:** `No`

### If yes, please provide the legal name and brief description of the company.
```
(leave blank)
```

---

## SECTION 3: Subcontractor Information

### Will you utilize a subcontractor for your intended application? *
**Select:** `No`

### Subcontracting Company Name
```
(leave blank)
```

### Subcontractor Name
```
(leave blank)
```

### Subcontractor Title
```
(leave blank)
```

---

## SECTION 4: General Program

### How do you plan to use the Garmin Connect Developer Program? *
```
RunSmart is an AI-powered running coach Progressive Web App (PWA) that generates personalized training plans, tracks runs via GPS, and provides recovery-based coaching. We plan to use the Garmin Connect APIs to enhance our coaching accuracy by importing data from Garmin wearables:

1. Activity API: Import completed running activities including GPS tracks, heart rate, pace, elevation, and running dynamics (cadence, ground contact time, vertical oscillation, stride length) for post-run analysis and AI coaching recommendations.

2. Health API: Access resting heart rate, HRV, sleep quality, and stress data to power our recovery engine and readiness-to-train assessments before each workout.

3. Training API: Import VO2 max estimates, training load, Training Stress Score, and lactate threshold data to improve our adaptive plan generation algorithm.

All Garmin data is used exclusively to improve each individual user's training experience. OAuth tokens are encrypted at rest with AES-256. Users can disconnect and delete all imported data at any time. We do not sell or share user data with third parties.
```

### Do you intend to offer the data and/or share it with other platforms or services? *
**Select:** `No`

### If so, please specify the type(s) of data you plan to share and the third-party platform(s) with which you plan to share this data.
```
(leave blank)
```

### Can Garmin or a Garmin Distributor contact you to discuss potential business opportunities? *
**Select:** `Yes`

### Have you already been in contact with Garmin or a Garmin Distributor? *
**Select:** `No`

### If yes, what is the name of your contact?
```
(leave blank)
```

### Are you currently integrated with other device companies (e.g. Fitbit, Polar, Apple)? *
**Select:** `No`
> We have Apple HealthKit integration designed but not yet in production via wearable API

### How many end users/members are on your platform? *
```
50 beta users (targeting 200 in 90 days, 2000-5000 in 12 months)
```

### Business Services: * (checkboxes - select all that apply)
**Check:** `Fitness or Outdoor – direct to consumer`
**Check:** `Analytics`

### Reference / Target Customer: * (checkboxes - select all that apply)
**Check:** `General Consumer`

---

## Pre-Submit Checklist

Before clicking Submit, verify:

- [ ] Phone number includes country code (+972...)
- [ ] Privacy policy URL is live: https://runsmart-ai.com/privacy
- [ ] Company website is live: https://runsmart-ai.com
- [ ] All required (*) fields are filled
- [ ] reCAPTCHA is completed

---

## What Happens After Submission

1. **Response time:** ~2 business days
2. **You'll receive:** Garmin Developer Portal access with API credentials
3. **Evaluation environment:** Test sandbox for integration testing
4. **Typical integration time:** 1-4 weeks (we already have the code built)

## Post-Approval: Environment Variables

Add to `.env.local` and Vercel:
```env
GARMIN_CLIENT_ID=<from-garmin-developer-portal>
GARMIN_CLIENT_SECRET=<from-garmin-developer-portal>
GARMIN_OAUTH_REDIRECT_URI=https://runsmart-ai.com/garmin/callback
```

### Post-Approval Create-App Walkthrough

Use `docs/garmin-portal-create-app-setup.md` for field-by-field values for:
`https://developerportal.garmin.com/teams/runsmart_ai/create-app`

## Existing Code Ready for Credentials

| Endpoint | File | Status |
|---|---|---|
| OAuth initiate | `/api/devices/garmin/connect` | Ready |
| OAuth callback | `/api/devices/garmin/callback` | Ready |
| Activity import | `/api/devices/garmin/activities` | Ready |
| Token encryption | `token-crypto.ts` | Ready |
| State management | `oauth-state.ts` | Ready |
| Background sync | Redis queue + fallback | Ready |
| Manual export | `garminManualExport.ts` | Ready |
| Export modal UI | `garmin-manual-export-modal.tsx` | Ready |
| Privacy policy | `/privacy` page (Section 6: Garmin) | Ready |
| Terms of service | `/terms` page (Section 6: Third-Party) | Ready |
