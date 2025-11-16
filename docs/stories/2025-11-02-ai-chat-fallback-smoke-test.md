# Story: AI Chat Fallback Smoke Test (No OPENAI_API_KEY)

- Type: QA / Dev
- Goal: Ensure chat gracefully falls back without blocking onboarding or app usage when no API key is configured
- Links: `V0/app/api/onboarding/chat/route.ts`, `docs/implementation-reports/SPRINT_CHANGE_PROPOSAL_2025-11-02.md`

## Description
When `OPENAI_API_KEY` is absent or placeholder, the chat API should return a friendly fallback with `redirectToForm` guidance. The UI must continue working without blocking the onboarding flow.

## Acceptance Criteria
- With no `OPENAI_API_KEY` set, invoking chat:
  - Returns fallback JSON (HTTP 503 or handled response)
  - JSON contains `redirectToForm: true` and a helpful `message`
  - UI shows non-blocking notice and/or redirects to a form-based flow
- Onboarding remains fully functional
- No unhandled errors in Console

## Steps
1) Ensure `OPENAI_API_KEY` is not set for the dev session
   - Windows PowerShell: `$env:OPENAI_API_KEY = ""` (then restart the dev server)
2) Start server: `V0\\start-dev.ps1`
3) From the app UI, trigger onboarding chat (if present) and send a simple prompt
4) Verify UI behavior is non-blocking and shows the fallback notice
5) API check (optional): call the chat endpoint and verify JSON fallback
6) Capture a short console/network screenshot and the JSON response

## Sample Request Payloads (optional)

PowerShell (Invoke-RestMethod):
```powershell
$body = @{ 
  messages = @(@{ role = "user"; content = "Hello from test" })
  currentPhase = "motivation"
} | ConvertTo-Json
$resp = Invoke-RestMethod -Uri "http://localhost:3000/api/onboarding/chat" -Method POST -ContentType "application/json" -Body $body
$resp | ConvertTo-Json -Depth 5
```

Fetch (Node/Browser):
```ts
await fetch('http://localhost:3000/api/onboarding/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Hello from test' }],
    currentPhase: 'motivation'
  })
}).then(r => r.json())
```

## Risks / Notes
- Network flakiness can also trigger fallbacks; confirm key absence case

## Estimate
- 1 point



## Result
- Status: DONE
- Evidence:
  - Playwright HTML report: `docs/implementation-reports/playwright-report/index.html`
  - Latest failure/snapshot image: `docs/implementation-reports/today-smoke.png`
  - Console snippet: `docs/implementation-reports/onboarding-console-snippet.txt` (live at `http://localhost:9323`)