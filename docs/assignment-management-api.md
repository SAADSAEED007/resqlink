# ResQLink Assignment Management & Operational History API

**Base URL:** `http://localhost:5000/api` (or `http://localhost:4000/api` depending on backend port)  
**Authentication:** Coordinator (`admin` role required via `accessToken` HTTP-only cookie).

---

## 1. Architectural Overview & Incident Lifecycle

The Assignment Management and Operational History subsystem provides Command Center coordinators with full visibility and tracking over rescue team dispatches, operational status, and historical assignments.

### Incident & Assignment Lifecycle Synchronization

The backend maintains strict state synchronization between **Incidents**, **Rescue Teams**, and **Assignments**:

```
   [ Incident: PENDING ]
            │
            ▼ (POST /api/assignments)
   [ Incident: ASSIGNED ] ────► [ Assignment: ACTIVE ] (assignedAt: Date.now)
            │                  [ Team: BUSY ] (currentIncident: incident._id)
            ▼
   [ Incident: IN_PROGRESS ]
            │
            ▼ (PATCH /api/incidents/:id/status -> RESOLVED)
   [ Incident: RESOLVED ] ────► [ Assignment: COMPLETED ] (completedAt: Date.now)
                               [ Team: AVAILABLE ] (currentIncident: null)
```

- **Transactional Dispatch:** When `POST /api/assignments` is executed, a MongoDB transaction atomically:
  1. Validates that the team is currently `AVAILABLE`.
  2. Creates the `Assignment` record with status `ACTIVE`.
  3. Transitions the incident status to `ASSIGNED` and links `assignedTeamId`.
  4. Marks the rescue team status to `BUSY` and links `currentIncident`.
- **Atomic Resolution & Release:** When an incident is marked `RESOLVED` via `PATCH /api/incidents/:id/status`, the active assignment is marked `COMPLETED` with timestamp `completedAt`, and the rescue team is immediately released back to `AVAILABLE`.
- **Operational History:** Completed and historical assignments persist permanently in MongoDB for auditing, post-disaster operational reviews, and performance metrics.

---

## 2. API Endpoints

### 1. List Assignments
**Path:** `GET /api/assignments`  
**Authentication:** Coordinator (`admin` role)  
**Description:** Returns a paginated list of assignment records sorted newest-first by `assignedAt`. Both the linked incident and rescue team are populated with operational fields, omitting sensitive citizen/reporter personal details.

#### Query Parameters:
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `page` | `number` | `1` | Page number (min: 1) |
| `limit` | `number` | `20` | Number of records per page (min: 1, max: 100) |
| `status` | `string` | - | Filter by status: `ACTIVE`, `COMPLETED`, `CANCELLED` |
| `incidentId`| `string` | - | Filter by 24-character hexadecimal Incident ID |
| `teamId` | `string` | - | Filter by 24-character hexadecimal Rescue Team ID |
| `isSimulated`| `boolean` | - | Filter by simulated or real test scenario data |

#### Example Request:
```http
GET /api/assignments?status=ACTIVE&page=1&limit=10 HTTP/1.1
Host: localhost:5000
Cookie: accessToken=<COORDINATOR_JWT_TOKEN>
```

#### Example Response (`200 OK`):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Assignments retrieved",
  "data": {
    "items": [
      {
        "_id": "67b120001b32d20b7a2d3001",
        "incidentId": {
          "_id": "67b0965d1b32d20b7a2d2001",
          "emergencyType": "FLOOD",
          "priorityLevel": "CRITICAL",
          "status": "ASSIGNED",
          "location": {
            "latitude": 24.8607,
            "longitude": 67.0011,
            "address": "Sector 4 Storm Drainage Basin"
          },
          "peopleAffected": 12,
          "reporterName": "Citizen Reporter",
          "createdAt": "2026-10-17T06:00:00.000Z"
        },
        "teamId": {
          "_id": "67b0965d1b32d20b7a2d1001",
          "name": "Alpha Swiftwater Rescue Unit",
          "teamCode": "ALPHA-01",
          "capabilities": ["WATER_RESCUE", "EVACUATION"],
          "status": "BUSY",
          "capacity": 15,
          "contact": {
            "phone": "+923001234567",
            "email": "alpha.rescue@resqlink.org",
            "leadName": "Commander Tariq"
          }
        },
        "status": "ACTIVE",
        "notes": "Immediate dispatch for high-risk flood evacuation.",
        "assignedAt": "2026-10-17T07:15:00.000Z",
        "completedAt": null,
        "isSimulated": false,
        "createdAt": "2026-10-17T07:15:00.000Z",
        "updatedAt": "2026-10-17T07:15:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

---

### 2. Get Assignment Details
**Path:** `GET /api/assignments/:id`  
**Authentication:** Coordinator (`admin` role)  
**Description:** Retrieves full operational details for a specific assignment record, including populated incident and team information.

#### URL Parameters:
- `id`: 24-character hexadecimal ObjectId of the assignment.

#### Example Request:
```http
GET /api/assignments/67b120001b32d20b7a2d3001 HTTP/1.1
Host: localhost:5000
Cookie: accessToken=<COORDINATOR_JWT_TOKEN>
```

#### Example Response (`200 OK`):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Assignment retrieved",
  "data": {
    "_id": "67b120001b32d20b7a2d3001",
    "incidentId": {
      "_id": "67b0965d1b32d20b7a2d2001",
      "emergencyType": "FLOOD",
      "priorityLevel": "CRITICAL",
      "status": "ASSIGNED",
      "location": {
        "latitude": 24.8607,
        "longitude": 67.0011,
        "address": "Sector 4 Storm Drainage Basin"
      },
      "peopleAffected": 12,
      "reporterName": "Citizen Reporter",
      "createdAt": "2026-10-17T06:00:00.000Z"
    },
    "teamId": {
      "_id": "67b0965d1b32d20b7a2d1001",
      "name": "Alpha Swiftwater Rescue Unit",
      "teamCode": "ALPHA-01",
      "capabilities": ["WATER_RESCUE", "EVACUATION"],
      "status": "BUSY",
      "capacity": 15,
      "contact": {
        "phone": "+923001234567",
        "email": "alpha.rescue@resqlink.org",
        "leadName": "Commander Tariq"
      }
    },
    "status": "ACTIVE",
    "notes": "Immediate dispatch for high-risk flood evacuation.",
    "assignedAt": "2026-10-17T07:15:00.000Z",
    "completedAt": null,
    "isSimulated": false,
    "createdAt": "2026-10-17T07:15:00.000Z",
    "updatedAt": "2026-10-17T07:15:00.000Z"
  }
}
```

---

### 3. Create Rescue Assignment (Existing Dispatch Engine)
**Path:** `POST /api/assignments`  
**Authentication:** Coordinator (`admin` role)  
**Description:** Dispatches a rescue team to an incident transactionally.

#### Request Schema:
```json
{
  "incidentId": "67b0965d1b32d20b7a2d2001",
  "teamId": "67b0965d1b32d20b7a2d1001",
  "notes": "Optional dispatch briefing notes"
}
```

#### Response (`201 Created`):
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Rescue assignment created",
  "data": {
    "_id": "67b120001b32d20b7a2d3001",
    "incidentId": "67b0965d1b32d20b7a2d2001",
    "teamId": "67b0965d1b32d20b7a2d1001",
    "status": "ACTIVE",
    "notes": "Optional dispatch briefing notes",
    "assignedAt": "2026-10-17T07:15:00.000Z",
    "completedAt": null,
    "createdAt": "2026-10-17T07:15:00.000Z",
    "updatedAt": "2026-10-17T07:15:00.000Z"
  }
}
```

---

## 3. Error Responses & Safeguards

| HTTP Code | Condition | Example Error Response |
| :--- | :--- | :--- |
| `400 Bad Request` | Malformed ObjectId or invalid query parameters | `{"success": false, "statusCode": 400, "message": ""status" must be one of [ACTIVE, COMPLETED, CANCELLED]", "errors": []}` |
| `401 Unauthorized` | Missing or invalid `accessToken` cookie | `{"success": false, "statusCode": 401, "message": "Authentication required", "errors": []}` |
| `403 Forbidden` | Authenticated non-coordinator user | `{"success": false, "statusCode": 403, "message": "Coordinator (admin) access required", "errors": []}` |
| `404 Not Found` | Assignment not found with given ID | `{"success": false, "statusCode": 404, "message": "Assignment not found", "errors": []}` |
| `409 Conflict` | Attempting to dispatch a team that is not `AVAILABLE` or incident already resolved | `{"success": false, "statusCode": 409, "message": "Rescue team is currently not available", "errors": []}` |

---

## 4. Operational Summary Metrics & Dashboard Integration

To populate summary metric cards on the Command Center's Assignments Management page:
- **Card 1: Total Assignments**
- **Card 2: Active Dispatches**
- **Card 3: Completed Operations**

### Recommendation:
1. **Command Dashboard Overview API:**  
   Call `GET /api/dashboard` (from merged dashboard analytics). It returns real-time organization-wide counts:
   - `activeAssignments`: Count of actively dispatched rescue operations.
   - `activeIncidents`: Count of un-resolved incidents.
   - `teamsAvailable` & `teamsBusy`: Fleet availability counts.
2. **Filtered Assignments Counts:**  
   Calling `GET /api/assignments?status=ACTIVE&limit=1` returns `pagination.total`, giving the exact count of active records without fetching full payloads. Similarly, `GET /api/assignments?status=COMPLETED&limit=1` returns the total completed operations count.

---

## 5. TypeScript Interfaces for Frontend (Codex)

```typescript
export type AssignmentStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface PopulatedIncident {
  _id: string;
  emergencyType: string;
  priorityLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED';
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  peopleAffected: number;
  reporterName?: string;
  createdAt: string;
}

export interface PopulatedRescueTeam {
  _id: string;
  name: string;
  teamCode: string;
  capabilities: string[];
  status: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
  capacity: number;
  contact?: {
    phone?: string;
    email?: string;
    leadName?: string;
  };
}

export interface AssignmentItem {
  _id: string;
  incidentId: PopulatedIncident | string;
  teamId: PopulatedRescueTeam | string;
  status: AssignmentStatus;
  notes?: string;
  assignedAt: string;
  completedAt?: string | null;
  isSimulated?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AssignmentListResponse {
  success: boolean;
  statusCode: number;
  message: string;
  data: {
    items: AssignmentItem[];
    pagination: AssignmentPagination;
  };
}

export interface AssignmentDetailResponse {
  success: boolean;
  statusCode: number;
  message: string;
  data: AssignmentItem;
}

export interface AssignmentFilterParams {
  page?: number;
  limit?: number;
  status?: AssignmentStatus;
  incidentId?: string;
  teamId?: string;
  isSimulated?: boolean;
}
```

---

## 6. Frontend Navigation & Integration Instructions for Codex

1. **Assignments Management View:**
   - Mount at `/admin/assignments` or in the Command Center navigation drawer.
   - Use tabs or pill buttons to filter by status: `All`, `Active` (`status=ACTIVE`), `Completed` (`status=COMPLETED`), `Cancelled` (`status=CANCELLED`).
2. **Linked Incident Navigation:**
   - When `incidentId` is an object, clicking the Incident column navigates to `/admin/incidents/${assignment.incidentId._id}` or opens the Incident triage drawer.
3. **Linked Team Navigation:**
   - When `teamId` is an object, clicking the Team column navigates to `/admin/teams/${assignment.teamId._id}` or displays the team's operational contact details (`contact.leadName`, `contact.phone`).
4. **Real-time Status Updates:**
   - When an incident is marked `RESOLVED` from the incident details drawer, trigger a re-fetch of `GET /api/assignments` to show that the assignment is now `COMPLETED` with a populated `completedAt` timestamp.
