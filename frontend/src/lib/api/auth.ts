import { ApiError, request } from "./client";
import type { SessionUser } from "@/types/api";
function profile(value: unknown): SessionUser {
  if (
    !value ||
    typeof value !== "object" ||
    !("_id" in value) ||
    typeof value._id !== "string" ||
    !("name" in value) ||
    typeof value.name !== "string" ||
    !("email" in value) ||
    typeof value.email !== "string" ||
    !("role" in value) ||
    (value.role !== "admin" && value.role !== "user")
  )
    throw new ApiError(
      "The service returned an invalid account profile.",
      0,
      "protocol",
    );
  return {
    _id: value._id,
    name: value.name,
    email: value.email,
    role: value.role,
  };
}
export const auth = {
  session: async (signal?: AbortSignal) =>
    profile(
      await request<unknown>("/user/me", {
        auth: true,
        protected: false,
        signal,
      }),
    ),
  login: async (email: string, password: string) => {
    // The legacy response also includes tokens. Deliberately discard them; only cookies authenticate requests.
    await request<unknown>("/login", {
      method: "POST",
      body: { email, password },
      auth: true,
      protected: false,
    });
    return auth.session(); // Verify the browser accepted the cookie before reporting success.
  },
  logout: () =>
    request<null>("/logout", { method: "PUT", auth: true, protected: false }),
};
