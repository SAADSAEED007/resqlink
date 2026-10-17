import Link from "next/link";
import type { Metadata } from "next";
import { PublicLayout } from "@/components/layout/public-layout";
import { Card, EmptyState, buttonStyles } from "@/components/ui";
export const metadata: Metadata = { title: "Citizen Portal" };
// Teammate 2 owns the SOS form and submission flow. No submission is simulated here.
export default function SosPage() {
  return (
    <PublicLayout compact>
      <div className="page-heading">
        <p className="section-label">CITIZEN PORTAL</p>
        <h1>A clearer way to ask for help.</h1>
      </div>
      <Card>
        <EmptyState
          title="The request portal is coming soon"
          description="Requests cannot be submitted from this page yet. For a real emergency, contact your local emergency services directly."
          action={
            <Link href="/" className={buttonStyles("outline")}>
              Back to public portal
            </Link>
          }
        />
      </Card>
    </PublicLayout>
  );
}
