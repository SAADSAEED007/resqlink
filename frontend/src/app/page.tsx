import Link from "next/link";
import { PublicLayout } from "@/components/layout/public-layout";
import { buttonStyles } from "@/components/ui/button";
export default function Home() {
  return (
    <PublicLayout>
      <section className="hero container">
        <div className="hero-copy">
          <h1>
            Help starts
            <br />
            with a <span>signal.</span>
          </h1>
          <p className="hero-description">
            Connecting urgent needs with coordinated rescue response.
          </p>
          <p className="hero-detail">
            A clearer way to report an emergency, understand who needs help, and
            put human judgment at the center of every response.
          </p>
          <div className="hero-actions">
            <Link href="/sos" className={buttonStyles("primary", "lg")}>
              Request Emergency Help <span aria-hidden="true">&#8599;</span>
            </Link>
            <Link href="/login" className="text-link">
              Coordinator Login <span aria-hidden="true">&#8599;</span>
            </Link>
          </div>
          <p className="hero-caution">
            Demonstration only. For a real emergency, contact your local
            emergency services directly.
          </p>
        </div>
        <div className="response-panel">
          <div className="panel-top">
            <span>THE RESPONSE PATH</span>
            <span aria-hidden="true">&#8599;</span>
          </div>
          <h2>
            From urgent need.
            <br />
            To informed action.
          </h2>
          <ol className="response-steps">
            <li>
              <span className="step-number">01</span>
              <div>
                <h3>Make the need visible</h3>
                <p>
                  Bring location, urgency, and vulnerability into one clear
                  request.
                </p>
              </div>
            </li>
            <li>
              <span className="step-number">02</span>
              <div>
                <h3>Understand what matters</h3>
                <p>
                  Give coordinators context to review priorities and available
                  teams.
                </p>
              </div>
            </li>
            <li>
              <span className="step-number">03</span>
              <div>
                <h3>Keep people in control</h3>
                <p>
                  Support a considered response. Every assignment is a human
                  decision.
                </p>
              </div>
            </li>
          </ol>
          <div className="panel-bottom">
            <span className="signal-mark" aria-hidden="true">
              +
            </span>
            <p>
              Technology connects the information.
              <br />
              <strong>People lead the response.</strong>
            </p>
          </div>
        </div>
      </section>
      <section
        className="purpose-strip container"
        aria-label="Built around people"
      >
        <p>
          One shared picture.
          <br />
          <strong>Two sides of a response.</strong>
        </p>
        <div>
          <h2>For people seeking help</h2>
          <p>
            A focused citizen portal designed around clear requests and mobile
            access.
          </p>
        </div>
        <div>
          <h2>For people coordinating it</h2>
          <p>
            A Command Center for reviewing needs and making informed
            assignments.
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
