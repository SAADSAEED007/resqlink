# ResQLink Incident Activity Timeline & Audit History API

## 1. Overview
The Incident Activity Timeline & Audit History module provides coordinators with an accurate, chronological record of operational events that occur throughout an incident's lifecycle. It powers the Incident Details frontend modal, giving responders visibility into:
- Initial SOS submission
- Priority adjustments and justification
- Coordinator verification decisions
- Rescue team assignments and releases
- Incident lifecycle status progression (e.g. `PENDING` -> `ASSIGNED` -> `IN_PROGRESS` -> `RESOLVED`)

Only events that actually occurred in the system are synthesized and presented. Older legacy incident records missing verification or status history subdocuments are supported safely with backward-compatible defaults.

---

## 2. Endpoints

### 2.1 GET `/api/incidents/:id/activity`
Retrieves the complete activity timeline for a single incident.

- **Authentication**: Required (Coordinator / Admin role)
- **Parameters**:
  - `id` (path, required): 24-character hexadecimal MongoDB ObjectId of the incident.
- **Query String**:
  - `limit` (integer, optional, default: `50`, min: `1`, max: `100`): Maximum number of events to return.
  - `sort` (string, optional, enum: `['asc', 'desc']`, default: `asc`): Chronological ordering (`asc` for oldest first, `desc` for newest first).
- **Headers**:
  - `Cookie: accessToken=<jwt>` or `Authorization: Bearer <jwt>`

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Incident activity retrieved",
  "data": {
    "incidentId": "671167829283749102938475",
    "total": 5,
    "items": [
      {
        "id": "inc-created-671167829283749102938475",
        "type": "INCIDENT_REPORTED",
        "title": "SOS Reported: FLOOD (4 affected)",
        "timestamp": "2026-10-17T08:00:00.000Z",
        "priority": "HIGH",
        "status": "PENDING",
        "metadata": {
          "incidentId": "671167829283749102938475",
          "reporterName": "Fatima",
          "emergencyType": "FLOOD",
          "peopleAffected": 4
        }
      },
      {
        "id": "ov-671167829283749102938475-1792224900000",
        "type": "PRIORITY_OVERRIDE",
        "title": "Priority override to CRITICAL: \"Rapidly rising water near school\"",
        "timestamp": "2026-10-17T08:15:00.000Z",
        "priority": "CRITICAL",
        "actor": {
          "id": "671167829283749102938100",
          "role": "coordinator"
        },
        "metadata": {
          "incidentId": "671167829283749102938475",
          "previousPriority": "HIGH",
          "newPriority": "CRITICAL",
          "reason": "Rapidly rising water near school"
        }
      },
      {
        "id": "ver-671167829283749102938475-1792225200000",
        "type": "VERIFICATION_REVIEWED",
        "title": "Verification reviewed: VERIFIED",
        "timestamp": "2026-10-17T08:20:00.000Z",
        "priority": "CRITICAL",
        "status": "PENDING",
        "actor": {
          "id": "671167829283749102938100",
          "role": "coordinator"
        },
        "metadata": {
          "incidentId": "671167829283749102938475",
          "verificationStatus": "VERIFIED",
          "requiresManualReview": false,
          "reviewNotes": "Confirmed via local community focal point"
        }
      },
      {
        "id": "asg-created-671167829283749102938999",
        "type": "TEAM_ASSIGNED",
        "title": "Team BOAT-SINDH-01 assigned to FLOOD",
        "timestamp": "2026-10-17T08:30:00.000Z",
        "status": "ACTIVE",
        "metadata": {
          "assignmentId": "671167829283749102938999",
          "incidentId": "671167829283749102938475",
          "teamId": "671167829283749102938777",
          "notes": "Immediate deployment"
        }
      },
      {
        "id": "sh-671167829283749102938475-1792226700000-IN_PROGRESS",
        "type": "STATUS_CHANGED",
        "title": "Status changed from ASSIGNED to IN_PROGRESS",
        "timestamp": "2026-10-17T08:45:00.000Z",
        "status": "IN_PROGRESS",
        "priority": "CRITICAL",
        "actor": {
          "id": "671167829283749102938100",
          "role": "coordinator"
        },
        "metadata": {
          "incidentId": "671167829283749102938475",
          "previousStatus": "ASSIGNED",
          "newStatus": "IN_PROGRESS",
          "notes": ""
        }
      }
    ]
  }
}
```

#### Error Responses
- `400 Bad Request`: Malformed incident ID or query parameters.
- `401 Unauthorized`: Missing or invalid authentication token.
- `403 Forbidden`: Authenticated user does not have coordinator/admin privileges.
- `404 Not Found`: Incident ID does not exist in the database.

---

### 2.2 GET `/api/dashboard/activity` (Extended with `incidentId`)
The shared dashboard activity endpoint supports filtering by a specific incident.

- **Authentication**: Required (Coordinator / Admin role)
- **Query String**:
  - `limit` (integer, optional, default: `20`, min: `1`, max: `100`)
  - `isSimulated` (boolean, optional)
  - `incidentId` (hex 24 chars, optional): Filter feed to events involving this specific incident.

---

## 3. Supported Event Types

| Event Type | Source | Description |
| :--- | :--- | :--- |
| `INCIDENT_REPORTED` | `incident.createdAt` | Initial persistence of citizen SOS report. |
| `PRIORITY_OVERRIDE` | `incident.priorityOverrides` | Manual coordinator adjustment of priority level & score. |
| `VERIFICATION_REVIEWED` | `incident.verification.reviewedAt` | Coordinator verification assessment and notes. |
| `TEAM_ASSIGNED` | `assignment.assignedAt` | Successful transactional assignment of a rescue crew. |
| `STATUS_CHANGED` | `incident.statusHistory` | State progression transitions (e.g. `ASSIGNED` -> `IN_PROGRESS`). |
| `INCIDENT_RESOLVED` | `incident.statusHistory` | Resolution event when status reaches `RESOLVED`. |
| `ASSIGNMENT_COMPLETED` | `assignment.completedAt` | Rescue team mission completion and resource release. |

---

## 4. Frontend Integration Guide

The frontend Incident Details modal can consume the activity history endpoint to present an interactive timeline:

```typescript
interface ActivityActor {
  id: string
  role?: string
}

interface ActivityItem {
  id: string
  type: 
    | 'INCIDENT_REPORTED'
    | 'PRIORITY_OVERRIDE'
    | 'TEAM_ASSIGNED'
    | 'ASSIGNMENT_COMPLETED'
    | 'VERIFICATION_REVIEWED'
    | 'STATUS_CHANGED'
    | 'INCIDENT_RESOLVED'
    | 'TEAM_RELEASED'
  title: string
  timestamp: string
  priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  status?: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED'
  actor?: ActivityActor
  metadata: Record<string, unknown>
}

interface IncidentActivityResponse {
  incidentId: string
  total: number
  items: ActivityItem[]
}
```

### Usage Example
```typescript
async function fetchIncidentTimeline(incidentId: string): Promise<ActivityItem[]> {
  const response = await fetch(`/api/incidents/${incidentId}/activity?sort=asc`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  })
  if (!response.ok) throw new Error('Failed to load activity timeline')
  const body = await response.json()
  return body.data.items
}
```
