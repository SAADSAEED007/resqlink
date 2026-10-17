# Command Center and SOS refinement

## Baseline and scope

Branch: `feature/frontend-ui-refinement`, based on `origin/dev` at `cbf32f1`. Both SOS commits were already merged through PR #9. The shared working directory contained unrelated backend scratch files and a brain pack; they were preserved and excluded. No dependency on `feature/incident-sync-api`, no backend/authentication/scoring/verification/assignment source changes, and no public landing hero or How It Works changes.

The task brief described three screenshots but no separate screenshot files accompanied this turn. The existing implementation and actual rendered desktop/mobile pages were inspected. Local before/after context from the prior SOS work is available under `playwright-report/citizen-sos`; current review artifacts are under `playwright-report/refinement` (ignored).

## Visible changes

- Command Center: route-scoped light gray canvas, white surfaces, shared palette tokens, 228px sidebar, 72px desktop toolbar, shorter title and compact mode banner. Four 100px metrics place the map at about 270px from the top at 1440px. The 540px map and queue share a 2:1 main grid. Navigation becomes a keyboard-accessible disclosure below 1280px and content stacks on mobile.
- Branding: reuse `/images/ResQLink Shield Brand Logo.png`, the exact landing asset, with preserved aspect ratio. No dark-letter variant exists in the asset directory. Its white wordmark is displayed on a small navy backing, without raster recoloring, in the sidebar and SOS header.
- Queue: real buttons, readable descriptions and location/time/status, actual priority score and verification state. No invented confidence percentage, inferred building-collapse title, or unrelated stock incident photo. Detail uses a native modal dialog with focus containment, Escape and focus restoration, and preserves unknown danger/assistance values.
- Actions: search/clear, mode switch, refresh, alerts/open incident, sign-out confirmation, map zoom/reset/expand, incident modal and team selection/close all have real actions. Unimplemented nav routes remain disabled with Soon labels. Fake View All actions, decorative weather, unsupported map layers, synthetic hospital availability in API mode and invented vehicle counts are removed.
- SOS desktop: maximum 1280px composition, roughly 32/68 columns, useful card interior around 736px at 1440px, 170px supplied glossy SOS image, compact two-column shortcuts, aligned step/action controls and a restrained reduced-motion-aware pulse. Existing mobile spacing and one-column flow remain, with only the official header branding updated. The three-step location/details/review architecture, state, validation, GPS, map picker, honest media dialog, API client, duplicate-click guard and real returned ID confirmation are preserved.

## Data and refresh

Current stable authenticated clients call GET `/api/incidents?limit=100&sort=priority`, GET `/api/rescue-teams?limit=100` and GET `/api/assignments?limit=100`. Existing credential/session-expiry behavior remains. The overview is read-only; it has no assignment/status/verification mutation controls, so no mutation workflow is invented. Its existing exposed `refresh()` can be awaited by future successful mutation actions.

API mode refreshes seven seconds after the previous cycle completes, avoiding overlap. Hidden tabs cancel in-flight requests and pause the timer; visible tabs refresh immediately, including rapid hide/show transitions. Unmount/mode change aborts requests and clears listeners/timers. Partial failures preserve each previously loaded dataset and show an error with the last fully successful update time. Search, selected incident/team and map viewport survive refresh. Map is instantiated once; ResizeObserver invalidates its size on container changes.

Demo mode uses only its existing simulated records, disables refresh for the fixed snapshot, makes no protected data requests, and clearly labels simulated trends/activity. API mode does not show those fabricated analytics. Summary counts describe the loaded first page, not database-wide totals; pagination/aggregate APIs remain a follow-up for datasets over 100 records. Resolved Today counts resolved loaded records whose updatedAt is today, explicitly labeled in its helper; no resolved-at history endpoint exists. This is an approximation, not a historical resolution metric.

The dashboard retains its existing Esri dark-gray base/reference tile URLs and visible Esri/OpenStreetMap attribution. It does not claim those are live GPS positions. SOS retains its separate existing OpenStreetMap picker. Markers use validated coordinates and text-only tooltips. External tile availability is outside this frontend; tile failure has honest feedback. Optional satellite/density modes were removed to simplify the operational controls.

Public SOS still uses POST `/api/incidents` through the existing typed client, requires no account and submits only the existing schema. No upload endpoint, public tracking, dispatch integration, idempotency service or persistent personal draft storage is added. A refresh loses the in-memory draft; acknowledged uncertain retries can duplicate a report under existing backend behavior.

## Changed files

- `src/components/layout/dashboard-shell.tsx`, `command-center.css`: compact shell, official logo, scoped theme and responsive controls.
- `src/components/dashboard/DashboardOverview.tsx`, `MetricCard.tsx`: layout, mode/data status, honest metrics and analytics separation.
- `OperationsMap.tsx`, `PriorityIncidentQueue.tsx`, `IncidentDetailModal.tsx`: map/readable queue/accessibility.
- `RescueTeamAvailability.tsx`, `IncidentTrends.tsx`, `RecentActivity.tsx`: real team actions, honest empty/data states and simulated analytics labels.
- `dashboard-context.tsx`: stable API polling, last update and retained selection/data.
- `src/components/sos/SOSExperience.tsx`, `sos.css`: official header logo and desktop-only refinement; workflow logic preserved.
- `tests/dashboard.spec.ts`, `tests/foundation.spec.ts`: updated heading and accurate card assertions.
- `tests/refinement.spec.ts`: nine-width screenshots, scoped light palette, compact header/map placement, menu keyboard behavior, polling visibility/failure/non-overlap/cleanup, map zoom and selection retention, action checks and runtime page-error capture.

## Validation and artifacts

Viewport matrix: 320, 375, 390, 430, 768, 1024, 1280, 1440 and 1920px. Screenshots are `playwright-report/refinement/command-WIDTH.png`, `sos-WIDTH.png` and `sos-details-WIDTH.png`. These are local ignored artifacts and are not bundled as source assets. Production lint, TypeScript, build and the final browser suite are reported in the PR with actual totals. Browser requests use isolated synthetic mocks and never submit fake incidents to the normal database.

Final validation: all 84 frontend checks pass (83 in the full run, then the corrected selection-retention test passed on rerun). The original test closed the dialog before expecting selection, which intentionally clears it; it now keeps the dialog open across refresh. Lint and TypeScript pass with no warnings; production build passes. Additional targeted polling/action checks verify the final disabled demo-refresh state. Manual Chrome inspection loaded 20 dashboard tiles with zero failed tile requests and zero console/runtime errors. The full responsive matrix and existing homepage/login/SOS tests were exercised without normal-database writes.
