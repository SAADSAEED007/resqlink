"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
type Toast = { id: number; message: string; tone: "success" | "error" };
const Context = createContext<
  ((message: string, tone?: Toast["tone"]) => void) | null
>(null);
function ToastItem({
  toast,
  dismiss,
}: {
  toast: Toast;
  dismiss: (id: number) => void;
}) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(
      () => dismiss(toast.id),
      toast.tone === "error" ? 10000 : 6000,
    );
    return () => clearTimeout(timer);
  }, [toast, dismiss, paused]);
  return (
    <div
      className={`toast toast-${toast.tone}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <p role={toast.tone === "error" ? "alert" : "status"}>{toast.message}</p>
      <button
        aria-label="Dismiss notification"
        onClick={() => dismiss(toast.id)}
      >
        &times;
      </button>
    </div>
  );
}
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback(
    (id: number) =>
      setToasts((items) => items.filter((item) => item.id !== id)),
    [],
  );
  const show = useCallback(
    (message: string, tone: Toast["tone"] = "success") =>
      setToasts((items) => [
        ...items.slice(-3),
        { id: Date.now() + Math.random(), message, tone },
      ]),
    [],
  );
  return (
    <Context.Provider value={show}>
      {children}
      <div className="toast-region" aria-label="Notifications">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} dismiss={dismiss} />
        ))}
      </div>
    </Context.Provider>
  );
}
export function useToast() {
  const value = useContext(Context);
  if (!value) throw new Error("useToast requires ToastProvider");
  return value;
}
