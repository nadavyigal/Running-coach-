# Beta registration page

Page: `https://www.runsmart-ai.com/beta` (code: `v0/app/beta/`).
Share it with a source tag, for example:

```
https://www.runsmart-ai.com/beta?src=linkedin&utm_campaign=beta_dm
```

Every registration becomes one row in the Google Sheet **RunSmart Beta Registrations**
(id `10w2yrMINJvIWNGstlb5-doeySJFFoiNVv5JlVaxLhZc`). The page fills the first 13 columns.
`group`, `invite_code`, `status`, `status_updated` and `notes` are yours.

How it works: the page posts to `v0/app/api/beta/register/route.ts`. The route checks the
form, limits each IP to 5 tries per 10 minutes, drops bot submissions (hidden honeypot field),
then sends the row to a Google Apps Script web app with a shared secret. No Google
credentials live in the repo or in Vercel.

The rate limit is kept in memory per server instance, so on Vercel it is a speed bump, not a
hard cap. If the sheet ever fills with junk rows, tell Claude and add a stronger limit.

Until both env vars are set, the form answers "Registration is not open yet." The App Store
button works either way.

## Setup (about 10 minutes, once)

1. **Make a secret.** In Terminal run:
   ```bash
   openssl rand -hex 24
   ```
   Copy the output. You paste it in two places below.

2. **Add the script.** Open the sheet, then **Extensions > Apps Script**. Delete what is in
   `Code.gs` and paste all of [`apps-script.gs`](apps-script.gs). Click **Save**.

3. **Store the secret in the script.** In the Apps Script editor: **Project Settings** (gear
   icon) > **Script Properties** > **Add script property**. Property: `WEBHOOK_SECRET`.
   Value: the secret from step 1. Save.

4. **Deploy as a web app.** **Deploy > New deployment** > type **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**

   Click **Deploy**, approve the Google permission screen, and copy the **Web app URL**
   (it ends in `/exec`). "Anyone" only means anyone can call the URL. Without the secret the
   script refuses the row and nobody can read the sheet through it.

5. **Put both values in Vercel** (project for www.runsmart-ai.com > Settings > Environment
   Variables, Production and Preview):
   - `BETA_SHEET_WEBHOOK_URL` = the Web app URL from step 4
   - `BETA_SHEET_WEBHOOK_SECRET` = the secret from step 1

   Redeploy so the new values load.

## Test it

Open `/beta` on your phone, register with your own email, and check that a new row appears.
Then delete the test row.

## If something breaks

- **Form says "Registration is not open yet."** One of the two Vercel env vars is missing.
- **Form says "We could not save your registration."** The script refused the row. Check the
  secret matches in both places, and that the deployment has access **Anyone**. Vercel logs
  show `[beta/register] sheet webhook rejected the row` with the reason.
- **You edit the script later.** Use **Deploy > Manage deployments > Edit > Version: New
  version**. A brand new deployment gets a new URL, and Vercel would still call the old one.
- **Columns renamed or moved.** The script matches by the header text in row 1, so order does
  not matter, but the 13 header names must stay as they are.
