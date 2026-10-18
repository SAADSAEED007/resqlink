"use client";
export function MapFeedback({
  status,
  retry,
}: {
  status: "loading" | "ready" | "error";
  retry: () => void;
}) {
  if (status === "ready") return null;
  return (
    <div className="rqMapFeedback" role="status">
      <span>
        {status === "loading"
          ? "Loading basemap…"
          : "Basemap tiles could not load. Stored positions are preserved."}
      </span>
      {status === "error" && (
        <button type="button" onClick={retry}>
          Retry Map
        </button>
      )}
    </div>
  );
}
