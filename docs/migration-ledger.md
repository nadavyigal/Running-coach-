# Migration ledger (Coach Experience v2)

**Owner:** story C0.2. **Generated:** 2026-11-21. **Identical copy lives in both repos** (iOS `docs/migration-ledger.md` and web `Running-coach-/docs/migration-ledger.md`). Every migration PR updates its row in both.

**Compared at `origin/main`:** iOS `4a016b4` (`supabase/migrations/`), web `7527b726` (`v0/supabase/migrations/`). Byte identity checked with `cmp` via `scripts/check-migration-drift.sh` (iOS repo).

**Re-run the check (from the iOS repo root):**

```bash
sh scripts/check-migration-drift.sh /Users/nadavyigal/Developer/RunSmart
```

Exit 0 = clean, 1 = drift. The script is read-only.

**"Applied in prod" was checked read-only on 2026-11-23** (Supabase project Run-Smart, `supabase_migrations.schema_migrations`), when Batch A was applied on Nadav's explicit yes. "yes" below means a production row exists whose SQL equals the repo file with comments and whitespace ignored (md5 compared). The prod version is the timestamp Supabase stored at apply time, so it differs from the file name. Agents still never apply a migration without Nadav's yes in the same message.

---

## 1. Existing migrations from `20261114120000`

| Filename | In iOS | In web | Byte-identical | Applied in prod |
|---|---|---|---|---|
| `20261114120000_close_cross_user_rls_leaks.sql` | y | y | y | yes (prod 20261114191102; checked 2026-11-23) |
| `20261114130000_runs_workout_link.sql` | y | y | y | yes (prod 20261115065606; checked 2026-11-23) |
| `20261114210000_coach_role_and_invites.sql` | y | y | y | yes (prod 20261115065607; checked 2026-11-23) |
| `20261115091000_coach_athlete_links.sql` | y | y | y | yes (prod 20261115173534; checked 2026-11-23) |
| `20261115194500_leave_coach.sql` | y | y | y | yes (prod 20261118082006; checked 2026-11-23) |
| `20261117100000_coach_route_upload.sql` | y | y | y | yes (prod 20261118185618; checked 2026-11-23) |
| `20261117120000_complete_run_workout.sql` | y | y | y | yes (prod 20261118185634; checked 2026-11-23) |
| `20261117130000_coach_plan_mode_group_settings.sql` | y | y | y | yes (prod 20261118185658; checked 2026-11-23) |
| `20261117160000_lookup_invite_group_plan.sql` | y | y | y | yes (prod 20261118185710; checked 2026-11-23) |
| `20261117163000_replace_group_training_plan.sql` | y | y | y | yes (prod 20261118185716; checked 2026-11-23) |
| `20261117164500_coach_read_rpcs.sql` | y | y | y | yes (prod 20261118082019; checked 2026-11-23) |
| `20261118100000_coach_feedback.sql` | y | y | y | yes (prod 20261118082029, current version re-applied as 20261118185740 `coach_feedback_current`; checked 2026-11-23) |
| `20261118120000_athlete_feedback_read.sql` | y | y | y | yes (prod 20261118185753; checked 2026-11-23) |
| `20261118140000_coach_run_route.sql` | y | y | y | yes (prod 20261118185757; checked 2026-11-23) |
| `20261118160000_get_my_coach.sql` | y | y | y | yes (prod 20261118185809; checked 2026-11-23) |
| `20261118170000_set_run_route_hidden.sql` | y | y | y | yes (prod 20261118185813; checked 2026-11-23) |
| `20261118180000_coach_welcome_note.sql` | y | y | y | yes (prod 20261118185847; checked 2026-11-23) |

17 files in each tree. The newest file on `main` is `20261118180000_coach_welcome_note.sql`.

---

## 2. Drift

**Repo trees: none found on 2026-11-23.** Every migration file exists in both trees and is byte-identical (`scripts/check-migration-drift.sh` CLEAN).

**Production only (found 2026-11-23):**

- `20261120094612_athlete_display_name_placeholder` (prod version, no repo file): only in production. It replaces `public.athlete_display_name(uuid)` so the placeholder name "RunSmart Runner" from builds before 1.2.7 reads as no name ("Athlete"). Same signature and grants as `20261117164500_coach_read_rpcs.sql`. No Batch A file replaces this function. Not fixed here: a follow-up PR adds the file to both repos.

When the script finds a mismatch, add one line per file here, in this form, and fix nothing in the same PR:

- `<filename>`: only in iOS | only in web | contents differ (one-line description).

---

## 3. v2 batches

Status values: `not written`, `written (draft PR)`, `merged`, `applied`. A file moves to `written` only when its draft PR is open. Every migration PR updates its row here, in both repos.

Batch letters are from the v1.3 file map (section 0.0) and the refined plan (section 3.4). Batch A is applied after the Grok Bot audit and the 1.2.6 regression. Batch B is applied with webhooks, cron and deploys. Batch C is applied at a quiet time with the rollback file ready.

### 3.1 Reserved files (refined plan section 3.4)

| Batch | Reserved file | M-number | Story | Status |
|---|---|---|---|---|
| A | `20261121100000_coach_v2_gate.sql` | M0 + M0b | C7.0 | merged (iOS #234, web #169); applied 2026-11-23 (prod 20261123064450) |
| A | `20261121110000_coach_consent_v2.sql` | M5a | C7.8 | merged (iOS #235, web #170); applied 2026-11-23 (prod 20261123064540) |
| A | `20261121120000_athlete_run_sharing.sql` | M1a | C7.3 | merged (iOS #238, web #171); applied 2026-11-23 (prod 20261123064630) |
| A | `20261121130000_coach_last_seen_and_events.sql` | M3 | C7.2 | merged (iOS #239, web #172); applied 2026-11-23 (prod 20261123064713) |
| A | `20261121150000_athlete_run_flags.sql` | M1b | C7.4 | merged (iOS #242, web #173); applied 2026-11-23 (prod 20261123064817) |
| A | `20261121160000_coach_link_end.sql` | M5b | C7.11 | merged (iOS #244, web #175); applied 2026-11-23 (prod 20261123064854) |
| A | `20261121170000_coach_milestones.sql` | M13 (only if needed) | C7.16 | not needed: C7.16 used the existing RPCs (iOS #246) |
| A | `20261121180000_coach_feedback_replies.sql` (renamed from the reserved `20261121140000`, which sorts before M1b and would be overwritten by it) | M4 | C7.7 | merged (iOS #245, web #176); applied 2026-11-23 (prod 20261123064953) |
| B | `20261122100000_push_tokens_and_prefs.sql` | M2a | C7.10 | merged (iOS #248, web #178); not applied |
| B | `20261122110000_notification_log_and_deferred.sql` | M2b | C7.5 | merged (iOS #250, web #180); not applied |
| B | `20261122120000_workout_adherence_state.sql` (not reserved: the plan said "Mig: none", but AC6's shared `workout_adherence_state` is a SQL function) | (C7.6) | C7.6 | written (draft PR) |
| C | `20261201100000_coach_workout_locks.sql` | M6a | C8.1a | not written |
| C | `20261201110000_coach_plan_locks.sql` | M6b | C8.1b | not written |

M0 and M0b share one file because the refined plan folds C7.12 (kill switch) into C7.0 (S1). The per-coach allowlist table `coach_v2_pilot_coaches` and the RPC `coach_v2_pilot_access()` (decision N1 = B) also go in the M0 file.

### 3.2 Later M-numbers (no file name reserved)

These get a file name and timestamp only when Nadav picks the story after TF-2. The new file must sort after every file marked `written` above and after `20261118180000`.

| Batch | M-number | Story | What it is | Status |
|---|---|---|---|---|
| C (v1.3), moved to R4+ | M10 | C8.13 | `coach_self_signup` | not reserved, picked after TF-2 |
| D | M7 | C8.6 | `coach_plan_versions` + `end_coach_link` v3. Must also cover `coach_plan_versions` in `delete_account` and `purge_coach_data_for_deleted_account` (F3). | not reserved, picked after TF-2 |
| E | M8 | C8.10 | templates | not reserved, picked after TF-2 |
| E | M11 | C8.14 | groups | not reserved, picked after TF-2 |
| E | M9 | C8.12 | broadcasts | not reserved, picked after TF-2 |
| F | M14 | C9.1 | `coach_athlete_history` | not reserved, picked after TF-2 |
| F | M15 | C9.2 | `coach_athlete_load` | not reserved, picked after TF-2 |
| F | M12 | C9.3 | `coach_weekly_summaries` | not reserved, picked after TF-2 |
| F | M16 | C9.4 | `coach_feedback_ai_assisted` (D12 label) | not reserved, picked after TF-2 |

---

## 4. Rules for every migration PR

From v1.3 section 1.1 and refined plan section 3.3:

- One new file per PR. Its timestamp sorts after `20261118180000` and after every file marked `written` in section 3.1.
- A twin draft PR in the web repo adds the identical file under `v0/supabase/migrations/` and updates this ledger.
- A story that needs a file not listed here adds a ledger row first, with a timestamp that sorts in the right place.
- Renaming a file is allowed only while it is unapplied.
- Each file ships a data-preserving rollback file in `supabase/rollback/` and a row in `docs/coach-v2-rollback.md`. Agents never run a rollback or apply a migration.
- After a PR, run `scripts/check-migration-drift.sh` and paste the result into the PR. It must exit 0.
