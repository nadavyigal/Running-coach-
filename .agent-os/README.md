# RunSmart Agent OS

This is a lightweight project-native operating layer for Claude Code, Codex, Cursor, and future agents.

It is intentionally router-based:
- Root files (`AGENTS.md`, `CLAUDE.md`, `CODEX.md`) stay short.
- Detailed behavior lives in `.agent-os/workflows`, `.agent-os/standards`, and `.agent-os/templates`.
- Live memory lives in `tasks/`.
- Product and technical context lives in `docs/product`, `docs/architecture`, `docs/specs`, `docs/decisions`, and `docs/qa`.

Agents should load only the files routed by `AGENTS.md` for the current task. The default workflow is:

Idea -> Product Brief -> Feature Spec -> Development Stories -> Implementation Plan -> Tests / Validation -> QA Report -> PR Summary -> Lessons Update.

This OS does not replace engineering judgment. It keeps work small, verified, and consistent.
