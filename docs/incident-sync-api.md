# ResQLink Incident Synchronization & API Performance Guide

## 1. Overview & Operational Polling Architecture
This guide outlines the backend capabilities and contracts designed to power the ResQLink Emergency Operations Command Center with reliable, low-latency periodic synchronization.

Instead of introducing unneeded real-time infrastructure (such as WebSockets, Socket.IO, or Redis), ResQLink leverages high-performance read-only queries with compound Mongoose indexes, lean document serialization, and deterministic tie-breaking.

---

## 2. Endpoints Summary

### A. Incident Synchronization Endpoint
- **Method**: GET
- **Path**: /api/incidents
- **Authentication**: Required (ccessToken in cookie or Authorization header).
- **Role**: Coordinator (dmin). Public users cannot view operational incident records.
- **Cache-Control**: 
o-store, no-cache, must-revalidate, proxy-revalidate (Never cached by reverse proxies or browser HTTP caches).

#### Supported Query Parameters
| Parameter | Type | Validation / Allowed Values | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| page | integer | min 1, max 100000 | 1 | Pagination page number |
| limit | integer | min 1, max 100 | 20 | Incidents per page (prevents unbounded memory spikes) |
| status | string | PENDING, ASSIGNED, IN_PROGRESS, RESOLVED, CANCELLED | none | Filter by operational lifecycle state |
| priorityLevel | string | CRITICAL, HIGH, MEDIUM, LOW | none | Filter by triage severity level |
| emergencyType | string | FLOOD, MEDICAL, FIRE, STRANDED, SUPPLIES, OTHER | none | Filter by emergency category (Command Center map filters) |
| erificationStatus | string | NEEDS_REVIEW, VERIFIED, FLAGGED_DUPLICATE, DISMISSED | none | Filter by verification badge state |
| updatedSince | ISO date string | Valid ISO-8601 string (e.g., 2026-10-17T12:00:00.000Z) | none | Returns only records modified at or after timestamp |
| sort | string | priority, newest, oldest | priority | Deterministic sort order |

#### Deterministic Sorting Order
1. **priority (default)**: { priorityScore: -1, createdAt: 1, _id: 1 } (Highest priority first; tie-broken by oldest created and ObjectID).
2. **
ewest**: { createdAt: -1, _id: 1 } (Most recent emergency submissions first).
3. **oldest**: { createdAt: 1, _id: 1 } (First reported first).

---

### B. Single Incident Endpoint
- **Method**: GET
- **Path**: /api/incidents/:id
- **Authentication**: Required (ccessToken).
- **Role**: Coordinator (dmin).

---

### C. Rescue Teams Endpoint
- **Method**: GET
- **Path**: /api/rescue-teams
- **Authentication**: Required (ccessToken).
- **Role**: Coordinator (dmin).
- **Cache-Control**: 
o-store, no-cache, must-revalidate, proxy-revalidate.

#### Supported Query Parameters
| Parameter | Type | Validation / Allowed Values | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| page | integer | min 1, max 100000 | 1 | Page number |
| limit | integer | min 1, max 100 | 20 | Max teams per page |
| status | string | AVAILABLE, BUSY, OFFLINE | none | Filter by team operational status |

#### Sorting & Indexes
- Ordered alphabetically by 	eamCode: 1.
- Supported by the compound index { status: 1, teamCode: 1 }.

---

## 3. Database Indexes Added
1. **Incident Model**:
   - { updatedAt: -1 }: Optimizes incremental synchronization queries with updatedSince.
   - { emergencyType: 1, status: 1, priorityScore: -1 }: Optimizes filtered list views across map hazard categories and lifecycle tabs.
2. **RescueTeam Model**:
   - { status: 1, teamCode: 1 }: Optimizes team availability filtering during polling.

---

## 4. Frontend Polling & Handoff Guidance

### Recommended Polling Setup for Tech Lead
1. **Polling Frequency**:
   - Poll /api/incidents?page=1&limit=50&sort=priority every **5 to 10 seconds** while the Command Center tab is active.
   - Poll /api/rescue-teams?status=AVAILABLE&limit=50 every **10 seconds** to refresh the available dispatchers panel.
2. **Lifecycle Optimization (Page Visibility API)**:
   - Pause polling when document.visibilityState === " hidden\ to reduce network and MongoDB overhead.
 - Resume polling immediately when the user returns to the tab.
3. **Immediate Mutation Refresh (Optimistic / Delta Revalidation)**:
 - When a coordinator verifies an incident (PATCH /api/incidents/:id/verification), overrides priority (PATCH /api/incidents/:id/priority), assigns a team (POST /api/assignments), or resolves an incident (PATCH /api/incidents/:id/status), immediately trigger a fetch to /api/incidents without waiting for the next polling tick.
4. **Preserving UI State**:
 - Do not wipe existing list state on fetch failure or during background requests.
 - Match items by _id to update marker locations, priority badges, and status pills in-place smoothly.
