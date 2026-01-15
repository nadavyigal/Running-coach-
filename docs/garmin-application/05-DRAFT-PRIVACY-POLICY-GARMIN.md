# DRAFT – NEEDS REVIEW: Privacy Policy (Garmin Activity Import)

This is a draft intended to update/replace the public privacy policy page(s) (currently `V0/app/landing/privacy/page.tsx`) so it explicitly covers Garmin-imported activity data.

CRITICAL: Do not invent facts. Replace all `[[FILL: ...]]` placeholders with your real, reviewed policy before publishing.

---

## Privacy Policy

**Last updated:** [[FILL: date]]

### Who we are

RunSmart ("Run-Smart", "we", "us") provides an AI running coach application that helps users plan, track, and analyze their running.

**Website:** [[FILL: canonical website URL]]  
**Contact:** [[FILL: privacy contact email]]

### What information we collect

#### Information you provide
- Account/contact information (e.g., email address) when you sign up or join a waitlist.
- Information you enter in the app (e.g., goals, preferences, notes).

#### Activity information (including Garmin, if connected)
If you connect a Garmin account, we import completed running activities from Garmin into RunSmart after you explicitly authorize access via OAuth.

Imported activity data may include (depending on what Garmin provides and what you authorize):
- Activity identifiers and timestamps
- Activity type (running)
- Distance, duration, pace/speed
- Calories and elevation gain (if available)
- Heart rate summary (avg/max) (if available)
- Optional details: GPS track/route, cadence, power, running dynamics (if available)

#### Analytics and diagnostics
We may collect product analytics and basic diagnostics to help us understand app usage and improve reliability (e.g., page views, feature usage, error events).

[[FILL: list analytics providers actually used in production, e.g., PostHog, Google Analytics.]]

### How we use information

We use information to:
- Provide core app functionality (run history, coaching insights, plan adjustments).
- Import and display your Garmin activities when you choose to connect Garmin.
- Maintain security, prevent abuse, and improve reliability.
- Communicate with you (e.g., product updates, support responses).

### Legal bases (if applicable)

[[FILL: GDPR/UK GDPR lawful bases if you serve those users. Example: consent for Garmin connection; legitimate interests for security; contract for providing the service.]]

### Sharing and third parties

We do not sell your personal data.

We may share data with:
- Service providers that help us operate the service (hosting, databases, email, analytics), under contractual confidentiality and security obligations.
- Garmin: as part of the OAuth connection and API requests to retrieve your activities.

[[FILL: list service providers actually used (e.g., Vercel, Supabase, Resend, PostHog) and what they do.]]

### Data storage and security

We use industry-standard security practices including HTTPS in transit.

Garmin OAuth tokens:
- Tokens are stored securely and used only to retrieve activities for the connected user.
- Tokens are encrypted at rest. (`V0/app/api/devices/garmin/token-crypto.ts` uses AES-256-GCM with an `ENCRYPTION_KEY` secret.)

Imported activity data:
- [[FILL: where activity data is stored in production (local-only, cloud DB, or both)]]
- [[FILL: encryption-at-rest posture for your production DB, if used]]

Access controls:
- Only the authenticated user can view their imported activity data by default.
- [[FILL: describe any admin/support access, auditing, and purpose limitations]]

### Retention

We retain data for as long as needed to provide the service, unless you delete it or request deletion.

Garmin connection:
- We keep Garmin OAuth tokens while your Garmin account is connected.

Imported Garmin activity data:
- [[FILL: retention policy for imported activities (e.g., kept until user deletes)]]

### Your choices and controls

#### Disconnect Garmin
You can disconnect Garmin at any time in the app: [[FILL: exact navigation, e.g., Profile -> Devices -> Disconnect Garmin]].

On disconnect:
- We delete stored Garmin tokens for your account and stop importing activities.
- [[FILL: whether you also revoke tokens at Garmin via a revocation endpoint]]

#### Delete imported Garmin data
You can request deletion of imported Garmin activity data by:
- [[FILL: in-app deletion path, if implemented]]
- Or contacting us at [[FILL: support email]] with the subject “Delete my Garmin data”.

Deletion timeline:
- We delete requested data within [[FILL: N days]].

#### Access / export
[[FILL: whether you support exporting run data; if yes, describe how.]]

### Children's privacy

The service is not intended for children under [[FILL: age threshold, typically 13/16/18 depending on your policy]].

### Changes

We may update this policy. We will post the latest version at [[FILL: privacy URL]] and update the “Last updated” date.
