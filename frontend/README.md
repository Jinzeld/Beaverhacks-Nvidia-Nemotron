# SecAgent Frontend Plan

This frontend is being built for an 8-hour hackathon demo.

The goal is not to build a perfect product UI. The goal is to ship a clear, stable demo for the SecAgent workflow:

`Detect → Reason → Approve → Patch → Verify → Report`

## Scope

- Keep the frontend small, fast to edit, and easy to demo.
- Prioritize the core workflow over visual polish.
- Do not expand scope beyond the agreed demo story.
- Treat data contracts in Module 1 as the baseline for later modules.

## Module Plan

### Module 1 — Skeleton + Data Layer

- HTML shell
- Tailwind + Chart.js CDN
- Global `appState`
- Full mock dataset with 4 findings
- `api()` fetch wrapper with mock fallback
- Landing ↔ Dashboard view switching

Status:
- Baseline implemented
- Should be treated as the current contract before building later modules

### Module 2 — Landing Page

- Title + subtitle
- Radar scan SVG animation
- URL input
- `ANALYZE` button
- Click transitions into the dashboard view

### Module 3 — Risk Panel (Left Column)

- Donut chart with Chart.js
- Total finding count in the center
- Severity count list
- Findings list with sorting
- Selected card state
- Click behavior that triggers `selectFinding`

### Module 4 — Summary + Output (Center Column)

- Sticky summary area
- Target / time / headline / timeline
- Tab switch: `Details` / `Raw Output`
- Details rendering for finding content
- Raw output rendered in `<pre>`
- History timeline dots

### Module 5 — Process Panel + Audit Log + Top Bar

- Top bar with URL + `ANALYZE` + `History`
- Right-side 5-step process panel
- Spinner / running state display
- Bottom audit log
- Audit log collapse behavior

### Module 6 — Wiring + History Drawer + Demo QA

- Full scan start flow
- API call + polling + final result hydration
- History drawer slide-out behavior
- Switching between historical runs
- Cross-module integration checks
- Final demo checklist

## Working Rules

- Work module by module.
- Do not casually change Module 1 schema names after later modules start.
- Keep commits small and phase-based.
- Do not wait until the end to make one large commit.
- Prefer demo clarity over extra features.
- If a change affects multiple modules, note it clearly before continuing.

## Current Frontend Direction

- The demo should feel like a focused security workflow, not a generic admin dashboard.
- The user should quickly understand:
  - what target is being scanned
  - what findings were detected
  - what Nemotron recommended
  - where approval happens
  - what changed after remediation

## Recommended Next Step

Build Module 2 next, using the Module 1 data layer and view switching contract as-is.
