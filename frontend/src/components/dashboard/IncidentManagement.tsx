"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  FlaskConical,
  Layers,
  MapPin,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Siren,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { incidents } from "@/lib/api/incidents";
import { errorMessage } from "@/lib/api/client";
import type {
  Incident,
  IncidentStatus,
  Paginated,
  PriorityLevel,
  VerificationStatus,
} from "@/types/api";
import { IncidentVisual, incidentTitle } from "./incident-visual";
import { useDashboard } from "./dashboard-context";
import { filterDemoIncidents } from "./incident-filters";
import { formatIncidentTime } from "./incident-location-utils";
import "./incident-management.css";

const initial: Paginated<Incident> = {
  items: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
};

export function IncidentManagement() {
  const router = useRouter();
  const {
    demo,
    isDemoMode,
    setIsDemoMode,
    refresh: refreshDashboard,
    setSelectedIncident,
  } = useDashboard();

  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<IncidentStatus | "">("");
  const [priority, setPriority] = useState<PriorityLevel | "">("");
  const [verification, setVerification] = useState<VerificationStatus | "">("");
  const [sort, setSort] = useState<"priority" | "oldest" | "newest">("priority");
  const [query, setQuery] = useState("");
  const [updated, setUpdated] = useState<number | null>(null);

  const request = useRef(0);

  const load = useCallback(async () => {
    const run = ++request.current;
    if (isDemoMode) {
      const filtered = filterDemoIncidents(demo.incidents, {
        search: query,
        status,
        priority,
        verification,
        sort,
      });
      setData({
        items: filtered.slice((page - 1) * 20, page * 20),
        pagination: {
          page,
          limit: 20,
          total: filtered.length,
          totalPages: Math.max(1, Math.ceil(filtered.length / 20)),
        },
      });
      setError("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const next = await incidents.list({
        page,
        limit: 20,
        status: status || undefined,
        priorityLevel: priority || undefined,
        verificationStatus: verification || undefined,
        search: query.trim() || undefined,
        isSimulated: false,
        sort,
      });
      if (run !== request.current) return;
      setData(next);
      setUpdated(Date.now());
    } catch (e) {
      if (run === request.current) setError(errorMessage(e));
    } finally {
      if (run === request.current) setLoading(false);
    }
  }, [isDemoMode, demo.incidents, page, status, priority, verification, sort, query]);

  useEffect(() => {
    const requests = request;
    const initialLoad = setTimeout(() => void load(), 0);
    return () => {
      clearTimeout(initialLoad);
      requests.current++;
    };
  }, [load]);

  useEffect(() => {
    if (document.hidden || isDemoMode) return;
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 7000);
    const visible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [load, isDemoMode]);

  const displayed = data.items;

  const clear = () => {
    setStatus("");
    setPriority("");
    setVerification("");
    setSort("priority");
    setQuery("");
    setPage(1);
  };

  const open = (incident: Incident) => {
    setSelectedIncident(null);
    router.push(
      `/dashboard/incidents/${encodeURIComponent(incident._id)}${
        isDemoMode ? "?demo=true" : ""
      }`
    );
  };

  const preview = () => {
    setIsDemoMode(true);
    setSelectedIncident(null);
    const firstDemoIncident = demo.incidents[0];
    if (firstDemoIncident) router.push(`/dashboard/incidents/${encodeURIComponent(firstDemoIncident._id)}?demo=true`);
  };

  const pendingCount = data.items.filter((i) => i.status === "PENDING").length;
  const criticalCount = data.items.filter((i) => i.priorityLevel === "CRITICAL").length;
  const activeResponsesCount = data.items.filter(
    (i) => i.status === "ASSIGNED" || i.status === "IN_PROGRESS"
  ).length;

  return (
    <div className="rqIncidentPage">
      {/* Simulation / Real Data Mode Banner */}
      {isDemoMode ? (
        <div
          className="rqIncidentNotice rqDemoBanner"
          role="region"
          aria-label="Demo environment status"
        >
          <div className="rqDemoBannerContent">
            <div className="rqDemoBannerIconWrap" aria-hidden="true">
              <FlaskConical size={15} />
            </div>
            <div className="rqDemoBannerText">
              <strong className="rqDemoTitle">Demo Mode · Simulated Incidents</strong>
              <span className="rqDemoSubtitle">
                Explore fictional reports and coordinator workflows without changing real records.
              </span>
            </div>
          </div>
          <button
            onClick={preview}
            className="rqDemoPreviewBtn"
            aria-label="Preview demo incident workspace"
          >
            <span>Preview demo incident workspace</span>
            <ArrowRight size={13} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div
          className="rqIncidentNotice rqRealNotice"
          role="region"
          aria-label="Live incident repository status"
        >
          <div className="rqRealNoticeContent">
            <div className="rqRealNoticeIndicator" aria-hidden="true">
              <span className="rqLivePulseDot" />
            </div>
            <div className="rqRealNoticeText">
              <strong className="rqRealTitle">Live Operations Feed</strong>
              <span className="rqRealSubtitle">
                Select a report below to open its full incident command workspace.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="rqIncidentPageHead">
        <div>
          <div className="rqIncidentEyebrowRow">
            <p className="rqIncidentEyebrow">Coordinator workspace</p>
            <span className="rqEyebrowBadge">Live Ops</span>
          </div>
          <h1 className="rqIncidentHeading">Incident Management</h1>
          <p className="rqIncidentSubtitle">
            Monitor reports, assess urgency, and coordinate response.
          </p>
        </div>

        <div className="rqIncidentActionsBlock">
          {updated ? (
            <span className="rqUpdateStamp" title="Last API synchronization">
              <Clock size={12} className="inline mr-1 opacity-70" aria-hidden="true" />
              Updated {new Date(updated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          ) : null}
          <button
            className="rqRefreshBtn"
            onClick={() => {
              void load();
              void refreshDashboard();
            }}
            disabled={loading}
            aria-label="Refresh incidents"
          >
            <RefreshCw
              size={14}
              className={loading ? "animate-spin" : ""}
              aria-hidden="true"
            />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {/* KPI Cards */}
      <section className="rqIncidentMetrics" aria-label="Incident summary">
        <KpiCard
          label="Records in current filter"
          value={data.pagination.total}
          subtitle="Matching search & filters"
          icon={<Layers size={20} />}
          accent="blue"
        />
        <KpiCard
          label="Pending review"
          value={pendingCount}
          subtitle="Visible unreviewed on page"
          icon={<Clock size={20} />}
          accent="amber"
        />
        <KpiCard
          label="Critical on this page"
          value={criticalCount}
          subtitle="Highest severity visible"
          icon={<Siren size={20} />}
          accent="red"
        />
        <KpiCard
          label="Active responses"
          value={activeResponsesCount}
          subtitle="Assigned & in-progress"
          icon={<Radio size={20} />}
          accent="green"
        />
      </section>

      {/* Search & Filter Toolbar */}
      <section className="rqIncidentFilters" aria-label="Incident filters">
        <div className="rqSearchWrap">
          <label htmlFor="incident-search-input" className="rqSearchLabel">
            <Search size={15} className="rqSearchIcon" aria-hidden="true" />
            <input
              id="incident-search-input"
              aria-label="Search incidents"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by incident, location or report reference"
              className="rqSearchInput"
            />
          </label>
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setPage(1);
              }}
              className="rqSearchClearBtn"
              aria-label="Clear search text"
            >
              <X size={12} />
            </button>
          ) : null}
        </div>

        <div className="rqFilterControls">
          <div className="rqSelectWrapper">
            <select
              aria-label="Filter by status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as IncidentStatus | "");
                setPage(1);
              }}
              className="rqSelect"
            >
              <option value="">All statuses</option>
              {["PENDING", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CANCELLED"].map((x) => (
                <option key={x} value={x}>
                  {x.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <div className="rqSelectWrapper">
            <select
              aria-label="Filter by priority"
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value as PriorityLevel | "");
                setPage(1);
              }}
              className="rqSelect"
            >
              <option value="">All priorities</option>
              {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>

          <div className="rqSelectWrapper">
            <select
              aria-label="Filter by verification"
              value={verification}
              onChange={(e) => {
                setVerification(e.target.value as VerificationStatus | "");
                setPage(1);
              }}
              className="rqSelect"
            >
              <option value="">All verification</option>
              {["NEEDS_REVIEW", "VERIFIED", "FLAGGED_DUPLICATE", "DISMISSED"].map((x) => (
                <option key={x} value={x}>
                  {x === "NEEDS_REVIEW" ? "Needs Review" : x.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <div className="rqSelectWrapper">
            <select
              aria-label="Sort incidents"
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="rqSelect"
            >
              <option value="priority">Highest priority</option>
              <option value="newest">Most recent</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>

          <button
            type="button"
            onClick={clear}
            className="rqClearFiltersBtn"
            aria-label="Clear all filters"
          >
            <X size={14} aria-hidden="true" />
            <span>Clear</span>
          </button>
        </div>
      </section>

      {/* Directory Section Header */}
      <div className="rqDirectoryHeader">
        <div className="rqDirectoryTitleGroup">
          <h2 className="rqDirectoryTitle">Incident Directory</h2>
          <span className="rqDirectoryCountBadge">
            {data.pagination.total} {data.pagination.total === 1 ? "incident" : "incidents"}
          </span>
        </div>
        {data.pagination.total > 0 && (
          <span className="rqDirectoryRange">
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, data.pagination.total)} of{" "}
            {data.pagination.total} records
          </span>
        )}
      </div>

      {/* Incident List / States */}
      {error ? (
        <div className="rqIncidentError" role="alert">
          <div className="rqErrorContent">
            <strong>Unable to load incidents</strong>
            <p>{error}</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="rqRetryBtn"
          >
            <RefreshCw size={13} aria-hidden="true" />
            <span>Try again</span>
          </button>
        </div>
      ) : loading ? (
        <section className="rqIncidentList" aria-busy="true">
          <div className="rqIncidentLoading">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="rqIncidentSkeletonCard animate-pulse">
                <div className="rqSkeletonThumb" />
                <div className="rqSkeletonBody">
                  <div className="rqSkeletonLine w-1/3 h-5" />
                  <div className="rqSkeletonLine w-1/2 h-4 mt-1" />
                  <div className="rqSkeletonLine w-1/4 h-3 mt-2" />
                </div>
              </div>
            ))}
            <p className="sr-only">Loading incident records…</p>
          </div>
        </section>
      ) : displayed.length === 0 ? (
        <section className="rqIncidentList">
          <div className="rqIncidentEmpty" role="status">
            <div className="rqEmptyIconWrap" aria-hidden="true">
              {query || status || priority || verification ? (
                <Search size={28} />
              ) : (
                <ShieldCheck size={28} />
              )}
            </div>
            <h3 className="rqEmptyHeading">
              {query || status || priority || verification
                ? "No matching incidents"
                : "No incidents recorded"}
            </h3>
            <p className="rqEmptyDesc">
              {query || status || priority || verification
                ? "No emergency reports match the current filters or search criteria. Try adjusting your parameters."
                : "New emergency reports will appear here automatically when received by the response network."}
            </p>
            {query || status || priority || verification ? (
              <button
                type="button"
                onClick={clear}
                className="rqEmptyClearBtn"
              >
                <X size={13} aria-hidden="true" />
                <span>Clear Filters</span>
              </button>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="rqIncidentList">
          {displayed.map((i) => {
            const timeInfo = formatIncidentTime(i.createdAt);
            const address = i.location?.address || "Location verification required";
            const verificationText =
              i.verification?.status?.replaceAll("_", " ") || "Verification not recorded";
            const statusText = i.status.replaceAll("_", " ");

            return (
              <button
                className="rqIncidentRow rqIncidentCard group"
                key={i._id}
                onClick={() => open(i)}
                aria-label={`${incidentTitle(i)}, ${i.priorityLevel} priority, located at ${address}`}
              >
                <div className="rqIncidentCardVisual">
                  <IncidentVisual incident={i} />
                </div>

                <div className="rqIncidentCardBody">
                  <div className="rqIncidentCardHeader">
                    <div className="rqIncidentCardTitleGroup">
                      <strong className="rqIncidentCardTitle">{incidentTitle(i)}</strong>
                      {i.reportReference ? (
                        <span
                          className="rqIncidentRefPill"
                          title="Official SOS Report Reference"
                        >
                          {i.reportReference}
                        </span>
                      ) : null}
                    </div>

                    <div className="rqIncidentCardBadges">
                      <span
                        className={`rqCommandSeverity ${i.priorityLevel.toLowerCase()} rqPriorityBadge`}
                      >
                        {i.priorityLevel}
                      </span>
                    </div>
                  </div>

                  <div className="rqIncidentCardLocation">
                    <MapPin size={13} className="rqLocationPinIcon shrink-0" aria-hidden="true" />
                    <p className="rqLocationText truncate m-0">
                      {address}
                    </p>
                  </div>

                  <div className="rqIncidentCardMeta">
                    <div className="rqIncidentMetaChips">
                      <span
                        className={`rqStatusBadge rqStatus-${i.status.toLowerCase()}`}
                      >
                        <span className="rqStatusDot" aria-hidden="true" />
                        {statusText}
                      </span>

                      <span
                        className={`rqVerifyBadge rqVerify-${(
                          i.verification?.status || "unrecorded"
                        ).toLowerCase()}`}
                      >
                        {i.verification?.status === "VERIFIED" ? (
                          <CheckCheck
                            size={12}
                            className="inline mr-1"
                            aria-hidden="true"
                          />
                        ) : i.verification?.status === "NEEDS_REVIEW" ? (
                          <Clock
                            size={12}
                            className="inline mr-1"
                            aria-hidden="true"
                          />
                        ) : null}
                        <small className="font-semibold text-inherit">{verificationText}</small>
                      </span>

                      <span className="rqTimeChip">
                        <Clock
                          size={11}
                          className="inline mr-1 opacity-70"
                          aria-hidden="true"
                        />
                        <time dateTime={i.createdAt}>{timeInfo.formatted}</time>
                      </span>
                    </div>

                    <div className="rqIncidentCardAction">
                      <span>Open Workspace</span>
                      <ArrowRight size={13} className="rqActionArrow" aria-hidden="true" />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </section>
      )}

      {/* Pagination Footer */}
      <footer className="rqIncidentPagination">
        <span>
          Page {data.pagination.page} of {Math.max(1, data.pagination.totalPages)} ·{" "}
          {data.pagination.total} records
        </span>
        <div className="rqPaginationActions">
          <button
            className="rqPaginationBtn"
            disabled={page <= 1 || loading}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft size={13} aria-hidden="true" />
            <span>Previous</span>
          </button>
          <button
            className="rqPaginationBtn"
            disabled={page >= data.pagination.totalPages || loading}
            onClick={() => setPage(page + 1)}
          >
            <span>Next</span>
            <ChevronRight size={13} aria-hidden="true" />
          </button>
        </div>
      </footer>
    </div>
  );
}

function KpiCard({
  label,
  value,
  subtitle,
  icon,
  accent,
}: {
  label: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
  accent: "blue" | "amber" | "red" | "green";
}) {
  return (
    <div className="rqKpiCard">
      <div className={`rqKpiIconSquare accent-${accent}`} aria-hidden="true">
        {icon}
      </div>
      <div className="rqKpiBody">
        <span className="rqKpiLabel">{label}</span>
        <strong className="rqKpiValue">{value}</strong>
        <span className="rqKpiSub">{subtitle}</span>
      </div>
    </div>
  );
}
