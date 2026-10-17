import Link from "next/link";
import { PublicLayout } from "@/components/layout/public-layout";
import { EmptyState, buttonStyles } from "@/components/ui";
export default function NotFound() {
  return (
    <PublicLayout compact>
      <EmptyState
        title="Page not found"
        description="This page may have moved or is not available yet."
        action={
          <Link href="/" className={buttonStyles()}>
            Return home
          </Link>
        }
      />
    </PublicLayout>
  );
}
