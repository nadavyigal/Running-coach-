# CURSOR.md — RunSmart Web

> Cursor-native router. Follow `AGENTS.md` in this repo for all session and work rules.

## Session Start

1. Read `~/.claude/MEMORY.md` and `~/.claude/ERRORS.md`
2. Read `tasks/MEMORY.md`, `tasks/ERRORS.md`, and `tasks/lessons.md`
3. State the objective in one sentence

## Project Notes

- Stack: Next.js 14 PWA, Dexie.js (IndexedDB), Supabase, OpenAI via Vercel AI SDK, Playwright
- All app commands run from `v0/`, not the repo root
- Done gate: `npm run lint && npm run type-check && npm run build` (from `v0/`)
- Use plan mode for multi-file refactors or screen additions
- Running coach AI skills live in `.cursor/skills/` (loaded automatically)

## Architecture & Skills Reference

Full architecture, component structure, AI skills catalog, and development patterns are documented in `docs/cursor-reference.md`.

## What NOT to Do

- Do not copy `.cursor/skills/` to iOS repos (documented policy)
- Do not duplicate `AGENTS.md` content into `.cursor/rules/`

## Cross-Project Context

- Global Agentic OS: `/Users/nadavyigal/Documents/Projects /Agentic OS/AGENTS.md`
- Load `PROJECT-BRIDGES/runsmart-web.md` only for cross-project work
