import type { Metadata } from "next";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";

// This route depends on a client-side authenticated session and live polling.
// It cannot participate in Next's static instant-navigation validation.
export const instant = false;

export const metadata: Metadata = {
  title: "Emergency Operations Command Center | ResQLink",
  description:
    "Intelligent Disaster Response & Rescue Coordination Platform for Karachi - CODE//CONNECT'26",
};

export default function DashboardPage() {
  return <DashboardOverview />;
}
