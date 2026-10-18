# Shared map repair — 18 October 2026

Status: **FRONTEND MAPS FIXED — DATA GAPS REMAIN**. Local integration and
real-provider visual checks are recorded below. No production deployment or merge
was performed. An unauthenticated production browser redirects to `/login`, so
authenticated production map behavior remains unverified.

## Root causes and evidence

**Rescue Teams:** the component always requested Esri Dark Gray, including in
light mode. Dark mode additionally applied `sepia(1) saturate(1.8)
hue-rotate(165deg) brightness(.65)` to the tile pane. Global CSS forced the map
background to `#061425 !important`. It also lacked tile-error feedback and theme
switching. These styling/configuration problems are verified. A complete tile
outage from the reported production screenshot was **not reproduced**: all 16
original base/reference requests returned 200 in the local browser, with 256px
decoded images, opacity 1, and no network failures. Therefore a specific failed
production tile status or transient outage cause cannot honestly be named.

**Assignments:** initialization explicitly used `.setView([0, 0], 2)`. The only
later view update required a selected team/incident coordinate. No bounds fit
existed, and only eligible/assigned teams were supplied, leaving a world view
when selection or incident coordinates were absent. This cause is verified.

**Additional data issue:** `validTeam` rejected an entire directory response
when one otherwise valid record lacked `location`. Location validity now controls
plotting, independently of whether a team remains visible in the directory.

## Component audit and resulting behavior

| Route | Component | Previous provider/view | Result and data scope |
|---|---|---|---|
| `/dashboard/rescue-teams` | `RescueTeamMap` | Always Esri Dark Gray; first valid team or Karachi, zoom 11; no bounds fit | Theme-aware shared basemap; fit loaded directory bases, single point zoom 12; selected base focus; Available/Busy/Offline markers; real team API list/profile |
| `/dashboard/assignments` | `AssignmentCoverageMap` | Esri Light/Dark Gray; world at zoom 2 until selected coordinate | Fit reported incident and loaded stored team bases, or Sindh with no markers; directory API context plus eligible/assigned populated teams; selection remains gated by recommendation IDs |
| `/dashboard` | `OperationsMap` | Always Esri Dark Gray; Karachi zoom 12; no bounds fit | Shared basemap and coordinate adapter; fit actual filtered API positions; incident-detail popup links; status/severity markers, including Offline |
| `/dashboard/incidents` | `IncidentManagement` | No separate map in the audited branch | Existing filtered list and navigation preserved; no page redesign or fictional new map |
| `/dashboard/incidents/[id]` | `IncidentLocationMap` | Always Esri Dark Gray; reported point zoom 13; hardcoded fallback for a demo ID | Layout and business controls preserved; shared theme-aware tiles/validation, visible attribution, safe popup text, reliable team-layer initialization; hardcoded fallback removed |
| `/dashboard/risk-zones` | `SindhMonitoringMap` | OSM light/Esri dark; representative district points, fit max zoom 7 | Shared lifecycle/tiles/error handling; unchanged representative-point semantics, attention colors, district registry and selection; no hazard polygons |
| `/sos` | `SOSMapPicker` | OSM; Karachi starting view; tap immediately changed report coordinates | Shared OSM lifecycle, regional unmarked fallback, existing selected point zoom 14; taps/drags create candidates; explicit confirmation writes the selected point into the report |

All Leaflet runtime imports remain client-side dynamic imports. The root layout
already imported Leaflet CSS; it was not missing. Page-specific logic remains in
its existing component. The existing incident list/detail layouts, assignment
transactions, report verification, maps' real API clients, and team registration
workflow are retained.

## Shared infrastructure

`frontend/src/components/maps/` contains:

- `map-coordinates.ts`: strict finite named-field validation, Leaflet ordering,
  explicitly identified GeoJSON Point conversion, regional fallback and an
  approximate operational-extent advisory.
- `map-bounds.ts`: zero/one/multiple-position views, padding and maximum fit zoom;
  stable coordinate keys avoid resetting view on status polling/list reordering.
- `use-map-base.ts`: SSR-safe initialization, animation-frame-batched
  ResizeObserver invalidation, map cleanup, shared theme/provider configuration,
  bounded loading indication and explicit manual retry.
- `map-markers.ts`: accessible Enter/Space and pointer activation without
  treating a marker selection as an assignment.
- `map-popups.ts`, `MapFeedback.tsx`, `maps.css`: real attributes, location
  provenance, error feedback, readable attribution/popups and narrowly scoped
  tile-pane styling. Filters never affect markers or controls.

The primary team/assignment maps reconcile existing markers by record ID.
Selection updates their highlight/popups without remounting the map. Other map
modules reuse the foundation incrementally. The incident detail retains its
specialized layout and center-on-incident behavior.

## Providers and visual evidence

Light mode uses `https://tile.openstreetmap.org/{z}/{x}/{y}.png`. Dark mode uses
the existing Esri World Dark Gray Base and Reference services without image
filters or blend modes. Public SOS uses OSM. Theme selection is deliberate and
consistent; there is no automatic provider failover or aggressive retry loop.
Maximum interactive zoom is 19; Esri service metadata advertises levels 0–23,
so requests remain within that range. Provider attribution is visible, including
Esri/HERE/Garmin/OpenStreetMap/GIS user community credits from service metadata.

OSM is best-effort infrastructure subject to its
[tile usage policy](https://operations.osmfoundation.org/policies/tiles/).
Browser cache headers are respected, the browser sends an origin referrer,
and no prefetch, offline download, tile proxy or new geocoding is introduced.
Automated workflow tests stub tile requests; they do not scan public tile servers.
Esri's existing service metadata is available at
[World Dark Gray Base](https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer).
No private API key or new map environment variable is required.

The real-provider browser captures use an explicitly fictional QA team at a
known coordinate in the local app. They establish tile/style behavior, **not**
production data correctness. See `docs/map-system-qa/`:

- `map-baseline-light.png`, `map-baseline-dark.png`, `map-baseline.json`.
- `map-after-light.png`, `map-after-dark.png`, `map-after.json`.

Captured examples: original Esri `/tile/11/877/1405` returned 200; repaired OSM
`/12/2810/1756.png` and Esri `/tile/12/1755/2810` returned 200. All 18 after-capture
tile responses were 200. The repaired pane has `filter: none`, opacity 1, and
light background RGB(232,237,242). Screenshots were inspected in both themes at
1440×1000. All six existing optimized marker PNGs were inspected with Sharp:
each has non-opaque alpha with a minimum of zero, and no asset replacement was
needed. Existing cached icon instances/anchors are reused; Offline gets a gray
accessible symbol instead of inheriting Busy styling.

## Coordinate integrity and operational limitations

Backend incident and team schemas store named numeric latitude/longitude fields,
not GeoJSON. Null, undefined, blank/numeric strings, NaN, infinity and out-of-range
values are rejected for plotting. Legitimate zero coordinates are preserved; the
model has no explicit zero-placeholder flag. Plausibly swapped numeric pairs
cannot be inferred safely: they are never silently flipped or clamped. Valid
out-of-region positions remain plotted and are identified in primary popups.

GPS/user-selected or stored incident coordinates are labelled **Reported
location**, never automatically coordinator-verified. Report verification status
is not treated as geolocation verification. Manual landmark-only incidents stay
unmapped. The assignment overlay links to the actual Incident Details page;
there is no invented coordinate-review workflow. Team pins say **Stored team base
location**, not live tracking. No personnel counts, coverage circles, routes,
ETAs, hospitals, geocoded landmarks, or hazard boundaries are invented.

The team form already accepts bounded latitude/longitude; backend storage needs
no migration. Map/list scope remains the loaded records and relevant populated
assignment teams, not a claim to have loaded every database record. Bases can
overlap at city/regional scales; zoom, directory selection and keyboard marker
activation are available without displacing their real positions.

## Validation and deployment

All **21 selected checks passed**: an 18-test combined coordinate/map/operational
suite and three additional incident-list/Overview-link/detail-visual regressions,
using `playwright.maps.config.ts`. Final changed-file ESLint, TypeScript, and
the full Next.js production build passed. No backend files changed.
Coverage includes zero/one/multiple positions, strict coordinate parsing, actual
API-shaped markers, selection, missing locations, tile failures/retry, both
themes, responsive layout, hidden/revealed SOS picker, explicit candidate
confirmation, incident detail, district map, and assignment lifecycle.

Assignment responsive tests passed in both themes at widths 320, 375, 390, 430,
768, 1024, 1280, 1440, 1648 and 1920. Incident detail passed dark-mode overflow
checks across the same widths with 1650 instead of 1648, a light-mode desktop
capture at 1440, and a 390px confirmation-dialog size check. Team-map interaction
also passed at 390px. These workflow/layout tests use stubbed tile images and
explicit QA API fixtures; the desktop real-provider screenshots above are the
separate geographical basemap visual evidence.

Frontend-only Vercel rebuild/deployment is required after review. Render and its
environment are unchanged. No merge, data migration or production mutation was
performed. Authenticated checks against all deployed map routes remain required
after deployment; the live Rescue Teams URL currently redirects this fresh
browser session to login.

Branch: `fix/shared-mapping-system-production`, isolated at
`D:/Hacakthon/.worktrees/shared-mapping-system-production`, based on origin/dev
`9a69070` at task start. Unrelated worktrees and pending source changes were not
edited.
