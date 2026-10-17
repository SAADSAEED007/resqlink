# ResQLink — Rescue Team Registry & Resource Management API Specification

**Module:** Response & Dispatch Coordination (`/api/rescue-teams`)  
**Target Roles:** Authorized Coordinators (`role: admin`)  
**Security Policy:** Strict JWT cookie (`accessToken`) or `Authorization: Bearer <token>` required. Non-admin and unauthenticated requests are rejected.

---

## 1. Domain Constants & Valid Enums

### Team Capabilities (`CAPABILITIES`)
Rescue teams must declare one or more of the following standard operational capabilities:
- `WATER_RESCUE`: Flood extraction, swift-water rescue, boat operations.
- `MEDICAL`: First aid, trauma triage, paramedic dispatch.
- `EVACUATION`: Mass transport, structural extraction, displaced person transit.
- `FIRE_RESPONSE`: Fire suppression, hazard containment, thermal equipment.
- `SUPPLY_DELIVERY`: Rations, clean water, medical packs, communications gear.

### Team Availability Statuses (`TEAM_STATUSES`)
- `AVAILABLE`: Idle and ready to receive incident dispatch recommendations and assignments.
- `BUSY`: Actively assigned to an ongoing incident (`currentIncident` is populated). Automatically transitioned by the assignment engine.
- `OFFLINE`: Team is off-duty, undergoing maintenance, or en route between sectors. Excluded from automated recommendation scoring.

> [!IMPORTANT]
> **Availability Transition Safeguards:**
> - Coordinators can manually transition idle teams between `AVAILABLE` and `OFFLINE`.
> - Coordinators **cannot** manually set a team to `BUSY` via profile updates (only the assignment transaction engine can assign a team to `BUSY`).
> - A `BUSY` team with an active assignment **cannot** be manually changed to `AVAILABLE` or `OFFLINE`. The incident must be completed (`RESOLVED`) or re-assigned/cancelled first.
> - Editing profile details (e.g. name, capacity, contact, coordinates) on an actively assigned team preserves its `BUSY` status and active `currentIncident`.

---

## 2. API Endpoints

### 1. List Rescue Teams
**Path:** `GET /api/rescue-teams`  
**Authentication:** Coordinator (`admin`)  
**Query Parameters:**
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `page` | Integer | No | Page number (default: `1`, min: `1`) |
| `limit` | Integer | No | Page size (default: `20`, min: `1`, max: `100`) |
| `status` | String | No | Filter by `AVAILABLE`, `BUSY`, or `OFFLINE` |
| `capability`| String | No | Filter teams possessing a specific capability |
| `search` | String | No | Case-insensitive search matching `name` or `teamCode` |
| `isSimulated`| Boolean | No | Filter by real vs simulated teams |

#### Example Request:
```http
GET /api/rescue-teams?status=AVAILABLE&capability=WATER_RESCUE&search=Alpha HTTP/1.1
Host: localhost:5000
Cookie: accessToken=<JWT_COORDINATOR_TOKEN>
```

#### Example Response (`200 OK`):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Rescue teams retrieved",
  "data": {
    "items": [
      {
        "_id": "67b0965d1b32d20b7a2d1001",
        "name": "Alpha Rescue Unit",
        "teamCode": "ALPHA-01",
        "capabilities": ["WATER_RESCUE", "EVACUATION"],
        "status": "AVAILABLE",
        "capacity": 12,
        "location": {
          "latitude": 24.8607,
          "longitude": 67.0011,
          "address": "Karachi Port Command Center"
        },
        "contact": {
          "phone": "+923001234567",
          "email": "alpha.rescue@resqlink.org",
          "leadName": "Commander Tariq"
        },
        "currentIncident": null,
        "isSimulated": false,
        "createdAt": "2026-10-17T06:00:00.000Z",
        "updatedAt": "2026-10-17T07:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

---

### 2. Get Rescue Team Details
**Path:** `GET /api/rescue-teams/:id`  
**Authentication:** Coordinator (`admin`)  
**Description:** Returns full profile information for a specific rescue team. When a team is actively assigned (`BUSY`), operational incident details (`emergencyType`, `priorityLevel`, `status`, `location`, `peopleAffected`) are populated into `currentIncident`.

#### Example Request:
```http
GET /api/rescue-teams/67b0965d1b32d20b7a2d1001 HTTP/1.1
Host: localhost:5000
Cookie: accessToken=<JWT_COORDINATOR_TOKEN>
```

#### Example Response (`200 OK`):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Rescue team retrieved",
  "data": {
    "_id": "67b0965d1b32d20b7a2d1001",
    "name": "Alpha Rescue Unit",
    "teamCode": "ALPHA-01",
    "capabilities": ["WATER_RESCUE", "EVACUATION"],
    "status": "BUSY",
    "capacity": 12,
    "location": {
      "latitude": 24.8607,
      "longitude": 67.0011,
      "address": "Karachi Port Command Center"
    },
    "contact": {
      "phone": "+923001234567",
      "email": "alpha.rescue@resqlink.org",
      "leadName": "Commander Tariq"
    },
    "currentIncident": {
      "_id": "67b0965d1b32d20b7a2d2002",
      "emergencyType": "FLOOD",
      "priorityLevel": "CRITICAL",
      "status": "IN_PROGRESS",
      "location": {
        "latitude": 24.8712,
        "longitude": 67.0154,
        "address": "Sector 4 Waterway"
      },
      "peopleAffected": 6,
      "reporterName": "Hamza Ali",
      "createdAt": "2026-10-17T07:15:00.000Z"
    },
    "isSimulated": false,
    "createdAt": "2026-10-17T06:00:00.000Z",
    "updatedAt": "2026-10-17T07:45:00.000Z"
  }
}
```

---

### 3. Register Rescue Team
**Path:** `POST /api/rescue-teams`  
**Authentication:** Coordinator (`admin`)  
**Description:** Registers a new rescue team profile. Requires a unique team code. Initial status must be `AVAILABLE` or `OFFLINE` (defaults to `AVAILABLE`).

#### Request Schema:
```typescript
{
  name: string;           // 2-100 characters, no control characters
  teamCode: string;       // 2-32 uppercase alphanumeric + hyphens (e.g. 'BRAVO-02')
  capabilities: string[]; // At least 1 valid CAPABILITIES enum value, unique
  capacity: number;       // Positive integer (1-10000)
  location: {
    latitude: number;     // -90 to 90
    longitude: number;    // -180 to 180
    address?: string;     // Optional street or landmark
  };
  status?: "AVAILABLE" | "OFFLINE"; // Defaults to 'AVAILABLE'
  contact?: {
    phone?: string;       // Valid phone pattern
    email?: string;       // Valid email address
    leadName?: string;    // Unit team leader name
  };
  isSimulated?: boolean;  // Optional, defaults to false
}
```

#### Example Request:
```http
POST /api/rescue-teams HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Cookie: accessToken=<JWT_COORDINATOR_TOKEN>

{
  "name": "Bravo Rapid Medical",
  "teamCode": "BRAVO-02",
  "capabilities": ["MEDICAL", "EVACUATION"],
  "capacity": 8,
  "location": {
    "latitude": 24.8934,
    "longitude": 67.0819,
    "address": "East District General Hospital Depot"
  },
  "contact": {
    "phone": "+923007654321",
    "email": "bravo.med@resqlink.org",
    "leadName": "Dr. Fatima Noor"
  },
  "status": "AVAILABLE"
}
```

#### Example Response (`201 Created`):
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Rescue team created",
  "data": {
    "_id": "67b0965d1b32d20b7a2d1002",
    "name": "Bravo Rapid Medical",
    "teamCode": "BRAVO-02",
    "capabilities": ["MEDICAL", "EVACUATION"],
    "status": "AVAILABLE",
    "capacity": 8,
    "location": {
      "latitude": 24.8934,
      "longitude": 67.0819,
      "address": "East District General Hospital Depot"
    },
    "contact": {
      "phone": "+923007654321",
      "email": "bravo.med@resqlink.org",
      "leadName": "Dr. Fatima Noor"
    },
    "currentIncident": null,
    "isSimulated": false,
    "createdAt": "2026-10-17T08:00:00.000Z",
    "updatedAt": "2026-10-17T08:00:00.000Z"
  }
}
```

---

### 4. Update Rescue Team Profile & Availability
**Path:** `PATCH /api/rescue-teams/:id`  
**Authentication:** Coordinator (`admin`)  
**Description:** Partially updates an existing team's profile information or toggles availability between `AVAILABLE` and `OFFLINE`.

#### Allowed Update Fields:
- `name`: string (2-100 characters)
- `capabilities`: array of unique `CAPABILITIES` (min 1)
- `capacity`: integer (1-10000)
- `location`: `{ latitude, longitude, address? }`
- `contact`: `{ phone?, email?, leadName? }`
- `status`: `'AVAILABLE' | 'OFFLINE'` (strictly validated against active assignments)

#### Example Request:
```http
PATCH /api/rescue-teams/67b0965d1b32d20b7a2d1002 HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Cookie: accessToken=<JWT_COORDINATOR_TOKEN>

{
  "capacity": 10,
  "contact": {
    "phone": "+923009998877",
    "leadName": "Dr. Fatima Noor (Lead)"
  },
  "status": "OFFLINE"
}
```

#### Example Response (`200 OK`):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Rescue team updated",
  "data": {
    "_id": "67b0965d1b32d20b7a2d1002",
    "name": "Bravo Rapid Medical",
    "teamCode": "BRAVO-02",
    "capabilities": ["MEDICAL", "EVACUATION"],
    "status": "OFFLINE",
    "capacity": 10,
    "location": {
      "latitude": 24.8934,
      "longitude": 67.0819,
      "address": "East District General Hospital Depot"
    },
    "contact": {
      "phone": "+923009998877",
      "email": "bravo.med@resqlink.org",
      "leadName": "Dr. Fatima Noor (Lead)"
    },
    "currentIncident": null,
    "isSimulated": false,
    "updatedAt": "2026-10-17T08:10:00.000Z"
  }
}
```

---

## 3. Error Responses & Safeguards

| HTTP Code | Condition | Example Error Response |
| :--- | :--- | :--- |
| `400 Bad Request` | Invalid parameters, coordinates out of range, negative capacity, unsupported fields | `{"success": false, "statusCode": 400, "message": "\"capacity\" must be greater than or equal to 1", "errors": []}` |
| `401 Unauthorized` | Missing or invalid authentication token | `{"success": false, "statusCode": 401, "message": "Authentication required", "errors": []}` |
| `403 Forbidden` | Non-admin user attempting coordinator actions | `{"success": false, "statusCode": 403, "message": "Coordinator (admin) access required", "errors": []}` |
| `404 Not Found` | Team ID does not exist | `{"success": false, "statusCode": 404, "message": "Rescue team not found", "errors": []}` |
| `409 Conflict` | Duplicate `teamCode` registration attempt | `{"success": false, "statusCode": 409, "message": "A rescue team with team code 'BRAVO-02' already exists", "errors": []}` |
| `409 Conflict` | Attempting manual status override on an actively assigned (`BUSY`) team | `{"success": false, "statusCode": 409, "message": "Cannot manually modify availability of an actively assigned (BUSY) rescue team. Complete or cancel the active incident assignment first.", "errors": []}` |

---

## 4. Frontend Integration Guide (For Tech Lead & Frontend Engineers)

1. **Team Registry UI:**
   - Mount a modal or form in the Emergency Operations Center at `/admin/teams` or in the Dispatch drawer.
   - Capability multi-select checkboxes: Provide `['WATER_RESCUE', 'MEDICAL', 'EVACUATION', 'FIRE_RESPONSE', 'SUPPLY_DELIVERY']`.
   - Team Code input: Automatically force uppercase transformation (`teamCode.toUpperCase()`).

2. **Availability Toggle:**
   - Display a status toggle button (`AVAILABLE` / `OFFLINE`).
   - When a team's status is `BUSY`, **disable** the status toggle button and display a badge: `"Actively Dispatched: Incident #<ID>"`.
   - Provide a direct link to the incident via `team.currentIncident._id`.

3. **Real-time Synchronization:**
   - All team responses include standard cache-busting headers (`no-store, no-cache, must-revalidate`).
   - Re-fetch `/api/rescue-teams` on dispatch events or assignment completions to reflect immediate live availability.
