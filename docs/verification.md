# Backend core verification — 2026-10-17

Current backend core checks supersede the historical initialization results below.

| Check | Actual result |
| --- | --- |
| Branch baseline | Foundation PR #1 merged into dev; feature/backend-core created from current dev. Previously requested optional-email fix included by cherry-pick. |
| Dependencies | Existing installed npm dependency tree verified with npm ls --depth=0; no libraries added and backend lockfile unchanged. |
| TypeScript build | npm run build passed after core, startup, and authentication integration changes. |
| ESLint | npm run lint passed after fixing typed test assertions and new application code. |
| Full tests | Jest --runInBand --detectOpenHandles --testTimeout=30000: 4 suites passed, 48 tests passed, no skipped tests in the opt-in database run. |
| Real transaction/API tests | Dedicated random resqlink_core_test_<hex> Atlas database; admin cookie login, admin-only access, public SOS validation, ID errors, body limit, missing location, competing assignment claims, team release, recommendation ordering/filtering/capacity warnings, overrides, pagination. Test database cleaned up. |
| Isolated tests | Scoring boundaries and missing data, invalid coordinates/counts, model validation, lifecycle policy, unavailable/incompatible/duplicate assignment rejection, successful orchestration, resolution/cancellation release, inconsistency rejection, audit actor, unsupported-transaction response. Existing authentication unit tests passed with only the logger isolated from external I/O. |
| Startup | npm run start:dev on test port 4107 connected to configured MongoDB, initialized indexes/rate limiter, then listened. GET /v1/health returned 200; unauthenticated GET /api/incidents returned 401. Test server stopped. |
| Seed safety | Missing DEMO_MODE rejected with exit 1 before connecting. Seed run twice in a dedicated temporary _demo database: 6 incidents, 5 teams, 1 active assignment; complete data snapshots unchanged on the second run. Temporary database cleaned up. |
| Formatting | npm run format:check still fails on 9 unchanged upstream files listed in historical results. All modified/new TypeScript and modified package/test files were formatted. |
| Frontend | No pages/components modified; only frontend/.env.example changed from /v1 to /api for integration. |
| Secrets | Local backend/.env remains ignored and unchanged; only placeholder templates are eligible for staging. |

Database integration tests are opt-in. Normal `npm test -- --runInBand` skips the integration suite unless TEST_DATABASE_URL is explicitly supplied and names an isolated `resqlink_core_test_<hex>` database. Tests refuse application database names and only clean their own validated test database. Real test runs derived a temporary database URI from local configuration without printing credentials; no real application records were inserted, changed, or deleted.

Seeding requires DEMO_MODE=true, NODE_ENV=development, ENV not production, and a separate DEMO_DATABASE_URL ending in `_demo`. Use a short database name such as resqlink_demo; the first verification attempt used a name rejected by Atlas at index creation, then was corrected to a shorter temporary name and both runs passed. No actual application URI/credentials are committed.

Remaining limitations: prototype scoring is unvalidated decision support; location verification is manual with no coordinate-edit endpoint in scope; capacity is advisory; coordinator provisioning uses existing users plus trusted admin-role promotion; cross-site cookie hosting needs review; existing dependency advisories and upstream formatting debt are unresolved. Transactions require Atlas or a replica set; no unsafe standalone fallback. No real dispatch or deployment occurred.

---
# Initialization verification — 2026-10-17

Executed on Windows with Node.js 24.17.0 and npm 11.13.0. No deployment was performed.

| Check | Result |
| --- | --- |
| Repository layout | frontend/, backend/, docs/, root README, ignore rules, and three environment examples present; one root Git repository |
| Frontend dependency install | create-next-app npm install completed; npm ls --depth=0 passed |
| Frontend lint | npm run lint passed |
| Frontend types | npm run typecheck passed (Next type generation and tsc --noEmit) |
| Frontend production build | npm run build passed; / statically prerendered |
| Frontend development startup | npm run dev ready; GET http://localhost:3000 returned HTTP 200 with ResQLink content |
| Backend dependency install | npm ci passed against unchanged upstream lockfile; npm ls --depth=0 passed |
| Backend build | npm run build passed |
| Backend lint | npm run lint passed; repeated after formatting modified files, exit 0 |
| Backend formatting | npm run format:check failed on 9 unchanged upstream files: .prettierrc, .vscode/launch.json, commitlint.config.js, docs/APIs/BestPractices.md, docs/APIs/development.md, docs/DEPENDENCIES.md, eslint.config.mjs, nodemon.json, README.md |
| Backend tests | npm test -- --runInBand failed before executing tests: inherited logger requires DATABASE_URL; 1 failed suite, 0 tests executed |
| Backend startup | npm run start:dev attempted; ts-node reached logger initialization and crashed with 'You should provide db to log to.' No actual environment files/credentials supplied; successful database-backed startup is unverified |
| Ignore rules | Actual env files, node_modules, .next, dist ignored; the service-specific .env.example files are eligible for tracking |
| Credential scan | No private-key, GitHub-token, OpenAI-key, or credential-bearing MongoDB URI patterns found in imported/project source outside generated dependencies |

Installed primary versions: frontend Next.js 16.4.2, React/React DOM 19.3.0, Tailwind CSS 4.3.3, TypeScript 5.9.3, ESLint 9.39.5; backend Express 4.21.0, Mongoose 8.6.3, TypeScript 5.6.2, Jest 29.7.0, ESLint 9.11.1. Lockfiles record the full dependency trees.

npm reported 5 high-severity frontend advisories (ESLint tooling chain) and 81 backend advisories (10 low, 8 moderate, 59 high, 4 critical). These are unresolved; no force-fix or broad dependency upgrade was applied to the imported foundation. Review and remediate the inherited dependency tree before public deployment.

The backend prepare script printed '.git can\'t be found' because backend/ is not a standalone Git repository; install still exited successfully. Upstream .husky files are preserved but no root hooks were configured. Git ownership differed between sandbox and host identities; commands used an invocation-scoped safe.directory exception for this workspace without changing global trust settings.

Required next configuration: supply DATABASE_URL and EMAIL_SERVICE_API_KEY, generate independent ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET, and confirm SERVER_URL/FRONTEND_URL. MongoDB is used for application data, logging, and rate limiting. Repeat backend startup and tests after configuration; the inherited unit tests currently load the database logger and should later isolate that side effect with a mock.

Temporary verification servers were stopped. Review the setup PR into dev before starting team feature branches. GitHub branch protection is not configured by this initialization.

Git diff --cached --check also reports inherited trailing whitespace in upstream backend documentation and a blank line in .prettierrc; these files were preserved rather than reformatted. The tracked environment templates are service-specific; generated artifacts and actual environment files are not staged.
