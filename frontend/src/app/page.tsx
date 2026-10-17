import type { Metadata } from "next";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingSections } from "@/components/landing/LandingSections";
import { landingStyles as styles } from "@/components/landing/landing-styles";
import "@/components/landing/landing.css";

export const metadata: Metadata = {
  title: { absolute: "ResQLink | Stronger Communities. Safer Sindh." },
  description:
    "ResQLink is a disaster response coordination prototype that helps communities report emergencies and supports explainable rescue prioritization.",
};

export default function Home() {
  return (
    <div className={styles.page}>
      <main>
        <LandingHero />
        <LandingSections />
      </main>
    </div>
  );
}
