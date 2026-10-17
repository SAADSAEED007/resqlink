import {
  ChevronRight,
  ClipboardList,
  MapPin,
  Waves,
  Flame,
  HeartPulse,
  LifeBuoy,
  Package,
  CircleAlert,
  Clock3,
} from "lucide-react";
import type { EmergencyType } from "@/types/api";
import type { AssignmentModel } from "./use-assignment-workspace";
import {
  incidentName,
  incidentNames,
  teamName,
  timestamp,
} from "./assignment-data";

export function IncidentSymbol({ type }: { type: EmergencyType }) {
  const Icon =
    {
      FLOOD: Waves,
      FIRE: Flame,
      MEDICAL: HeartPulse,
      STRANDED: LifeBuoy,
      SUPPLIES: Package,
      OTHER: CircleAlert,
    }[type] || CircleAlert;
  return (
    <span className={`awSymbol awType-${type}`}>
      <Icon size={28} aria-hidden="true" />
    </span>
  );
}
export function Pager({
  page,
  pages,
  change,
}: {
  page: number;
  pages: number;
  change: (value: number) => void;
}) {
  return (
    <div className="awPager">
      <button disabled={page <= 1} onClick={() => change(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} of {Math.max(1, pages)}
      </span>
      <button disabled={page >= pages} onClick={() => change(page + 1)}>
        Next
      </button>
    </div>
  );
}
export function AssignmentQueue({ model: m }: { model: AssignmentModel }) {
  const { filters, setFilters, snapshot } = m;
  return (
    <section className="awCard awQueue" aria-labelledby="aw-queue-title">
      <header>
        <h2 id="aw-queue-title" tabIndex={-1}>
          <ClipboardList size={18} />
          Unassigned Incident Queue
        </h2>
        <span>{snapshot?.queue.pagination.total ?? "—"}</span>
      </header>
      <div className="awFilters">
        <input
          aria-label="Search incident descriptions or locations"
          placeholder="Search incidents or locations…"
          maxLength={100}
          onChange={(event) =>
            setFilters({
              ...filters,
              search: event.target.value || undefined,
              page: 1,
            })
          }
          value={filters.search ?? ""}
        />
        <select
          aria-label="Incident priority"
          value={filters.priorityLevel ?? ""}
          onChange={(event) =>
            setFilters({
              ...filters,
              page: 1,
              priorityLevel:
                (event.target.value as typeof filters.priorityLevel) ||
                undefined,
            })
          }
        >
          <option value="">All priorities</option>
          {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select
          aria-label="Emergency type"
          value={filters.emergencyType ?? ""}
          onChange={(event) =>
            setFilters({
              ...filters,
              page: 1,
              emergencyType: (event.target.value as EmergencyType) || undefined,
            })
          }
        >
          <option value="">All emergencies</option>
          {Object.entries(incidentNames).map(([value, name]) => (
            <option key={value} value={value}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Queue sort"
          value={filters.sort}
          onChange={(event) =>
            setFilters({
              ...filters,
              page: 1,
              sort: event.target.value as typeof filters.sort,
            })
          }
        >
          <option value="priority">Highest priority</option>
          <option value="newest">Newest reports</option>
          <option value="oldest">Oldest reports</option>
        </select>
      </div>
      {!snapshot ? (
        <p className="awEmpty" role="status">
          Loading incident queue…
        </p>
      ) : snapshot.queue.items.length === 0 ? (
        <p className="awEmpty">
          No unassigned incidents are currently available.
        </p>
      ) : (
        snapshot.queue.items.map((incident) => (
          <button
            disabled={m.busy}
            className={`awQueueRow ${m.selection?.kind === "incident" && m.selection.id === incident._id ? "selected" : ""}`}
            key={incident._id}
            onClick={() => m.select("incident", incident._id)}
            aria-pressed={
              m.selection?.kind === "incident" &&
              m.selection.id === incident._id
            }
          >
            <IncidentSymbol type={incident.emergencyType} />
            <span className="awRowText">
              <strong>{incidentNames[incident.emergencyType]}</strong>
              <small>
                <MapPin size={12} />
                {incident.location?.address || "Location requires review"}
              </small>
              <span className={`awBadge priority-${incident.priorityLevel}`}>
                {incident.priorityLevel}
              </span>
            </span>
            <span className="awRowEnd">
              <time dateTime={incident.createdAt}>
                {timestamp(incident.createdAt)}
              </time>
              <span className="awBadge">
                {incident.verification?.status === "VERIFIED"
                  ? "Verified · Pending"
                  : "Review · Pending"}
              </span>
            </span>
            <ChevronRight size={16} />
          </button>
        ))
      )}
      <Pager
        page={filters.page ?? 1}
        pages={snapshot?.queue.pagination.totalPages ?? 1}
        change={(page) => setFilters({ ...filters, page })}
      />
    </section>
  );
}
export function AssignmentRecords({ model: m }: { model: AssignmentModel }) {
  return (
    <section className="awCard awRecords">
      <header>
        <h2>
          <LifeBuoy size={18} />
          {m.history ? "Completed History" : "Active Assignments"}{" "}
          <small>({m.snapshot?.records.pagination.total ?? "—"})</small>
        </h2>
      </header>
      <div className="awTabs" aria-label="Assignment records">
        <button
          aria-pressed={!m.history}
          onClick={() => {
            m.setHistory(false);
            m.setAssignmentPage(1);
          }}
        >
          Active
        </button>
        <button
          aria-pressed={m.history}
          onClick={() => {
            m.setHistory(true);
            m.setAssignmentPage(1);
          }}
        >
          Completed history
        </button>
      </div>
      {!m.snapshot ? (
        <p className="awEmpty" role="status">
          Loading assignments…
        </p>
      ) : !m.snapshot.records.items.length ? (
        <p className="awEmpty">
          No {m.history ? "completed" : "active"} assignments.
        </p>
      ) : (
        m.snapshot.records.items.map((row) => (
          <button
            disabled={m.busy}
            className={`awRecord ${m.selection?.kind === "assignment" && m.selection.id === row._id ? "selected" : ""}`}
            key={row._id}
            onClick={() => m.select("assignment", row._id)}
          >
            <span>
              <strong>{teamName(row)}</strong>
              <small>
                {incidentName(row)} ·{" "}
                {timestamp(m.history ? row.completedAt : row.assignedAt)}
              </small>
            </span>
            <span className={`awBadge status-${row.status}`}>{row.status}</span>
            <ChevronRight size={14} />
          </button>
        ))
      )}
      <Pager
        page={m.assignmentPage}
        pages={m.snapshot?.records.pagination.totalPages ?? 1}
        change={m.setAssignmentPage}
      />
    </section>
  );
}
export function AssignmentActivity({ model: m }: { model: AssignmentModel }) {
  const events = (m.snapshot?.activity ?? [])
    .flatMap((row) => [
      {
        id: `${row._id}-created`,
        assignmentId: row._id,
        date: row.assignedAt,
        title: "Assignment created",
        row,
      },
      ...(row.status === "COMPLETED" && row.completedAt
        ? [
            {
              id: `${row._id}-completed`,
              assignmentId: row._id,
              date: row.completedAt,
              title: "Assignment completed",
              row,
            },
          ]
        : []),
    ])
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, 5);
  return (
    <section className="awCard awActivity">
      <header>
        <h2>
          <Clock3 size={18} />
          Recent Assignment Activity
        </h2>
      </header>
      <div className="awTimeline">
        {!events.length ? (
          <p className="awEmpty">
            {m.snapshot
              ? "No recorded assignment activity."
              : "Loading activity…"}
          </p>
        ) : (
          events.map((event) => (
            <button
              key={event.id}
              onClick={() => m.select("assignment", event.assignmentId)}
            >
              <i
                className={event.title.endsWith("completed") ? "completed" : ""}
              />
              <span>
                <strong>{event.title}</strong>
                <small>
                  {teamName(event.row)} · {incidentName(event.row)}
                </small>
                <time>{timestamp(event.date)} PKT</time>
              </span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
