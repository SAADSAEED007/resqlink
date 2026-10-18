import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CircleAlert,
  CloudSun,
  MapPinned,
  ShieldAlert,
  UsersRound,
  Waypoints,
} from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { LandingBrand } from "./LandingNavbar";
import { HowItWorks } from "./HowItWorks";
import { landingStyles as styles } from "./landing-styles";

export function LandingSections() {
  const communityFeatures = [
    {
      title: "Report in moments",
      description:
        "Choose an emergency, share a location, and send an SOS without completing a lengthy form.",
      icon: BellRing,
    },
    {
      title: "Help identify urgent situations",
      description:
        "A quick, optional safety question helps coordinators recognize reported immediate danger and prioritize human review.",
      icon: ShieldAlert,
    },
    {
      title: "Connect reports to coordinated action",
      description:
        "Coordinators can review incidents, assess available teams, and record response assignments through the command center.",
      icon: UsersRound,
    },
  ];
  const pillars = [
    {
      label: "REPORT",
      title: "Community Reporting",
      description: "Give people a fast way to share emergencies and locations.",
      icon: MapPinned,
    },
    {
      label: "UNDERSTAND",
      title: "Preparedness Intelligence",
      description:
        "Use real weather evidence, transparent attention rules, and AI-assisted explanations to support preparedness decisions.",
      icon: CloudSun,
    },
    {
      label: "COORDINATE",
      title: "Rescue Coordination",
      description:
        "Help coordinators review incidents, assign appropriate available teams, and manage response progress.",
      icon: Waypoints,
    },
  ];
  const team = [
    { name: "Saad", role: "Team Lead", initials: "SA" },
    { name: "Saba", role: "Backend Development", initials: "SB" },
    { name: "Kulsoom", role: "Frontend Development", initials: "KU" },
    { name: "Hafsa", role: "Quality Assurance", initials: "HA" },
  ];
  return (
    <>
      <aside
        className={styles.safetyNotice}
        aria-label="Prototype safety notice"
      >
        <div className={styles.sectionContainer}>
          <CircleAlert size={21} aria-hidden="true" />
          <p>
            <strong>A demonstration. A responsibility to be clear.</strong>{" "}
            ResQLink is a hackathon demonstration platform and is not connected
            to official emergency dispatch services. In a real emergency,
            contact your local emergency authorities.
          </p>
        </div>
      </aside>
      <HowItWorks />
      <section
        id="communities"
        className={styles.communitySection}
        aria-labelledby="communities-heading"
      >
        <div className={`${styles.sectionContainer} ${styles.communityGrid}`}>
          <div>
            <p className={styles.sectionLabel}>DESIGNED FOR COMMUNITIES</p>
            <h2 id="communities-heading">
              Every emergency deserves to be heard.
            </h2>
            <p>
              ResQLink makes it easier to report emergencies and helps
              coordinators review incidents, understand reported urgency, and
              organize available rescue resources through one connected
              platform.
            </p>
            <Link
              href="/sos"
              className={`${buttonStyles("primary")} ${styles.inlineLink}`}
            >
              Report an Emergency
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <p className={styles.communityFuture}>
              <strong>Looking ahead:</strong> volunteer-assisted and
              low-connectivity reporting could help more people access
              emergency coordination.
            </p>
          </div>
          <div className={styles.communityCopy}>
            <ol className={styles.communityFeatures}>
              {communityFeatures.map(({ title, description, icon: Icon }) => (
                <li key={title} className={styles.communityFeature}>
                  <span aria-hidden="true">
                    <Icon size={22} strokeWidth={1.8} />
                  </span>
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
      <section
        id="about"
        className={`${styles.sectionContainer} ${styles.aboutSection}`}
        aria-labelledby="about-heading"
      >
        <p className={styles.sectionLabel}>ABOUT RESQLINK</p>
        <div className={styles.aboutIntro}>
          <h2 id="about-heading">
            Built for Sindh.
            <br />
            Centered on people.
          </h2>
          <p>
            ResQLink is a disaster-response coordination MVP developed for
            CODE//CONNECT &rsquo;26. It brings public emergency reports,
            explainable preliminary triage, weather-informed preparedness, and
            human-led rescue coordination into one shared operational
            workspace.
          </p>
        </div>
        <ol className={styles.aboutFlow} aria-label="ResQLink response workflow">
          {pillars.map(({ label, title, description, icon: Icon }) => (
            <li key={label} className={styles.aboutPillar}>
              <Icon size={24} strokeWidth={1.7} aria-hidden="true" />
              <p>{label}</p>
              <h3>{title}</h3>
              <span>{description}</span>
            </li>
          ))}
        </ol>
        <p className={styles.footerDisclosure}>
          ResQLink is a hackathon prototype and is not connected to official
          emergency dispatch services.
        </p>
      </section>
      <section
        id="team-zyphora"
        className={styles.teamSection}
        aria-labelledby="team-heading"
      >
        <div className={styles.sectionContainer}>
          <div className={styles.teamIntro}>
            <div>
              <p className={styles.sectionLabel}>THE TEAM BEHIND RESQLINK</p>
              <h2 id="team-heading">Built by Zyphora</h2>
            </div>
            <p>
              Four teammates building a more connected approach to emergency
              response for CODE//CONNECT &rsquo;26.
            </p>
          </div>
          <ul className={styles.teamGrid} aria-label="Team Zyphora members">
            {team.map((member) => (
              <li key={member.name} className={styles.teamCard}>
                <span className={styles.teamMonogram} aria-hidden="true">
                  {member.initials}
                </span>
                <div>
                  <h3>{member.name}</h3>
                  <p>{member.role}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className={styles.footerDisclosure}>
            Team Zyphora &middot; CODE//CONNECT &rsquo;26
          </p>
        </div>
      </section>
      <footer className={styles.footer}>
        <div className={`${styles.sectionContainer} ${styles.footerTop}`}>
          <LandingBrand />
          <nav aria-label="Footer navigation">
            <a href="#how-it-works">How It Works</a>
            <a href="#communities">For Communities</a>
            <a href="#about">About</a>
            <a href="#team-zyphora">Team Zyphora</a>
            <Link href="/login">Coordinator Login</Link>
          </nav>
        </div>
        <div className={`${styles.sectionContainer} ${styles.footerBottom}`}>
          <p>
            &copy; 2026 ResQLink &middot; Built by Team Zyphora for
            CODE//CONNECT &rsquo;26
          </p>
          <p>
            Hackathon prototype &middot; Not an official emergency service
            <br />
            Hero artwork is an illustration, not documentation of a real rescue.
          </p>
        </div>
      </footer>
    </>
  );
}
