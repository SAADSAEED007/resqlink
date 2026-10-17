import Image from "next/image";
import Link from "next/link";
import { ArrowRight, FileSearch, Siren, UsersRound } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import "./how-it-works.css";

const steps = [
  {
    title: "Report an Emergency",
    description:
      "Citizens or volunteers share what happened, where help is needed, and who may be at risk.",
    icon: Siren,
    stage: "report",
  },
  {
    title: "Assess Priority",
    description:
      "The system evaluates reported risk factors, flags uncertain information, and explains suggested priority.",
    icon: FileSearch,
    stage: "assess",
  },
  {
    title: "Coordinate Response",
    description:
      "Authorized coordinators review incidents, assign suitable teams, and track response progress.",
    icon: UsersRound,
    stage: "coordinate",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="rqHowSection"
      aria-labelledby="how-heading"
    >
      <div className="rqHowLayout">
        <div className="rqHowCopy">
          <p className="rqHowEyebrow">
            HOW RESQLINK WORKS
            <span aria-hidden="true" />
          </p>
          <h2 id="how-heading">
            A clearer path from
            <br />
            report to response.
          </h2>
          <p className="rqHowDescription">
            Good coordination begins with useful information. ResQLink connects
            communities, reports, and rescue coordinators through a clear,
            explainable response workflow.
          </p>
          <ol className="rqHowSteps" aria-label="Response workflow">
            {steps.map(({ title, description, icon: Icon, stage }, index) => (
              <li key={stage} data-stage={stage}>
                <span className="rqHowNumber">0{index + 1}</span>
                <span className="rqHowIcon">
                  <Icon size={23} strokeWidth={1.7} aria-hidden="true" />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </li>
            ))}
          </ol>
          <Link
            href="/sos"
            className={`${buttonStyles("primary", "lg")} rqHowCta`}
          >
            See ResQLink in Action
            <ArrowRight size={19} aria-hidden="true" />
          </Link>
        </div>
        <figure className="rqHowShowcase">
          <div className="rqHowArt">
            <svg
              className="rqHowConnection"
              viewBox="0 0 900 760"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M100 180C100 35 330 45 480 82S790 0 823 180"
                stroke="var(--how-blue)"
                strokeOpacity=".38"
                strokeWidth="1.5"
                strokeDasharray="2 9"
              />
              <path
                d="M250 105C440 -10 830 110 848 350S830 715 625 678"
                stroke="var(--how-red)"
                strokeOpacity=".32"
                strokeWidth="1.5"
                strokeDasharray="2 9"
              />
            </svg>
            <Image
              src="/images/ResQLink Emergency Response Dashboard Mockup.png"
              alt="ResQLink emergency reporting mobile interface beside its operations command center dashboard"
              width={1448}
              height={1086}
              sizes="(min-width: 1600px) 850px, (min-width: 1100px) 56vw, (min-width: 768px) 85vw, 100vw"
              className="rqHowMockup"
            />
          </div>
          <figcaption>
            Illustrative product mockup. Not a live incident feed.
          </figcaption>
        </figure>
        <p className="rqHowPrototype">
          ResQLink is a demonstration platform and is not connected to real
          emergency dispatch services. The citizen submission interface is still
          being developed; the mockup illustrates the intended experience.
        </p>
      </div>
    </section>
  );
}
