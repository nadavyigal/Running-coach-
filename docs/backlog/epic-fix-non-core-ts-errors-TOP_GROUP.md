# Fix non-core TS errors – app/api/devices — Brownfield Enhancement

## Epic Goal
Reduce noise from non-core TypeScript errors by fixing the highest-impact group (app/api/devices), improving developer signal while keeping CI green per the scoping policy.

## Epic Description
### Existing System Context
- Current relevant functionality: Core MVP paths (onboarding, plan generation, Today) are type-clean and Dexie-only.
- Technology stack: TypeScript, Next.js (V0 web), Dexie for local DB.
- Integration points: Non-core folders per CI scoping (e.g., devices, recovery advanced, experimental).

### Enhancement Details
- What’s being changed: Resolve TypeScript errors in app/api/devices (non-core) without impacting core flows.
- Integration approach: Localized fixes within app/api/devices directories; avoid cross-cutting changes.
- Success criteria: 0 TypeScript errors in app/api/devices; CI non-core warning summary shows 0 for this group.

## Stories (1–3 max)
1. Enumerate non-core TS errors and produce report (existing story)
2. Fix TS errors – app/api/devices (`docs/stories/2025-11-02-fix-ts-errors-TOP_GROUP.md`)
3. Update CI non-core report to highlight resolved group; adjust backlog priorities

## Compatibility Requirements
- [ ] Existing APIs remain unchanged
- [ ] Any data changes are backward compatible (none expected)
- [ ] UI changes (if any) follow existing patterns
- [ ] Performance impact is minimal

## Risk Mitigation
- Primary Risk: Broad refactors spilling into core code
- Mitigation: Constrain edits to app/api/devices only; prefer narrow type fixes
- Rollback Plan: Revert PR; CI remains green via warn-only non-core gating

## Definition of Done
- [ ] All included stories complete; app/api/devices shows 0 TS errors
- [ ] No regressions in core paths; app builds and runs locally
- [ ] CI artifact reflects 0 errors for <top-group>
- [ ] Documentation updated (report links, backlog updates)

## Validation Checklist
Scope Validation
- [ ] 1–3 stories max
- [ ] Follows existing patterns; no architecture work
- [ ] Integration complexity is low

Risk Assessment
- [ ] Risk to existing system is low
- [ ] Rollback is feasible (single PR)
- [ ] Testing covers core functionality remains intact

Completeness Check
- [ ] Goal is clear and measurable
- [ ] Stories are properly scoped
- [ ] Dependencies identified (CI scoping policy, report)

## Story Manager Handoff
Please develop detailed user stories for this brownfield epic. Key considerations:
- System: V0 web (TypeScript, Dexie)
- Integration points: Non-core folders under CI scoping; target group: app/api/devices
- Patterns: Follow existing code style; avoid cross-cutting changes
- Compatibility: Keep external behavior unchanged; core paths unaffected
- Each story must verify no regression in core MVP paths


