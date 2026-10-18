import type { RescueTeam } from "@/types/api";
import {
  capabilityLabels,
  statusText,
  teamDate,
} from "@/components/rescue-teams/team-utils";
import { outsideOperationalRegion } from "./map-coordinates";

export function teamPopup(team: RescueTeam, eligible?: boolean) {
  const content = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = team.name;
  content.append(title);
  for (const text of [
    capabilityLabels(team),
    statusText[team.status] || "Status unavailable",
    team.location.address || "Base address not recorded",
    "Stored team base location · not live GPS",
    eligible === undefined
      ? ""
      : eligible
        ? "Eligible for manual selection"
        : "Not eligible for this assignment",
    team.updatedAt ? `Updated ${teamDate(team.updatedAt)}` : "",
    outsideOperationalRegion(team.location)
      ? "Outside the approximate Sindh operational extent"
      : "",
  ]) {
    if (!text) continue;
    const row = document.createElement("div");
    row.textContent = text;
    content.append(row);
  }
  return content;
}
