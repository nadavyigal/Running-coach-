# 07. Voice coaching trace: motivating, calm and technical

State: READY FOR APPROVAL
Date: 2026-10-31
Scope: read-only. No product code changed.

## Answer first

The three tones do not reach the voice. A runner can pick a tone, and it is stored, but no cue path reads it.

- Server AI cues use one fixed prompt ("a calm encouraging running coach") and one fixed OpenAI voice (`nova`). The request from iOS carries no tone field.
- Offline cues are fixed English sentences (distance, split pace, moving time), spoken by the built-in `en-US` system voice.
- The profile "Coaching Tone" screen is a static mock. It always shows "Motivating" as selected and saves nothing.
- Three different tone lists exist in the app. "Direct" and "Calm" are both saved as `supportive`.
- No ElevenLabs code, config or commit message exists in any branch of either repo.
- There is no live evidence that any AI cue has ever been served. PostHog has 0 `voice_cue_served` events in 180 days.

## Sources checked

| Source | Ref | How checked |
| --- | --- | --- |
| iOS release source for 1.2.2 (40) | `48ee7b3b` on `codex/release-1-2-2` (not in main) | `git show` of each file |
| iOS main | `origin/main` `3c2d679` | `git diff 48ee7b3b origin/main` on all voice files: no difference |
| Packaged 1.2.2 (40) IPA | `/private/tmp/runsmart-release-artifacts-2026-10-29/AppStoreExport40/RunSmart.ipa`, SHA-256 `7be6c540...e055` (matches receipt) | Unzipped, read `Info.plist`, `strings` on the binary, listed files |
| Live 1.2.2 | Apple lookup id 6768297840 | Version 1.2.2, released 2026-10-30T15:13:05Z. Build number is not public. |
| Web main and production | `origin/main` `33dcbc4f`, latest Production deployment `33dcbc4f` (2026-10-29) | Source read, GitHub deployments API, live probe |
| Analytics | PostHog RunSmart project | HogQL count of `voice_cue_served`, `voice_cue_throttled` |
| All branches | Both repos, every remote branch plus all commit messages | `git grep -i elevenlabs`, `git log --all --grep=eleven` |

Live 1.2.2 to IPA link: ASC had build 40 selected in the 1.2.2 draft, and the IPA SHA matches the receipt. Apple does not publish the build number, so "live 1.2.2 is build 40" is strong but not proven. The voice files are identical in main and in the release source, so the finding holds either way.

## End-to-end trace

### 1. Stored preference

| Where the runner picks | Options shown | Saved to Supabase `profiles.coaching_style` |
| --- | --- | --- |
| Onboarding (`OnboardingView.swift:57`) | Motivating, Calm, Direct | `encouraging`, `supportive`, `supportive` |
| Goal editor (`SecondaryFlowView.swift:1990`) | Motivating, Technical, Supportive, Strict | `encouraging`, `analytical`, `supportive`, `challenging` |
| Profile > Coaching Tone (`CoachingToneScaffold`, `SecondaryFlowView.swift:1732`) | Motivating, Calm, Technical | Nothing. Static view. "Motivating" is hard-coded as selected. |

Mapping is in `RunSmartSupabaseClient.swift:569` (`supabaseCoachingStyle`). Anything not matching "motivat", "techni" or "strict" falls to `supportive`. After a reload, `SupabaseSession.swift:142` sets `coachingTone` to the stored style string, so the profile tile can show `supportive` or `analytical` instead of the label the runner picked.

So: "motivating" is stored as `encouraging`. "Calm" is stored as `supportive`. "Technical" can only be set from the Goal editor and is stored as `analytical`. Onboarding cannot produce "technical".

### 2. Cue generation

Two independent paths.

**A. Offline cues (default on).** `LocalRunCueService.swift`.
- Triggers: run start, pause, auto-pause, resume, finish, recovered run, and a split every 1 km, 0.5 km or 5 min of moving time (user setting). Guided workout step cues ride along.
- Text: fixed English, built in code. Example: "2 kilometers. Split pace 5 minutes 41 seconds per kilometer. Moving time 11 minutes 20 seconds."
- No tone input.

**B. Server AI cues ("Extra AI coach cues", default off).** `VoiceCoachService.swift`.
- Toggle is in Audio cues settings. Default is off (`voiceCoachEnabled` absent means false).
- Needs both toggles on: AI cues and spoken cues. The live Audio/Muted button mutes both.
- Fires every 300 s of live run time. Paused time is banked, not counted.
- Request body (`VoiceCueContext`): elapsed minutes, distance, current pace, `targetPaceMinPerKm: nil`, workout title, `heartRateBPM: nil`. No tone. No user id.
- Server (`v0/app/api/coach/voice-cue/route.ts`): requires a Supabase bearer token, then `VOICE_COACH_ENABLED === "true"`, then a throttle, then `gpt-4o-mini` with a fixed system prompt, max 60 tokens.

### 3. Provider and voice mapping

| Tone | Provider | Model | Voice | Prompt |
| --- | --- | --- | --- | --- |
| Motivating | OpenAI | tts-1 | nova, speed 0.95, AAC | "calm encouraging running coach" |
| Calm | OpenAI | tts-1 | nova, same | same |
| Technical | OpenAI | tts-1 | nova, same | same |
| Offline (any tone) | Apple AVSpeechSynthesizer | system | `en-US` default voice | none |

There is no per-tone mapping anywhere. There is no ElevenLabs path.

### 4. Credentials

- Server only. `OPENAI_VOICE_KEY`, falling back to `OPENAI_API_KEY`. No key ships in the app.
- The iOS app sends the Supabase access token. Guests skip the call.
- Whether `VOICE_COACH_ENABLED` and `OPENAI_VOICE_KEY` are set in Vercel production is **not verified**. The Vercel MCP needs authentication. The auth check runs before the flag check, so an unauthenticated probe returns 401 (observed: 401 in 2.4 s) and cannot reveal the flag.

### 5. Cache

None. The server sends `Cache-Control: no-store`. The app plays from memory and keeps nothing.

### 6. Packaged audio

None. The 1.2.2 (40) IPA contains no `.mp3`, `.m4a`, `.aac`, `.wav`, `.caf` or `.aiff` file.

### 7. Fallback

- Any server failure (no token, 401, 503 flag off, 429 throttle, 500, timeout over 8 s, empty body) is silent. No retry, no log in the app.
- Offline cues run on their own and do not depend on the server.
- A local cue always wins. If one starts, any in-flight server cue is dropped.

### 8. Device playback

- Server cue: `AVAudioPlayer`. Session category `.playback`, mode `.spokenAudio`, options `.duckOthers` and `.allowBluetoothHFP`. The session is activated just before a cue and deactivated after it with `.notifyOthersOnDeactivation`.
- Offline cue: `AVSpeechSynthesizer` with `usesApplicationAudioSession = false`, so the system manages mixing and ducking per utterance.

## What is in main, the release source and live 1.2.2

| Item | Code merged (iOS main) | In release source 48ee7b3b | In packaged 1.2.2 (40) | Enabled in production | Used by real users |
| --- | --- | --- | --- | --- | --- |
| Offline cues | Yes | Yes | Yes (`runLocalCueSettings` in binary) | Yes, default on | Not measured |
| AI cue toggle and client | Yes | Yes | Yes (`/api/coach/voice-cue`, "Extra AI coach cues" in binary) | Default off on device | No evidence |
| Server route (web) | Yes | n/a | n/a | Deployed at `33dcbc4f` (401 without auth). Flag value unknown. | 0 `voice_cue_served` in 180 days |
| Tone in voice | No | No | No | No | No |
| ElevenLabs | No | No | No | No | No |

Caveat on the PostHog zero: server capture needs a PostHog key in Vercel. That is also unverified. Zero events means "flag off, no one enabled the toggle, or capture not configured". It does not prove which.

## Behavior facts

| Topic | Finding | Evidence level |
| --- | --- | --- |
| Supported languages | English only for all cues. The App Store lists English and Hebrew for the app, so Hebrew users get English cues. | Code |
| Cue timing | Offline: per 1 km, 0.5 km or 5 min moving time, boundary interpolated. AI: every 300 s live time. Server throttle: 45 s minimum gap, 30 per hour. | Code |
| Ducking | Both paths duck other audio only while speaking. No interruption handler for phone calls on the AI path. | Code. Not heard on device. |
| Lock and background | `UIBackgroundModes` has `location` and `audio`. Offline cues are designed to run while locked. AI cue timer runs on the main run loop and should fire while location keeps the app alive. | Code. No physical lock test recorded. |
| Offline | Offline cues work. AI cues are skipped silently. | Code |
| Latency | Not measured. The server makes two sequential OpenAI calls after auth. The app gives up at 8 s. | Unmeasured |
| Cost per run | About $0.002 per AI cue (about 140 characters at the $15 per 1M characters tts-1 rate in the code comment, plus about $0.00005 for text). About 6 cues for 30 min, about $0.013. About 12 cues for 60 min, about $0.026. Offline cues cost nothing. Price not re-checked against OpenAI's current list. | Code estimate |

## Other defects found on the way

1. Throttle key. iOS sends no `userId`, so the server throttles by client IP. Runners behind the same carrier NAT share one budget. The route already has the authenticated user and could key on it.
2. "Direct" in onboarding is saved as `supportive`, the same as "Calm".
3. The Voice Coaching screen (`VoiceCoachingScaffold`) is also static ("During workouts: On", "Light", "Focused"). These rows are not wired to anything.

## Smallest reliable fix

Recommendation: a server-only change first, then a small iOS build.

**Step 0, founder, no code.** Decide if AI cues should be live at all. If yes, confirm `VOICE_COACH_ENABLED=true` and `OPENAI_VOICE_KEY` in Vercel production. If no, leave it off. Nothing else matters until this is known.

**Step 1, web only, reversible, reaches live 1.2.2 users.** In `voice-cue/route.ts`, read `profiles.coaching_style` for the authenticated user and choose one of three short system prompts. Map `encouraging` and `challenging` to motivating, `supportive` to calm, `analytical` to technical. Key the throttle on the authenticated user id. Keep the one `nova` voice for now. Changing the voice per tone can follow after listening tests. Effort: about 1 to 2 hours plus tests. Rollback: revert one commit.

Why this is the smallest: the tone is already stored on the server, and the route already knows the user. No App Store review is needed.

**Step 2, next iOS build.** Make the tone lists match and make the Coaching Tone screen real. See checklist.

Not recommended now: adding ElevenLabs. It adds a vendor, a key, a cost line and a privacy disclosure, and the current gap is wiring, not voice quality.

## Next-build checklist (iOS)

1. One tone list everywhere: Motivating, Calm, Technical. Use it in onboarding, the Goal editor and the Coaching Tone screen.
2. Make `CoachingToneScaffold` read and save `coachingTone`, or hide the screen.
3. Fix `supabaseCoachingStyle`: Calm to `supportive`, Technical to `analytical`, Motivating to `encouraging`. Keep old "Direct" and "Strict" rows readable.
4. Show the human label, not the stored style string, after reload.
5. Wire or hide the static Voice Coaching rows.
6. Optional: send `coachingTone` in `VoiceCueContext` so the server does not need a lookup.
7. Decide if offline cues follow tone. The smallest option is to leave them factual and say so in settings.
8. Hebrew: either localize offline cue strings and pick a `he-IL` voice, or state "spoken cues are in English" in settings.
9. Add an interruption observer on the AI cue path (phone call during a cue).
10. Unit tests: tone mapping both ways, Coaching Tone save, request body.
11. Release gate: physical lock test and listening tests below, recorded with device, OS and build.

## Listening tests (founder only)

Use a physical iPhone, the exact build, headphones, and music playing in another app.

1. Offline cues, screen on: start, 1 km split, pause, resume, finish. Check words are clear and pace numbers are right.
2. Offline cues, phone locked in pocket for 2 km. Check every split is spoken.
3. Ducking: music lowers during each cue and comes back after.
4. Bluetooth headphones and AirPods: cue routes to them.
5. AI cues on, signed in, flag confirmed on: run 15 min. Expect about 3 cues. Note gap between the 5-minute mark and speech.
6. AI cues with phone locked.
7. AI cues offline (airplane mode, GPS on): offline cues continue, no error.
8. Phone call during a cue: cue stops, music and cues resume after.
9. After Step 1: one run each with Motivating, Calm and Technical. Can you hear a difference in wording? Rate each 1 to 5.
10. Hebrew device language: note what is spoken.

## Founder actions

- Authenticate the Vercel MCP or run `vercel env ls production` yourself, and confirm `VOICE_COACH_ENABLED`, `OPENAI_VOICE_KEY` and `POSTHOG_API_KEY` exist. Do not paste values.
- Approve or reject Step 1.
