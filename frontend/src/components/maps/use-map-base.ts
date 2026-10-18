"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import type { Map as LeafletMap } from "leaflet";
import { useDashboardTheme } from "@/components/layout/dashboard-theme";
import { SINDH_CENTER, SINDH_ZOOM } from "./map-coordinates";

export const MAP_TILES = {
  light: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxNativeZoom: 19,
  },
  dark: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution:
      'Tiles &copy; <a href="https://www.esri.com">Esri</a>, HERE, Garmin, &copy; OpenStreetMap contributors, GIS user community',
    maxNativeZoom: 19,
  },
} as const;
const DARK_LABELS =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}";

export function useMapTiles(
  map: RefObject<LeafletMap | null>,
  ready: boolean,
  generation = 0,
  forcedTheme?: "light" | "dark",
) {
  const { theme: dashboardTheme } = useDashboardTheme();
  const theme = forcedTheme || dashboardTheme;
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    let remove: (() => void) | undefined;
    const timer = setTimeout(() => {
      if (active) setStatus("error");
    }, 12000);
    void import("leaflet")
      .then((L) => {
        if (!active || !map.current) return;
        setStatus("loading");
        let failed = false;
        const config = MAP_TILES[theme];
        const base = L.tileLayer(config.url, {
          attribution: config.attribution,
          maxNativeZoom: config.maxNativeZoom,
          maxZoom: 19,
          referrerPolicy: "strict-origin-when-cross-origin",
          updateWhenIdle: true,
          keepBuffer: 1,
        });
        const loaded = () => {
          clearTimeout(timer);
          if (active && !failed) setStatus("ready");
        };
        const error = () => {
          failed = true;
          clearTimeout(timer);
          if (active) setStatus("error");
        };
        base.on("load", loaded).on("tileerror", error).addTo(map.current);
        const labels =
          theme === "dark"
            ? L.tileLayer(DARK_LABELS, {
                maxNativeZoom: 19,
                maxZoom: 19,
                zIndex: 2,
                updateWhenIdle: true,
                keepBuffer: 1,
              })
                .on("tileerror", error)
                .addTo(map.current)
            : undefined;
        remove = () => {
          base.off();
          labels?.off();
          base.remove();
          labels?.remove();
        };
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
      clearTimeout(timer);
      remove?.();
    };
  }, [map, ready, theme, attempt, generation]);
  return {
    status,
    retry: () => {
      setStatus("loading");
      setAttempt((n) => n + 1);
    },
  };
}

export function useMapBase(
  container: RefObject<HTMLDivElement | null>,
  zoomControl = false,
  forcedTheme?: "light" | "dark",
) {
  const map = useRef<LeafletMap | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let observer: ResizeObserver | undefined;
    let frame = 0;
    void import("leaflet")
      .then((L) => {
        if (!active || !container.current) return;
        const instance = L.map(container.current, {
          center: SINDH_CENTER,
          zoom: SINDH_ZOOM,
          minZoom: 2,
          maxZoom: 19,
          zoomControl,
          scrollWheelZoom: false,
        });
        map.current = instance;
        observer = new ResizeObserver(() => {
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(() => {
            if (
              active &&
              container.current?.clientWidth &&
              container.current.clientHeight
            )
              instance.invalidateSize({
                pan: true,
                animate: false,
                debounceMoveend: true,
              });
          });
        });
        observer.observe(container.current);
        setReady(true);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, [container, zoomControl, attempt]);
  const tiles = useMapTiles(map, ready, 0, forcedTheme);
  return {
    map,
    ready,
    status: failed ? ("error" as const) : tiles.status,
    retry: () => {
      if (failed) {
        setFailed(false);
        setReady(false);
        setAttempt((n) => n + 1);
      } else tiles.retry();
    },
  };
}
