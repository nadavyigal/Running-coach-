# Coding Standards

## General
- Prefer existing patterns in `v0/app`, `v0/components`, `v0/lib`, and `v0/hooks`.
- Use TypeScript and keep changes narrow.
- Keep files and routes readable; avoid broad refactors during feature work.
- Use path aliases like `@/components` and `@/lib` where already used.
- Keep behavior compatible with existing tests unless a spec intentionally changes it.

## Next.js
- Use App Router conventions.
- Keep server-only code out of client components.
- Use route handlers for server/API work.
- Prefer Server Components where they fit, but respect existing client-heavy app shell patterns.
- Do not add new global state unless local state, context, or existing utilities are insufficient.

## Components
- Reuse existing UI primitives in `v0/components/ui`.
- Keep screen-level behavior in screen/page components and reusable display logic in smaller components.
- Include loading, empty, and error states for user-facing async work.
- Preserve authentication-aware behavior where present.

## API Routes
- Validate input with structured checks or Zod when practical.
- Return clear status codes and safe error messages.
- Never expose secrets or service-role behavior to clients.
- Log enough for diagnosis without leaking user data or tokens.

## Accessibility
- Use semantic elements.
- Preserve keyboard access for interactive controls.
- Maintain labels, focus states, and readable contrast.
- Do not hide critical information behind hover-only UI.

## Performance
- Keep Today and primary mobile flows fast.
- Avoid loading heavy charts/maps unless needed.
- Be careful with client bundle growth.
- Use memoization only when it solves a measured or obvious rendering issue.
