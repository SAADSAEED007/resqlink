# Production weather investigation — 18 October 2026

The production ingestion failure is not yet reproduced or attributed. Do not
describe this patch as a verified production fix.

## Verified evidence

- `GET https://resqlink-backend-3agc.onrender.com/api/weather/districts/overview`
  returns HTTP 401 without a coordinator session; the route exists.
- With the Vercel Origin header, the backend returns the matching
  `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials: true`.
- The original exact Open-Meteo query returned HTTP 200 for Hyderabad. The
  original parser accepted its response, including provider `current.interval`.
- Node ingestion fetched and normalized real forecasts for all seven configured
  district locations around 11:51 Asia/Karachi. All had 0 mm next-24-hour
  precipitation and correctly classify Routine. This is local evidence only.
- No authenticated production browser session or Render logs were available.
  Production commit, environment values, outbound HTTP status, and Groq model
  availability remain unverified.

## Changes

Manual refresh previously used the successful 15-minute backend cache. It now
requests `?refresh=true` and updates selected evidence from the overview snapshot.
The UI reports actual forecast retrieval timestamps rather than overview request
time, and shows observed wind speed with timezone.

Provider calls use two attempts at most, each with a five-second timeout. HTTP
400-class responses are not retried; 429 honors Retry-After with a minimum
60-second process-wide cooldown, including forced refreshes. Successful cached
evidence remains available during cooldown. Only successful payloads are cached;
existing explicitly stale fallback and unavailable classification are preserved.
Diagnostic events distinguish HTTP status, transport error name/code, validation
path/type, and affected coordinates without logging credentials or payloads.

## Deployment and verification

Validation completed locally: 36 backend weather/attention/Groq tests passed;
backend production build and frontend TypeScript passed; five focused Playwright
tests passed (forced refresh completion, partial coverage/KPI totals, unavailable
forecasts with missing AI key, AI failure, and forecast evidence/resources).
Frontend production build reached compilation but failed downloading Geist from
Google Fonts; it is not recorded as a passing build.

Both Render and Vercel need the reviewed branch deployed. No new weather
environment variable or Open-Meteo credential is required. The public forecast
endpoint supports non-commercial use without a key, subject to provider terms:
https://open-meteo.com/en/terms and https://open-meteo.com/en/docs.

Existing contracts to verify, not new required changes:

- Vercel `NEXT_PUBLIC_API_URL=https://resqlink-backend-3agc.onrender.com/api`
- Vercel `NEXT_PUBLIC_AUTH_URL=https://resqlink-backend-3agc.onrender.com/v1`
- Render `FRONTEND_URL=https://resqlink-drab.vercel.app`
- Optional Render-only `GROQ_API_KEY` and `GROQ_MODEL`; never public browser keys.

After deployment, use Render Shell:

```sh
node dist/scripts/diagnose-weather.js
```

This checks the actual Render outbound network and parser for each location
without needing a coordinator cookie, database query, or Groq request. A failure
sets a nonzero exit code. Capture `weather.provider_http`,
`weather.transport_failed`, `weather.validation_failed`, and
`weather.forecast_failed` log events from a dashboard refresh. Do not bypass
authentication or share session cookies/API keys in chat.

Then verify an authenticated `/api/weather/districts/overview?refresh=true`
response and dashboard: seven real forecasts or explicit per-district failures,
honest KPI totals, observed temperatures/wind, timestamps, and completed loading.
Groq must be verified separately with server configuration; weather does not
invoke or depend on Groq. No merge or production deployment is performed here.
