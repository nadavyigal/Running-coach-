# Coach feedback migration rollout — 18 November 2026

Source: nadavyigal/IOS-runsmart-light-app- PR #207, head `6a0033c606dafb6a261a06052aa92c393f15f291`.
Target: existing Run-Smart Supabase project `dxqglotcyirxzyqaxqln`.
The owner explicitly approved applying the missing leave-coach and coach-read prerequisites before feedback.

## Applied migration history

Supabase MCP assigns deployment-time versions. These are equivalent to the repository files below; do not replay them solely because their timestamps differ.

| Repository file | Live version | Name |
| --- | --- | --- |
| 20261115091000_coach_athlete_links.sql | 20261115173534 | coach_athlete_links (already applied) |
| 20261115194500_leave_coach.sql | 20261118082006 | leave_coach |
| 20261117164500_coach_read_rpcs.sql | 20261118082019 | coach_read_rpcs |
| 20261118100000_coach_feedback.sql | 20261118082029 | coach_feedback |

The four SQL files are byte-for-byte copies from the source head. The previously applied coach-athlete-links file was also missing from the web tree and is included so a fresh schema can replay these prerequisites in order.

## Verification

- Live schema inspected before changes; runs.id is bigint and the read RPCs' referenced columns exist.
- Three authorized migrations applied successfully in dependency order.
- Live feedback table: RLS enabled; authenticated has SELECT only; two owner/active-coach SELECT policies; no client write policy.
- Feedback RPCs use an empty search_path, deny anon execution and grant authenticated execution.
- Account-deletion cleanup denies anon/authenticated execution and is service-role only.
- Coach, athlete and run foreign keys cascade.
- Current-head GitHub Actions SQL suites for leave_coach, coach_read and coach_feedback passed, including applying the target migrations twice on throwaway databases.
- Security advisors flagged the intentionally authenticated SECURITY DEFINER endpoints (add/edit feedback, active-coach lookup and leave-coach). These endpoints need elevated table access by design; explicit auth/ownership/link checks, empty search_path and revoked anon execution were verified. This warning is accepted for these RPCs. See [advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Unrelated pre-existing advisories remain outside this rollout.
- This PR mirrors SQL and records rollout evidence. It does not require a web deployment or a new paid capability.
