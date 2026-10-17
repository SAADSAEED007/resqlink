"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brand, PrototypeNotice } from "@/components/layout/public-layout";
import { Button, FormField, Input } from "@/components/ui";
import { useAuth } from "@/components/auth/auth-provider";
import { ApiError, errorMessage } from "@/lib/api/client";
export function LoginForm() {
  const session = useAuth();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<{ email?: string; password?: string }>(
    {},
  );
  useEffect(() => {
    if (session.status === "authenticated" && session.user?.role === "admin")
      router.replace("/dashboard");
  }, [session.status, session.user?.role, router]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const errors = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? undefined
        : "Enter a valid email address.",
      password: password ? undefined : "Enter your password.",
    };
    setFields(errors);
    setError("");
    if (errors.email || errors.password) {
      (
        form.elements.namedItem(
          errors.email ? "email" : "password",
        ) as HTMLInputElement
      )?.focus();
      return;
    }
    setBusy(true);
    try {
      const user = await session.login(email, password);
      if (user.role === "admin") router.replace("/dashboard");
      else
        setError(
          "This account does not have coordinator access. Contact your project administrator.",
        );
    } catch (error) {
      setError(
        error instanceof ApiError && [400, 401, 404].includes(error.status)
          ? "Sign-in could not be verified. Check your email and password and ensure cookies are enabled."
          : errorMessage(error),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-layout">
      <aside className="login-story">
        <Brand inverse />
        <div>
          <span className="login-cross" aria-hidden="true">
            +
          </span>
          <h2>
            Clarity when
            <br />
            it matters most.
          </h2>
          <p>
            Bring urgent needs, available resources, and human decisions into
            one shared picture.
          </p>
        </div>
        <p className="login-story-footer">RESQLINK / COORDINATOR WORKSPACE</p>
      </aside>
      <div className="login-main">
        <Link href="/" className="text-link back-link">
          &larr; Back to public portal
        </Link>
        <main id="main" className="login-form-wrap">
          <div className="mobile-brand">
            <Brand />
          </div>
          <p className="section-label">COMMAND CENTER</p>
          <h1>Coordinator Login</h1>
          <p className="muted login-intro">
            Sign in to your authorized coordinator account.
          </p>
          {session.expired && (
            <p role="status" className="inline-notice">
              Your session expired. Please sign in again.
            </p>
          )}
          <form onSubmit={submit} noValidate className="login-form">
            <FormField label="Email address" required error={fields.email}>
              {(props) => (
                <Input
                  {...props}
                  name="email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  placeholder="you@organization.org"
                  disabled={busy}
                />
              )}
            </FormField>
            <FormField label="Password" required error={fields.password}>
              {(props) => (
                <div className="password-field">
                  <Input
                    {...props}
                    name="password"
                    type={visible ? "text" : "password"}
                    autoComplete="current-password"
                    disabled={busy}
                  />
                  <button
                    type="button"
                    aria-label={visible ? "Hide password" : "Show password"}
                    aria-pressed={visible}
                    onClick={() => setVisible(!visible)}
                  >
                    {visible ? "Hide" : "Show"}
                  </button>
                </div>
              )}
            </FormField>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Button
              type="submit"
              size="lg"
              loading={busy}
              loadingLabel="Signing in"
              className="w-full"
            >
              Sign in <span aria-hidden="true">&#8599;</span>
            </Button>
          </form>
          <p className="login-help">
            Access is managed by your project administrator.
            <br />A coordinator account requires the admin role.
          </p>
          {session.user?.role === "user" && (
            <Button
              variant="ghost"
              onClick={() =>
                void session
                  .logout()
                  .catch((error) => setError(errorMessage(error)))
              }
            >
              Sign out of this account
            </Button>
          )}
        </main>
        <div className="login-disclaimer">
          <PrototypeNotice />
        </div>
      </div>
    </div>
  );
}
