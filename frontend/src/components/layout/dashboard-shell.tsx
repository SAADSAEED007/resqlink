"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brand } from "./public-layout";
import { Badge, Button, ConfirmationDialog } from "@/components/ui";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/feedback/toast";
import { errorMessage } from "@/lib/api/client";
export function DashboardShell({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { user, logout } = useAuth();
  const router = useRouter();
  const toast = useToast();
  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await logout();
      toast("You have been signed out.");
      router.replace("/login");
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Brand inverse />
          <button
            className="mobile-toggle"
            onClick={() => setMenu(!menu)}
            aria-expanded={menu}
            aria-controls="command-navigation"
          >
            {menu ? "Close menu" : "Menu"}
          </button>
        </div>
        <nav
          id="command-navigation"
          aria-label="Command center"
          className={menu ? "sidebar-nav is-open" : "sidebar-nav"}
        >
          <p className="nav-caption">WORKSPACE</p>
          <Link
            href="/dashboard"
            aria-current="page"
            onClick={() => setMenu(false)}
          >
            <span aria-hidden="true">&#9638;</span> Overview
          </Link>
          {["Incidents", "Rescue Teams", "Assignments", "Operations Map"].map(
            (label) => (
              <button key={label} disabled>
                <span>{label}</span>
                <span className="soon">Soon</span>
              </button>
            ),
          )}
          <Link className="public-return" href="/">
            Public portal <span aria-hidden="true">&#8599;</span>
          </Link>
        </nav>
        <div className="sidebar-note">
          <span className="notice-dot" />
          <strong>Human decisions. Always.</strong>
          <p>
            Recommendations support coordinators. They never dispatch a rescue.
          </p>
        </div>
      </aside>
      <div className="dashboard-body">
        <header className="command-header">
          <div>
            <p className="label">RESQLINK / OPERATIONS</p>
            <span>Command Center</span>
          </div>
          <div className="account-controls">
            <Badge tone="warning">Simulation</Badge>
            <span className="account-name">{user?.name}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setError("");
                setConfirm(true);
              }}
            >
              Sign out
            </Button>
          </div>
        </header>
        <main id="main" className="dashboard-content">
          {children}
        </main>
        <footer className="command-footer">
          Decision-support prototype &middot; No real emergency dispatch
        </footer>
      </div>
      <ConfirmationDialog
        open={confirm}
        title="Sign out of ResQLink?"
        description="You will need to sign in again to access the Command Center."
        confirmLabel="Sign out"
        busy={busy}
        error={error}
        onClose={() => setConfirm(false)}
        onConfirm={() => void signOut()}
      />
    </div>
  );
}
