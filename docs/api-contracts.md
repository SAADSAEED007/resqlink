# ResQLink API contracts

Base URL: `http://localhost:4000/api`. Existing boilerplate authentication and health routes remain under `/v1`; do not combine the prefixes. Responses are JSON. This is prototype decision support for a simulated flood scenario, not validated emergency policy or real dispatch infrastructure.

## Authentication and frontend integration

`POST /api/incidents` is public. Every other `/api` operation requires the existing `accessToken` HTTP-only cookie for a database user whose role is `admin`. No authentication bypass, static demo token, or new auth system is added. Unauthenticated/expired requests return 401; authenticated non-admin users return 403.

Use existing `POST /v1/register` and `POST /v1/login` flows. Login body is `{ "email": "...", "password": "..." }`. Account creation always assigns role `user`; a trusted Tech Lead must promote an existing account to `admin` directly in MongoDB. There is no public role-promotion endpoint. Existing confirmation-email flow is inherited; when email is disabled it does not deliver confirmation messages. Do not claim a production-ready account provisioning workflow. Never send roles or coordinator IDs in core request bodies.

Set frontend `.env.local` to `NEXT_PUBLIC_API_URL=http://localhost:4000/api`, then restart Next.js. Frontend calls should use `credentials: 'include'`. Set backend FRONTEND_URL to the exact frontend origin (no path). Login/logout cookies use Path=/ so authentication covers both prefixes; clear old /v1-scoped cookies once when migrating from the boilerplate. Login omits password hashes from its user response. Existing cookies use SameSite=Strict; production cookies are Secure. Separate cross-site deployments need a reviewed cookie/domain configuration or same-site hosting; CORS alone does not make cross-site cookies work. Do not deploy an unrestricted demo admin account publicly.

```ts
const base = process.env.NEXT_PUBLIC_API_URL!;
const response = await fetch(`${base}/incidents?status=PENDING&limit=20`, {
  credentials: 'include',
});
const result = await response.json();
if (!response.ok) throw new Error(result.message);
const incidents = result.data.items;
```

## Shared responses

Success uses the existing utility:

```json
{
  "success": true,
  "statusCode": 201,
  "request": { "method": "POST", "url": "/api/incidents", "ip": "client-ip-in-development" },
  "message": "Incident created successfully",
  "data": {}
}
```

IP metadata is omitted when ENV=production. Core errors contain `{ "success": false, "statusCode": 400, "message": "...", "errors": [] }`. No stack trace or driver error is returned. Joi messages describe the first invalid field; `errors` is reserved for future structured details. Unknown request fields are rejected, including client-supplied scores, status, audit identity, assignedTeam, isSimulated, and demoKey. JSON body limit is 32kb. Text is trimmed; angle brackets and control characters are rejected. Render all text as text, not raw HTML.

HTTP codes: 200 read/update, 201 create, 400 invalid input/ID/query, 401 authentication required, 403 admin required, 404 missing record/route, 409 state/unique-code/assignment conflict, 413 oversized body, 429 inherited production rate limit, 500 generic unexpected failure, 503 transaction deployment unsupported. Retry 409 only after refreshing current state.

All list endpoints return `data: { items: [], pagination: { page, limit, total, totalPages } }`. Defaults: page=1, limit=20; max page=100000 and limit=100. No unbounded list requests. Counts and lists are separate reads and may differ briefly during concurrent writes.

## Enumerations

| Field | Values |
| --- | --- |
| emergencyType | FLOOD, MEDICAL, FIRE, STRANDED, SUPPLIES, OTHER |
| waterLevel | NONE, LOW, MODERATE, HIGH, UNKNOWN |
| priorityLevel | CRITICAL, HIGH, MEDIUM, LOW |
| confidenceLevel | HIGH, MEDIUM, LOW |
| incident status | PENDING, ASSIGNED, IN_PROGRESS, RESOLVED, CANCELLED |
| team capabilities | WATER_RESCUE, MEDICAL, EVACUATION, FIRE_RESPONSE, SUPPLY_DELIVERY |
| team status | AVAILABLE, BUSY, OFFLINE |
| assignment status | ACTIVE, COMPLETED, CANCELLED |

MongoDB IDs are 24 hexadecimal characters. Invalid IDs return 400; valid IDs with no document return 404. Timestamps are ISO dates. Object references serialize as ID strings.

## Incident operations

### POST /api/incidents (public)

```json
{
  "reporterName": "Demo citizen",
  "description": "SIMULATED household surrounded by rising water",
  "emergencyType": "FLOOD",
  "peopleAffected": 4,
  "location": { "latitude": 24.86, "longitude": 67.01, "address": "SIMULATED Karachi location" },
  "vulnerablePeople": { "elderly": 1, "children": 2, "disabled": 0, "medicalNeeds": 0 },
  "waterLevel": "HIGH",
  "immediateDanger": true
}
```

Required: reporterName (2–100 chars), description (5–2000), emergencyType, peopleAffected (integer 1–10000). reporterPhone is optional (5–32 chars, digits/plus/space/parentheses/hyphen). No email or unnecessary personal data is collected by this operation.

Location is optional or null. When present, both latitude [-90,90] and longitude [-180,180] are required finite numbers; optional address max 300. No coordinates are fabricated. Missing coordinates persist as null and set `locationVerificationRequired=true`; address-only coordinates are rejected. There is no location-edit endpoint in this scope: coordinate verification remains an operational manual task.

Each vulnerability count is optional, integer 0–10000. Categories may overlap; they are not summed to infer unique people. Omitted counts remain unknown, not zero. Water level and immediate danger are optional; omissions lower confidence. Numeric/boolean string coercion follows the inherited Joi validation utility. Return 201 with the incident, generated score/reasons/confidence, PENDING status, assignedTeam=null, empty priorityOverrides, isSimulated=false, and timestamps. Seed records alone are explicitly marked isSimulated=true; public API-created records are not automatically labeled simulated.

### GET /api/incidents (admin)

Query: page, limit, optional status and priorityLevel, sort=`priority|oldest|newest`. Default priority sorts score descending, creation date ascending (oldest first on ties), then _id ascending. Oldest/newest sort creation date ascending/descending, then _id ascending. Filtering uses validated enum values only.

### GET /api/incidents/:id (admin)

Returns one complete incident including score reasons, location-verification flag, and priority override history.

### PATCH /api/incidents/:id/status (admin)

Body `{ "status": "IN_PROGRESS" }`. Valid transitions:

- PENDING → CANCELLED.
- PENDING → ASSIGNED only through POST /api/assignments (never through this PATCH).
- ASSIGNED → IN_PROGRESS or CANCELLED.
- IN_PROGRESS → RESOLVED.
- Terminal states cannot transition; same-state updates return 409.

Resolution completes the active assignment, sets completedAt, releases the team to AVAILABLE, clears both current references, and retains assignment history. Cancellation of an assigned incident cancels its assignment and similarly releases the team; completedAt acts as the closure timestamp for cancellation too. An inconsistent assignment/team reference returns 409 requiring reconciliation; it is not silently repaired. Lifecycle updates use transactions.

### PATCH /api/incidents/:id/priority (admin)

Body `{ "priorityLevel": "CRITICAL", "reason": "Verified worsening conditions in this simulated report" }`. Reason is required, 5–1000 chars. Closed incidents return 409. New classification gets its band's minimum score (CRITICAL=75, HIGH=50, MEDIUM=25, LOW=0), so overrides affect queue ordering. Same-level overrides retain the current score.

`priorityOverrides[]` records previousPriority, newPriority, previousScore, newScore, reason, timestamp, and the authenticated coordinatorId. Original priorityReasons/confidence remain intact and are not represented as higher-certainty evidence. UI must show the override audit as well as the original risk explanation. No client-supplied identity is trusted.

### GET /api/incidents/:id/recommendations (admin)

Pending incidents only. Returns `data: { manualSelectionRequired, distanceType: "APPROXIMATE_STRAIGHT_LINE_KM", message, items }`. Each item contains a team, approximateDistanceKm rounded to 2 decimals, and nullable capacityWarning. Only AVAILABLE, unassigned, capable teams with matching isSimulated flag are included. Sort by Haversine distance then teamCode. Distance is approximate, not route distance or travel time; no dispatch occurs.

Missing location returns manualSelectionRequired=true with no distance estimates and empty items. Use GET /api/rescue-teams for manual selection. Capacity is people per trip, not proof a rescue can be completed; smaller teams remain eligible with a warning. Coordinators decide resources/trips.

## Rescue teams (admin)

### POST /api/rescue-teams

```json
{
  "name": "Demo boat crew",
  "teamCode": "KHI-BOAT-01",
  "capabilities": ["WATER_RESCUE", "EVACUATION"],
  "status": "AVAILABLE",
  "capacity": 6,
  "location": { "latitude": 24.85, "longitude": 67.02 }
}
```

Name 2–100 chars; teamCode unique, normalized uppercase, 2–32 alphanumeric/hyphen chars. Capabilities requires at least one distinct supported value. Capacity integer 1–10000; both valid coordinates required. Initial status AVAILABLE (default) or OFFLINE only; BUSY is assignment-managed. Returns 201 with currentIncident=null, isSimulated=false, and timestamps. Duplicate teamCode returns 409.

### GET /api/rescue-teams

Query page, limit, optional status (`AVAILABLE|BUSY|OFFLINE`). Sort teamCode ascending; return paginated list. Filter AVAILABLE for the manual assignment picker.

### GET /api/rescue-teams/:id

Returns one rescue team, or 400/404.

## Assignments (admin)

### POST /api/assignments

```json
{ "incidentId": "24_HEX_CHARACTERS", "teamId": "24_HEX_CHARACTERS", "notes": "Optional coordinator notes" }
```

notes optional, max 1000 chars. Confirms both documents exist, incident PENDING with no team, team AVAILABLE with no incident, matching simulated/real flag, suitable capability, and no active assignment for either side. Creates ACTIVE assignment and atomically sets incident ASSIGNED and team BUSY with reciprocal references. Returns 201 assignment with assignedAt, completedAt=null, notes, and isSimulated. This records a simulated coordination decision; it does not call real emergency services.

Capability policy: FLOOD→WATER_RESCUE; MEDICAL→MEDICAL; FIRE→FIRE_RESPONSE; STRANDED→EVACUATION or WATER_RESCUE; SUPPLIES→SUPPLY_DELIVERY; OTHER→EVACUATION (prototype assumption). Coordinates are not required for manual assignment. Capacity is advisory, not a hard assignment rejection.

Transactions and unique partial ACTIVE indexes on incidentId and teamId prevent competing coordinators claiming the same incident/team. A losing request returns 409. MongoDB Atlas/replica set is required. Standalone deployments get 503; there is no unsafe nontransactional fallback.

### GET /api/assignments

Query page, limit, optional status (`ACTIVE|COMPLETED|CANCELLED`). Sort assignedAt descending, _id ascending. Returns assignment history with raw incident/team ID references. Fetch details through the incident/team endpoints; there is no implicit population.

## Dashboard analytics and activity (admin)

### GET /api/dashboard/summary (alias: GET /api/dashboard/stats)

Requires admin authorization cookie. Query: optional `isSimulated` boolean.
Returns operational statistics and recent activity for the Command Center:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Dashboard summary retrieved",
  "data": {
    "incidents": {
      "total": 12,
      "byStatus": {
        "PENDING": 4,
        "ASSIGNED": 3,
        "IN_PROGRESS": 2,
        "RESOLVED": 3,
        "CANCELLED": 0
      },
      "byPriority": {
        "CRITICAL": 3,
        "HIGH": 4,
        "MEDIUM": 3,
        "LOW": 2
      },
      "byEmergencyType": {
        "FLOOD": 7,
        "MEDICAL": 3,
        "FIRE": 1,
        "STRANDED": 1,
        "SUPPLIES": 0,
        "OTHER": 0
      },
      "totalPeopleAffected": 38,
      "requiringLocationVerification": 2
    },
    "teams": {
      "total": 6,
      "byStatus": {
        "AVAILABLE": 3,
        "BUSY": 2,
        "OFFLINE": 1
      },
      "totalCapacity": 36,
      "availableCapacity": 18,
      "busyCapacity": 14
    },
    "assignments": {
      "total": 5,
      "byStatus": {
        "ACTIVE": 2,
        "COMPLETED": 3,
        "CANCELLED": 0
      }
    },
    "trends": {
      "last24Hours": [
        { "timestamp": "2026-10-17T03:00", "label": "03:00", "count": 2, "criticalCount": 1 }
      ],
      "last7Days": [
        { "date": "2026-10-17", "label": "Sat (10-17)", "count": 5, "criticalCount": 2 }
      ]
    },
    "recentActivity": [
      {
        "id": "asg-created-6710b...",
        "type": "TEAM_ASSIGNED",
        "title": "Team KHI-BOAT-01 assigned to FLOOD",
        "timestamp": "2026-10-17T10:30:00.000Z",
        "status": "ACTIVE",
        "metadata": {
          "assignmentId": "6710b...",
          "incidentId": "6710a...",
          "teamId": "67109...",
          "notes": "Urgent deployment"
        }
      }
    ]
  }
}
```

All counts default to 0 if no records exist; empty collections return safely without undefined errors.

### GET /api/dashboard/activity

Requires admin authorization cookie. Query parameters:
- `limit`: integer between 1 and 100 (default: 20).
- `isSimulated`: optional boolean filter.

Returns a chronological timeline of recent operational actions (new incident reports, team assignments, assignment completions, and priority overrides) sorted by `timestamp` descending:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Dashboard activity retrieved",
  "data": {
    "items": [
      {
        "id": "asg-completed-6710c...",
        "type": "ASSIGNMENT_COMPLETED",
        "title": "Assignment completed by Team KHI-BOAT-01",
        "timestamp": "2026-10-17T11:00:00.000Z",
        "status": "COMPLETED",
        "metadata": {
          "assignmentId": "6710c...",
          "incidentId": "6710a...",
          "teamId": "67109..."
        }
      },
      {
        "id": "ov-6710a...-1729162500000",
        "type": "PRIORITY_OVERRIDE",
        "title": "Priority override to CRITICAL: \"Rising floodwaters reported by ground crew\"",
        "timestamp": "2026-10-17T10:45:00.000Z",
        "priority": "CRITICAL",
        "metadata": {
          "incidentId": "6710a...",
          "previousPriority": "HIGH",
          "newPriority": "CRITICAL",
          "reason": "Rising floodwaters reported by ground crew"
        }
      },
      {
        "id": "asg-created-6710c...",
        "type": "TEAM_ASSIGNED",
        "title": "Team KHI-BOAT-01 assigned to FLOOD",
        "timestamp": "2026-10-17T10:30:00.000Z",
        "status": "ACTIVE",
        "metadata": {
          "assignmentId": "6710c...",
          "incidentId": "6710a...",
          "teamId": "67109...",
          "notes": ""
        }
      },
      {
        "id": "inc-created-6710a...",
        "type": "INCIDENT_REPORTED",
        "title": "SOS Reported: FLOOD (4 affected)",
        "timestamp": "2026-10-17T10:00:00.000Z",
        "priority": "HIGH",
        "status": "PENDING",
        "metadata": {
          "incidentId": "6710a...",
          "reporterName": "Demo citizen",
          "emergencyType": "FLOOD",
          "peopleAffected": 4
        }
      }
    ],
    "total": 4
  }
}
```


## Prototype scoring and uncertainty

Points: immediate danger +30; HIGH water +20 or MODERATE water +10; medical emergency +20; reported medical needs +15; disability +10; elderly +10; children +5; more than one person +5. Presence of each group scores once, irrespective of count. Clamp 0–100. Classification: 75+ CRITICAL, 50–74 HIGH, 25–49 MEDIUM, 0–24 LOW. Weights are unvalidated prototype assumptions.

Missing location always gives LOW confidence. Otherwise two or more missing/uncertain categories give LOW, one gives MEDIUM, none HIGH. Categories: location, immediateDanger, waterLevel (missing/UNKNOWN), incomplete vulnerability counts. HIGH confidence means reported fields are complete, not independently verified. Missing data adds an explicit manual-review reason. Zero score explicitly does not establish safety; no incident is automatically dismissed or resolved.

## Simulated data and checks

All seed names/descriptions are labeled SIMULATED and all three seeded model types have isSimulated=true. The seed requires DEMO_MODE=true, nonproduction environment, and a separate DEMO_DATABASE_URL whose database name ends `_demo`. Existing records are not reset; duplicate keys abort the transaction. Run `npm run seed:demo` from backend. To view seeded records, point the demo backend's DATABASE_URL to that same demo database. Never change a real-data backend to a demo database during active use.

`npm test -- --runInBand` runs isolated tests; real MongoDB integration tests skip unless TEST_DATABASE_URL names `resqlink_core_test_<hex>`. Those tests create and clean only that test database. Never point TEST_DATABASE_URL at an application database. See verification.md for actual execution results.
