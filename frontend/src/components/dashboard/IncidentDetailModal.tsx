"use client";

import type { Incident } from "@/types/api";
import { IncidentQuickPreview } from "./IncidentQuickPreview";

/**
 * IncidentDetailModal (Refactored to IncidentQuickPreview)
 *
 * Formerly an oversized, full-page scrolling modal inside the overview.
 * Now renders the concise, responsive Incident Quick Preview Drawer while
 * preserving full compatibility with existing call sites.
 */
export function IncidentDetailModal({
  incident,
  onClose,
}: {
  incident: Incident | null;
  onClose: () => void;
  onUpdateStatus?: (id: string, status: Incident["status"]) => void;
}) {
  return <IncidentQuickPreview incident={incident} onClose={onClose} />;
}

export { IncidentQuickPreview };
