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
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboard } from "@/components/dashboard/dashboard-context";
import {
  notifications,
  type NotificationItem,
  type NotificationType,
  type NotificationSeverity,
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

export interface EmergencyToastData {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  incidentId: string | null;
  reportReference?: string;
  createdAt: string;
}

function extractReportReference(title: string, message: string): string | null {
  const match = (title + " " + message).match(/RESQ-\d{6,}/i);
  return match ? match[0].toUpperCase() : null;
}

export function NotificationBell() {
  const { user } = useAuth();
  const { isDemoMode, setIsDemoMode } = useDashboard();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Emergency SOS Popups (bounded queue: max 2)
  const [activeToasts, setActiveToasts] = useState<EmergencyToastData[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef<boolean>(true);
  const pollingLockRef = useRef<boolean>(false);

  // Fetch recent notifications when popover opens
  const fetchNotificationsList = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await notifications.list({
        limit: 15,
        isSimulated: false,
      });
      setItems(res.items);
    } catch {
      setError("Notifications couldn't be loaded.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Dismiss a specific toast popup without marking as read
  const handleDismissToast = useCallback((id: string) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Action from toast popup: Mark read, switch to real data, navigate to incident
  const handleReviewFromToast = useCallback(
    async (toast: EmergencyToastData) => {
      handleDismissToast(toast.id);

      try {
        await notifications.markRead(toast.id);
        setItems((prev) =>
          prev.map((i) => (i.id === toast.id ? { ...i, isRead: true } : i))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // Continue even if markRead fails
      }

      if (toast.incidentId) {
        if (isDemoMode) {
          setIsDemoMode(false);
        }
        router.push(`/dashboard/incidents/${toast.incidentId}?demo=false`);
      }
    },
    [handleDismissToast, isDemoMode, setIsDemoMode, router]
  );

  // Lightweight 5-second polling loop for unread count & fresh emergency arrivals
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setActiveToasts([]);
      return;
    }

    let isSubscribed = true;

    const pollNotifications = async () => {
      if (pollingLockRef.current || !isSubscribed) return;
      pollingLockRef.current = true;

      try {
        // Fetch unread count for genuine operational records
        const countRes = await notifications.unreadCount(false);
        if (isSubscribed) {
          setUnreadCount(countRes.unreadCount);
        }

        // Fetch recent items to check for new arrivals
        const listRes = await notifications.list({
          limit: 10,
          isSimulated: false,
        });

        if (!isSubscribed) return;

        if (isInitialLoadRef.current) {
          // Initial baseline: Record existing IDs, do NOT replay backlog as popups
          listRes.items.forEach((item) => {
            seenNotificationIdsRef.current.add(item.id);
          });
          setItems(listRes.items);
          isInitialLoadRef.current = false;
        } else {
          // Subsequent poll: detect newly arrived unread notifications
          const newlyDiscovered: EmergencyToastData[] = [];

          listRes.items.forEach((item) => {
            if (!seenNotificationIdsRef.current.has(item.id)) {
              seenNotificationIdsRef.current.add(item.id);
              if (!item.isRead) {
                const reportRef = extractReportReference(item.title, item.message);
                newlyDiscovered.push({
                  id: item.id,
                  type: item.type,
                  severity: item.severity,
                  title: item.title,
                  message: item.message,
                  incidentId: item.incidentId,
                  reportReference: reportRef || undefined,
                  createdAt: item.createdAt,
                });
              }
            }
          });

          setItems(listRes.items);

          if (newlyDiscovered.length > 0) {
            // Append newly arrived alerts, keeping queue bounded to max 2 visible
            setActiveToasts((prev) => {
              const combined = [...newlyDiscovered, ...prev];
              return combined.slice(0, 2);
            });
          }
        }
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          if (isSubscribed) {
            setUnreadCount(0);
          }
        }
      } finally {
        pollingLockRef.current = false;
      }
    };

    // Immediate initial poll
    void pollNotifications();

    // 5-second interval
    const interval = setInterval(() => {
      void pollNotifications();
    }, 5000);

    const onVisibilityChange = () => {
      if (!document.hidden && isSubscribed) {
        void pollNotifications();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [user]);

  // Auto-dismiss timers for emergency toasts
  useEffect(() => {
    if (activeToasts.length === 0) return;

    const timers = activeToasts.map((toast) => {
      // 15 seconds for critical/urgent, 10 seconds for standard notifications
      const timeoutMs = toast.severity === "CRITICAL" ? 15000 : 10000;
      return setTimeout(() => {
        handleDismissToast(toast.id);
      }, timeoutMs);
    });

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [activeToasts, handleDismissToast]);

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
      if (isDemoMode) {
        setIsDemoMode(false);
      }
      router.push(`/dashboard/incidents/${item.incidentId}?demo=false`);
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
      await notifications.markAllRead(false);
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
    <>
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
                <p>Real-time coordinator updates</p>
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

      {/* Floating Emergency In-App SOS Notification Toast Popup */}
      {activeToasts.length > 0 && (
        <aside
          className="rqEmergencyToastContainer"
          role="region"
          aria-label="Emergency SOS Notifications"
        >
          {activeToasts.map((toast) => (
            <div
              key={toast.id}
              className={`rqEmergencyToast severity-${toast.severity}`}
              role="alert"
            >
              <div className="rqEmergencyToastHeader">
                <div className="rqEmergencyToastMeta">
                  <div className="rqEmergencyToastIcon">
                    {getNotificationIcon(toast.type)}
                  </div>
                  <div className="rqEmergencyToastTitleGroup">
                    <strong>{toast.title}</strong>
                    <div className="rqEmergencyToastBadges">
                      {isDemoMode && (
                        <span
                          className="rqToastRealBadge"
                          title="Real operational SOS arrived from a citizen"
                        >
                          Real SOS
                        </span>
                      )}
                      {toast.reportReference && (
                        <span className="rqToastRefBadge">
                          {toast.reportReference}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="rqEmergencyToastDismiss"
                  aria-label="Dismiss notification alert"
                  title="Dismiss alert"
                  onClick={() => handleDismissToast(toast.id)}
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </div>

              <p className="rqEmergencyToastBody">{toast.message}</p>

              <div className="rqEmergencyToastActions">
                <button
                  type="button"
                  className="rqEmergencyToastReviewBtn"
                  onClick={() => void handleReviewFromToast(toast)}
                >
                  <span>
                    {isDemoMode ? "Review Real Incident" : "Review Incident"}
                  </span>
                  <ExternalLink size={13} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </aside>
      )}
    </>
  );
}
