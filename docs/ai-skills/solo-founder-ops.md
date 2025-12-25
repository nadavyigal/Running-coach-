# AI Skill: Solo Founder Ops Playbook

A set of operational skills to keep a solo founder on top of backlog triage, release hygiene, customer feedback, and stakeholder comms without adding headcount.

## Skills covered
1. **Backlog & Spec Triage Copilot** — clusters inbound issues/ideas, drafts mini-specs, and prioritizes by impact/effort.
2. **Release QA & Smoke Tester** — runs scripted checks and summarizes blockers before shipping.
3. **Customer Feedback Synthesizer** — pulls themes from chat/email/app reviews and suggests quick-win fixes.
4. **Growth & GTM Cue Generator** — proposes weekly experiments (landing copy, email subject tests, onboarding tweaks) tied to metrics.
5. **Investor/Advisor Update Drafter** — compiles key metrics, shipped items, and asks; outputs a ready-to-send update.

## Inputs & context
- **Product signals**: issue tracker exports, `v0/docs/` specs, roadmap snippets, and error logs (e.g., `v0/lib/backendMonitoring.ts`).
- **Analytics**: events from `v0/lib/analytics.ts` (adoption, funnel drop-offs), lighthouse reports, and testing artifacts in `v0/`.
- **Support/feedback**: helpdesk CSVs, chat transcripts (sanitized), app store reviews, or NPS comments.
- **Release artifacts**: recent commits, test outputs, and e2e screenshots under `v0/playwright-report/`.
- **Business context**: target KPIs, cash runway, and upcoming milestones (fundraise, launch, partnership).

## Output contracts (suggested)
```ts
interface BacklogTriage {
  themes: Array<{ theme: string; count: number; sampleIssues: string[] }>;
  topPicks: Array<{ id: string; title: string; impact: 'low' | 'med' | 'high'; effort: 's' | 'm' | 'l'; rationale: string }>;
  nextActions: string[];
}

interface ReleaseQA {
  status: 'go' | 'block' | 'risk';
  checks: Array<{ name: string; result: 'pass' | 'fail' | 'warn'; note?: string; evidence?: string }>;
  blockers?: string[];
  owners?: string[];
}

interface UpdateDraft {
  headline: string;
  metrics: Array<{ name: string; value: string; trend: 'up' | 'flat' | 'down'; note?: string }>;
  shipped: string[];
  risks: string[];
  asks: string[];
  eta: string;
}
```

## Prompting scaffolds
- **Backlog triage**: "Cluster issues by theme, label impact/effort, and return BacklogTriage JSON. Include 3 sample issue titles per theme."
- **Release QA**: "Given test logs and diffs, list critical checks and output ReleaseQA. Treat any failed auth/navigation tests as block."
- **Update drafting**: "Summarize wins/metrics/risks for advisors; keep under 160 words. Return UpdateDraft and a plain-text email body." 

## Execution flows (per skill)
1. **Backlog & Spec Triage Copilot**
   - Ingest issue/export CSV + recent commits.
   - Cluster with embeddings; cap to top 5 themes.
   - Score impact/effort; propose `topPicks` sorted by ROI.
   - Emit analytics event `founder_triage_run`.

2. **Release QA & Smoke Tester**
   - Parse `npm run lint`, `npm run test`, and Playwright outputs under `v0/playwright-report`.
   - Map failures to user-facing flows (onboarding, plan, chat) for prioritization.
   - Output `ReleaseQA`; flag `status='block'` on auth, checkout, or data-loss bugs.

3. **Customer Feedback Synthesizer**
   - Deduplicate feedback by semantic similarity; tag by feature (onboarding, plan, chat, recovery).
   - Surface 3 quick wins and 2 structural issues; include sample quotes.
   - Emit `feedback_synthesized` for tracking.

4. **Growth & GTM Cue Generator**
   - Read funnel drop-offs from analytics; pair each with a proposed experiment.
   - Suggest copy tests, lifecycle nudges, or pricing prompts with metric owners and sample text.
   - Limit to 5 experiments; mark expected impact and validation metric.

5. **Investor/Advisor Update Drafter**
   - Pull key metrics (MAU, activation, retention, burn/runway) and shipped highlights.
   - Draft `UpdateDraft` plus a narrative paragraph; include 1–2 explicit asks.
   - Provide a TL;DR and subject line variants.

## Integration points
- **APIs**: Add a `/api/founder/ops` route that accepts CSV uploads or links to dashboards and returns the chosen contract(s).
- **CLI/cron**: Optional GitHub Action or cron to run triage weekly; drop outputs into `docs/ops-reports/`.
- **Analytics & monitoring**: track runs via `v0/lib/analytics.ts`; trace prompts with `v0/lib/backendMonitoring.ts`.
- **Security**: scrub PII and secrets before prompting; reuse `v0/lib/security.middleware.ts` for inbound requests.

## Evaluation & success metrics
- Time saved per week (self-reported).
- Lead time from issue intake to shipped fix.
- Release blocker catch rate before production.
- Advisor response rate and follow-up actions.

## Failure & mitigation
- **Noisy or low-quality input** → request more structured artifacts and default to deterministic heuristics (e.g., label by file path).
- **PII leakage risk** → enforce redaction and logging controls before/after model calls.
- **Overconfident prioritization** → cap `topPicks` count and require a human confirm step in the UI/CLI.

## Extensions
- Connect to external trackers (Linear/Jira) for two-way sync.
- Add a "fundraise brief" mode to prep data rooms and FAQ responses.
- Offer a "founder off-day" digest summarizing only critical alerts and top opportunities.
