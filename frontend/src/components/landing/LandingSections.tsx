import Link from "next/link";
import { ArrowRight, CircleAlert } from "lucide-react";
import { LandingBrand } from "./LandingNavbar";
import { HowItWorks } from "./HowItWorks";
import { landingStyles as styles } from "./landing-styles";

export function LandingSections() {
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
            <p className={styles.sectionLabel}>FOR COMMUNITIES</p>
            <h2 id="communities-heading">
              Being heard should not
              <br />
              depend on a smartphone.
            </h2>
          </div>
          <div className={styles.communityCopy}>
            <p>
              In a flood, access to a phone or a reliable connection cannot be
              taken for granted. People without either still need a way to make
              their situation known.
            </p>
            <p>
              Volunteer-assisted reporting is an intended capability: a
              connected neighbor or volunteer could help share emergency
              information on someone else&apos;s behalf. That dedicated workflow
              is planned; offline submission and synchronization are not
              available.
            </p>
            <Link href="/sos" className={styles.inlineLink}>
              Explore the citizen portal
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
      <section
        id="about"
        className={`${styles.sectionContainer} ${styles.aboutSection}`}
        aria-labelledby="about-heading"
      >
        <p className={styles.sectionLabel}>ABOUT RESQLINK</p>
        <div>
          <h2 id="about-heading">
            Built for Sindh.
            <br />
            Centered on people.
          </h2>
          <p>
            ResQLink is a disaster-response decision-support prototype created
            for CODE//CONNECT &rsquo;26. It brings community reporting,
            explainable prioritization, and human-led coordination into one
            shared picture. It is a hackathon project, not an operational
            emergency service.
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
            <Link href="/login">Coordinator Login</Link>
          </nav>
        </div>
        <div className={`${styles.sectionContainer} ${styles.footerBottom}`}>
          <p>
            &copy; 2026 ResQLink. CODE//CONNECT &rsquo;26 hackathon prototype.
          </p>
          <p>
            Hero artwork is an illustration, not documentation of a real rescue.
          </p>
        </div>
      </footer>
    </>
  );
}
