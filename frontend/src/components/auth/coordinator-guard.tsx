"use client";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";
import { Button, ErrorState, LoadingSpinner } from "@/components/ui";
import { useToast } from "@/components/feedback/toast";
import { errorMessage } from "@/lib/api/client";
export function CoordinatorGuard({ children }: { children: ReactNode }) {
  const session = useAuth();
  const router = useRouter();
  const toast = useToast();
  useEffect(() => {
    if (session.status === "anonymous")
      router.replace(session.expired ? "/login?reason=expired" : "/login");
  }, [session.status, session.expired, router]);
  if (session.status === "loading" || session.status === "anonymous")
    return (
      <main id="main" className="session-state">
        <LoadingSpinner label="Checking your session..." />
      </main>
    );
  if (session.status === "error")
    return (
      <main id="main" className="session-state">
        <ErrorState
          title="Connection unavailable"
          message={session.error}
          action={
            <Button onClick={() => void session.refresh()}>Try again</Button>
          }
        />
      </main>
    );
  if (session.user?.role !== "admin")
    return (
      <main id="main" className="session-state">
        <ErrorState
          title="Coordinator access required"
          message="This account does not have the admin role. Ask your project administrator for access."
          action={
            <Button
              onClick={() =>
                void session
                  .logout()
                  .catch((error) => toast(errorMessage(error), "error"))
              }
            >
              Sign out
            </Button>
          }
        />
      </main>
    );
  return children;
}
