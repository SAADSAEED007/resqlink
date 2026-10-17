"use client";
import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { PrototypeNotice } from "@/components/layout/public-layout";
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
        <div className="login-brand-lockup">
          <Image
            src="/images/ResQLink Shield Brand Logo.png"
            alt="ResQLink — People, Response, Safer Sindh"
            width={242}
            height={81}
            priority
          />
        </div>
        <div className="login-story-content">
          <p className="login-kicker">COORDINATED RESPONSE / SINDH</p>
          <h2>
            Decisions with
            <br />
            clarity when
            <br />
            every minute matters.
          </h2>
          <p>
            ResQLink brings verified reports, available teams, and accountable
            human decisions into one operational picture.
          </p>
          <div className="login-story-footer">
            <span className="login-footer-dot" aria-hidden="true" />
            Secure coordinator workspace
          </div>
        </div>
      </aside>
      <div className="login-main">
        <Link href="/" className="back-link">
          <span aria-hidden="true">&larr;</span> Back to public portal
        </Link>
        <main id="main" className="login-form-wrap">
          <div className="mobile-brand">
            <Image
              src="/images/ResQLink Shield Brand Logo.png"
              alt="ResQLink — People, Response, Safer Sindh"
              width={198}
              height={66}
              priority
            />
          </div>
          <p className="login-eyebrow"><span /> Command Center</p>
          <h1>Welcome back.</h1>
          <p className="muted login-intro">
            Sign in to review live reports and coordinate a considered response.
          </p>
          {session.expired && (
            <p role="status" className="inline-notice">
              Your session expired. Please sign in again.
            </p>
          )}
          <form onSubmit={submit} noValidate className="login-form">
            <FormField label="Email address" required error={fields.email}>
              {(props) => (
                <div className="login-input-wrap">
                  <Mail className="login-input-icon" size={18} aria-hidden="true" />
                  <Input
                    {...props}
                    name="email"
                    type="email"
                    autoComplete="username"
                    inputMode="email"
                    placeholder="Enter your work email"
                    disabled={busy}
                    className="login-input"
                  />
                </div>
              )}
            </FormField>
            <FormField label="Password" required error={fields.password}>
              {(props) => (
                <div className="login-input-wrap password-field">
                  <Lock className="login-input-icon" size={18} aria-hidden="true" />
                  <Input
                    {...props}
                    name="password"
                    type={visible ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    disabled={busy}
                    className="login-input"
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    aria-label={visible ? "Hide password" : "Show password"}
                    aria-pressed={visible}
                    onClick={() => setVisible(!visible)}
                  >
                    {visible ? (
                      <EyeOff size={18} aria-hidden="true" />
                    ) : (
                      <Eye size={18} aria-hidden="true" />
                    )}
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
              className="w-full login-submit-btn"
            >
              <span>Sign in</span>
              <ArrowRight size={18} aria-hidden="true" className="login-btn-arrow" />
            </Button>
          </form>
          <p className="login-help">
            <Lock size={13} aria-hidden="true" className="inline-block shrink-0 opacity-75" />
            <span>Authorized coordinators only. Access is managed by your administrator.</span>
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
