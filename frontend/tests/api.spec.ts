import { test, expect } from "@playwright/test";
import { request, ApiError } from "../src/lib/api/client";
const original = globalThis.fetch;
test.afterEach(() => {
  globalThis.fetch = original;
});
test("unwraps successful data and includes credentials", async () => {
  let init: RequestInit | undefined;
  globalThis.fetch = async (_url, options) => {
    init = options;
    return Response.json({ success: true, data: { id: "test" } });
  };
  expect(await request("/incidents")).toEqual({ id: "test" });
  expect(init?.credentials).toBe("include");
  expect(init?.cache).toBe("no-store");
});
for (const status of [400, 401, 403, 404, 409, 429, 500])
  test(`handles ${status} without leaking server details`, async () => {
    globalThis.fetch = async () =>
      Response.json({ message: "sensitive internal details" }, { status });
    const error = await request("/incidents").catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(status);
    expect((error as ApiError).message).not.toContain("sensitive");
  });
test("handles network failure and invalid response envelopes", async () => {
  globalThis.fetch = async () => {
    throw new TypeError("fetch failed");
  };
  await expect(request("/incidents")).rejects.toMatchObject({
    code: "network",
  });
  globalThis.fetch = async () => Response.json({ success: false, data: {} });
  await expect(request("/incidents")).rejects.toMatchObject({
    code: "protocol",
  });
});
test("distinguishes timeout and caller cancellation", async () => {
  globalThis.fetch = async (_url, options) =>
    new Promise((_resolve, reject) => {
      if (options?.signal?.aborted) reject(new Error("abort"));
      else
        options?.signal?.addEventListener("abort", () =>
          reject(new Error("abort")),
        );
    });
  await expect(request("/incidents", { timeoutMs: 10 })).rejects.toMatchObject({
    code: "timeout",
  });
  const controller = new AbortController();
  controller.abort();
  await expect(
    request("/incidents", { signal: controller.signal }),
  ).rejects.toMatchObject({ code: "aborted" });
});
