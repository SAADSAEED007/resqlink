# Incident command detail workspace

## Delivery and scope

- Branch: `feature/incident-detail-redesign`, created from `72c6140` on the current integrated frontend baseline. PR base: `dev`.
- Preserved `/dashboard/incidents` as the searchable, filterable, paginated incident list. Selecting a report opens `/dashboard/incidents/[id]`; reloads and copied internal links resolve that ID through the existing authenticated API.
- Reused the official sidebar, coordinator guard, HTTP-only-cookie request client, existing API clients, dashboard team/assignment data, theme preference, incident visual component, and marker helper.
- The dedicated route has one local resource model for its current server record and mutations; there is no new global store, authentication scheme, backend, or duplicated API client.
- Existing Overview incident modals remain available. Nested detail routes correctly highlight Incidents in the sidebar.
- No backend, environment, public landing-page, login architecture, or citizen SOS source changes.

Before editing, checked Git status, branch, fetched origin, inspected worktrees and frontend instructions, and read Next's installed dynamic-route documentation. The initial tracked tree was clean. Left `resqlink-brain-pack/` untouched. Concurrent map/icon integration was retained. The final requested push includes its shared marker helper, map styling, OperationsMap integration, and referenced icon assets because the detail map depends on them. Unrelated root-image moves remain unstaged.

## Visual implementation

The supplied reference controls the composition: breadcrumb and prominent severity/title; two top cards for incident information/media and actual location; priority gauge, vulnerability statistics, status tracker, and recommendations below; green assignment action; stored-event timeline. Notes sit under recommendations; verification uses an accessible disclosure with a visible warning summary.

Kept the actual ResQLink logo and compact global toolbar. Dark mode uses the existing navy tokens, thin blue-gray borders, icon tiles, priority colors, selected team treatment, and refined spacing. Light mode uses the existing token mapping. Responsive grids reduce columns at tablet widths and stack details, risk, people, location, status/recommendations, assignment, and timeline on mobile. No reference population estimates, fictional agency logos, AI confidence percentages, match percentages, driving ETAs, impact boundaries, live-video badges, or made-up events were added.

The layout intentionally differs where backend records are sparse: API records receive a category illustration instead of fictitious evidence, unknown values remain unknown, unavailable features are explained, and a partial timeline stays short. The existing Esri dark-gray map receives a scoped navy tint in dark mode; it is not a replacement cartographic provider or a replica of the reference imagery.

## Components and files

Created:

- `frontend/src/app/dashboard/incidents/[id]/page.tsx`: route and Suspense boundary.
- `frontend/src/components/dashboard/incident-detail/IncidentWorkspace.tsx`: composition, drafts, selection, confirmations, verification, assignment, and lifecycle presentation.
- `frontend/src/components/dashboard/incident-detail/use-incident-workspace.ts`: by-ID loading, recommendation fetching, visibility-aware polling, mutation lock, server confirmation, refresh, and ambiguous-write safeguards.
- `frontend/src/components/dashboard/incident-detail/IncidentFactCards.tsx`: information, priority, vulnerability, status, notes, timeline, and date formatting.
- `frontend/src/components/dashboard/incident-detail/IncidentLocationMap.tsx`: focused Leaflet map and valid-coordinate fallback.
- `frontend/src/components/dashboard/incident-detail/incident-detail.css`: scoped themes, grids, gauge, map controls, team selection, timeline, forms, and responsive styles.
- `frontend/tests/incident-workspace.spec.ts` and `frontend/playwright.incident.config.ts`: focused browser and visual checks using the existing port-3000 development server.
- This report.

Modified:

- `frontend/src/components/dashboard/IncidentManagement.tsx`: list-to-route navigation, removed obsolete list-modal selection state, labeled filters, and scheduled the initial fetch outside synchronous effect execution to address the existing lint error.
- `frontend/src/components/layout/dashboard-shell.tsx`: active navigation for nested detail URLs.

## Available and connected backend capabilities

Readiness was verified against fetched `origin/dev` at `c8d2351`, including `backend/src/APIs/response/index.ts`, `response.service.ts`, `priority.service.ts`, `validation.ts`, `types.ts`, `dashboard.service.ts`, and the incident model. All routes below are protected by the existing authenticate middleware plus coordinator/admin authorization; frontend requests retain `credentials: include` and `cache: no-store`.

| Method and actual route | Request/response fields used | Frontend consumer | Verification |
|---|---|---|---|
| `GET /api/incidents` | Paging/status/priority/verification/sort queries; `items`, `pagination` | Existing IncidentManagement and DashboardProvider | List filtering, searching, pagination contract and navigation tested with mocked responses |
| `GET /api/incidents/:id` | `_id`, emergency type, description, location, reporter, timestamps, people/vulnerability counts, priority score/level/reasons/overrides, verification, status, assigned team, simulation flag | useIncidentWorkspace and fact cards | Direct load, reload, by-ID navigation, invalid/missing ID, failure, sparse data, and polling tested |
| `GET /api/incidents/:id/recommendations` | `items[].team`, `approximateDistanceKm`, `capacityWarning`, `manualSelectionRequired`, `message`, `distanceType` | Recommendation panel, team selection and map | Actual response shape rendered; only requested for real, pending, unassigned records; selection sends no write |
| `GET /api/rescue-teams` | `items` with ID, name/code, capabilities, availability, location, capacity, simulation flag, current incident | Existing DashboardProvider; assignment selector and assigned-team display | Existing loading reused; unavailable/concurrently assigned teams excluded from selection |
| `GET /api/assignments` | `items` with incident/team IDs, status, assigned/completed timestamps | Existing DashboardProvider and partial timeline | Actual record timestamps used; lifecycle integration tests cover refreshed assignments |
| `POST /api/assignments` | Request `{ incidentId, teamId }`; confirmed assignment `_id` | Assignment Action via existing assignments client | Explicit confirmation, server success, 400/409/500 failure, double-submit lock, refresh, and no simulated-ID writes tested |
| `PATCH /api/incidents/:id/status` | Request `{ status }`; returned incident | Lifecycle action and tracker | Assignment → in progress → resolved tested; backend rejection preserves current status |
| `PATCH /api/incidents/:id/verification` | Request `{ status, notes }`; returned verification status, review notes and timestamp | Verification & Duplicate Review | Warnings/duplicate IDs rendered; successful review and conflict-preserved draft tested |
| `PATCH /api/incidents/:id/priority` | Request `{ priorityLevel, reason }`; returned score, level and override audit | Adjust Priority and priority card | Explanation and confirmation required; real response updates gauge and override rationale |

These are code inspection and mocked frontend checks, not live database, network-dispatch, or end-to-end authentication verification.

## Operational behavior

- Priority is a rule-based score clamped by the backend to **0–100 points**. The gauge displays the actual number and scale, not a confidence percentage. Missing numeric scores show the actual priority level. Original reasons remain visible after an override, with the separate coordinator rationale identified.
- Vulnerability fields are counts, not demographic percentages. Known zero remains zero; omitted/invalid counts show Not reported. Immediate-danger messaging depends on the actual Boolean. The UI never infers missing neighborhoods, source channels, medical needs, or population estimates.
- Status progression matches the merged backend: Pending may cancel; assignment is only via `POST /api/assignments`; Assigned may start or cancel; In progress may resolve; Resolved and Cancelled are terminal. Pending cancellation is a secondary disclosure. Current assignment blocks a second assignment. No reassignment endpoint is assumed.
- Team selection is explicit. Only a subsequent confirmation can create an assignment. The backend remains authoritative on capability, availability, simulation flags, and conflicts. The UI promises a prototype record, never a real rescue dispatch or notification.
- A synchronous ref lock prevents overlapping writes. Ambiguous network/server failures do not produce success messages and require reviewing records before acknowledging a retry. Draft review/override text and selection remain local and survive polling. Successful mutations re-fetch the incident and refresh shared records.
- Detail polling uses the existing seven-second cadence, avoids overlapping reads, pauses while hidden, and retains the Leaflet instance and map view while coordinates stay the same. Route changes reset incident-specific form state.
- Valid coordinates create an attributed Leaflet map centered on the actual point. Invalid/missing coordinates show Location verification required and any supplied address, with no Karachi fallback. Open in Maps uses the actual coordinates on OpenStreetMap. The halo is explicitly decorative; no affected polygons are inferred. Team markers use only returned recommendation/assigned-team positions, labeled reported positions rather than live GPS.
- Copy internal link copies only the authenticated route URL. Coordinator access protection remains required. No public incident-sharing route was added.
- Dates consistently use `Asia/Karachi` / PKT in the workspace. The timeline uses only incident creation, the latest stored verification review, override audit entries, and matching loaded assignment timestamps, and explicitly discloses its incomplete history.
- Simulated records are read-only, use labeled existing illustrative assets, and do not send recommendation or mutation requests for simulated IDs. API errors never fall back to demo records.

## Backend gap table

| Capability | Backend status | Actual or proposed API | Frontend status | Priority |
|---|---|---|---|---|
| Incident details | Verified in origin/dev | Actual `GET /api/incidents/:id` | Integrated | P0 |
| Recommendations | Verified in origin/dev | Actual `GET /api/incidents/:id/recommendations` | Integrated; straight-line distance only | P0 |
| Assignment | Verified in origin/dev | Actual `POST /api/assignments` | Integrated with confirmation | P0 |
| Status updates | Verified in origin/dev | Actual `PATCH /api/incidents/:id/status` | Integrated; no unsupported transitions | P0 |
| Verification / duplicates | Verified in origin/dev | Actual `PATCH /api/incidents/:id/verification` | Integrated | P0 |
| Priority override | Verified in origin/dev | Actual `PATCH /api/incidents/:id/priority` | Integrated with reason and confirmation | P1 |
| Shared incident notes | Missing from inspected incident model and routes | Proposed `GET/POST /api/incidents/:id/notes` | Composer and Post Note disabled | P2 |
| Complete per-incident timeline | Global limited feed exists; no incident filter or stored full status/review history | Existing `GET /api/dashboard/activity`; proposed incident-scoped `/api/incidents/:id/activity` | Partial timeline from legitimate stored records | P1 |
| Incident media | No attachment fields or media endpoint in inspected incident contract | Proposed `GET/POST /api/incidents/:id/attachments` | Category visual in API mode; existing labeled photos only for demo records | P2 |
| Geographical impact zones | No incident-linked geometry in inspected contract | Proposed `GET /api/incidents/:id/impact-areas` | Point + decorative halo only | P2 |
| Complete linked assignment lookup | List exists, but no incident-ID filter in inspected query schema | Proposed extension `GET /api/assignments?incidentId=:id` | Only matching loaded assignments shown; partial history disclosed | P1 |
| Reporting channel | Not stored on inspected incident model | Proposed extension to incident create/detail fields | Reporting channel not recorded | P2 |
| Real team notification / routing ETA | Not present in inspected workflow contracts | Requires a separately designed dispatch/notification/routing integration | No delivery or ETA claim/control added | P2 |

### Proposed backend requirements (not implemented)

- **Notes:** authenticated coordinator `POST /api/incidents/:id/notes` with `{ content, clientRequestId }`; validated length and idempotency. Return `{ _id, incidentId, content, authorId, createdAt }`; GET should paginate the same shape. Enables shared note posting and history. Verification reviewNotes is not a general incident-note stream.
- **Activity:** extend the existing feed with incident filtering and pagination, or add `GET /api/incidents/:id/activity?cursor=&limit=`. Return stable event ID, incident ID, type, occurredAt, actor/source and transition/review/assignment metadata, plus a next cursor. Requires persisting status and review audit events rather than deriving a fictional full history from updatedAt. Enables a complete incident timeline.
- **Media:** authenticated attachment metadata GET, with separately authorized upload POST accepting a real file reference and caption. Return attachment ID, incident ID, media type, authorized URL, origin, uploader and captured/uploaded timestamps. Enables genuine incident media; do not mix illustrative assets with citizen submissions.
- **Impact geometry:** incident-scoped GET should return validated GeoJSON, incident association, hazard/severity, provenance, confidence terminology and assessedAt. This requires a verified area source/association; one point is insufficient. Enables the reference's affected-area legend and polygons.
- **Assignments:** extend existing list query to accept incidentId and paginate, preserving existing authorization. Return the existing assignment fields and total/page metadata. Enables reliable incident-specific assignment history beyond the shared first 100 records.
- **Reporting channel:** extend the existing incident schema and create/detail contract with a validated source/channel only when genuinely captured. No frontend value should be inferred from a screenshot or reporter name.

### Available but not connected

- `GET /api/dashboard/activity` and summary/stats endpoints are merged. The activity service limits global incident and assignment sets before building events, and accepts only limit/isSimulated; client-side filtering that result would not guarantee a complete per-incident timeline. The detail page therefore uses honest partial record events. Dashboard analytics integration belongs to the overview scope.
- `POST /api/assignments` accepts optional assignment-scoped notes. These were not repurposed as shared incident notes.
- Team create/update/detail endpoints are available in origin/dev but are unrelated to this incident-detail task and were not added to this workspace.

### Unmerged work and broken capabilities

No unmerged API was integrated or cherry-picked. A separate `feature/assignment-management-api` worktree exists; its presence is not evidence of merged endpoints. Open PR metadata could not be inspected with GitHub CLI because `gh` is not installed; exact open-PR status is not claimed. All capabilities connected here passed the origin/dev readiness gate.

No live backend defect was established in this frontend-only run. Mocked failures verify behavior on rejected/ambiguous requests and are not reported as backend outages. The prior IncidentManagement lint error is fixed within the allowed list changes.

## Validation and screenshots

The combined 41-test suite passed before the final layout refinement. After refinement, 18 workspace tests passed, and the remaining map interaction test passed separately after replacing its obsolete marker-class selector with the stable marker title. An additional navigation test passed for the list preview and Overview popup links. The configured suite now contains 42 tests: 20 workspace checks, 12 existing integration tests, and 10 API-client tests. Full-project TypeScript and lint checks passed during implementation; the production build was interrupted by shared build contention and is not claimed as verified for this final state.

Visual checks cover 320, 375, 390, 430, 768, 1024, 1280, 1440, 1650, and 1920px, including document overflow, light/dark themes, mobile confirmation dimensions, and uncaught page errors. Additional cases include direct URL/reload/back navigation, missing records, invalid IDs, sparse optional fields, verification/assignment/status failures, no fabricated media or percentages, read-only demo behavior, session expiration, and draft-preserving polling.

Screenshots are generated under `frontend/test-results/`:

- `incident-workspace-inciden-f7efb-tes-to-a-durable-detail-URL/incident-list.png`
- `incident-workspace-visual--f1c82-mes-and-all-required-widths/incident-dark-1440.png`
- Same directory: `incident-dark-1650.png`, `incident-dark-1920.png`, `incident-light-1440.png`, `incident-dark-390.png`, `assignment-selection.png`, `incident-location.png`.

Actual screenshots were opened and inspected during design iteration; final artifacts are regenerated by the final rerun. Browser mocks prove frontend behavior against the inspected contracts, not a real MongoDB transaction or official emergency response.

Run `npx playwright test --config playwright.incident.config.ts` with the frontend development server already running on port 3000. Run the actual project checks: `npm run typecheck`, `npm run lint`, and `npm run build` from `frontend`.

## Remaining limits

Notes, a complete per-incident audit history, attachments, impact geometry, reporting channel and real dispatch/notification services remain backend work. No paid basemap, map library, chart dependency, state library, fabricated operational data, or fake successful response was added. Exact map/image fidelity differs from the screenshot where the system has no genuine data.

No PR was created or automatically merged. The final local commit hash and final quality results are reported separately. Verdict is supported by those results and the backend gaps above.
