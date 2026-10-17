import type { Metadata } from "next";
import { RiskZonesWorkspace } from "@/components/risk-zones/RiskZonesWorkspace";
export const metadata: Metadata = { title: "Community Risk Zones | ResQLink" };
export default function RiskZonesPage() {
  return <RiskZonesWorkspace />;
}
