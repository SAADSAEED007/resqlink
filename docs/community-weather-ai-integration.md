# Sindh Disaster Risk Intelligence

Verdict: IMPLEMENTED - GROQ KEY PENDING. Coverage is a verified seven-district subset, not all Sindh districts. Forecasts describe representative towns, not district-wide conditions or confirmed disasters.

## Existing implementation audit

Inspected the local incident branch at 2a512ce and merged dev at bebda05 before changes. The original community page was connected to the correct API envelope. A read-only query against the configured database returned **zero community records**. No records were inserted to make the page look populated. No authenticated live browser session was available for end-to-end backend mutation testing.

| Capability | Existing | Working evidence | Action |
|---|---|---|---|
| Community listing/detail/registration | Yes | Existing unit tests; current database count zero | Preserve in secondary tab |
| Field assessments/status changes | Yes | Existing tests and browser mutation fixtures | Preserve contract; append prior assessments to history |
| Shelter resources/nearby search | Merged dev; missing locally | Existing merged shelter tests | Reuse unchanged service and mount in local app |
| District dataset | No | New sourced registry tests | Add seven verified monitoring locations |
| Weather/normalization/cache | Work started under previous brief | Live Open-Meteo + mocked tests | Reuse service; connect district overview |
| Weather attention | No district-level policy | Boundary and unavailable-state tests | Separate deterministic weather-only attention |
| Groq service/endpoint | Work started under previous brief | Mocked provider/error/schema tests | Reuse generic evidence-selection service |
| Sindh map | No | Chrome interaction and screenshots | One Leaflet instance; representative points |
| Theme/auth/client | Yes | Existing client and theme provider | Reuse without changing protected modules |

The previous brief's weather, community AI and assessment-history work is retained. District Monitoring is now the initial view. Community Assessments retains registration, filters, status transitions, notes and history, and stays mounted after first opening to retain drafts across tab changes.

## Dataset and coverage

Version: `sindh-monitoring-2026-10-18-v1`. Names verified against [Pakistan Bureau of Statistics district tables](https://www.pbs.gov.pk/result-excel/) and [PDMA Sindh](https://pdma.gos.pk/provincial-disaster-profile/). Town points verified through the GeoNames-backed Open-Meteo geocoding API on 18 October 2026; each registry entry includes its exact verification URL and GeoNames source.

| District / representative town | Latitude | Longitude | GeoNames ID |
|---|---:|---:|---:|
| Hyderabad | 25.39689 | 68.37718 | 1176734 |
| Sukkur | 27.70323 | 68.85889 | 1164408 |
| Larkana | 27.55898 | 68.21204 | 1172128 |
| Mirpur Khas | 25.52760 | 69.01255 | 1170295 |
| Badin | 24.65600 | 68.83700 | 1184055 |
| Thatta | 24.74745 | 67.92353 | 1163582 |
| Dadu | 26.73033 | 67.77690 | 1180809 |

Remaining Sindh districts, including Karachi's district subdivisions, are **not configured**. Jacobabad was deliberately excluded because its geocoding response used an older administrative label. Decimal precision is the source record's precision, not a guarantee of weather-grid accuracy. No verified boundaries were available; the UI draws point symbols only.

## Backend endpoints

All weather and AI endpoints reuse cookie-based authentication and the existing admin/coordinator role.

- `GET /api/weather/districts`: versioned registry and coverage metadata; no community records required.
- `GET /api/weather/districts/overview`: bounded three-worker forecast overview with partial-success states.
- `GET /api/weather/districts/:districtId`: full selected-point forecast and deterministic attention policy.
- `POST /api/weather/districts/:districtId/ai-analysis`: explicit, protected, prompt-free evidence analysis.
- Existing `/api/community-risk-zones` GET/POST, `/:id` GET, `/:id/assessment` POST and `/:id/status` PATCH remain compatible.
- Community `/:id/weather`, `/:id/intelligence`, `/:id/ai-analysis` reuse the same services from the previous brief.
- `/api/shelters` and `/:id/resources` use Saba's existing contracts. Nearby search uses latitude/longitude/radiusKm and returns approximate straight-line distance, never travel time.

Community listing additionally accepts escaped name search and simulation filtering. Existing severity classifications and assessment-status semantics are unchanged. Assessment requests append to a new optional `assessments` array while retaining `fieldAssessment` as the latest-record contract; legacy latest records are preserved when a new request is made. No automatic severity rewrite occurs.

## Weather provider

Fixed endpoint: `https://api.open-meteo.com/v1/forecast`. [Official forecast documentation](https://open-meteo.com/en/docs) was checked for supported fields and Unix time behavior.

Parameters: four forecast days; `timezone=Asia/Karachi`; `timeformat=unixtime`; current temperature_2m, weather_code, wind_speed_10m; hourly precipitation, precipitation_probability, wind_speed_10m; daily weather_code, temperature_2m_max/min, precipitation_sum, precipitation_probability_max.

All timestamps normalize to UTC ISO strings and display in Asia/Karachi. The next-24-hour accumulation sums the 24 hourly precipitation periods whose ending timestamps fall after the provider current time and at/before current time +24h. It is not a midnight-to-midnight total; hourly resolution means this is an hourly approximation. Amounts are mm; maximum hourly probability is a separate percentage. Daily cards use provider daily dates and values.

Validation rejects missing/null/non-finite measurements, mismatched or unordered arrays, invalid coordinates/probabilities, incomplete windows and outdated current timestamps. Requests time out after eight seconds. The fixed host prevents arbitrary upstream URL requests.

An in-memory cache uses rounded 0.001-degree coordinate keys and a 15-minute TTL, coalesces concurrent requests, and is bounded to 500 entries. A cached forecast less than one hour old may be returned explicitly as `stale` during outage. Stale/missing forecasts receive DATA_UNAVAILABLE, never Routine. This cache is per backend instance and resets on restart. Overview uses three concurrent workers; provider failures remain isolated per district. UI automatic refresh is 15 minutes and pauses its timer requests while the document is hidden. Manual refresh respects the same provider cache; it does not force an upstream call.

Live check: all seven locations returned valid Open-Meteo data on 18 October 2026 PKT. At that check precipitation was 0 mm at all seven points and attention was Routine; the UI does not manufacture risk states. Current temperatures ranged from 25.8 degrees C to 29.1 degrees C. This was service-level live-provider verification, not an authenticated production browser write test.

Attribution appears in the UI: Open-Meteo / CC BY 4.0. The standard free endpoint is for qualifying non-commercial use subject to the provider's current limits (currently 10,000 calls/day); deployments must check [provider terms](https://open-meteo.com/en/terms).

## Attention policy

Named policy: `prototype-rainfall-v1`.

- ROUTINE: available fresh/cached precipitation below 20 mm.
- ELEVATED: precipitation >=20 mm and below 50 mm.
- URGENT_REVIEW: precipitation >=50 mm.
- DATA_UNAVAILABLE: missing or stale weather.

Thresholds are configurable with `RISK_REVIEW_ELEVATED_RAIN_MM` and `RISK_REVIEW_URGENT_RAIN_MM`; urgent is clamped to at least elevated. These are prototype attention heuristics, **not scientific flood-warning thresholds**. Probability and wind are displayed as evidence but do not silently influence these rainfall-only rules. Inputs, thresholds and reasons are inspectable. Human-recorded community risk is displayed separately and never mutated by weather or AI. Routine does not mean an area is safe.

## Groq

Model default: `openai/gpt-oss-20b`, configurable through `GROQ_MODEL`. Its supported structured-output mode was verified in [Groq model documentation](https://console.groq.com/docs/models) and [structured outputs](https://console.groq.com/docs/structured-outputs). Account-specific availability remains pending a real key. Unsupported configurations return a controlled error without silently changing the model.

Provider endpoint: `https://api.groq.com/openai/v1/chat/completions`, server-side only. Timeout: 20 seconds. Per-user generation guard: five requests per ten minutes and one in flight per route family. Cache: ten minutes per evidence fingerprint/model/version, maximum 200 entries. Results are session-only in the browser and not stored as authoritative assessments.

The model uses strict JSON schema to select summary/insight evidence IDs and approved general-precaution action IDs. Server-side Joi validates lengths, enums, unknown fields and evidence references. The server assembles factual text from the original evidence verbatim. This deliberately extractive approach prevents invented numerical claims, HTML, disaster forecasts or privilege-bearing actions from becoming factual output. Model output never sets the authoritative attention level.

Inputs include actual representative location, normalized forecast, attention reasons and up to ten genuine communities matched by exact case-insensitive district name. No raw notes, officer/citizen names, contact fields or free-text assessment findings are transmitted. Structured hazard/severity/urgency/status facts are sent; detailed notes remain available to human reviewers. Shelter association uses actual coordinates/radius, not invented district polygons.

Normalized output contains summary, authoritative reviewLevel, keyInsights with evidenceReferences, preparednessActions, missingInformation, limitations, provider/model, generation/source timestamps, evidence fingerprint and disclaimer. Missing key, invalid credentials/model, rate limit, timeout, malformed JSON and unsupported references are controlled failures. Browser requests cannot supply prompts. No automatic calls, dispatch, warnings or database mutations occur.

## Environment and deployment

Add to backend `.env` or deployment secrets (never NEXT_PUBLIC):

```env
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b
RISK_REVIEW_ELEVATED_RAIN_MM=20
RISK_REVIEW_URGENT_RAIN_MM=50
```

Restart/redeploy the backend after adding the key. Without it, the application starts, district monitoring/weather works, and AI displays its unconfigured state. Open-Meteo requires no separate key for qualifying standard usage. Existing frontend API URL/cookie/CORS configuration remains in use. No .env credentials are committed.

## Frontend and verification

Route: `/dashboard/risk-zones` on the main port 3000 app. Sidebar label remains Community Risk Zones. The reference-inspired three-column composition uses existing shell/theme tokens, four truthful KPI cards, district search/attention filter, synced Leaflet markers, evidence chart, district detail tabs, Groq states and four forecast cards. Light is the initial theme; existing toggle controls dark mode. No new theme provider or chart dependency was added. Local assessments are exact district-name matches; nearby shelters show actual availability and straight-line distance plus real relief inventory.

Chrome scenarios cover primary monitoring with zero communities, search/filter and map selection, unavailable counts, missing-key behavior, explicit duplicate-protected AI, provider failure, evidence units, nearby shelter inventory, secondary registration and field assessment creation, existing Overview/Incident navigation and responsive themes. Eight browser scenarios passed across the full run and one loading-label assertion rerun; screenshot fixtures intentionally exercise different attention states and are not live weather claims.

Backend full suite: 176 passed, 6 skipped, 0 failed; eight suites passed and one opt-in MongoDB transaction suite skipped because TEST_DATABASE_URL was absent. No production database mutation was used. Tests mock weather/Groq and logging transports; live weather was checked separately. The original community and shelter suites pass. Backend and frontend build/lint results are recorded in the final handoff after scoped verification.

Responsive overflow checks passed at 320,375,390,430,768,1024,1280,1440,1648,1920. Screenshots captured light at 390/768/1440/1648, dark at 1440/1648, and AI loading/result states. Light 1648, dark 1648 and mobile 390 were inspected during the correction loop: map bounds, desktop card gaps, degree symbols and mobile map width were repaired. Final artifacts remain under frontend/test-results-sindh/sindh-monitoring-responsiv-31186--and-dark-visual-comparison/.

## Remaining limits

- Only seven verified districts are configured; no official boundaries, river gauges, terrain/drainage model or district-wide flood prediction.
- Live Groq invocation is pending the user-supplied backend key.
- Authenticated live registration/assessment writes were not attempted against the application database; browser writes were mocked, and transactional integration tests remain opt-in.
- Community district association relies on the human-recorded exact district name; spelling variants are not silently mapped.
- Nearby shelters are within 25 km of the town point, not certified as belonging to the district.
- Weather/AI caches are per process; provider outages can produce explicitly unavailable/stale states.
- Existing community severity pagination behavior was preserved; this work does not rewrite the original registry's sorting implementation.

## Git delivery

The live main checkout retains the feature files so port 3000 immediately shows the new page. Delivery uses `.worktrees/sindh-weather-risk-intelligence`, branch `feature/sindh-weather-risk-intelligence`, based on `dev` (bebda05). Only weather/community feature files and tests are included; Antigravity's incident edits, Rescue Teams changes and local image files are excluded. No merge or force push is performed. Commit and PR identifiers are supplied in the final handoff.

Scoped validation: backend lint/build passed; isolated frontend lint passed. The main app production build passed. The isolated Turbopack build needs a local-only root override because node_modules is a junction outside that worktree; this machine-specific config is excluded from the commit. The live checkout lint has unrelated concurrent incident-component errors; those files were deliberately not edited.

Final scoped checks: backend ESLint and TypeScript build passed; frontend ESLint and production build passed on the isolated dev-based branch. The local-only Turbopack root override was not included in delivery. Full backend tests exited successfully with 176 passes and 6 configured skips.
