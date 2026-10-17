import type { Metadata } from "next";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";

export const metadata: Metadata = {
  title: "Emergency Operations Command Center | ResQLink",
  description:
    "Intelligent Disaster Response & Rescue Coordination Platform for Karachi - CODE//CONNECT'26",
};

export default function DashboardPage() {
  return <DashboardOverview />;
}
