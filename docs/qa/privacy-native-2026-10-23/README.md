# Native privacy publication — 23 October 2026

Published to https://www.runsmart-ai.com/privacy. Vercel team `team_3x9sb1XpevPDc48ijaL990io`, project `running-coach` / `prj_sAYkBPR6TteCU8uFHbkpMpUno4I3`, root `v0`, production.

- Source: `63e82cd62025bac04aaae57ad9e6af446d754206`, based on previously live `1397da404fc49a1c569a070b191f792012ec81e8`. Only policy, regression tests and progress documents differ.
- Preview: `dpl_8JGw7ThYfv95hgy4Q8nw5qDJRZ7F`, inspected in browser.
- Production: `dpl_CDGcoK8VvKf87WYr6VdXjCw7m38Y`, READY, custom domains assigned, no deployment error.
- Public HTTP 200; date October 23, 2026, Health/weight and sharing sections verified. Browser screenshot: `production.png`. No runtime error seen while loading the policy. Runtime-wide logs/drains were not audited.
- Privacy tests 5/5; TypeScript passed; lint zero errors / 1,657 existing warnings. Desktop browser checked; dedicated mobile viewport unavailable in browser tooling.
- Rollback: redeploy/promote previous production `dpl_4ua4ehuaSGx1Rn6bVUsw2cJ7Eh5m` (`1397da4`) to the same project after verifying no newer production changes. No database or env changes.

Strava is deferred. App Store Connect is signed out: the iOS repo contains prepared privacy reconciliation, but actual answers remain unverified. iOS PR164 stays open pending physical device checks; web PR147 preserves policy source for review. Neither PR was merged by this session.
