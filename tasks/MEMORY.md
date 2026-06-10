# RunSmart — Decision Log

Project-specific architectural and product decisions. Read at the start of every RunSmart session.

## Format
```
## YYYY-MM-DD — [Decision title]
**Decided:** [What was chosen]
**Why:** [The reasoning]
**Rejected:** [Alternatives considered and why ruled out]
```

---

## 2026-05-20 — Agentic OS Setup
**Decided:** Added MEMORY.md, ERRORS.md, hooks, and subagents to Claude Code setup
**Why:** To eliminate re-explaining context and re-proposing failed approaches between sessions. The "same broken plan next session" loop is now structurally prevented.
**Rejected:** Minimal patch (MEMORY.md only) — hooks provide enforcement that instructions alone cannot
