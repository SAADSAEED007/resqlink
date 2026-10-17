Here is the complete, resolved document **ready to copy and paste directly into GitHub's conflict resolution editor** so you can click **"Mark as resolved"**:

```markdown
# ResQLink API contracts

Base URL: `http://localhost:4000/api`. Existing boilerplate authentication and health routes remain under `/v1`; do not combine the prefixes. Responses are JSON. This is prototype decision support for a simulated flood scenario, not validated emergency policy or real dispatch infrastructure.

## Authentication and frontend integration

`POST /api/incidents` is public. Every other `/api` operation requires the existing `accessToken` HTTP-only cookie for a database user whose role is `admin`. No authentication bypass, static demo token, or new auth system is added. Unauthenticated/expired requests return 401; authenticated non-admin users return 403.

Use existing `POST /v1/register` and `POST /v1/login` flows. Login body is `{ "email": "...", "password": "..." }`. Account creation always assigns role `user`; a trusted Tech Lead must promote an existing account to `admin` directly in MongoDB. There is no public role-promotion endpoint. Existing confirmation-email flow is inherited; when email is disabled it does not deliver confirmation messages. Do not claim a production-ready account provisioning workflow. Never send roles or coordinator IDs in core request bodies.

Set frontend `.env.local` to `NEXT_PUBLIC_API_URL=http://localhost:4000/api`, then restart Next.js. Frontend calls should use `credentials: 'include'`. Set backend FRONTEND_URL to the exact frontend origin (no path). Login/logout cookies use Path=/ so authentication covers both prefixes; clear old /v1-scoped cookies once when migrating from the boilerplate. Login omits password hashes from its user response. Existing cookies use SameSite=Strict; production cookies are Secure. Separate cross-site deployments need a reviewed cookie/domain configuration or same-site hosting; CORS alone does not make cross-site cookies work. Do not deploy an unrestricted demo admin account publicly.

```ts
const base = process.env.NEXT_PUBLIC_API_URL!;
const response = await fetch(`${base}/incidents?status=PENDING&limit=20`, {
  credentials: "include",
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
  "request": {
    "method": "POST",
    "url": "/api/incidents",
    "ip": "client-ip-in-development"
  },
  "message": "Incident created successfully",
  "data": {}
}
```

IP metadata is omitted when ENV=production. Core errors contain `{ "success": false, "statusCode": 400, "message": "...", "errors": [] }`. No stack trace or driver error is returned. Joi messages describe the first invalid field; `errors` is reserved for future structured details. Unknown request fields are rejected, including client-supplied scores, status, audit identity, assignedTeam, isSimulated, and demoKey. JSON body limit is 32kb. Text is trimmed; angle brackets and control characters are rejected. Render all text as text, not raw HTML.

HTTP codes: 200 read/update, 201 create, 400 invalid input/ID/query, 401 authentication required, 403 admin required, 404 missing record/route, 409 state/unique-code/assignment conflict, 413 oversized body, 429 inherited production rate limit, 500 generic unexpected failure, 503 transaction deployment unsupported. Retry 409 only after refreshing current state.

All list endpoints return `data: { items: [], pagination: { page, limit, total, totalPages } }`. Defaults: page=1, limit=20; max page=100000 and limit=100. No unbounded list requests. Counts and lists are separate reads and may differ briefly during concurrent writes.

## Enumerations

| Field             | Values                                                            |
| ----------------- | ----------------------------------------------------------------- |
| emergencyType     | FLOOD, MEDICAL, FIRE, STRANDED, SUPPLIES, OTHER                   |
| waterLevel        | NONE, LOW, MODERATE, HIGH, UNKNOWN                                |
| priorityLevel     | CRITICAL, HIGH, MEDIUM, LOW                                       |
| confidenceLevel   | HIGH, MEDIUM, LOW                                                 |
| incident status   | PENDING, ASSIGNED, IN_PROGRESS, RESOLVED, CANCELLED               |
| team capabilities | WATER_RESCUE, MEDICAL, EVACUATION, FIRE_RESPONSE, SUPPLY_DELIVERY |
| team status       | AVAILABLE, BUSY, OFFLINE                                          |
| assignment status | ACTIVE, COMPLETED, CANCELLED                                      |

MongoDB IDs are 24 hexadecimal characters. Invalid IDs return 400; valid IDs with no document return 404. Timestamps are ISO dates. Object references serialize as ID strings.

## Incident operations

### POST /api/incidents (public)

```json
{
  "reporterName": "Demo citizen",
  "description": "SIMULATED household surrounded by rising water",
  "emergencyType": "FLOOD",
  "peopleAffected": 4,
  "location": {
    "latitude": 24.86,
    "longitude": 67.01,
    "address": "SIMULATED Karachi location"
  },
  "vulnerablePeople": {
    "elderly": 1,
    "children": 2,
    "disabled": 0,
    "medicalNeeds": 0
  },
  "waterLevel": "HIGH",
  "immediateDanger": true
}
```

Required: reporterName (2–100 chars), description (5–2000), emergencyType, peopleAffected (integer 1–10000). reporterPhone is optional (5–32 chars, digits/plus/space/parentheses/hyphen). No email or unnecessary personal data is collected by this operation.

Location is optional or null. When present, both latitude [-90,90] and longitude [-180,180] are required finite numbers; optional address max 300. No coordinates are fabricated. Missing coordinates persist as null and set `locationVerificationRequired=true`; address-only coordinates are rejected. There is no location-edit endpoint in this scope: coordinate verification remains an operational manual task.

Each vulnerability count is optional, integer 0–10000. Categories may overlap; they are not summed to infer unique people. Omitted counts remain unknown, not zero. Water level and immediate danger are optional; omissions lower confidence. Numeric/boolean string coercion follows the inherited Joi validation utility.

Lightweight duplicate and completeness verification runs on submission:

- **Duplicate detection:** Checks recent active incidents (past 120 minutes) for identical emergency type within 0.5 km, matching contact phone, or matching address text.
- **Completeness check:** Evaluates missing coordinates, missing contact phone, unknown/unverified water level, missing immediate danger, or incomplete vulnerability breakdowns.
- **Safety guarantee:** Requests are **never** automatically rejected, deleted, or downgraded. False matches are not automatically merged.
- **Verification object returned:**
  ```json
  "verification": {
    "status": "NEEDS_REVIEW",
    "requiresManualReview": true,
    "isPotentialDuplicate": false,
    "potentialDuplicateIncidents": [],
    "missingFields": ["location", "waterLevel"],
    "warnings": [
      "Missing location coordinates: manual location verification required before team dispatch",
      "Water level is unknown or unverified"
    ],
    "reviewedBy": null,
    "reviewedAt": null,
    "reviewNotes": null
  }
  ```

Return 201 with the incident, generated score/reasons/confidence, verification object, PENDING status, assignedTeam=null, empty priorityOverrides, isSimulated=false, and timestamps. Seed records alone are explicitly marked isSimulated=true; public API-created records are not automatically labeled simulated.

### GET /api/incidents (admin)

Query: page, limit, optional status, priorityLevel, and verificationStatus (`NEEDS_REVIEW|VERIFIED|FLAGGED_DUPLICATE|DISMISSED`), sort=`priority|oldest|newest`. Default priority sorts score descending, creation date ascending (oldest first on ties), then \_id ascending. Oldest/newest sort creation date ascending/descending, then \_id ascending. Filtering uses validated enum values only.

### GET /api/incidents/:id (admin)

Returns one complete incident including score reasons, location-verification flag, complete verification details, and priority override history.

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

### PATCH /api/incidents/:id/verification (admin)

Body `{ "status": "VERIFIED", "notes": "Verified location via VHF radio; separate household from nearby report" }`.

- `status`: required, valid enum `NEEDS_REVIEW | VERIFIED | FLAGGED_DUPLICATE | DISMISSED`.
- `notes`: required, 3–1000 characters.

Updates the incident's verification object with coordinator attribution:

- Records `reviewedBy` (authenticated coordinator ID) and `reviewedAt` (timestamp).
- Setting `status` to `VERIFIED` or `DISMISSED` marks `requiresManualReview: false`.
- Setting `status` to `NEEDS_REVIEW` or `FLAGGED_DUPLICATE` marks `requiresManualReview: true`.
- Dismissing a duplicate warning allows coordinators to accept a legitimate separate incident near an existing report without merging or deleting records.
- Incident lifecycle status (`status`, `priorityLevel`, `assignedTeam`) is never altered or downgraded by verification updates. Uses transactions.

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
{
  "incidentId": "24_HEX_CHARACTERS",
  "teamId": "24_HEX_CHARACTERS",
  "notes": "Optional coordinator notes"
}
```

notes optional, max 1000 chars. Confirms both documents exist, incident PENDING with no team, team AVAILABLE with no incident, matching simulated/real flag, suitable capability, and no active assignment for either side. Creates ACTIVE assignment and atomically sets incident ASSIGNED and team BUSY with reciprocal references. Returns 201 assignment with assignedAt, completedAt=null, notes, and isSimulated. This records a simulated coordination decision; it does not call real emergency services.

Capability policy: FLOOD→WATER_RESCUE; MEDICAL→MEDICAL; FIRE→FIRE_RESPONSE; STRANDED→EVACUATION or WATER_RESCUE; SUPPLIES→SUPPLY_DELIVERY; OTHER→EVACUATION (prototype assumption). Coordinates are not required for manual assignment. Capacity is advisory, not a hard assignment rejection.

Transactions and unique partial ACTIVE indexes on incidentId and teamId prevent competing coordinators claiming the same incident/team. A losing request returns 409. MongoDB Atlas/replica set is required. Standalone deployments get 503; there is no unsafe nontransactional fallback.

### GET /api/assignments

Query page, limit, optional status (`ACTIVE|COMPLETED|CANCELLED`). Sort assignedAt descending, \_id ascending. Returns assignment history with raw incident/team ID references. Fetch details through the incident/team endpoints; there is no implicit population.

## Community risk zones (admin / proactive assessment)

The `/api/community-risk-zones` endpoints enable disaster response coordinators to register, monitor, and assess vulnerable communities requiring proactive field assessment, even when no citizen SOS reports have been received (e.g. low-connectivity, flooded, or power-out areas). This module operates independently of citizen SOS dispatch and incident priority scoring.

### Endpoints overview

| Method  | Endpoint                                   | Description                                             | Auth Required           |
| ------- | ------------------------------------------ | ------------------------------------------------------- | ----------------------- |
| `POST`  | `/api/community-risk-zones`                | Register a new community risk zone                      | Yes (Admin/Coordinator) |
| `GET`   | `/api/community-risk-zones`                | List and filter risk zones (severity, status, district) | Yes (Admin/Coordinator) |
| `POST`  | `/api/community-risk-zones/seed`           | Seed realistic simulated Sindh risk zone demo fixtures  | Yes (Admin/Coordinator) |
| `GET`   | `/api/community-risk-zones/:id`            | Retrieve details of a specific community risk zone      | Yes (Admin/Coordinator) |
| `POST`  | `/api/community-risk-zones/:id/assessment` | Request proactive field assessment reconnaissance       | Yes (Admin/Coordinator) |
| `PATCH` | `/api/community-risk-zones/:id/status`     | Update assessment status with audit trail notes         | Yes (Admin/Coordinator) |

### Enumerations

| Field                 | Values                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| hazardType            | `FLOOD_INUNDATION`, `FLASH_FLOOD`, `RIVER_BREACH`, `HEATWAVE`, `WATER_SHORTAGE`, `OTHER`             |
| hazardSeverity        | `CRITICAL`, `HIGH`, `MODERATE`, `LOW`                                                                |
| connectivityStatus    | `NO_CELL_COVERAGE`, `INTERMITTENT_SIGNAL`, `NORMAL_NETWORK`, `UNKNOWN`                               |
| assessmentStatus      | `PENDING_ASSESSMENT`, `ASSESSMENT_DISPATCHED`, `ASSESSMENT_COMPLETED`, `MONITORING_ONLY`, `INACTIVE` |
| priorityUrgency       | `CRITICAL`, `URGENT`, `ROUTINE`                                                                      |
| informationConfidence | `HIGH`, `MEDIUM`, `LOW`                                                                              |

### POST /api/community-risk-zones (admin)

Registers a vulnerable community risk zone.

```json
{
  "communityName": "Goth Haji Ismail",
  "district": "Thatta",
  "tehsil": "Mirpur Sakro",
  "approximateLocation": {
    "latitude": 24.55,
    "longitude": 67.65,
    "landmarkDescription": "Adjacent to main canal culvert, 4km past coastal dyke"
  },
  "hazardType": "FLOOD_INUNDATION",
  "hazardSeverity": "CRITICAL",
  "connectivityStatus": "NO_CELL_COVERAGE",
  "accessObstacles": ["Submerged culvert", "Washed-out link road"],
  "vulnerablePopulation": {
    "estimatedTotalPopulation": 450,
    "estimatedVulnerableCount": 120,
    "vulnerabilityDetails": "High proportion of elderly and infants; 2 disabled individuals"
  },
  "informationConfidence": "MEDIUM",
  "notes": "Reported via union council radio liaison"
}
```

- **Approximate Location Handling:** When coordinates (`latitude`, `longitude`) are omitted or null, `isLocationEstimated` defaults to `true`. `informationConfidence` is capped at `MEDIUM` (if supplied as `HIGH`), and an explanatory confidence reason is automatically recorded.
- **Connectivity Warnings:** Areas flagged with `NO_CELL_COVERAGE` automatically receive an audit note explaining that communications rely on delayed external liaisons.

### GET /api/community-risk-zones (admin)

Query parameters:

- `hazardSeverity`: Filter by `CRITICAL | HIGH | MODERATE | LOW`
- `assessmentStatus`: Filter by `PENDING_ASSESSMENT | ASSESSMENT_DISPATCHED | ASSESSMENT_COMPLETED | MONITORING_ONLY | INACTIVE`
- `district`: Filter by district name (case-insensitive)
- `connectivityStatus`: Filter by `NO_CELL_COVERAGE | INTERMITTENT_SIGNAL | NORMAL_NETWORK | UNKNOWN`
- `sort`: `severity` (default: CRITICAL > HIGH > MODERATE > LOW, then newest first), `newest`, or `oldest`
- `page` (default 1), `limit` (default 20, max 100)

### POST /api/community-risk-zones/:id/assessment (admin)

Coordinator submits a request for proactive field reconnaissance.

```json
{
  "priorityUrgency": "CRITICAL",
  "assignedOfficer": "Officer Tariq Baloch",
  "assessmentNotes": "Dispatching 4x4 survey team to inspect rising canal levels and confirm community status"
}
```

- Transitions `assessmentStatus` to `ASSESSMENT_DISPATCHED`.
- Records `fieldAssessment` subdocument with coordinator ID and timestamp.
- Appends entry to `statusHistory`.
- No automatic emergency dispatch is triggered.

### PATCH /api/community-risk-zones/:id/status (admin)

Updates the assessment status with mandatory coordinator notes.

```json
{
  "status": "ASSESSMENT_COMPLETED",
  "notes": "Field survey complete; identified 30 families requiring relocation to higher ground"
}
```

- Appends transition to `statusHistory` recording previous status, new status, coordinator ID, and timestamp.
- Automatically marks `fieldAssessment.completedAt` when moving to `ASSESSMENT_COMPLETED`.
- Rejects identical status updates with 409 Conflict.

### POST /api/community-risk-zones/seed (admin)

Seeds 5 realistic simulated Sindh demo fixtures (Thatta, Dadu, Sujawal, Khairpur, Kashmore) marked `isSimulated: true`. Idempotent (skips existing demo keys).

## Shelters and relief resources

The `/api/shelters` endpoints enable coordinators and citizens to track disaster evacuation shelters, monitor real-time shelter capacity/occupancy, view structured inventories of essential relief items (food, drinking water, medical supplies, blankets, hygiene kits), and search for nearby shelters within a designated radius.

All shelters are decision support tools; demo shelters are strictly labeled as fictional (`isSimulated: true`) and must not be published as operational guidance.

### Endpoints overview

| Method  | Endpoint                             | Description                                                 | Auth Required           |
| ------- | ------------------------------------ | ----------------------------------------------------------- | ----------------------- |
| `GET`   | `/api/shelters`                      | List shelters (with availability & nearby radius filtering) | Public / Read           |
| `GET`   | `/api/shelters/:id`                  | View shelter details and attached relief resource inventory | Public / Read           |
| `GET`   | `/api/shelters/:id/resources`        | View relief resources for a shelter                         | Public / Read           |
| `POST`  | `/api/shelters`                      | Create a new shelter with optional initial relief resources | Yes (Admin/Coordinator) |
| `PATCH` | `/api/shelters/:id`                  | Update shelter capacity, occupancy, status, or contact      | Yes (Admin/Coordinator) |
| `POST`  | `/api/shelters/:id/resources`        | Add or restock a relief resource in a shelter               | Yes (Admin/Coordinator) |
| `PATCH` | `/api/shelters/:id/resources/:resId` | Update quantity, threshold, or status of a relief resource  | Yes (Admin/Coordinator) |
| `POST`  | `/api/shelters/seed`                 | Seed 5 realistic simulated Sindh demo shelters & supplies   | Yes (Admin/Coordinator) |

### Enumerations

| Field             | Values                                                                            |
| ----------------- | --------------------------------------------------------------------------------- |
| shelter status    | `OPEN`, `FULL`, `CLOSED`                                                          |
| resource category | `FOOD`, `DRINKING_WATER`, `MEDICAL_SUPPLIES`, `BLANKETS`, `HYGIENE_KITS`, `OTHER` |
| resource status   | `ADEQUATE`, `LOW`, `CRITICAL`, `EXHAUSTED`                                        |

### Availability calculation & overcapacity prevention

Available spaces are strictly calculated as:
$$\text{availableSpaces} = \max(0, \text{totalCapacity} - \text{currentOccupancy})$$

- **Overcapacity Prevention:** `currentOccupancy` cannot exceed `totalCapacity` (returns `400 Bad Request` if an update or creation attempts overcapacity).
- **Negative Prevention:** `currentOccupancy` cannot be negative.
- **Dynamic Transition:** When `availableSpaces` drops to 0 and the shelter is not explicitly `CLOSED`, status transitions to `FULL`. When capacity frees up, status returns to `OPEN`.

### GET /api/shelters (read)

Query parameters:

- `status`: `OPEN | FULL | CLOSED`
- `availableOnly`: boolean (filters `status: 'OPEN'` and `availableSpaces > 0`)
- `minAvailableSpaces`: integer (filters `availableSpaces >= minAvailableSpaces`)
- `latitude` & `longitude`: numbers for nearby straight-line search
- `radiusKm`: number (default: 25 km, max: 500 km)
- `page`: default 1, `limit`: default 20 (max 100)

When coordinates are supplied, shelters within the radius are sorted nearest first, and each result includes `approximateDistanceKm` and `distanceType: "APPROXIMATE_STRAIGHT_LINE_KM"`.

### POST /api/shelters (admin)

```json
{
  "name": "SIMULATED - Thatta Relief Shelter",
  "address": "Main National Highway, Near District Sports Complex, Thatta, Sindh",
  "location": { "latitude": 24.747, "longitude": 67.923 },
  "totalCapacity": 350,
  "currentOccupancy": 210,
  "status": "OPEN",
  "contactInformation": {
    "contactPerson": "Liaison Officer Munir Ahmed",
    "phone": "+92 300 2345671",
    "email": "thatta.shelter1@simulated.resqlink.org"
  },
  "notes": "Equipped with water filtration. Decision support only.",
  "initialResources": [
    {
      "category": "FOOD",
      "resourceName": "Ready-to-eat dry ration boxes",
      "quantity": 1200,
      "unit": "packs",
      "minimumThreshold": 200
    }
  ]
}
```

### POST /api/shelters/:id/resources (admin)

```json
{
  "category": "DRINKING_WATER",
  "resourceName": "Bottled mineral water 5L cans",
  "quantity": 850,
  "unit": "cans",
  "minimumThreshold": 150
}
```

Resource status is automatically assigned (`ADEQUATE`, `LOW`, `CRITICAL`, `EXHAUSTED`) based on quantity relative to `minimumThreshold` if not explicitly supplied.

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

### GET /api/incidents/:id/activity

Requires coordinator/admin authorization cookie. Path parameter:
- `id`: valid 24-character hexadecimal incident ID.

Query parameters:
- `limit`: integer between 1 and 100 (default: 50).
- `sort`: string enum `asc` | `desc` (default: `asc`).

Returns the full chronological activity history for a specific incident, synthesizing:
- `INCIDENT_REPORTED`: Incident creation.
- `PRIORITY_OVERRIDE`: Manual priority adjustments with rationale and coordinator actor.
- `VERIFICATION_REVIEWED`: Verification decisions with review notes and coordinator actor.
- `TEAM_ASSIGNED`: Rescue team assignments.
- `STATUS_CHANGED`: State progression transitions with coordinator actor.
- `INCIDENT_RESOLVED`: Incident closure with notes and coordinator actor.
- `ASSIGNMENT_COMPLETED`: Team mission completion and resource release.

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Incident activity retrieved",
  "data": {
    "incidentId": "6710a...",
    "total": 3,
    "items": [
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
    ]
  }
}
```

## Prototype scoring and uncertainty

Points: immediate danger +30; HIGH water +20 or MODERATE water +10; medical emergency +20; reported medical needs +15; disability +10; elderly +10; children +5; more than one person +5. Presence of each group scores once, irrespective of count. Clamp 0–100. Classification: 75+ CRITICAL, 50–74 HIGH, 25–49 MEDIUM, 0–24 LOW. Weights are unvalidated prototype assumptions.

Missing location always gives LOW confidence. Otherwise two or more missing/uncertain categories give LOW, one gives MEDIUM, none HIGH. Categories: location, immediateDanger, waterLevel (missing/UNKNOWN), incomplete vulnerability counts. HIGH confidence means reported fields are complete, not independently verified. Missing data adds an explicit manual-review reason. Zero score explicitly does not establish safety; no incident is automatically dismissed or resolved.

## Simulated data and checks

All seed names/descriptions are labeled SIMULATED and all three seeded model types have isSimulated=true. The seed requires DEMO_MODE=true, nonproduction environment, and a separate DEMO_DATABASE_URL whose database name ends `_demo`. Existing records are not reset; duplicate keys abort the transaction. Run `npm run seed:demo` from backend. To view seeded records, point the demo backend's DATABASE_URL to that same demo database. Never change a real-data backend to a demo database during active use.

`npm test -- --runInBand` runs isolated tests; real MongoDB integration tests skip unless TEST_DATABASE_URL names `resqlink_core_test_<hex>`. Those tests create and clean only that test database. Never point TEST_DATABASE_URL at an application database. See verification.md for actual execution results.

## Frontend session contract

`GET /v1/user/me` requires the access-token cookie and returns HTTP 200 with the existing success envelope and `data: { _id, name, email, role }`. It sends `Cache-Control: no-store`; confirmation/reset fields are excluded. `PUT /v1/logout` clears both cookies with matching path/domain/security options and a past expiry. The frontend uses these existing routes and verifies session cookies after login. See [frontend-foundation.md](frontend-foundation.md) for same-site deployment requirements.
```