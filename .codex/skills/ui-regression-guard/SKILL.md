---
name: ui-regression-guard
description: Visual regression workflow for RunSmart UI changes. Use when the user is redesigning a screen, changing layouts, swapping templates, polishing visuals, updating CSS variables, or wants to verify that a UI change did not break existing screens.
---

# UI Regression Guard

Use Playwright-based visual checks before and after UI changes that could disturb existing layouts.

## Workflow

1. Identify the affected routes or screens.
2. Capture baseline screenshots for the current behavior when possible.
3. After the change, capture the same screens and compare:
   - layout shifts
   - missing controls
   - clipped content
   - mobile spacing regressions
   - console errors that accompany the visual break
4. If a redesign or template swap changed shared tokens, inspect adjacent screens, not just the edited one.
5. If a regression is found, fix it before treating the visual work as complete.

## RunSmart Focus Areas

- mobile-first layouts in `max-w-md` shells
- today, onboarding, plan, record, chat, and profile flows
- CSS-variable and design-token changes
- post-deploy runtime asset issues that show up as visual breakage

## Guardrails

- Do not rely on static code review for visual safety.
- Pair screenshot review with browser console inspection.
- For deploy verification, combine this skill with `post-deploy-validator`.
