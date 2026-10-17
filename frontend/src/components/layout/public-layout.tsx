import Link from "next/link";
import type { ReactNode } from "react";
import { buttonStyles } from "@/components/ui/button";
export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link
      href="/"
      className={`brand ${inverse ? "brand-inverse" : ""}`}
      aria-label="ResQLink home"
    >
      <span className="brand-symbol" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none">
          <path
            d="M5 17V7h10M27 15v10H17M11 16h10M16 11v10"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="square"
          />
        </svg>
      </span>
      <span>
        ResQ<span className="brand-light">Link</span>
      </span>
    </Link>
  );
}
export function PrototypeNotice() {
  return (
    <div className="prototype-notice">
      <span className="notice-dot" aria-hidden="true" />
      <p>
        <strong>Prototype / simulation.</strong> ResQLink is a decision-support
        demonstration. It is not connected to emergency services and does not
        dispatch rescue teams.
      </p>
    </div>
  );
}
export function PublicLayout({
  children,
  compact = false,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="public-layout">
      <header className="public-header container">
        <Brand />
        <Link href="/login" className={buttonStyles("ghost", "sm")}>
          Coordinator Login <span aria-hidden="true">&#8599;</span>
        </Link>
      </header>
      <main id="main" className={compact ? "container citizen-content" : ""}>
        {children}
      </main>
      <footer className="public-footer container">
        <PrototypeNotice />
        <div className="footer-line">
          <span>ResQLink &middot; Human-led response.</span>
          <span>CODE//CONNECT &rsquo;26</span>
        </div>
      </footer>
    </div>
  );
}
