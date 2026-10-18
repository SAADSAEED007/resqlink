import type { Metadata } from "next";
import { QuickSOSCorrected } from "@/components/sos/QuickSOSCorrected";
export const metadata: Metadata = {
  title: "Report an Emergency",
  description:
    "Share an emergency report with ResQLink's demonstration system. No account required. Not connected to official emergency dispatch services.",
};
export default function SosPage() {
  return <QuickSOSCorrected />;
}
