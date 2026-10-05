# Recursive Quality Control for Marketing Outputs

Use this protocol when a skill needs higher confidence before shipping copy, strategy, or experiments.

## Purpose

Replace one-shot outputs with a quality-gated loop:

Generate -> Score -> Diagnose -> Rewrite -> Re-score

Run at least one full loop. Run more loops for high-stakes assets (paid ads, pricing pages, launch messaging, high-traffic pages).

## Step 1: Define Rubric and Gates

Create an 8-12 criterion rubric tied to the deliverable.

Suggested criteria:
- Clarity
- Specificity
- Audience fit
- Differentiation
- Proof and credibility
- Offer strength
- CTA strength
- Channel compliance

For each criterion, define:
- 0/5/10 anchors
- Pass threshold

Add hard-fail checks that override score:
- Legal/compliance risk
- Unsupported claims
- Brand safety violations
- Platform policy violations

## Step 2: Define Adversarial Personas

Create 1-3 adversaries to pressure-test outputs:
- Skeptical buyer: "Why should I trust this?"
- Competitor reviewer: "What makes this non-generic?"
- Distracted scroller: "Would I stop and care in seconds?"

Require severity tags on critique:
- High: blocks shipping
- Medium: material weakness
- Low: polish issue

## Step 3: Baseline Draft (V1)

Draft V1 from a fixed brief template:
- Product and promise
- Audience, pains, objections
- Offer and constraints
- Channel rules
- Reasons to believe

Save the brief snapshot with the draft so the run is reproducible.

## Step 4: Recursive Loop

For each iteration Vn:
1. Score Vn in a rubric table (criterion, score, threshold, pass/fail, evidence).
2. Run adversary critique with severity tags.
3. Diagnose root causes (why issues happened).
4. Rewrite to Vn+1 with an explicit change plan.
5. Re-score and log delta.

## Stop Conditions

Ship only when all are true:
- All rubric thresholds pass
- No High-severity adversary issues remain
- No hard-fail violations

## Safety Rails

- Max iterations: 5-8
- If score plateaus for 2 rounds, force strategy change (new angle, tighter persona, stronger proof, different hook)

## Output Package

For reusable execution, keep:
- Final output
- Rubric and thresholds
- Adversary pack
- Iteration log
- Input and output templates

## Quick Templates

### Rubric Row

| Criterion | Score (0-10) | Threshold | Pass/Fail | Evidence |
|---|---:|---:|---|---|

### Adversary Critique Row

| Persona | Issue | Severity | Why it matters | Suggested fix |
|---|---|---|---|---|

### Iteration Log Row

| Version | Key changes | Score delta | Remaining risks | Ship status |
|---|---|---|---|---|