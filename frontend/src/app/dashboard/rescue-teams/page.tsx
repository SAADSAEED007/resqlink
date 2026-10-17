import type { Metadata } from "next";
import { RescueTeamsWorkspace } from "@/components/rescue-teams/RescueTeamsWorkspace";
export const instant = false;
export const metadata: Metadata = { title: "Rescue Team Management | ResQLink" };
export default function RescueTeamsPage() { return <RescueTeamsWorkspace/>; }
