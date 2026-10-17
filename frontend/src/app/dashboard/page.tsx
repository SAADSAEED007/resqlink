import type { Metadata } from "next";
import { Card, EmptyState } from "@/components/ui";
export const metadata: Metadata = { title: "Command Center" };
// Teammate 1 owns this route's incident workspace. The shared layout provides authentication and navigation.
export default function DashboardPage() {
  return (
    <>
      <div className="page-heading">
        <p className="section-label">WORKSPACE OVERVIEW</p>
        <h1>Ready for a clearer response.</h1>
        <p className="muted">
          A shared space for human-led rescue coordination.
        </p>
      </div>
      <Card>
        <EmptyState
          title="Your operational workspace is coming next"
          description="Incident review, rescue teams, and assignment tools are not available in this version. No emergency requests or dispatches can be managed here yet."
        />
      </Card>
      <div className="workspace-note">
        <strong>Simulation environment</strong>
        <p>
          Use this prototype for demonstration only. Any future recommendations
          require coordinator review.
        </p>
      </div>
    </>
  );
}
