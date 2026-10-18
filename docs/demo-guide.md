# ResQLink judge demo guide

## Before you begin

ResQLink is a hackathon prototype for human-led disaster-response coordination. It is not an emergency service. Please avoid submitting public SOS reports or changing prepared Real Data records during review.

Open [the live application](https://resqlink-drab.vercel.app). Coordinator credentials are distributed separately and are not stored in this repository.

## Public portal

1. Explore the landing page and open **Report an Emergency**.
2. Review the guided SOS fields: category, description, location/map selection, and immediate-danger answer.
3. The confirmation design presents a report reference after a successful submission. Do not send a test report to the live environment.

## Coordinator Command Center

After authorized sign-in, the Command Center opens in **Demo Mode** by default. Its records and actions are fictional and browser-local.

1. Open **Incident Management** and select a simulated pending incident.
2. Review its preliminary priority, verification information, and status history.
3. Review a priority or verification action to see that a human reason or note is required.
4. Choose an eligible available team and confirm the simulated assignment.
5. Progress the simulated incident through **In Progress** and **Resolved**.
6. Confirm that the simulated active assignment closes and the simulated team becomes available again.

Demo Mode can be reset by opening a fresh session. It neither reads nor writes production records.

## Real Data Mode

Switch to **Real Data Mode** only when authorized to inspect backend data. The dashboard polls authenticated incident, team, and assignment records. Creating teams, assigning a team, updating an incident, or recording a preparedness decision can persist in the backend; do not perform these actions against prepared evaluation data.

## Weather and community preparedness

The **Community Risk Zones** workspace displays configured Sindh monitoring locations and, when the backend is configured, provider-attributed forecast evidence. Review levels and optional AI summaries are decision-support material requiring coordinator judgment; they are not official weather or flood warnings.

## Responsible use

- Do not use ResQLink as a substitute for contacting official emergency services.
- Do not publish coordinator credentials or secrets.
- Treat triage, potential-duplicate indicators, and weather intelligence as inputs to human review.
- An assignment record does not mean that a team received a mobile or push dispatch.
