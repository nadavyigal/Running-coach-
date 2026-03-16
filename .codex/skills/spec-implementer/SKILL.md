---
name: spec-implementer
description: Structured implementation workflow for turning an approved plan or spec into code. Use when the user asks to implement a plan, execute a phase, build from a spec, carry out a roadmap item, or complete a multi-step feature without re-deciding the design.
---

# Spec Implementer

Use this skill after the intended behavior is already defined. The job is execution with minimal re-design.

## Workflow

1. Read the approved plan, relevant docs, and any nearby `tasks/lessons.md` guidance.
2. Convert the work into a small execution sequence:
   - interfaces and contracts
   - core behavior
   - validation and tests
   - documentation or follow-up notes
3. Preserve the spec unless new repo facts make it invalid. If the spec conflicts with reality, surface the conflict explicitly before changing direction.
4. Implement incrementally and verify each subsystem before moving on.
5. Close with a concise summary of what changed, what was verified, and any remaining risk.

## RunSmart Defaults

- Respect the existing architecture: `v0/` Next.js App Router, Dexie plus Supabase dual-data model, and running-coach safety guardrails.
- Use plan and spec flow for broad changes instead of ad hoc edits.
- If the work includes deploy or release steps, invoke `pre-deploy-checklist` before considering the implementation complete.

## Guardrails

- Do not silently redesign public behavior during implementation.
- Do not skip validation for "just wiring" changes.
- If a recurring bug pattern appears, update `tasks/lessons.md` through the lessons workflow before closing.
