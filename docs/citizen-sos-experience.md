# Citizen SOS reporting experience

The public `/sos` route is a client-side, three-step location, details and review flow. The supplied `frontend/public/images/Glowing Red SOS Emergency Button.png` (1254 x 1254, transparent PNG) is displayed inside a real accessible button. Starting the flow never submits an incident.

## Implementation and files

- `frontend/src/app/sos/page.tsx`: route and metadata.
- `frontend/src/components/sos/SOSExperience.tsx`: navigation, in-memory draft, submission, confirmation and media availability dialog.
- `SOSLocationStep.tsx`: explicit GPS request, manual address, coordinate validation and unknown location.
- `SOSMapPicker.tsx`: lazy client-only Leaflet map, OpenStreetMap attribution, click selection, draggable marker and keyboard pan/map-center selection.
- `SOSEmergencyDetailsStep.tsx`: required incident fields, optional contact and assistance counts, reporting for another person.
- `SOSReviewStep.tsx`: editable report summary, unknown values and privacy notice.
- `report.ts`: validation and typed backend payload conversion; `sos.css`: scoped responsive styles.
- `frontend/src/app/layout.tsx`: imports Leaflet CSS once. The duplicate import was removed from `dashboard/OperationsMap.tsx`; dashboard map logic is unchanged.
- `frontend/tests/sos-report.spec.ts`, `sos.spec.ts`: contract and browser scenarios. Existing landing/how-it-works/foundation tests now expect the functional SOS page title; dashboard regression also checks the initialized Leaflet container.

## Backend contract

The existing typed public client calls `POST /api/incidents`, resolved against `NEXT_PUBLIC_API_URL` (locally `http://localhost:4000/api`). This endpoint already permits unauthenticated creation. No authentication, backend, priority, verification or assignment logic changed.

The request contains `reporterName`, `emergencyType`, `description`, `peopleAffected`, `location` and `waterLevel`; optional `reporterPhone`, `immediateDanger` and individual `vulnerablePeople` counts are included only when supplied. Emergency types are FLOOD, MEDICAL, FIRE, STRANDED, SUPPLIES and OTHER. Name and a positive people estimate are required by the existing API; they are never invented. Empty assistance counts remain omitted, while an explicit zero remains zero. Unknown immediate danger is omitted; unknown water level uses the API's UNKNOWN value.

A location point contains actual selected latitude/longitude and optional address. The initial Karachi view is explicitly a starting view and creates no reported point. A manual address without coordinates sends `location: null` and includes the address in the description as coordinates unverified. Reporting on behalf of another person and additional notes are included in the supported description field. Whitespace is normalized to the backend text contract and the combined description is validated against its 2,000-character limit.

GPS permission is requested only when the user chooses it. Denial, unavailable position, timeout and unsupported devices retain manual alternatives. Delayed GPS responses cannot overwrite a newer manual choice.

## Submission, privacy and limitations

Only a successful backend response containing a valid incident ID produces confirmation; the actual returned ID is displayed. There is no invented tracking link or dispatch status. The synchronous in-flight guard blocks double clicks. Errors preserve the in-memory draft. Network, timeout, server and malformed-response failures explain that the outcome is unconfirmed and require acknowledgement of possible duplication before an explicit retry. There is no automatic retry and the backend has no idempotency key; cross-tab or acknowledged retries can still create duplicates under the existing verification policy.

Photos and video cannot be uploaded: the backend has no media endpoint. The availability dialog states this; no local preview pretends to save an attachment and no base64 media enters the incident payload. No personally identifying draft data is persisted to browser storage. Refreshing or closing the page loses the draft. The existing public API CORS/environment setup must allow the deployed frontend origin; location permission requires HTTPS or localhost. OpenStreetMap tiles require connectivity; manual location works if tiles fail. The existing backend does not provide citizen tracking.

The prototype notice remains visible throughout and confirmation explicitly states that official emergency services have not been notified. No hotline or response-time promise is invented. Existing homepage/how-it-works source is preserved; its earlier capability copy may need a separate editorial update now that citizen submission exists.

## Verification

Production frontend lint, TypeScript checking and build pass. Browser requests are mocked to avoid entering synthetic incidents in the normal database. Backend integration tests run separately against an isolated temporary MongoDB database: 72 tests across 5 suites pass, including public incident creation and verification. This is not a claim of an unmocked browser-to-Atlas smoke test.

SOS coverage includes required validation, coordinate bounds and partial pairs, manual/unknown/GPS/map location, GPS denial/unavailable/timeout, optional phone, unknown/zero assistance counts, reporting for another person, server confirmation, validation errors, uncertain outcomes, retained edits, deliberate retry and duplicate-click protection. Responsive screenshots cover 375, 430, 768 and 1440 pixels. Local review artifacts are under `frontend/playwright-report/citizen-sos/` (ignored); the start/review screenshots are named `sos-start-WIDTH.png` and `sos-review-WIDTH.png`.

Existing dashboard horizontal-overflow failures at narrow widths predate this task and are outside its scope; functional dashboard map/search/modal, public page and login checks are run as regression coverage. Final frontend verification: 67 selected checks pass (55 SOS/public-page/API checks, 11 dashboard/login checks, and the corrected public navigation assertion on rerun). The initial navigation assertion matched retained route text as well as the heading; it now targets the level-one SOS heading.
