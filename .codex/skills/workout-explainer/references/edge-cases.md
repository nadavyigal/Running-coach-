# Edge Cases

- Workout duration > user's recent long run → emit `load_spike` flag and propose shorter substitution.
- Missing pace guidance → fall back to RPE cues and mark `missing_data`.
- Complex multi-block workouts → split cues per block, keep each block ≤3 bullets.
