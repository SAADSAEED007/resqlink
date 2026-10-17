# Command Center visual restoration

Verdict: **PARTIALLY RESTORED**. The sidebar image, symbolic map markers, richer cards, and presentation are restored and browser checked. The existing Esri gray cartography remains, with a restrained tint; it does not reproduce the reference's navy cartographic detail. Full-project lint has an existing error outside the restoration files.

## A. Visual differences fixed

Compared the supplied reference with an actual 1440px baseline capture and inspected PR #5's original components/assets, PR #12-era refinement history, and restoration commit `21f0385`.

Regressions identified: missing sidebar promotional component despite the image still existing; circle-only Leaflet markers; small flat KPI presentation; undersized team icons; truncated activity descriptions; identical Medium/Low chart styling. Existing incident images had already been restored and remain clearly labeled as illustrative.

Restored the promotional component, icon markers and synchronized legend, colored KPI accents and icon backplates, larger figures, category visuals, queue priority edges, team visuals, wrapping activity descriptions, and distinct Low chart styling. Kept the compact header and existing official logo.

## B. Sidebar image

- Original asset: `frontend/public/images/rescue-sidebar.jpg`, also present in PR #5.
- Component: `frontend/src/components/layout/dashboard-shell.tsx`.
- Uses Next Image with object-cover, rounded border, navy gradient, headline, accent line, and `People | Technology | Faster Response` tagline.
- Sidebar scrolls on short desktop viewports. Promo hides below 1280px to preserve the existing mobile/tablet menu. Public Portal and navigation remain accessible.

## C. Map markers

- Shared controlled SVG markup: `frontend/src/components/dashboard/map-marker.ts`.
- Critical: red circled exclamation and glow. High: orange warning triangle. Medium: blue information symbol. Low: muted information symbol.
- Available teams: green vehicle symbol; busy teams: blue vehicle symbol. Offline teams remain excluded.
- 40px Leaflet divIcon targets with 36px symbols, accessible marker titles, hover feedback, selected outline, and ordered z-indexes. The legend uses the same markup.
- Actual priority, team status, and validated coordinates drive markers. No facilities or locations added.
- Preserved tooltip and incident detail-modal callbacks, team selection, dynamic Leaflet import, attribution, and map instance lifecycle. Resize now preserves the geographic center.
- Provider retained: Esri World_Dark_Gray_Base and World_Dark_Gray_Reference. Existing attribution is retained. No paid service, replacement provider, satellite/heatmap controls, or generated map image added.

## D. Theme

- Kept existing light/dark tokens and persistence. Dark cards use navy `#10253d` / `#0c2035`; sidebar uses `#10253d` / `#081a2d`; selected navigation uses `#2563eb` / `#195cbe`.
- Scoped styling to Command Center selectors. Light mode remains legible and was visually inspected.
- Retained existing provider cartography; the dark map receives only a restrained blend tint, not a substitute for a styled basemap.
- Reduced-motion styling disables workspace animations and transitions when requested.

## E. Dashboard components

- KPI counts and captions unchanged. Two demo-only sparklines reuse `MOCK_TRENDS_24H`, explicitly labeled Simulated; no historical trends added in API mode. Sparklines hide where space is constrained.
- Queue retains actual status, description, location, report time, score, and verification state. Larger image containers, priority-colored borders, and improved spacing retain existing illustrative-demo safeguards and API category icons.
- Team roster uses larger capability icons, availability accents, reported locations, and actual capacity. Removed a name-based inferred capability label. No team image assets were available, so existing vector icons were used.
- Trend chart retains existing data and range controls; Low now has a distinct muted line/legend.
- Activity retains existing labeled simulated records; improved wrapping, timestamp space, and icon backplates. API empty-state explanations remain.

## F. Functionality protected

Browser checks passed for incident-marker details, team selection, map expansion/zoom/reset, demo/API switching, theme switching, mobile menu, and short-sidebar scrolling. Existing integration tests passed for verification, recommendations, assignment/lifecycle clients, rejected mutations, read-only demo actions, risk-zone forms/assessment, and access control. These tests use mocked APIs; they are not evidence of a live backend or live authentication session.

No backend, API contract, environment, authentication, landing-page, or SOS implementation changes. Existing disabled routes remain disabled.

## G. Quality checks

- TypeScript: passed `npm run typecheck`.
- Focused ESLint on changed TypeScript components/config/tests: passed.
- Full `npm run lint`: fails on existing `react-hooks/set-state-in-effect` at `IncidentManagement.tsx:17`, plus an unused `Filter` warning at line 3. That component was not changed.
- Production build: passed.
- Browser suite: 13 tests passed (12 existing integration tests plus the restoration review).
- Overflow checked at 320, 375, 390, 430, 768, 1024, 1280, 1440, and 1920px.
- Captured and actually inspected dark desktop 1440x900 and 1920x1080, dark mobile 390x844, light desktop, sidebar detail, map/marker detail, and queue detail. Full-page captures extend vertically beyond the viewport.
- Final artifacts: `frontend/test-results/visual-restoration-dashboard-visual-review/`, with `final-dark-1440.png`, `final-dark-1920.png`, `final-dark-390.png`, `final-light-1440.png`, `sidebar-detail.png`, `map-detail.png`, and `queue-detail.png`. Test output is regenerated on subsequent runs; the initial baseline was inspected before implementation and is not retained in the final output directory.
- Browser assertions include no uncaught page errors during the restoration review.

To reproduce, start the existing frontend development server on port 3000, then run `npx playwright test --config playwright.visual.config.ts` from `frontend`. This separate config reuses the server because the normal config tries to start a second Next server on port 3100.

## H. Git

- Branch: `feature/merged-feature-integration`; intended PR base: `dev`.
- Before editing: inspected status, branch, fetched origin, and checked worktrees. Left `resqlink-brain-pack/` and the incident-sync worktree untouched.
- Changed: overview, metric, map, marker helper, team roster, activity, chart, dashboard shell, scoped CSS, focused visual tests/config, existing integration-test selectors/demo setup, and this report.
- No PR created, remote branch pushed, or PR merged. Local commit hash is reported in the completion message.

## I. Remaining issues

- Exact navy basemap fidelity remains incomplete; no replacement provider was introduced without establishing suitable access and usage terms.
- Existing incident photos limit source image quality and variety. No arbitrary or generated images added. Real attached-media rendering was not added because the inspected incident presentation exposes no attachment-media contract.
- Genuine API trend/activity histories remain unavailable and are not fabricated. No team photography assets exist in the inspected public asset tree.
- Full-project lint is blocked by the existing IncidentManagement error. Login, public SOS, and a real backend session were not exercised in this scoped mocked-browser run.
