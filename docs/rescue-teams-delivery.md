# Rescue Teams delivery

Verdict: FRONTEND COMPLETE / BACKEND GAPS. The reference composition is implemented using the existing shell and actual API fields; the shell, illustrations and map tiles differ from the supplied artwork.

## Isolation and implementation
Branch: `feature/rescue-teams-reference-ui-isolated`. Worktree: `D:/Hacakthon/.worktrees/rescue-teams-reference-ui`. Preview: `http://localhost:3200/dashboard/rescue-teams`. The main working tree and port 3000 remain available for Antigravity?s incident work. This page is not installed into that active working tree.

The original shell disabled Rescue Teams and there was no complete team workspace. The new route enables that navigation item. It contains the header, four KPI cards, directory, map, profile, registration/editing dialogs, confirmed availability actions and actual assignment timeline.

Created: `frontend/src/app/dashboard/rescue-teams/page.tsx`, `frontend/src/components/rescue-teams/{RescueTeamsWorkspace,RescueTeamMap,TeamDetails,TeamFormDialog,TeamAssignmentDialog,TeamActivity,team-utils}.tsx`, `use-rescue-teams.ts`, `rescue-teams.css`, `frontend/tests/rescue-teams.spec.ts`, and `frontend/playwright.rescue-teams.config.ts`.
Modified: dashboard shell navigation, team API client, assignment list client and team input contact type. No incident implementation or backend files changed.

## Backend contracts inspected
Inspected merged `origin/dev` at `22017f4`: response routes/validation/service and team model. Authenticated coordinator/admin team list/get/create/PATCH endpoints support server pagination, name/code search, status, capability and simulation filtering. Code is immutable; only AVAILABLE/OFFLINE can be manually submitted. Active assignments protect BUSY status. Contact fields are supported.

Assignment history is merged: GET `/api/assignments?teamId=...` returns populated team/incident references. The workspace handles these shapes locally without changing existing incident consumers. Assignment creation uses POST `/api/assignments`; pending-incident recommendations gate eligibility before explicit review and confirmation. Backend conflicts remain authoritative.

## Data and interactions
Each KPI uses the API pagination total from an independent limit-one query, never a loaded-page count. API mode explicitly requests real records; demo uses established sample fixtures and disables writes. Directory search/status/capability operate on the server. Code/name/status sorting is visibly labeled as loaded-page sorting. Pagination, stable selection, nine-second polling, visibility pause and mutation locks are included.

The map uses one Leaflet instance, existing Esri base/reference tiles with attribution, the existing `getRescueTeamMarkerIcon` helper and `MARKER_ASSETS` green/blue rescue assets. Offline teams use a neutral marker. It plots valid stored bases, synchronizes row/marker/profile selection, preserves zoom and does not claim live GPS or inferred service boundaries.

Overview and Capabilities tabs display stored fields. Equipment/Personnel tabs explain their missing backend support. Capacity is shown as response capacity, never invented headcount. Contact links use stored phone/email. Full Profile shows actual dates, coordinates and contact fields.

Registration validates the supported schema and preserves rejected drafts. Editing never changes team code or assignment relationships and omits status for BUSY teams. Availability requires confirmation. Assignment requires backend eligibility and a second confirmation. Ambiguous write failures require inspection before an acknowledged retry. Activity contains actual stored assignment/completion/cancellation timestamps, with selected-team filtering and pagination.

## Verification
Thirteen Rescue Teams browser scenarios passed across the initial run and targeted rerun after fixing duplicate marker creation. Ten existing API tests passed. Typecheck, ESLint and production build passed. Build generated `/dashboard/rescue-teams` successfully.

Browser scenarios cover exact full-server totals, server filters/search, local sorting, directory/map/profile synchronization, populated assignment references, register/duplicate rejection, BUSY editing payload, availability confirmation, assignment confirmation, missing coordinates, API error/empty states, polling draft/tab retention, read-only demo and route navigation. Responsive overflow checks passed at 320,375,390,430,768,1024,1280,1440,1648,1920 pixels. Screenshots generated in dark mode at 390/768/1440/1648/1920 and light mode at 1440; dark 390/768/1648 were visually inspected. This is not a pixel-identical reference claim.

Production validation used a local-only absolute Turbopack root to resolve the shared node_modules junction. That machine-specific config is deliberately excluded from the commit. Live production backend writes were not exercised: browser mutation tests use API mocks.

## Backend gaps and limits
No equipment/personnel inventory, team photographs, live GPS, coverage polygons, trustworthy travel ETA, profile/status audit stream or dispatch notification contract exists. These fields/events are not fabricated. Search matches backend name/code only. Map and assignment picker expose their loaded-page scope. Equipment and personnel controls remain unavailable until contracts exist. The incident workspace in the other working tree is outside this delivery.
