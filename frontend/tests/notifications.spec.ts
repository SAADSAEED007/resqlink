import { test, expect } from "@playwright/test";
import { notifications } from "../src/lib/api/notifications";

const original = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = original;
});

test("notifications.unreadCount fetches unread count with correct endpoint and credentials", async () => {
  let calledUrl = "";
  let calledInit: RequestInit | undefined;

  globalThis.fetch = async (url, init) => {
    calledUrl = String(url);
    calledInit = init;
    return Response.json({
      success: true,
      statusCode: 200,
      message: "Unread notification count retrieved",
      data: { unreadCount: 4 },
    });
  };

  const res = await notifications.unreadCount(false);
  expect(res.unreadCount).toBe(4);
  expect(calledUrl).toContain("/notifications/unread-count?isSimulated=false");
  expect(calledInit?.credentials).toBe("include");
});

test("notifications.list requests recent notifications with pagination and simulation filter", async () => {
  let calledUrl = "";

  globalThis.fetch = async (url) => {
    calledUrl = String(url);
    return Response.json({
      success: true,
      statusCode: 200,
      message: "Notifications retrieved",
      data: {
        items: [
          {
            id: "671158d60c2d3a95bf0a1122",
            type: "CRITICAL_INCIDENT",
            severity: "CRITICAL",
            title: "Critical Incident Reported",
            message: "Critical FLOOD incident reported. Immediate dispatch recommended.",
            incidentId: "671158d60c2d3a95bf0a1100",
            teamId: null,
            assignmentId: null,
            isRead: false,
            readAt: null,
            createdAt: "2026-10-17T11:45:00.000Z",
          },
        ],
        pagination: {
          page: 1,
          limit: 15,
          total: 1,
          totalPages: 1,
        },
      },
    });
  };

  const res = await notifications.list({ limit: 15, isSimulated: true });
  expect(res.items).toHaveLength(1);
  expect(res.items[0].type).toBe("CRITICAL_INCIDENT");
  expect(res.items[0].severity).toBe("CRITICAL");
  expect(calledUrl).toContain("/notifications?limit=15&isSimulated=true");
});

test("notifications.markRead sends PATCH to mark single notification as read", async () => {
  let calledUrl = "";
  let calledMethod = "";

  globalThis.fetch = async (url, init) => {
    calledUrl = String(url);
    calledMethod = init?.method ?? "GET";
    return Response.json({
      success: true,
      statusCode: 200,
      message: "Notification marked as read",
      data: {
        id: "671158d60c2d3a95bf0a1122",
        type: "CRITICAL_INCIDENT",
        severity: "CRITICAL",
        title: "Critical Incident Reported",
        message: "Critical FLOOD incident reported.",
        incidentId: "671158d60c2d3a95bf0a1100",
        teamId: null,
        assignmentId: null,
        isRead: true,
        readAt: "2026-10-17T12:00:00.000Z",
        createdAt: "2026-10-17T11:45:00.000Z",
      },
    });
  };

  const res = await notifications.markRead("671158d60c2d3a95bf0a1122");
  expect(res.isRead).toBe(true);
  expect(calledUrl).toContain("/notifications/671158d60c2d3a95bf0a1122/read");
  expect(calledMethod).toBe("PATCH");
});

test("notifications.markAllRead sends PATCH to mark all notifications as read", async () => {
  let calledUrl = "";
  let calledMethod = "";

  globalThis.fetch = async (url, init) => {
    calledUrl = String(url);
    calledMethod = init?.method ?? "GET";
    return Response.json({
      success: true,
      statusCode: 200,
      message: "All notifications marked as read",
      data: {
        success: true,
        updatedCount: 3,
      },
    });
  };

  const res = await notifications.markAllRead(true);
  expect(res.success).toBe(true);
  expect(res.updatedCount).toBe(3);
  expect(calledUrl).toContain("/notifications/read-all?isSimulated=true");
  expect(calledMethod).toBe("PATCH");
});
