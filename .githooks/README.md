# Git hooks

`pre-commit` blocks commits that stage hardcoded secrets (API keys, tokens,
private keys, JWTs). It is tool-agnostic — it runs for Claude, Codex, and manual
`git commit`.

## Activate (once per clone)

```bash
git config core.hooksPath .githooks
```

Bypass for a confirmed false positive: `git commit --no-verify`.
# hooks active
