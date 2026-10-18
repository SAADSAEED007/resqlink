"use client";
import {
  ClipboardList,
  Users,
  TriangleAlert,
  CheckCircle2,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useDashboard } from "@/components/dashboard/dashboard-context";
import { useAssignmentWorkspace } from "./use-assignment-workspace";
import {
  AssignmentQueue,
  AssignmentRecords,
  AssignmentActivity,
} from "./AssignmentLists";
import { AssignmentDetail } from "./AssignmentDetail";
import { AssignmentCoverageMap } from "./AssignmentCoverageMap";
import "./assignments.css";

const metrics = [
  {
    label: "Unassigned Incidents",
    caption: "Pending reports without a team",
    icon: ClipboardList,
    color: "red",
  },
  {
    label: "Active Deployments",
    caption: "Recorded active assignments",
    icon: Users,
    color: "blue",
  },
  {
    label: "Unassigned Critical Incidents",
    caption: "Requiring urgent coordination",
    icon: TriangleAlert,
    color: "amber",
  },
  {
    label: "Completed Today",
    caption: "Asia/Karachi · completion time",
    icon: CheckCircle2,
    color: "green",
  },
];
export function AssignmentWorkspace() {
  const { isDemoMode, teams: registeredTeams } = useDashboard();
  const model = useAssignmentWorkspace(isDemoMode);
  const mapTeams = Array.from(
    new Map(
      [
        ...registeredTeams.filter((team) => !team.isSimulated),
        ...model.mapTeams,
      ].map((team) => [team._id, team]),
    ).values(),
  );
  return (
    <div className="awWorkspace">
      <header className="awHeading">
        <span className="awHeadingIcon">
          <ClipboardList size={30} />
        </span>
        <div>
          <h1>Assignment Management</h1>
          <p>Coordinate incident assignments and track rescue deployments.</p>
        </div>
        <div className="awHeadingActions">
          <button
            aria-label="Refresh assignment workspace"
            disabled={model.busy}
            onClick={model.refresh}
          >
            <RefreshCw size={18} />
          </button>
          <button
            className="awPrimary"
            onClick={() => {
              const queue = document.getElementById("aw-queue-title");
              queue?.scrollIntoView({ block: "center", behavior: "instant" });
              queue?.focus();
            }}
          >
            <Plus size={19} />
            Create Assignment
          </button>
        </div>
      </header>
      {isDemoMode ? (
        <p className="awNotice">
          Assignments use persisted coordinator records. Exit demo mode and sign
          in to coordinate a response.
        </p>
      ) : (
        <>
          {model.error && (
            <div className="awError" role="alert">
              {model.error} Displayed records may be stale.{" "}
              <button onClick={model.refresh}>Retry</button>
            </div>
          )}
          {model.message && (
            <p
              role="status"
              className={model.uncertain ? "awError" : "awNotice"}
            >
              {model.message}
            </p>
          )}
          <div className="awMetrics">
            {metrics.map(({ label, caption, icon: Icon, color }, index) => (
              <article key={label} className={`awMetric ${color}`}>
                <span>
                  <Icon size={27} />
                </span>
                <div>
                  <h2>{label}</h2>
                  <strong>{model.snapshot?.metrics[index] ?? "—"}</strong>
                  <p>{caption}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="awGrid">
            <AssignmentQueue model={model} />
            <AssignmentDetail model={model} />
            <AssignmentRecords model={model} />
            <div className="awRight">
              <AssignmentCoverageMap
                incident={model.detail?.incident}
                teams={mapTeams}
                eligibleTeamIds={model.eligible.map((item) => item.team._id)}
                selectedTeam={model.selectedTeam}
                selectTeam={model.setSelectedTeam}
              />
              <AssignmentActivity model={model} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
