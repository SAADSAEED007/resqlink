# Open-Meteo rate-limit repair

## Confirmed cause and request volume

Render logs supplied by the user show upstream HTTP 429 and the subsequent district forecast failure. Previously, overview issued seven separate requests through three workers. Manual refresh and subsequent frontend polling sent `refresh=true`, bypassing the shared cache. Detail refresh added backend reads. The provider cooldown was short and repeated blocked district reads generated failure logs.

The controlled replay in `weather-request-volume.json` runs the actual old and new service implementations against a mock provider: cold overview decreases from seven HTTP requests to one, and a refresh within the cache TTL decreases from seven to zero. These are controlled HTTP counts, not measured production traffic or provider quota usage.

## Final behavior

- All consumers share an authoritative 20-minute coordinate cache, including legacy refresh query callers. Concurrent reads coalesce by coordinate and batch within 20 milliseconds. Provider concurrency is one, batches contain at most 50 locations, attempts are separated by at least one second, and requests time out after eight seconds.
- Open-Meteo supports comma-separated coordinates and returns a location array. Responses are checked for exact batch size, unique valid location IDs when supplied, and each location's payload validity. One invalid location does not discard valid districts. Invalid individual payloads have a one-minute negative cache.
- HTTP 429 opens a process-wide circuit with a one-minute initial delay, exponential backoff and jitter capped at 30 minutes. Transient failures start at 30 seconds; other HTTP errors start at five minutes. `Retry-After` seconds/date is a lower bound and can exceed the cap. There are no immediate retries or autonomous polling during cooldown. A subsequent caller can retry after the deadline. Logs describe actual provider attempts/transitions rather than every blocked district read.
- Last successful data remains available for at most one hour with its original retrieval timestamp. Stale and missing evidence cannot produce a routine classification. The UI reports cooldown and retry time, finishes loading without data, and does not refetch unchanged detail when refreshing overview.
- Both district and community AI analysis use existing cached weather and cannot start ingestion. Fresh evidence is required for analysis. Normal monitoring/context reads can populate the shared cache.
- Cache, pending work and negative-cache maps are bounded at 500 coordinates. Cache reset aborts pending work and prevents old responses from repopulating it.

## Validation and production limits

Backend validation: 43 focused unit tests pass; TypeScript, production build and focused ESLint pass. Frontend production build and focused ESLint pass. All 11 browser regressions pass, covering cache-respecting refresh, stale/no-cache cooldown, timestamps, classification, AI independence, district selection and responsive map flows.

One local live diagnostic at 2026-10-18 08:21:45 UTC (13:21:45 Karachi) returned valid current and four-day forecasts for all seven districts in one batch. All seven had routine classification, zero next-24-hour precipitation and current provider time 08:15 UTC. This does not establish recovery on Render's egress IP. Render's current cooldown deadline and live authenticated endpoint status remain unverified.

Deploy both the backend on Render and the frontend on Vercel. No new environment variables or credentials are required. After deployment, run `node dist/scripts/diagnose-weather.js` from the built backend directory in Render Shell and inspect bounded `weather.provider_cooldown` / `weather.provider_recovered` events. The standalone diagnostic uses its own process/cache; it does not inspect or warm the running web process. A 429 should show a retry deadline and no repeated upstream attempts during that interval. Verify an authenticated overview and detail share cached timestamps and that a refresh does not cause another upstream call while fresh.

The cache/circuit are in memory, scoped to one backend process and lost on restart. Multiple replicas do not share cooldown or cached forecasts. A durable cross-replica cache is outside this patch. Batching reduces HTTP overhead but does not guarantee a proportional reduction in provider quota accounting. Sustained quota exhaustion still requires reviewing provider usage and the appropriate service plan; this patch does not bypass limits.

Provider references: [forecast API and multiple coordinates](https://open-meteo.com/en/docs), [usage terms and limits](https://open-meteo.com/en/terms).
