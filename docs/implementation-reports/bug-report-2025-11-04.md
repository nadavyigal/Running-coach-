# Bug Report – Exploratory Audit (Playwright) – 2025-11-04

**Environment**
- URL: `http://localhost:3010`
- Mode: Dev (Next.js app, Dexie-only)
- Tooling: Playwright MCP session (headless)
- Artifacts:
  - Screenshot: `.playwright-mcp/docs/implementation-reports/today-audit-2025-11-04.png`

**Entry Steps**
1. Navigate to `http://localhost:3010`.
2. Observe onboarding wizard is shown (progress 1→2 works).
3. Click `Start Chat` in Step 2 and send a short message.

**Findings**

1) Accessibility issues in chat modal
- Error: `DialogContent requires a DialogTitle` (missing accessible title)
- Warning: `Missing Description or aria-describedby` for DialogContent
- Impact: Screen readers cannot correctly announce context and purpose.
- Severity: Medium
- Evidence: Console errors when opening chat modal.

2) Chat fallback handling returns 200 with empty content
- Behavior: POST `/api/onboarding/chat` returns 200 but no message content.
- UI Result: User sees toast "Onboarding Error – Failed to get response from AI coach"; chat input becomes effectively blocked (send disabled), dialog stays open.
- Expected: Friendly fallback message rendered in the chat transcript and/or redirect to form flow (`redirectToForm: true`), never block onboarding.
- Severity: High
- Evidence: Console error `Onboarding chat error: No response content received from AI service` and network log 200 on POST.

3) Logging inconsistency during initial render
- Log shows: `Current screen: today Onboarding complete: false`, while onboarding UI is displayed.
- Impact: Can mislead debugging and automated checks; indicates a state-label mismatch.
- Severity: Low

4) Minor UX nits (observed)
- Chat dialog shows prolonged "Loading conversation history..." even on first run.
- Progress bar buttons labeled as "Step N - Not started" are clickable; ensure this matches intended navigation rules.
- Severity: Low

**Console (errors/warnings)**
```
[ERROR] DialogContent requires a DialogTitle for accessibility
[WARNING] Missing Description or aria-describedby for {DialogContent}
[ERROR] Onboarding chat error: No response content received from AI service
```

**Network summary (relevant)**
- `HEAD /api/health` → 200 OK
- `POST /api/onboarding/chat` → 200 OK (no content in body)
- Static assets → 200 OK

**Recommended Fixes (targeted)**
- A11y: Add `DialogTitle` and `aria-describedby` to the chat modal; wire `id` to content block.
- Chat fallback: In API handler, when OPENAI is unavailable or response is empty, return:
  - HTTP 503 (or 200 with explicit fallback payload) and JSON `{ message, redirectToForm: true }`.
  - In UI, detect fallback and render a friendly assistant bubble; keep input enabled or guide to form.
- State logging: Align log label with actual route/screen or guard logs until screen state is finalized.
- UX polish: Hide or shorten the "Loading conversation history" state on first run; gate step navigation if needed.

**Next Actions**
- Implement A11y fix in chat modal component.
- Adjust `/api/onboarding/chat` fallback response contract and UI handling.
- Add Playwright checks for:
  - No console errors on opening chat
  - Fallback message presence when AI is unavailable
  - Onboarding remains interactive after fallback

— Generated via Playwright exploratory session on 2025-11-04.






