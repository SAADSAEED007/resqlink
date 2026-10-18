# Sindh Weather Intelligence release report

## Status and verification boundaries

**WEATHER COMPLETE — DEPLOYMENT PENDING.** WeatherAPI and Groq were verified through real local provider calls. Preparedness persistence is implemented and covered by server/service tests and browser fixtures; no production database write, authenticated production workflow, incident creation or team dispatch was performed. Deploy and complete a coordinator-led persistence check before claiming the entire production workflow is verified.

Worktree: `D:/Hacakthon/.worktrees/sindh-weather-intelligence-complete`. Branch: `feature/sindh-weather-intelligence-complete`, based on `origin/dev` at `ab25959` (which includes PR #41). Existing dirty worktrees were preserved. The PR targets `dev`; no automatic merge or deployment.

## A. Weather integration

Primary endpoint: `https://api.weatherapi.com/v1/forecast.json`, with the private backend `WEATHERAPI_KEY`, the configured coordinate pair, `days=3`, `aqi=no`, `alerts=no`. Provider URLs and raw provider error bodies never reach browser responses or logs. The official [forecast documentation](https://www.weatherapi.com/docs/forecast-api/) describes hourly epochs, precipitation in mm and wind/gust in km/h; the [plan comparison](https://www.weatherapi.com/pricing.aspx) confirms three-day daily/hourly forecasts on Free and excludes bulk requests on that plan. Accordingly WeatherAPI requests are serialized rather than using a paid bulk endpoint.

Hyderabad was verified first at 09:01 UTC on 2026-10-18, before the all-district check and preparedness implementation. It returned Sunny, 36.9°C, a valid observation timestamp and a complete future-hour interval. All seven then succeeded. A later final service/Groq verification at 09:11 UTC returned 72 hourly periods and three days for each location:

| District | WeatherAPI availability | Classification |
| --- | --- | --- |
| Hyderabad | Available | Routine |
| Sukkur | Available | Routine |
| Larkana | Available | Routine |
| Mirpur Khas | Available | Routine |
| Badin | Available | Routine |
| Thatta | Available | Routine |
| Dadu | Available | Routine |

The observed 24-hour precipitation was zero in all seven responses; no attention values were forced to make a KPI nonzero. See `weatherapi-live-verification.json` for actual values, provider/observation/fetch timestamps, intervals and AI status. This artifact documents a point-in-time test and is not used as application data.

The domain provides current temperature, condition, feels-like temperature, humidity, wind, gust and current precipitation; hourly forecast precipitation, rain probability and wind/gust; three daily outlooks; a complete 24-hour precipitation sum, peak hourly rain, maximum rain probability, wind and gust; source, coordinates, timezone, freshness, timestamps and limitations. The frontend never consumes raw provider objects.

Hourly calculations use epoch timestamps. The summary starts at the next complete forecast hour and covers exactly 24 contiguous future hourly intervals. The partial current hour is excluded and this limitation is visible. Daily totals remain distinct from this rolling interval. Missing/non-finite/coerced values, invalid ranges, wrong location/timezone, outdated observations and incomplete/unaligned intervals are rejected instead of becoming zero.

## B. Request volume, cache and failures

The previous confirmed production failure was Open-Meteo HTTP 429. Earlier manual refresh/polling bypassed cache and separately fetched all seven districts. The already-merged rate-limit fix is retained and extended to WeatherAPI. Each WeatherAPI cold cache needs seven requests, serially; repeated overview/detail/selection/AI reads within TTL need zero more equivalent provider calls. There is no automatic Open-Meteo fallback or paid bulk request. The existing Open-Meteo path remains an explicit operator rollback via `WEATHER_PROVIDER=open-meteo` and retains its batching/cooldown.

The shared process cache has a 20-minute success TTL, at most 500 coordinate/forecast-parameter keys, in-flight coalescing, and up to one hour of last-good data with the original retrieval time. WeatherAPI has one in-flight request, at least one second between attempts and a 12-second timeout. Invalid per-location payloads get a one-minute negative cache without blocking other districts. Provider-wide HTTP/network failures open the shared exponential circuit with jitter and `Retry-After` support. There are no immediate retries or seven-way fallback storms. Missing credentials make zero upstream requests and yield an explicit configuration state; 401/403 require backend credential/subscription review.

Cache and circuit state are in memory: Render restart clears them and replicas do not share them. Cache policy is enforced on the backend regardless of browser refresh or legacy refresh parameters. AI and decision records consume existing evidence and do not initiate weather ingestion.

## C. Attention classification

Preserved prototype rainfall rules: below 20 mm is Routine, at least 20 mm is Elevated, at least 50 mm is Urgent Review. `RISK_REVIEW_ELEVATED_RAIN_MM` / `RISK_REVIEW_URGENT_RAIN_MM` retain configurability. Missing precipitation, missing wind, incomplete coverage, stale or absent evidence yields Data Unavailable. Counts reconcile with the seven configured points.

Reasons expose actual rainfall, the triggered rule and thresholds. Responses also include missing evidence, observation/fetch timestamps, the forecast interval and limitations. Peak hourly rainfall and wind/gust are displayed for review; they are not additional calibrated hazard thresholds. The rainfall-only prototype does not incorporate river levels, drainage, exposure or scientifically validated flood predictions. Existing local community severity remains a separate recorded assessment.

## D. Map and data experience

Existing verified coordinates, Leaflet, OpenStreetMap light tiles, Esri dark tiles, legend and shared selection state are preserved. Popups now include temperature, source, Karachi timestamp and a Review District action. Marker colors remain blue/amber/red/gray for Routine/Elevated/Urgent/Data Unavailable. No hazard polygons or flood points were invented.

Real-tile visual inspection exposed center drift when layout width changed. The shared resize hook now preserves the geographic center on invalidation; the browser regression checks all seven markers remain inside the map across responsive widths. Charts use the exact normalized interval, separate rain amount/probability axes and a wind chart. Static curves avoid transient empty animation frames. Source text and attribution now follow the actual provider. The district directory shows actual condition text and retains freshness/selection behavior.

Browser checks cover light/dark modes and widths 320, 375, 390, 430, 768, 1024, 1280, 1440, 1648 and 1920. External tile requests can time out; the existing explicit Retry Map state preserves positions. The local real-evidence harness uses actual captured provider/domain responses with a test authentication session, not a production login. Its temporary script/test are excluded from the PR. Evidence images are `weatherapi-real-evidence-desktop.png` and `weatherapi-real-evidence-mobile.png`.

## E. Grounded Groq

Real Groq succeeded with the configured model and normalized Hyderabad evidence. It selects only validated evidence references and fixed precaution actions; it cannot invent a classification or free-form hazard facts. Evidence/source references now name the actual weather provider. AI errors leave weather and the deterministic explanation intact. The UI displays rule-derived weather explanations before AI generation and retains a compact configuration/error state. No calibrated confidence percentage is claimed.

The live diagnostic deliberately did not query local assessments/resources and supplied that limitation. Normal district analysis still queries actual matching non-simulated community records and reports when records are absent/unavailable. Free-text field notes and personal contacts are not sent to Groq. Live tests do not establish Render's Groq configuration or production access to internal records.

## F. Human preparedness actions

| Control | Implemented behavior | Persistence / limitations |
| --- | --- | --- |
| Create Field Assessment | Select an actual non-simulated community in the district, choose priority and enter a reason; attach provider, interval, freshness and timestamp evidence | Existing `POST /api/community-risk-zones/:id/assessment`; existing coordinator actor/time/history and `ASSESSMENT_DISPATCHED` state. No rescue-team assignment. No matching record means register/inspect a real community first. |
| Review Available Teams | Read existing available non-simulated teams, names, capabilities and stored base | Read-only, up to 100 records across the service area; no nearest-team claim, travel time, reservation or status change. |
| View Nearby Shelters | Open existing Nearby Resources tab with actual shelter and inventory APIs | Existing coordinate-based distance and representative-point caveats retained. No invented stock/capacity. |
| Record Coordinator Decision | Explicit reason and confirmation; append-only actor/time/coordinates/weather evidence snapshot | New coordinator-protected Mongo record, server-derived actor and cache evidence, mismatch protection and UUID idempotency. A decision records intent; it does not create an assessment, incident or dispatch. |
| View Incident Directory | Navigate to existing incident management | Navigation only; no invented district association or incident. |

Decision actions are Continue Monitoring, Request Field Assessment, Review Resources and Escalate Review. UI success requires a valid successful response. Ambiguous failures block blind retries and advise inspecting stored records. Model initialization waits for the unique idempotency index before accepting a write. Actual production persistence has not been exercised; server tests mock database writes and validate success/failure/idempotency contracts, while browser tests use clearly synthetic fixture records.

## G/H. Exact code and API changes

Backend:

- `backend/.env.example`: empty key and optional explicit provider rollback documentation.
- `backend/src/APIs/weather/providers/weather-provider.ts`: provider/domain/error types.
- `backend/src/APIs/weather/providers/weatherapi.provider.ts`: typed strict adapter, normalization and sanitized failures.
- `backend/src/APIs/riskZones/weather.service.ts`: WeatherAPI primary path in existing shared cache/queue/circuit; old Open-Meteo path retained.
- `backend/src/APIs/weather/attention.ts`: completeness guards and explicit evidence/limitations.
- `backend/src/APIs/weather/preparedness.service.ts`: append-only decision model, validation, snapshots, idempotent persistence and recent history.
- `backend/src/APIs/weather/index.ts`: authenticated coordinator GET/POST `/api/weather/districts/:districtId/decisions`; existing weather routes remain compatible.
- `backend/src/APIs/weather/monitoring.service.ts`, `backend/src/APIs/riskZones/intelligence.service.ts`: provider-correct AI facts.
- `backend/src/scripts/diagnose-weather.ts`: optional single-district diagnostic.
- Backend tests: new `weatherapi.spec.ts`, `preparedness.spec.ts`; existing `sindh-weather.spec.ts`, `weather-rate-limit.spec.ts` explicitly select Open-Meteo for their legacy adapter cases.

Frontend:

- `frontend/src/types/risk-zones.ts`, `frontend/src/lib/api/district-weather.ts`: compatible enriched domain fields and decision API contracts.
- `frontend/src/components/risk-zones/PreparednessActions.tsx`: actual review/assessment/decision controls with honest failure confirmation.
- `RiskZonesWorkspace.tsx`: configuration state, condition text and preparedness placement.
- `CommunityAssessments.tsx`: selected district prefill, retaining required user-entered actual assessment findings.
- `DistrictDetails.tsx`: exact-window rainfall/probability/wind charts, current/maximum wind, provider attribution.
- `DistrictWeatherPanels.tsx`: dynamic source/condition/limitations and deterministic explanation when AI is unavailable.
- `SindhMonitoringMap.tsx`: richer popup/source/review action.
- `sindh-intelligence.css`: compact and responsive action forms/AI state.
- `frontend/src/components/maps/use-map-base.ts`: preserve center while resizing.
- `frontend/tests/sindh-monitoring.spec.ts`: WeatherAPI, preparedness and responsive map regressions.

## I. Validation

Commands executed from the corresponding backend/frontend directories:

```text
node node_modules/typescript/bin/tsc --noEmit
node node_modules/typescript/bin/tsc
node node_modules/eslint/bin/eslint.js <all changed TypeScript files>
node node_modules/jest/bin/jest.js --runInBand <weather, preparedness, community, response, assignment, shelter suites> --silent
node node_modules/next/dist/bin/next typegen
node node_modules/@playwright/test/cli.js test --config playwright.sindh.config.ts --reporter line
node node_modules/next/dist/bin/next build
```

Backend: 74 weather tests plus 150 preparedness/operational tests pass across the focused suite runs (224 unique cases). Both new decision authorization/idempotency tests and failure confirmation tests pass. Types, production compilation and focused ESLint pass. Frontend: all 16 Sindh browser regressions and nine shared-map regressions pass; the strengthened responsive marker-visibility check also passes after the resize correction. Frontend type generation, TypeScript, production build (all 12 routes) and focused ESLint pass. A separate local browser harness rendered captured real WeatherAPI/Groq results and real tiles with all seven markers visible. An earlier external tile timeout exercised the existing error state; the final real-tile run passed. Installed dependencies were reused in an isolated worktree; a temporary local Turbopack root accommodated dependency junctions and is not part of the committed application config.

## J. Deployment and post-deploy checks

Privately configure Render backend:

```env
WEATHERAPI_KEY=<your private WeatherAPI.com key>
WEATHER_PROVIDER=weatherapi
NODE_ENV=production
FRONTEND_URL=https://resqlink-drab.vercel.app
SERVER_URL=https://resqlink-backend-3agc.onrender.com
```

Keep existing database/authentication/Groq settings. The local private key has been configured in ignored `D:/Hacakthon/backend/.env`; `.env.example` does not configure Render. No `NEXT_PUBLIC_WEATHERAPI_KEY` exists or is needed. Vercel retains its existing backend integration URLs.

Deploy the backend and rebuild the frontend after review/merge. The Mongo role needs collection/index creation and read/write privileges for the new preparedness-decision collection. Check unique index `{coordinatorId:1, clientRequestId:1}` exists. No incident/assignment schema changes are needed.

From built backend directory, `node dist/scripts/diagnose-weather.js hyderabad` checks Hyderabad, and omission of the district checks all seven. Local usage can load the existing private environment with `DOTENV_CONFIG_PATH=D:/Hacakthon/backend/.env` and `node -r dotenv/config ...`. A CLI diagnostic has its own process cache and does not warm the running web process.

Then use an authenticated coordinator session to verify overview/detail timestamps, source attribution, cache-respecting refresh, classification counts and marker selection. Inspect real local assessments/teams/shelters. Explicitly confirm one appropriate coordinator decision, reload its history and verify its database record/actor/time/evidence. Request a real field assessment only when justified and authorized by the coordinator. Do not create a fake incident or dispatch during smoke tests.

Render settings and deployments were not accessible in this session. No claim is made about Render's current Open-Meteo cooldown or production WeatherAPI/Groq availability. The new provider uses an independent circuit in the deployed process.
