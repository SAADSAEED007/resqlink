# ResQLink — Coordinator Notification System Backend Specification

**Module:** Emergency Operations Command Center — Notification Bell (`/api/notifications`)  
**Target Roles:** Authorized Coordinators (`role: admin`)  
**Security Policy:** Strict JWT cookie (`accessToken`) or `Authorization: Bearer <token>` required. Non-admin users (`role: user`) and unauthenticated requests are rejected with `403` or `401`.

---

## 1. Architecture & Design Principles

### Purpose & Distinction
- **Incident Activity Log (`/api/dashboard/activity`):** An objective, system-wide historical audit trail of operations (who was dispatched, status transitions, priority overrides).
- **Coordinator Notifications (`/api/notifications`):** Action-oriented event alerts tailored for the operations dashboard bell. Each coordinator maintains an independent read/unread state. Coordinator A marking an alert as read never clears it for Coordinator B.

### Multi-Coordinator Isolation
The notification document tracks read receipts in an array:
```typescript
readBy: [
  { coordinatorId: ObjectId, readAt: Date }
]
```
When queried by a coordinator:
- `isRead`: Evaluated dynamically as `true` if `readBy` contains the requesting coordinator's ID.
- `readAt`: The timestamp when this specific coordinator marked it read.
- `unreadOnly=true`: Efficiently filters with MongoDB query `readBy.coordinatorId: { $ne: coordinatorId }`.

### Transaction Safety & Error Boundaries
- Emergency event notifications are emitted **only after** primary database transactions commit (e.g. `assignTeam`, `changeStatus`).
- If an assignment transaction rolls back or fails validation, **zero false-positive notifications** are generated.
- Notification writes are wrapped in safe error boundaries; a failure in notification persistence **never** rolls back or disrupts core emergency workflows.

### Polling & Real-Time Strategy
- Designed for lightweight polling at **~10 second intervals** by the frontend Command Center navbar:
  - Navbar Bell Badge polls `GET /api/notifications/unread-count`.
  - Notification Dropdown panel fetches `GET /api/notifications?limit=10`.
  - When the user opens the dropdown or filters, requests use standard pagination.

---

## 2. Notification Types & Severities

### Event Types (`NOTIFICATION_TYPES`)
| Type | Default Severity | Trigger Condition |
| :--- | :--- | :--- |
| `CRITICAL_INCIDENT` | `CRITICAL` | New incident reported with priority score $\ge 75$ or `priorityLevel: 'CRITICAL'`. |
| `INCIDENT_REVIEW_REQUIRED` | `HIGH` | New incident with missing location coordinates or verification status `NEEDS_REVIEW`. |
| `INCIDENT_CREATED` | `HIGH` / `MEDIUM` | New incident reported (`HIGH` for high priority, `MEDIUM` for others). |
| `TEAM_ASSIGNED` | `HIGH` | Rescue team successfully dispatched to an incident. |
| `INCIDENT_IN_PROGRESS` | `HIGH` | Incident status transitioned to `IN_PROGRESS`. |
| `INCIDENT_RESOLVED` | `LOW` | Incident status transitioned to `RESOLVED`, returning team to `AVAILABLE`. |
| `INCIDENT_CANCELLED` | `LOW` | Incident cancelled. |

### Severity Levels (`NOTIFICATION_SEVERITIES`)
- `CRITICAL`: Urgent emergency event requiring immediate coordinator intervention (red indicator).
- `HIGH`: Significant operational transition or review bottleneck (amber indicator).
- `MEDIUM`: Standard operational activity notification (blue indicator).
- `LOW`: Routine completion or administrative resolution (gray indicator).

---

## 3. API Endpoints

### 1. List Notifications
**Path:** `GET /api/notifications`  
**Authentication:** Coordinator (`admin`)  
**Query Parameters:**
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `page` | Integer | No | Page number (default: `1`, min: `1`) |
| `limit` | Integer | No | Items per page (default: `20`, max: `100`) |
| `unreadOnly` | Boolean | No | If `true`, returns only notifications unread by the current coordinator |
| `type` | String | No | Filter by specific `NotificationType` enum |
| `isSimulated` | Boolean | No | Filter simulated vs real emergency notifications |

#### Example Request:
```http
GET /api/notifications?unreadOnly=true&limit=10 HTTP/1.1
Host: localhost:5000
Cookie: accessToken=<COORDINATOR_JWT_TOKEN>
```

#### Example Response (`200 OK`):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Notifications retrieved",
  "data": {
    "items": [
      {
        "id": "671158d60c2d3a95bf0a1122",
        "type": "CRITICAL_INCIDENT",
        "severity": "CRITICAL",
        "title": "Critical Incident Reported",
        "message": "Critical FLOOD incident reported at Sector 4 Riverbank. Immediate dispatch recommended.",
        "incidentId": "671158d60c2d3a95bf0a1100",
        "teamId": null,
        "assignmentId": null,
        "isRead": false,
        "readAt": null,
        "createdAt": "2026-10-17T11:45:00.000Z"
      },
      {
        "id": "671158d60c2d3a95bf0a1123",
        "type": "TEAM_ASSIGNED",
        "severity": "HIGH",
        "title": "Rescue Team Dispatched",
        "message": "Rescue team has been assigned to incident #0a1100.",
        "incidentId": "671158d60c2d3a95bf0a1100",
        "teamId": "671158d60c2d3a95bf0a2200",
        "assignmentId": "671158d60c2d3a95bf0a3300",
        "isRead": false,
        "readAt": null,
        "createdAt": "2026-10-17T11:46:12.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 2,
      "totalPages": 1
    }
  }
}
```

---

### 2. Get Unread Notification Count
**Path:** `GET /api/notifications/unread-count`  
**Authentication:** Coordinator (`admin`)  
**Query Parameters:**
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `isSimulated` | Boolean | No | Optional filter for simulated vs real notifications |

#### Example Request:
```http
GET /api/notifications/unread-count HTTP/1.1
Host: localhost:5000
Cookie: accessToken=<COORDINATOR_JWT_TOKEN>
```

#### Example Response (`200 OK`):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Unread notification count retrieved",
  "data": {
    "unreadCount": 5
  }
}
```

---

### 3. Mark Single Notification as Read
**Path:** `PATCH /api/notifications/:id/read`  
**Authentication:** Coordinator (`admin`)  
**URL Parameters:**
- `id`: 24-character hexadecimal MongoDB ObjectId of the notification.

#### Example Request:
```http
PATCH /api/notifications/671158d60c2d3a95bf0a1122/read HTTP/1.1
Host: localhost:5000
Cookie: accessToken=<COORDINATOR_JWT_TOKEN>
```

#### Example Response (`200 OK`):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Notification marked as read",
  "data": {
    "id": "671158d60c2d3a95bf0a1122",
    "type": "CRITICAL_INCIDENT",
    "severity": "CRITICAL",
    "title": "Critical Incident Reported",
    "message": "Critical FLOOD incident reported at Sector 4 Riverbank. Immediate dispatch recommended.",
    "incidentId": "671158d60c2d3a95bf0a1100",
    "teamId": null,
    "assignmentId": null,
    "isRead": true,
    "readAt": "2026-10-17T11:48:30.000Z",
    "createdAt": "2026-10-17T11:45:00.000Z"
  }
}
```

---

### 4. Mark All Notifications as Read
**Path:** `PATCH /api/notifications/read-all`  
**Authentication:** Coordinator (`admin`)  
**Query Parameters:**
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `isSimulated` | Boolean | No | Optional filter to clear only simulated or real notifications |

#### Example Request:
```http
PATCH /api/notifications/read-all HTTP/1.1
Host: localhost:5000
Cookie: accessToken=<COORDINATOR_JWT_TOKEN>
```

#### Example Response (`200 OK`):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "All notifications marked as read",
  "data": {
    "success": true,
    "updatedCount": 5
  }
}
```

---

## 4. Frontend Integration Contract for Codex

For the frontend team connecting the Emergency Operations Command Center navbar notification bell:

1. **Badge Counter Polling:**
   ```typescript
   // Poll every 10 seconds:
   const fetchBadgeCount = async () => {
     const res = await fetch('/api/notifications/unread-count', { credentials: 'include' });
     const json = await res.json();
     return json.data.unreadCount; // number
   };
   ```

2. **Dropdown Quick View:**
   ```typescript
   // When user clicks the bell icon:
   const fetchRecentNotifications = async () => {
     const res = await fetch('/api/notifications?limit=10', { credentials: 'include' });
     const json = await res.json();
     return json.data.items; // NotificationItem[]
   };
   ```

3. **Clicking a Notification:**
   - Call `PATCH /api/notifications/${item.id}/read` to set `isRead: true`.
   - If `item.incidentId` is present, navigate the coordinator directly to the incident in the command center:
     `/dashboard?incidentId=${item.incidentId}` or highlight the incident row/marker.

4. **"Mark all as read" Button:**
   - Call `PATCH /api/notifications/read-all`.
   - Optimistically reset the badge count to `0`.

