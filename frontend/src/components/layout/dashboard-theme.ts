"use client";
import { useSyncExternalStore } from "react";
const key = "resqlink:dashboard-theme";
const eventName = "resqlink:dashboard-theme-change";
let storageUnavailable = false;
let fallback: "light" | "dark" = "light";
function snapshot(): "light" | "dark" {
  if (storageUnavailable) return fallback;
  try {
    const stored = localStorage.getItem(key);
    return stored === "dark" || stored === "light" ? stored : fallback;
  } catch {
    return fallback;
  }
}
function subscribe(listener: () => void) {
  window.addEventListener(eventName, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(eventName, listener);
    window.removeEventListener("storage", listener);
  };
}
export function useDashboardTheme() {
  const theme = useSyncExternalStore(
    subscribe,
    snapshot,
    () => "light" as const,
  );
  function toggleTheme() {
    fallback = theme === "light" ? "dark" : "light";
    try {
      localStorage.setItem(key, fallback);
      storageUnavailable = false;
    } catch {
      storageUnavailable = true;
      /* Keep toggling in memory when storage is unavailable. */
    }
    window.dispatchEvent(new Event(eventName));
  }
  return { theme, toggleTheme };
}
