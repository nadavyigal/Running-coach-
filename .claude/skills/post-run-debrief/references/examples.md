# Examples

- **Clean run:** `summary: ["Steady pacing, minimal HR drift"]`, `confidence: 0.8`, `nextStep: "Proceed with tomorrow's workout as planned."`
- **Fatigue noted:** `summary: ["Positive split, RPE high"]`, `nextStep: "Swap tomorrow to easy 30min"`, `safetyFlags: [{code: "load_spike"}]`
- **Pain reported:** `summary: ["Stopped due to knee pain"]`, `nextStep: "Skip next session and consult a professional."`, `safetyFlags: [{code: "injury_signal", severity: "high"}]`
