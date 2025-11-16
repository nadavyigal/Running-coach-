# Type-Check Scoping Policy

This project splits TypeScript checks into two tiers to keep CI green while we retire legacy/non-core errors.

Core (blocking):
- `V0/app/`, `V0/components/`, `V0/lib/`, `V0/hooks/` (excluding advanced/experimental subtrees)
- Enforced via `V0/tsconfig.core.json` and the CI step “Type check (core paths, strict)”

Non-Core (warn-only):
- `V0/app/api/devices/**`, `V0/app/api/data-fusion/**`, `V0/app/api/recovery/**`, `V0/app/(experimental)/**`, `V0/app/devices/**`, `V0/experimental/**`
- Checked via `V0/tsconfig.noncore.json`; CI publishes `docs/implementation-reports/ts-non-core-warnings-<run-id>.md`

Developer workflow:
- Fix core errors immediately.
- For non-core errors, file issues grouped by feature and schedule remediation.
- Prefer localized, low-risk fixes (types, guards) that do not alter runtime behavior.

