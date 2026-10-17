import type { Metadata } from "next";
import { IncidentManagement } from "@/components/dashboard/IncidentManagement";
export const instant = false;
export const metadata: Metadata = { title: "Incident Management | ResQLink" };
export default function IncidentsPage() { return <IncidentManagement />; }
