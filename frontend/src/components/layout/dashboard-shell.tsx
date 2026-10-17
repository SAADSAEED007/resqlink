"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { ConfirmationDialog } from "@/components/ui";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/feedback/toast";
import { errorMessage } from "@/lib/api/client";
import { useDashboard } from "@/components/dashboard/dashboard-context";
import {
  Moon,
  Sun,
  Home,
  AlertTriangle,
  Users,
  ClipboardList,
  MapPin,
  BarChart3,
  Settings,
  Search,
  Bell,
  LogOut,
  X,
} from "lucide-react";
import "./command-center.css";
import { useDashboardTheme } from "./dashboard-theme";

export function DashboardShell({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useDashboardTheme();
  const [menu, setMenu] = useState(false);
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    if (menu)
      navigation.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [menu]);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showAlerts, setShowAlerts] = useState(false);

  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const { searchQuery, setSearchQuery, setSelectedIncident, incidents } =
    useDashboard();

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await logout();
      toast("You have been signed out.");
      router.replace("/login");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const criticalIncidents = incidents.filter(
    (i) =>
      i.priorityLevel === "CRITICAL" &&
      i.status !== "RESOLVED" &&
      i.status !== "CANCELLED",
  );

  const navItems = [
    { label: "Overview", href: "/dashboard", icon: Home, active: true },
    {
      label: "Community Risk Zones",
      href: "/dashboard/risk-zones",
      icon: MapPin,
    },
    {
      label: "Incidents",
      href: "/dashboard/incidents",
      icon: AlertTriangle,
    },
    {
      label: "Rescue Teams",
      href: "/dashboard/rescue-teams",
      icon: Users,
    },
    {
      label: "Assignments",
      href: "/dashboard/assignments",
      icon: ClipboardList,
      soon: true,
    },
    {
      label: "Operations Map",
      href: "/dashboard/map",
      icon: MapPin,
      soon: true,
    },
    {
      label: "Analytics",
      href: "/dashboard/analytics",
      icon: BarChart3,
      soon: true,
    },
    {
      label: "Settings",
      href: "/dashboard/settings",
      icon: Settings,
      soon: true,
    },
  ];

  // Derive user initials
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "C";

  const displayName = user?.name || "Coordinator";
  const displayRole =
    user?.role === "admin" ? "Operations Lead" : "Coordinator";

  return (
    <div className="dashboard-shell rqCommand" data-theme={theme}>
      <aside className="sidebar rqCommandSidebar">
        <Link
          href="/dashboard"
          className="rqCommandLogo"
          aria-label="ResQLink command center"
        >
          <Image
            src="/images/ResQLink Shield Brand Logo.png"
            alt="ResQLink"
            width={2172}
            height={724}
            sizes="168px"
            priority
          />
        </Link>
        <span className="rqCommandPrototype">Simulation / Prototype</span>
        <button
          className="mobile-toggle rqCommandMenu"
          onClick={() => setMenu(true)}
          aria-expanded={menu}
          aria-controls="command-navigation"
        >
          Menu
        </button>
        <nav
          ref={navigation}
          id="command-navigation"
          aria-label="Command center"
          className={`sidebar-nav ${menu ? "is-open" : ""}`}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setMenu(false);
              document
                .querySelector<HTMLButtonElement>(".rqCommandMenu")
                ?.focus();
            }
          }}
        >
          <button
            className="rqCommandClose"
            onClick={() => {
              setMenu(false);
              document
                .querySelector<HTMLButtonElement>(".rqCommandMenu")
                ?.focus();
            }}
          >
            Close menu
          </button>
          {navItems.map(({ label, href, icon: Icon, soon }) =>
            soon ? (
              <button key={label} disabled>
                <Icon size={18} />
                <span>{label}</span>
                <small>Soon</small>
              </button>
            ) : (
              <Link
                key={label}
                href={href}
                aria-current={pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`)) ? "page" : undefined}
                onClick={() => setMenu(false)}
              >
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            ),
          )}
          <Link href="/" className="public-return">
            Public Portal <span aria-hidden="true">&#8599;</span>
          </Link>
          <p className="rqCommandNavNote">
            Decision support for project coordinators. Not connected to official
            emergency dispatch.
          </p>
        </nav>
        <div className="rqCommandPromo">
          <Image src="/images/rescue-sidebar.jpg" alt="Rescue workers helping communities" fill sizes="220px" className="object-cover" />
          <div>
            <p>Stronger Communities<br />Safer Tomorrows</p>
            <span aria-hidden="true" />
            <small>People | Technology | Faster Response</small>
          </div>
        </div>
      </aside>
      <div className="dashboard-body">
        <header className="command-header">
          <div className="rqCommandHeading">
            <h1>Command Center</h1>
            <p>Emergency Operations</p>
          </div>
          {pathname === "/dashboard" && (<div className="rqCommandSearch">
            <Search size={17} aria-hidden="true" />
            <input
              aria-label="Search locations, incidents, teams"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search locations, incidents, teams..."
            />
            {searchQuery && (
              <button
                aria-label="Clear search"
                onClick={() => setSearchQuery("")}
              >
                <X size={16} />
              </button>
            )}
          </div>)}
          <div className="rqCommandAccount">
            <button
              className="rqCommandIcon"
              onClick={toggleTheme}
              aria-label={
                theme === "light"
                  ? "Switch to dark mode"
                  : "Switch to light mode"
              }
              title={
                theme === "light"
                  ? "Switch to dark mode"
                  : "Switch to light mode"
              }
            >
              {theme === "light" ? (
                <Moon size={18} aria-hidden="true" />
              ) : (
                <Sun size={18} aria-hidden="true" />
              )}
            </button>
            <div className="rqCommandAlerts">
              <button
                className="rqCommandIcon"
                title="Emergency alerts"
                aria-label="Open emergency alerts"
                aria-expanded={showAlerts}
                onClick={() => setShowAlerts(!showAlerts)}
              >
                <Bell size={19} />
                {criticalIncidents.length > 0 && (
                  <sup>{criticalIncidents.length}</sup>
                )}
              </button>
              {showAlerts && (
                <section
                  className="rqCommandAlertPanel"
                  aria-label="Critical alerts"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setShowAlerts(false);
                  }}
                >
                  <div>
                    <strong>
                      Critical alerts ({criticalIncidents.length})
                    </strong>
                    <button
                      aria-label="Close alerts"
                      onClick={() => setShowAlerts(false)}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  {criticalIncidents.length === 0 ? (
                    <p>No unresolved critical alerts.</p>
                  ) : (
                    criticalIncidents.map((inc) => (
                      <button
                        key={inc._id}
                        onClick={() => {
                          setSelectedIncident(inc);
                          setShowAlerts(false);
                        }}
                      >
                        {inc.description}
                        <small>
                          {inc.location?.address || "Location unverified"}
                        </small>
                      </button>
                    ))
                  )}
                </section>
              )}
            </div>
            <span className="rqCommandAvatar">{initials}</span>
            <div className="rqCommandUser">
              <strong className="account-name">{displayName}</strong>
              <small>{displayRole}</small>
            </div>
            <button
              className="rqCommandIcon"
              title="Sign out"
              aria-label="Sign out"
              onClick={() => {
                setError("");
                setConfirm(true);
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main id="main" className="dashboard-content">
          {children}
        </main>
        <footer className="command-footer">
          ResQLink &middot; Prototype decision support &middot; Human
          confirmation required
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
