"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  AlertCircle,
  FileCheck,
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  X,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboard } from "@/components/dashboard/dashboard-context";
import {
  notifications,
  type NotificationItem,
  type NotificationType,
} from "@/lib/api/notifications";
import { ApiError } from "@/lib/api/client";
import "./notification-bell.css";

function formatRelativeTime(dateStr: string): string {
  try {
    const then = new Date(dateStr).getTime();
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - then) / 1000));

    if (diffSec < 60) return "just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;

    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case "CRITICAL_INCIDENT":
      return <AlertTriangle size={16} aria-hidden="true" />;
    case "INCIDENT_REVIEW_REQUIRED":
      return <FileCheck size={16} aria-hidden="true" />;
    case "TEAM_ASSIGNED":
      return <Shield size={16} aria-hidden="true" />;
    case "INCIDENT_IN_PROGRESS":
      return <Clock size={16} aria-hidden="true" />;
    case "INCIDENT_RESOLVED":
      return <CheckCircle2 size={16} aria-hidden="true" />;
    case "INCIDENT_CANCELLED":
      return <XCircle size={16} aria-hidden="true" />;
    case "INCIDENT_CREATED":
    default:
      return <AlertCircle size={16} aria-hidden="true" />;
  }
}

export function NotificationBell() {
  const { user } = useAuth();
  const { isDemoMode } = useDashboard();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Simulation filter aligned with dashboard demo state
  const isSimulated = isDemoMode ? true : undefined;

  // Fetch recent notifications when popover opens
  const fetchNotificationsList = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await notifications.list({
        limit: 15,
        isSimulated,
      });
      setItems(res.items);
    } catch {
      setError("Notifications couldn't be loaded.");
    } finally {
      setLoading(false);
    }
  }, [user, isSimulated]);

  // Polling strategy: 10s interval when coordinator is authenticated
  useEffect(() => {
    if (!user) return;

    let isSubscribed = true;

    const fetchCount = async () => {
      try {
        const res = await notifications.unreadCount(isSimulated);
        if (isSubscribed) {
          setUnreadCount(res.unreadCount);
        }
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          if (isSubscribed) {
            setUnreadCount(0);
          }
        }
      }
    };

    void fetchCount();

    const interval = setInterval(() => {
      if (!document.hidden && isSubscribed) {
        void fetchCount();
      }
    }, 10000);

    const onVisibilityChange = () => {
      if (!document.hidden && isSubscribed) {
        void fetchCount();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [user, isSimulated]);

  // Toggle popover and trigger fetch on open
  const handleToggleOpen = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        void fetchNotificationsList();
      }
      return next;
    });
  };

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  // Mark single notification as read & navigate
  const handleItemClick = async (item: NotificationItem) => {
    if (!item.isRead) {
      try {
        await notifications.markRead(item.id);
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, isRead: true } : i))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // Continue with navigation even if markRead fails
      }
    }

    setIsOpen(false);

    if (item.incidentId) {
      router.push(`/dashboard/incidents/${item.incidentId}`);
    } else if (item.teamId) {
      router.push("/dashboard/rescue-teams");
    } else if (item.assignmentId) {
      router.push("/dashboard/assignments");
    }
  };

  // Mark all notifications as read
  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      await notifications.markAllRead(isSimulated);
      setItems((prev) => prev.map((i) => ({ ...i, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Keep state if markAllRead fails
    } finally {
      setMarkingAll(false);
    }
  };

  const badgeText = unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : null;
  const accessibleLabel = unreadCount > 0
    ? `Notifications (${unreadCount} unread)`
    : "Notifications";

  return (
    <div
      ref={containerRef}
      className="rqNotificationBellContainer"
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className="rqNotificationBellBtn rqCommandIcon"
        aria-label={accessibleLabel}
        title={accessibleLabel}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={handleToggleOpen}
      >
        <Bell size={19} aria-hidden="true" />
        {badgeText && (
          <span className="rqNotificationBadge" aria-hidden="true">
            {badgeText}
          </span>
        )}
      </button>

      {isOpen && (
        <section
          role="dialog"
          aria-label="Coordinator Notifications"
          className="rqNotificationPopover"
        >
          <header className="rqNotificationHeader">
            <div className="rqNotificationHeaderInfo">
              <h3>Notifications</h3>
              <p>Recent coordinator updates</p>
            </div>
            <div className="rqNotificationHeaderActions">
              <button
                type="button"
                className="rqNotificationMarkAllBtn"
                disabled={unreadCount === 0 || markingAll}
                onClick={handleMarkAllRead}
                title="Mark all as read"
              >
                <CheckCheck size={14} aria-hidden="true" />
                <span>Mark all read</span>
              </button>
              <button
                type="button"
                className="rqNotificationCloseBtn"
                aria-label="Close notifications"
                onClick={() => setIsOpen(false)}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </header>

          {loading ? (
            <div className="rqNotificationStateMsg">
              <RefreshCw size={20} className="animate-spin" aria-hidden="true" />
              <p>Loading updates...</p>
            </div>
          ) : error ? (
            <div className="rqNotificationStateMsg">
              <strong>{error}</strong>
              <button
                type="button"
                className="rqNotificationRetryBtn"
                onClick={() => void fetchNotificationsList()}
              >
                <RefreshCw size={12} aria-hidden="true" />
                Retry
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="rqNotificationStateMsg">
              <strong>You&apos;re all caught up.</strong>
              <p>No new notifications at this time.</p>
            </div>
          ) : (
            <ul className="rqNotificationList" role="list">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`rqNotificationItem ${!item.isRead ? "unread" : ""}`}
                    onClick={() => void handleItemClick(item)}
                  >
                    <div
                      className={`rqNotificationIconWrapper severity-${item.severity}`}
                    >
                      {getNotificationIcon(item.type)}
                    </div>
                    <div className="rqNotificationContent">
                      <div className="rqNotificationTitleRow">
                        <span className="rqNotificationTitle">{item.title}</span>
                        <time
                          dateTime={item.createdAt}
                          className="rqNotificationTime"
                        >
                          {formatRelativeTime(item.createdAt)}
                        </time>
                      </div>
                      <p className="rqNotificationMessage">{item.message}</p>
                      <div className="rqNotificationFooterRow">
                        <span
                          className={`rqNotificationSeverityBadge ${item.severity}`}
                        >
                          {item.severity}
                        </span>
                        {!item.isRead && (
                          <span
                            className="rqNotificationUnreadDot"
                            title="Unread"
                            aria-label="Unread notification"
                          />
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <footer className="rqNotificationFooterNav">
            <Link
              href="/dashboard/incidents"
              className="rqNotificationFooterLink"
              onClick={() => setIsOpen(false)}
            >
              <span>View all incidents</span>
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </footer>
        </section>
      )}
    </div>
  );
}
