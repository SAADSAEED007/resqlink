import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  MapPin,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { LandingNavbar } from "./LandingNavbar";
import { landingStyles as styles } from "./landing-styles";

const highlights = [
  {
    title: "People First",
    description: "Support vulnerable communities",
    icon: Users,
  },
  {
    title: "Faster Response",
    description: "Prioritize critical emergencies",
    icon: Zap,
  },
  {
    title: "Community Powered",
    description: "Reports from citizens and volunteers",
    icon: MapPin,
  },
  {
    title: "Transparent & Explainable",
    description: "Technology-assisted, human-reviewed decisions",
    icon: ShieldCheck,
  },
];
export function LandingHero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-heading">
      <Image
        src="/images/hero-background.webp"
        alt=""
        fill
        preload
        sizes="100vw"
        className={styles.heroImage}
      />
      <div className={styles.heroOverlay} aria-hidden="true" />
      <LandingNavbar />
      <div className={styles.heroBody}>
        <div id="main" tabIndex={-1} className={styles.heroCopy}>
          <p className={styles.eyebrow}>
            <span aria-hidden="true" />
            DISASTER RESPONSE PLATFORM FOR SINDH
          </p>
          <h1 id="hero-heading" aria-label="Stronger Communities. Safer Sindh.">
            <span>Stronger</span>
            <span>Communities.</span>
            <span className={styles.accent}>Safer Sindh.</span>
          </h1>
          <p className={styles.description}>
            ResQLink connects people in need with rescue coordinators through
            timely information, community reporting, and explainable
            prioritization.
          </p>
          <div className={styles.heroActions}>
            <Link
              href="/sos"
              className={`${buttonStyles("primary", "lg")} ${styles.emergencyButton}`}
            >
              <BellRing size={23} aria-hidden="true" />
              Request Emergency Help
              <ArrowRight size={22} aria-hidden="true" />
            </Link>
            <a
              href="#how-it-works"
              className={`${buttonStyles("outline", "lg")} ${styles.secondaryButton}`}
            >
              <Users size={23} aria-hidden="true" />
              How It Works
            </a>
          </div>
          <p className={styles.ctaNotice}>
            Hackathon prototype. No official emergency dispatch is connected.
          </p>
        </div>
      </div>
      <div className={styles.heroBottom}>
        <ul className={styles.highlights} aria-label="Our approach">
          {highlights.map(({ title, description, icon: Icon }) => (
            <li key={title}>
              <span className={styles.highlightIcon}>
                <Icon size={23} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <div>
                <h2>{title}</h2>
                <p>{description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
