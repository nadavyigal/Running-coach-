# Edge Cases

- Missing HR data → default to `modify` and emit `SafetyFlag: missing_data`.
- Consecutive hard sessions (>3) → force `modify` with rest recommendation.
- Self-report includes pain/dizziness → force `skip`; include safety advisory.
- Race day flagged but low readiness → propose pacing downgrade instead of cancellation unless severe symptoms.
