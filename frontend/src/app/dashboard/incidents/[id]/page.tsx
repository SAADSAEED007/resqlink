import { Suspense } from "react";
import type { Metadata } from "next";
import { IncidentWorkspace } from "@/components/dashboard/incident-detail/IncidentWorkspace";

export const instant = false;
export const metadata: Metadata = { title: "Incident Command | ResQLink" };
export default function IncidentPage() {
  return <Suspense fallback={<p role="status">Loading incident workspace…</p>}><IncidentWorkspace /></Suspense>;
}
