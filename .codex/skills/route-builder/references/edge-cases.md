# Edge Cases

- No start area provided → request clarification, emit `missing_data`.
- Distance <1km or >60km → cap to safe range or refuse with guidance.
- High-traffic constraints → prioritize parks/paths; warn if not feasible.
