# Emergency Operations Command Center Dashboard (Feature 03)

## Overview

The Emergency Operations Command Center is the operational centerpiece of **ResQLink** for CODE//CONNECT'26. Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Leaflet, and Recharts, it provides coordinators with an interactive real-time spatial overview of flood incidents, rescue team deployments, and situational risk analysis across Karachi.

The visual design closely follows the approved dark navy operational command center design tokens (#061425 background, #07182B sidebar, #0B1D33 cards, #203650 borders, #2378F6 primary blue, #F04452 critical red, #F5B942 warning amber, and #18C785 available green).

---

## Route Structure

- **`/dashboard`**: Protected coordinator overview dashboard route.
  - Guarded by `<CoordinatorGuard>` (session verification and `admin` role validation).
  - Encapsulated by `<DashboardProvider>` providing reactive shared state across header, sidebar, map, queue, and analytics panels.
  - Rendered inside `<DashboardShell>` layout.

---

## Components Created & Organized

All feature components are organized in `frontend/src/components/dashboard/`:

| Component | File Path | Purpose |
| --- | --- | --- |
| `DashboardOverview` | `src/components/dashboard/DashboardOverview.tsx` | Main orchestration view; arranges KPI metrics, spatial map, incident queue, team status, trends, and activity feed. |
| `DashboardProvider` & `useDashboard` | `src/components/dashboard/dashboard-context.tsx` | Central state management: live API query, search filtering, demo mode toggle, selection state, and KPI computations. |
| `MetricCard` | `src/components/dashboard/MetricCard.tsx` | Reusable KPI card with large numerical display, semantic status indicators, and SVG sparkline area visualization. |
| `OperationsMap` | `src/components/dashboard/OperationsMap.tsx` | Interactive Leaflet map centered on Karachi (24.8607, 67.0011). Supports Map (ArcGIS Dark Gray Canvas), Satellite, and Density Heatmap modes, divIcon markers with pulsing critical animations, and interactive popups. |
| `PriorityIncidentQueue` | `src/components/dashboard/PriorityIncidentQueue.tsx` | Priority-sorted incident list with documentary photo thumbnails, priority badges, location/timestamp, and SVG AI confidence circular progress rings. |
| `RescueTeamAvailability` | `src/components/dashboard/RescueTeamAvailability.tsx` | Operational status panel showing response units (Alpha-1, Bravo-2, Charlie-3, Delta-4), vehicle/crew counts, and base locations. |
| `IncidentTrends` | `src/components/dashboard/IncidentTrends.tsx` | Recharts responsive multi-series area chart displaying historical incident progression by priority tier with 24h, 7d, and 30d time ranges. |
| `RecentActivity` | `src/components/dashboard/RecentActivity.tsx` | Real-time event log tracking team assignments, en-route status, new reports, and resolutions. |
| `IncidentDetailModal` | `src/components/dashboard/IncidentDetailModal.tsx` | Interactive modal allowing coordinators to inspect full incident details, vulnerability demographics, risk factor breakdowns, and update resolution status. |
| `mock-data.ts` | `src/components/dashboard/mock-data.ts` | Isolated, typed simulated Karachi emergency dataset with realistic coordinates, teams, assignments, and hospitals. |

---

## Backend Endpoints Consumed

| Endpoint | Method | Role | Data Consumed |
| --- | --- | --- | --- |
| `/api/incidents` | `GET` | Admin | Fetches paginated incident list sorted by priority score. Derives active incidents, critical cases, and map marker coordinates. |
| `/api/rescue-teams` | `GET` | Admin | Fetches paginated rescue teams. Derives available/busy team counts and team map positions. |
| `/api/assignments` | `GET` | Admin | Fetches active assignments. Derives recent assignment activity and en-route statuses. |
| `/v1/user/me` | `GET` | Coordinator | Authenticates user session, coordinator initials, name, and admin verification. |
| `/v1/logout` | `PUT` | Coordinator | Secure sign-out with HTTP-only cookie invalidation. |

---

## Data Transformation Logic

1. **Active Incidents**: Filtered from `incidents` where `status !== 'RESOLVED' && status !== 'CANCELLED'`.
2. **Critical Cases**: Filtered from `incidents` where `priorityLevel === 'CRITICAL' && status !== 'RESOLVED' && status !== 'CANCELLED'`.
3. **Available Teams**: Count of teams where `status === 'AVAILABLE'` formatted alongside total teams (`6 / 8 Available Teams, 2 teams on mission`).
4. **Queue Sorting**: Incidents are prioritized by severity tier (`CRITICAL` > `HIGH` > `MEDIUM` > `LOW`) with tie-breaking based on `priorityScore` and timestamp.
5. **Missing Coordinate Guard**: Incidents without valid coordinates (`location === null` or `locationVerificationRequired === true`) are strictly excluded from map markers to avoid fabricating GPS positions; they are flagged in the queue and map warning banner for manual phone verification.

---

## Map Implementation & Attributions

- **Library**: `leaflet` with custom dynamic client component rendering.
- **Default Dark Matter Basemap**:
  - Provider: Esri ArcGIS World Dark Gray Base & Reference Overlay.
  - Attribution: `&copy; Esri &copy; OpenStreetMap contributors`.
  - Zero watermark, high-contrast dark gray palette optimized for emergency GIS.
- **Satellite Basemap**:
  - Provider: Esri World Imagery.
  - Attribution: `Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS`.
- **Heatmap Layer**:
  - Interactive SVG radial gradient density circles based on incident priority and water levels.

---

## Generated Asset Inventory

All generated imagery was produced using the platform's AI visual asset generation tools for illustrative simulation purposes and saved in `frontend/public/images/`:

1. **`frontend/public/images/rescue-sidebar.jpg`**:
   - Sidebar documentary artwork depicting Pakistani emergency rescue personnel in high-visibility protective gear assisting civilians onto an inflatable raft in urban floodwaters at dusk.
   - Text overlay: *"Stronger Communities. Safer Tomorrows."*

2. **`frontend/public/images/incidents/urban-flooding.jpg`**:
   - Simulated incident thumbnail: Severe street flooding in Korangi Industrial Area with submerged vehicles and brown floodwaters.

3. **`frontend/public/images/incidents/building-collapse.jpg`**:
   - Simulated incident thumbnail: Structural damage to an urban residential building in Lyari with emergency cordon tape and inspection personnel.

4. **`frontend/public/images/incidents/fallen-tree.jpg`**:
   - Simulated incident thumbnail: Large uprooted fallen tree obstructing traffic in PECHS during monsoon rains.

5. **`frontend/public/images/incidents/water-logging.jpg`**:
   - Simulated incident thumbnail: Stagnant rainwater inundating a residential alley in Gulshan-e-Iqbal.

---

## Demo Mode & Integrity Guardrails

- The application includes an explicit **Demonstration Mode** switch.
- When toggled ON (or with `?demo=true`), the dashboard loads the curated Karachi simulated dataset matching the official reference screenshot.
- A prominent banner visibly identifies simulated content: *"Demonstration Mode: Displaying simulated Karachi flood response data."*
- When toggled OFF (or with `?demo=false`), the dashboard queries the live backend API at `http://localhost:4000/api`.
- API connection failures display an honest ErrorState with a *"Try Again"* button; errors never silently fall back to mock data.

---

## How to Run Locally

### 1. Prerequisites
- Node.js 18+ (tested on Node 20+)
- npm 9+

### 2. Frontend Setup
```powershell
cd frontend
# Ensure dependencies are installed
npm install

# Start Next.js development server
npm run dev
```
Open `http://localhost:3000/dashboard` in a browser.

### 3. Verification & Tests
```powershell
cd frontend
npm run lint          # ESLint checks
npm run typecheck     # TypeScript strict compilation
npm run build         # Next.js Turbopack production build
npm test              # Full Playwright test suite (26 automated tests)
```

---

## Environment Variables

Configured in `frontend/.env.local`:
```dotenv
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_AUTH_URL=http://localhost:4000/v1
```

---

## Testing Results

- **Playwright Test Suite**: 26 out of 26 tests passing.
  - `tests/dashboard.spec.ts`: All 5 command center tests passed (panel rendering, real-time search filtering, detail modal interaction, 375px mobile overflow check, 1600px desktop screenshot).
  - `tests/foundation.spec.ts`: All 11 responsive layout, authentication, cookie, keyboard navigation, and dialog tests passed.
  - `tests/api.spec.ts`: All 10 API error and envelope unwrapping tests passed.
- **Production Build**: `next build` compiled cleanly in Turbopack in 4.0s with zero errors.
- **TypeScript**: `tsc --noEmit` passed with 0 type errors.
- **ESLint**: Passed with 0 errors and 0 warnings.

---

## Teammate Integration Guidance

- **Teammate 2 (Citizen SOS)**: Public SOS form submissions created via `POST /api/incidents` will automatically appear in this Command Center dashboard once the coordinator refreshes or on periodic polling.
- **Child Routes**: Real detail pages for `/dashboard/incidents/[id]` or `/dashboard/teams` can be linked directly from `DashboardShell` navigation when implemented.
