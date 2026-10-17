"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { ConfirmationDialog } from "@/components/ui";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/feedback/toast";
import { errorMessage } from "@/lib/api/client";
import { useDashboard } from "@/components/dashboard/dashboard-context";
import {
  Activity,
  Home,
  AlertTriangle,
  Users,
  ClipboardList,
  MapPin,
  BarChart3,
  Settings,
  Search,
  CloudRain,
  Bell,
  LogOut,
  X,
} from "lucide-react";

export function DashboardShell({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showAlerts, setShowAlerts] = useState(false);

  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const { searchQuery, setSearchQuery, stats, setSelectedIncident, incidents } =
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
    (i) => i.priorityLevel === "CRITICAL" && i.status !== "RESOLVED",
  );

  const navItems = [
    { label: "Overview", href: "/dashboard", icon: Home, active: true },
    { label: "Incidents", href: "/dashboard/incidents", icon: AlertTriangle, soon: true },
    { label: "Rescue Teams", href: "/dashboard/teams", icon: Users, soon: true },
    { label: "Assignments", href: "/dashboard/assignments", icon: ClipboardList, soon: true },
    { label: "Operations Map", href: "/dashboard/map", icon: MapPin, soon: true },
    { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3, soon: true },
    { label: "Settings", href: "/dashboard/settings", icon: Settings, soon: true },
  ];

  // Derive user initials
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "AH";

  const displayName = user?.name || "Ayesha Khan";
  const displayRole = user?.role === "admin" ? "Operations Lead" : "Coordinator";

  return (
    <div className="dashboard-shell bg-[#061425] text-[#EAF3FF] min-h-screen flex flex-col md:grid md:grid-cols-[260px_minmax(0,1fr)]">
      {/* ────────────────────────────────────────────────────────
          SIDEBAR
      ──────────────────────────────────────────────────────── */}
      <aside className="sidebar bg-[#07182B] border-r border-[#162B42] flex flex-col justify-between p-4 sticky top-0 h-auto md:h-screen z-30">
        <div>
          {/* Logo & Simulation Badge */}
          <div className="sidebar-brand px-1">
            <div className="flex items-center justify-between">
              <Link href="/dashboard" className="flex items-center gap-2.5 group">
                <span className="w-8 h-8 rounded-lg bg-[#2378F6] flex items-center justify-center text-white font-bold shadow-md shadow-[#2378F6]/30">
                  <Activity className="w-5 h-5" />
                </span>
                <div>
                  <span className="text-xl font-bold tracking-tight text-white block">
                    ResQ<span className="text-[#2378F6]">Link</span>
                  </span>
                </div>
              </Link>

              {/* Mobile toggle button (accessible names 'Menu' and 'Close menu' for existing tests) */}
              <button
                className="mobile-toggle md:hidden p-2 text-[#91A8C2] hover:text-white"
                onClick={() => setMenu(!menu)}
                aria-expanded={menu}
                aria-controls="command-navigation"
              >
                {menu ? "Close menu" : "Menu"}
              </button>
            </div>

            <p className="text-[11px] text-[#91A8C2] mt-1">
              Faster Response. Safer Communities.
            </p>

            <div className="mt-2.5">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F04452]/15 text-[#F04452] border border-[#F04452]/30">
                Simulation / Prototype
              </span>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav
            id="command-navigation"
            aria-label="Command center"
            className={`${menu ? "is-open flex" : "hidden"} md:flex flex-col gap-1.5 mt-6 sidebar-nav`}
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isCurrent = item.href === "/dashboard" && pathname === "/dashboard";

              if (item.soon) {
                return (
                  <button
                    key={item.label}
                    disabled
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-[#91A8C2] hover:bg-[#10253F] hover:text-[#EAF3FF] transition-colors group cursor-not-allowed opacity-75"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-[#627D98] group-hover:text-[#91A8C2]" />
                      <span>{item.label}</span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#122A45] text-[#627D98] border border-[#1E344D]">
                      Soon
                    </span>
                  </button>
                );
              }

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={isCurrent ? "page" : undefined}
                  onClick={() => setMenu(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isCurrent
                      ? "bg-[#2378F6] text-white shadow-md shadow-[#2378F6]/25"
                      : "text-[#91A8C2] hover:bg-[#10253F] hover:text-[#EAF3FF]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <div className="pt-2 border-t border-[#162B42] mt-2">
              <Link
                href="/"
                className="public-return flex items-center justify-between px-3.5 py-2 rounded-xl text-xs text-[#91A8C2] hover:text-[#EAF3FF] hover:bg-[#10253F] transition-colors"
              >
                <span>Public Portal</span>
                <span aria-hidden="true">&#8599;</span>
              </Link>
            </div>
          </nav>
        </div>

        {/* Sidebar Bottom Promotional Rescue Image Card */}
        <div className="hidden md:block mt-auto pt-4">
          <div className="relative rounded-2xl overflow-hidden border border-[#203650] h-52 shadow-xl group">
            <Image
              src="/images/rescue-sidebar.jpg"
              alt="ResQLink rescue teams helping civilians in urban floodwaters"
              fill
              priority
              loading="eager"
              sizes="240px"
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
            {/* Subtle Gradient Overlay for high text legibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#061425] via-[#07182B]/60 to-transparent" />

            {/* Overlay Copy */}
            <div className="absolute bottom-3 left-3.5 right-3.5">
              <p className="text-sm font-bold text-white leading-tight drop-shadow-md">
                Stronger Communities.
                <br />
                Safer Tomorrows.
              </p>
              <p className="text-[10px] text-[#91A8C2] mt-1 tracking-wide font-medium">
                People &bull; Technology &bull; Faster Response
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* ────────────────────────────────────────────────────────
          MAIN WORKSPACE BODY
      ──────────────────────────────────────────────────────── */}
      <div className="dashboard-body flex flex-col min-w-0 bg-[#061425]">
        {/* TOP COMMAND HEADER */}
        <header className="command-header bg-[#07182B]/85 backdrop-blur-md border-b border-[#162B42] p-4 lg:px-6 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-20">
          {/* Header Title + Pulse Icon */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-[#2378F6]/15 border border-[#2378F6]/30 flex items-center justify-center shrink-0 text-[#2378F6] shadow-sm shadow-[#2378F6]/20">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-[#EAF3FF] tracking-tight leading-tight whitespace-nowrap">
                Emergency Operations Command Center
              </h1>
              <p className="text-[11px] text-[#91A8C2] hidden sm:block">
                AI-powered coordination for a safer, more resilient Karachi.
              </p>
            </div>
          </div>

          {/* Search, Weather, Notifications, and Profile */}
          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
            {/* Meaningful Search Input */}
            <div className="relative flex-1 sm:w-64 md:w-72">
              <Search className="w-4 h-4 text-[#627D98] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search locations, incidents, teams..."
                className="w-full bg-[#061425] border border-[#203650] focus:border-[#2378F6] rounded-xl pl-9 pr-3 py-1.5 text-xs text-[#EAF3FF] placeholder-[#627D98] outline-none transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#91A8C2] hover:text-white"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Weather / Operational Indicator */}
            <div
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#061425] border border-[#203650] text-xs text-[#EAF3FF] shrink-0"
              title="Monsoon weather feed &bull; Karachi Operations Center"
            >
              <CloudRain className="w-4 h-4 text-[#2378F6]" />
              <span className="font-medium text-[#91A8C2]">Karachi</span>
              <span className="font-bold">28&deg;C</span>
              <span className="text-[11px] text-[#627D98]">Light Rain</span>
            </div>

            {/* Notification Alert Bell */}
            <div className="relative">
              <button
                onClick={() => setShowAlerts(!showAlerts)}
                className="w-8 h-8 rounded-xl bg-[#061425] hover:bg-[#122A45] border border-[#203650] flex items-center justify-center text-[#EAF3FF] transition-colors relative"
                aria-label="Open emergency alerts"
              >
                <Bell className="w-4 h-4" />
                {stats.criticalCases > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#F04452] text-white text-[9px] font-bold flex items-center justify-center shadow-md shadow-[#F04452]/50 animate-pulse">
                    {stats.criticalCases}
                  </span>
                )}
              </button>

              {/* Alerts Dropdown Drawer */}
              {showAlerts && (
                <div className="absolute right-0 top-10 w-72 sm:w-80 bg-[#07182B] border border-[#203650] rounded-xl shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between pb-2 border-b border-[#162B42]">
                    <span className="text-xs font-bold text-[#EAF3FF] flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#F04452]" />
                      Active Critical Alerts ({criticalIncidents.length})
                    </span>
                    <button
                      onClick={() => setShowAlerts(false)}
                      className="text-[#91A8C2] hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="py-2 space-y-2 max-h-52 overflow-y-auto custom-scrollbar">
                    {criticalIncidents.length === 0 ? (
                      <p className="text-xs text-[#91A8C2] py-2 text-center">
                        No unresolved critical alerts.
                      </p>
                    ) : (
                      criticalIncidents.map((inc) => (
                        <div
                          key={inc._id}
                          onClick={() => {
                            setSelectedIncident(inc);
                            setShowAlerts(false);
                          }}
                          className="p-2 rounded-lg bg-[#061425] hover:bg-[#122A45] border border-[#162B42] cursor-pointer transition-colors"
                        >
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="font-bold text-[#F04452]">CRITICAL</span>
                            <span className="text-[#627D98]">
                              {inc.location?.address || "Karachi"}
                            </span>
                          </div>
                          <p className="text-xs text-[#EAF3FF] font-medium truncate">
                            {inc.description}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Avatar & Sign Out */}
            <div className="flex items-center gap-2 pl-1 border-l border-[#162B42]">
              <div className="w-8 h-8 rounded-full bg-[#122A45] border border-[#2378F6]/40 flex items-center justify-center text-xs font-bold text-[#2378F6] shrink-0">
                {initials}
              </div>
              <div className="hidden sm:block text-left pr-1">
                <span className="account-name text-xs font-bold text-[#EAF3FF] block leading-tight">
                  {displayName}
                </span>
                <span className="text-[10px] text-[#91A8C2] block">
                  {displayRole}
                </span>
              </div>
              <button
                onClick={() => {
                  setError("");
                  setConfirm(true);
                }}
                className="p-1.5 rounded-lg bg-[#061425] hover:bg-[#F04452]/20 hover:text-[#F04452] text-[#91A8C2] border border-[#203650] transition-colors"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </header>

        {/* MAIN DASHBOARD CONTENT */}
        <main id="main" className="dashboard-content flex-1 p-4 lg:p-5 max-w-[1720px] w-full mx-auto">
          {children}
        </main>

        {/* FOOTER */}
        <footer className="command-footer border-t border-[#162B42] py-3 px-6 text-center text-xs text-[#627D98]">
          ResQLink Operations Command Center &middot; Simulated flood scenario for CODE//CONNECT&rsquo;26 &middot; Human-confirmed decision support
        </footer>
      </div>

      {/* Sign Out Confirmation Dialog */}
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
