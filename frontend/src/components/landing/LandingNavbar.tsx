"use client";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Menu, ShieldCheck, X } from "lucide-react";
import type { MouseEvent } from "react";
import { buttonStyles } from "@/components/ui/button";
import { landingStyles as styles } from "./landing-styles";

export function LandingBrand() {
  return (
    <Link href="/" aria-label="ResQLink home" className={styles.brand}>
      <Image
        src="/images/ResQLink Shield Brand Logo.png"
        alt="ResQLink - People, Response, Safer Sindh"
        width={2172}
        height={724}
        sizes="(max-width: 767px) 190px, 260px"
        className={styles.logo}
      />
    </Link>
  );
}
const links = [
  { href: "/", label: "Home" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#communities", label: "For Communities" },
  { href: "#about", label: "About" },
];
export function LandingNavbar() {
  function closeMenu(event: MouseEvent<HTMLAnchorElement>) {
    const details = event.currentTarget.closest("details");
    if (details) details.open = false;
  }
  return (
    <header className={styles.header}>
      <div className={styles.navbar}>
        <LandingBrand />
        <nav className={styles.desktopNav} aria-label="Main navigation">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={href === "/" ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <Link
          href="/login"
          className={`${buttonStyles("outline")} ${styles.loginLink}`}
        >
          <ShieldCheck size={19} aria-hidden="true" />
          Coordinator Login
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <details
          className={styles.mobileMenu}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.currentTarget.open = false;
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}
        >
          <summary aria-label="Toggle navigation">
            <Menu className={styles.menuIcon} size={23} aria-hidden="true" />
            <X className={styles.closeIcon} size={23} aria-hidden="true" />
            <span>Menu</span>
          </summary>
          <nav aria-label="Mobile navigation">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={closeMenu}
                aria-current={href === "/" ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
            <Link href="/login" onClick={closeMenu}>
              Coordinator Login
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
