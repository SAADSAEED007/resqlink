export const SESSION_EXPIRED_EVENT = "resqlink:session-expired";
export type ApiErrorCode =
  | "http"
  | "network"
  | "timeout"
  | "aborted"
  | "protocol"
  | "configuration";
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code: ApiErrorCode = "http",
  ) {
    super(message);
    this.name = "ApiError";
  }
}
const messages: Record<number, string> = {
  400: "Check the submitted details and try again.",
  401: "Your session has expired. Please sign in again.",
  403: "This action requires coordinator access.",
  404: "This record could not be found.",
  409: "This record has changed or is no longer available. Refresh and try again.",
  429: "Too many requests. Please wait a moment before trying again.",
};
export function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "Something went wrong. Please try again.";
}
export function apiBase(auth = false) {
  const core =
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV !== "production" ? "http://localhost:4000/api" : "");
  if (!core)
    throw new ApiError(
      "The service address has not been configured.",
      0,
      "configuration",
    );
  if (!auth) return core.replace(/\/$/, "");
  return (
    process.env.NEXT_PUBLIC_AUTH_URL || `${core.replace(/\/api\/?$/, "")}/v1`
  ).replace(/\/$/, "");
}
export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT";
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
  auth?: boolean;
  protected?: boolean;
}
export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const url = `${apiBase(options.auth)}${path}`;
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  if (options.signal?.aborted) cancel();
  options.signal?.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? 15000);
  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
      headers:
        options.body === undefined
          ? { Accept: "application/json" }
          : { Accept: "application/json", "Content-Type": "application/json" },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    if (!response.ok) {
      if (
        response.status === 401 &&
        options.protected !== false &&
        typeof window !== "undefined"
      )
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      throw new ApiError(
        messages[response.status] ??
          "The service is temporarily unavailable. Please try again.",
        response.status,
      );
    }
    const result: unknown = await response.json();
    if (
      !result ||
      typeof result !== "object" ||
      !("success" in result) ||
      result.success !== true ||
      !("data" in result)
    )
      throw new ApiError(
        "The service returned an unexpected response.",
        response.status,
        "protocol",
      );
    return result.data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (timedOut)
      throw new ApiError(
        "The request took too long. Please try again.",
        0,
        "timeout",
      );
    if (controller.signal.aborted)
      throw new ApiError("Request cancelled.", 0, "aborted");
    if (error instanceof SyntaxError)
      throw new ApiError(
        "The service returned an unexpected response.",
        0,
        "protocol",
      );
    throw new ApiError(
      "Unable to reach the service. Check your connection and try again.",
      0,
      "network",
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", cancel);
  }
}
export function queryString(query: object) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) params.set(key, String(value));
  });
  return params.size ? `?${params}` : "";
}
