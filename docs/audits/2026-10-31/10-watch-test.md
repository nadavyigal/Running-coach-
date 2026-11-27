# 10. Apple Watch feature and tester script

State: READY FOR APPROVAL
Date: 2026-10-31
Scope: read-only. Nothing fixed, nothing sent, no App Store Connect change.

## Answer first

There is no RunSmart Watch app. The feature in PR #165 sends a planned RunSmart session to Apple's own Workout app on a paired Watch, then reads the finished workout back from Apple Health.

- It is not in main and not in public 1.2.2. It exists only on branch `codex/apple-watch-workoutkit` and in TestFlight build **1.2.1 (38)**.
- Build 38 is older than the public app. Its source is 41 commits behind iOS main. Installing it replaces 1.2.2 on the tester's iPhone.
- The last recorded beta review state is "Waiting for Review" on 26 Oct. The current state is not verified. There is no App Store Connect API access in this session.
- No physical Watch test has passed. Every Watch claim below is from code and simulator tests only.

## Inclusion

| Question | Finding | Evidence |
| --- | --- | --- |
| Branch | `codex/apple-watch-workoutkit`, head `323ed3e` | `git log` |
| PR | [#165](https://github.com/nadavyigal/IOS-runsmart-light-app-/pull/165), draft, CONFLICTING with main | `gh pr view` |
| In iOS main | No. Build 38 source `feee81c` branches from `61b7cfb` (PR #164 merge). | `git merge-base` |
| In 1.2.2 release | No. Receipt says `watch_pr_165_excluded: true`. 1.2.2 binary has no "Send to Apple Watch" string. | Receipt, `strings` on IPA |
| In TestFlight | Build 1.2.1 (38), external group "Apple Watch Beta", one tester, submitted for beta review | `docs/qa/releases/1.2.1-watch-beta/upload-receipt.json` on the branch |

## Target, signing, entitlements

Checked on the build 38 IPA at `/Users/nadavyigal/Developer/runsmart-apple-watch-artifacts/2026-10-26/AppStoreExport38/RunSmart.ipa`. SHA-256 `3239a38a...60c9d1` matches the receipt.

| Item | Value |
| --- | --- |
| Targets | iPhone app plus `RunSmartRunLiveActivityExtension`. No watchOS target. The PR changes `project.pbxproj` only for version numbers. |
| Bundle id | `com.runsmart.lite`, team `8VC4R5M425` |
| Version | 1.2.1 (38), minimum iOS 17.0 |
| Signing | Apple Distribution, `get-task-allow` false, `beta-reports-active` true |
| Entitlements | HealthKit, Sign in with Apple, associated domains. No new entitlement for Watch scheduling. |
| Health usage strings | Read and write present |
| Apple platform needs | `WorkoutScheduler` and `CustomWorkout` need iOS 17 and watchOS 10 (Apple docs). The app checks `WorkoutScheduler.isSupported`. |

## TestFlight readiness

| Check | State |
| --- | --- |
| Uploaded and processed | Yes, 26 Oct |
| Beta review | Last seen "Waiting for Review" on 26 Oct. Current state unknown. |
| Tester enrolled | One approved tester. Whether that tester is the intended person is not recorded in either repo. |
| Invite delivered or accepted | Not verified |
| Build expiry | TestFlight builds expire 90 days after upload, so about 24 Jan 2027 |
| Physical Watch pass | No |

## Data flow

1. RunSmart plan session (interval type, complete work and recovery targets, dated today or later).
2. `AppleWorkoutService.makePlan` builds a `CustomWorkout`: outdoor running, warmup, one interval block, cooldown, optional pace alerts (`SpeedRangeAlert`).
3. `WorkoutScheduler.shared.schedule(plan, at:)` hands it to Apple. RunSmart reads the schedule back to confirm.
4. Apple syncs it to the Workout app on the paired Watch. RunSmart has no control over timing.
5. Runner starts it on the Watch, runs, saves. Apple writes the workout to Apple Health.
6. Runner opens RunSmart, Connections, Apple Health, Sync Now. Import is manual and foreground only: latest 100 workouts, 180 days.
7. `HealthKitSyncService` imports the run, links it to the plan item by the stable plan id, marks it complete once, uploads to Supabase.

What it does not do: no RunSmart app on the Watch, no live RunSmart voice coaching on the Watch, no background Health delivery, no deletion sync from Health, no Garmin or Strava.

## Known open issue

One real P2, raised by both Codex and CodeRabbit at `HealthKitSyncService.swift:80`. If the first plan lookup for an ordinary Health workout fails, and a later lookup succeeds with no linked plan, that run never reaches the normal completion matching. The plan item stays open. This is a narrow edge case. Not fixed, per scope.

## Decision before inviting the tester

Build 38 lacks everything shipped in 1.2.1 (39) and 1.2.2 (40): run photo and video sharing, satellite share design, plan recovery, and the Gate A fix that keeps test events out of PostHog.

| Option | Pro | Con |
| --- | --- | --- |
| A. Test build 38 as is | Ready now, if Apple approved it | Tester loses 1.2.2 features while on it. His test events may reach PostHog. |
| B. Rebase #165 on main, fix the P2, cut a new beta | Tests what would ship | New build, new beta review. Needs founder approval for upload. |

The script below is written for option A. If option B is chosen, replace the build number and keep every step.

## Test script

**Build.** RunSmart 1.2.1 (38) from TestFlight, group "Apple Watch Beta".

**Devices.**
- iPhone on iOS 17 or later.
- Apple Watch paired to that iPhone, on watchOS 10 or later.
- Write down both models and OS versions before starting.

**Prerequisites.**
1. TestFlight installed on the iPhone. Accept the invite with the same Apple ID that got it.
2. Install build 38. It replaces the App Store version.
3. Sign in to RunSmart with a real account, not guest mode.
4. Have a training plan with an interval session dated today or later. If there is none, use Build my plan.
5. Watch charged. Outdoor route of at least 3 km. Phone can stay home for step 3.

**Steps and expected results.**

| # | Do this | Expect this |
| --- | --- | --- |
| 1 | Open the interval session. Tap Send to Apple Watch. Allow scheduling. | Success message in RunSmart. No error. |
| 2 | On the Watch, open Workout, scroll to scheduled workouts. | Exactly one RunSmart session with the right warmup, reps, recovery and cooldown. Pace alerts match the plan if the plan has them. Delivery can take a few minutes. |
| 3 | Start that session on the Watch. Leave the iPhone behind. Run it. Save on the Watch. | Watch guides each step and gives step alerts. |
| 4 | Back home, keep the Watch near the iPhone for a few minutes. In RunSmart open Connections, Apple Health, Sync Now. Allow workout read access. | One new run appears. |
| 5 | Compare that run with the Apple Workout summary. | Distance and moving time match within a small margin. The planned session shows as completed once. |
| 6 | Tap Sync Now again. Force-quit and reopen RunSmart. | Still one run and one completion. No duplicate. |
| 7 (optional) | Send a session, then edit or reschedule it in RunSmart. | The Watch shows the updated version only. |
| 8 (optional) | Deny scheduling or Health read in Settings, then try again. | A clear message. No crash. |
| 9 (optional) | Run a Watch workout that was not sent from RunSmart, then Sync Now. | It imports as a normal run. It must not complete an unrelated plan session. |

**Bug report template.**

```
Step number:
What I did:
What I expected:
What happened:
iPhone model and iOS version:
Watch model and watchOS version:
RunSmart build (Settings > TestFlight shows it):
Time it happened (with time zone):
Screenshot or screen recording: yes / no
Can I repeat it: always / sometimes / once
```

Send through TestFlight feedback (screenshot and shake, or the TestFlight app). Do not post route maps or health data publicly.

**Retest criteria.** A fix is accepted only when:
1. It is in a new build number, named in the retest note.
2. The failed step passes twice in a row on the same devices.
3. Steps 1 to 6 still pass on that build.
4. The result is written down with device, OS, build and date.

**After testing.** Reinstall RunSmart from the App Store to get back to the public version.

## Draft invitation (not sent)

> Hi [name],
>
> Would you test one RunSmart feature with your Apple Watch? It sends a planned interval run from RunSmart to Apple's Workout app on your Watch, then brings the finished run back through Apple Health.
>
> You need an iPhone on iOS 17 or later and a paired Watch on watchOS 10 or later. It takes one outdoor run of about 30 to 45 minutes, plus 10 minutes of checks.
>
> This is a test build, 1.2.1 (38). It replaces the App Store version on your phone until you reinstall it from the App Store. It does not include the newest sharing features.
>
> You will get a TestFlight email from Apple. I will send the short checklist separately. If something breaks, the checklist has a simple report format.
>
> Thanks,
> Nadav

## Founder actions

1. Open App Store Connect, TestFlight, "Apple Watch Beta". Record the current review state of build 38 and the tester's email. Do not change it from this track.
2. Choose option A or B.
3. Confirm the intended person is the enrolled tester, or add them (that is an App Store Connect change, so it needs your approval).
4. Send the invitation yourself if you approve the text.
5. Keep PR #165 as draft until a physical pass is recorded.
