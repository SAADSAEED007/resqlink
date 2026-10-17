# ResQLink

Intelligent Disaster Response & Rescue Coordination Platform for Code Connect Hackathon 2026. This repository establishes the foundation for a four-person team working toward a 36-hour MVP. Backend core provides incident intake, prototype priority scoring, rescue teams, transactional assignments, and approximate team recommendations. The frontend remains a minimal placeholder.

## Stack and structure

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS, ESLint; npm.
- Backend: imported Express/TypeScript MERN base server, Mongoose, Joi, JWT, bcrypt, Winston, Resend; npm.
- Database: MongoDB, with Atlas suitable for hosted environments.

```text
frontend/                 Independent Next.js application
  src/app/                Layout, styles, minimal home page
  .env.example
backend/                  Existing Base-Server-MERN application
  src/APIs/               Controllers, services, repositories, models
  src/bootstrap/          Database and rate-limiter initialization
  src/config/             Environment configuration
  src/middlewares/        Authentication, errors, rate limiting
  src/__tests__/          Inherited unit tests
  scripts/                Inherited migration utilities
  .env.example
  README.md               Original upstream documentation
  LICENSE                 Upstream ISC license
  docker/                 Existing upstream assets; not required for setup
docs/
  architecture.md
  api-contracts.md
.env.example              Reference only; not loaded by either app
.gitignore
README.md
```

## Local setup

Use Node.js 24 LTS and npm. Run each app in its own terminal. On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`; changing execution policy is unnecessary.

```bash
git clone https://github.com/SAADSAEED007/resqlink.git
cd resqlink
git switch dev
```

The initial foundation is submitted on `feature/initialize-monorepo`; until its PR is merged, switch to that branch to use it.

Frontend:

```bash
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. In PowerShell replace `cp` with `Copy-Item` if preferred.

Backend, in a second terminal:

```bash
cd backend
npm ci
cp .env.example .env
# Configure the values below before starting.
npm run start:dev
```

The API server uses port 4000 to avoid colliding with Next.js. Run commands from their respective application directories. Do not run the inherited backend setup CLI: it manages Git and is intended for standalone upstream projects. The inherited Husky prepare script may report that it cannot find a Git directory from backend/; root Git hooks are intentionally not installed.

## Environment configuration

The root example is a reference. Next.js loads frontend/.env.local; dotenv-flow loads backend/.env and environment-specific overrides. Never commit actual environment files.

| Variable | Location | Purpose |
| --- | --- | --- |
| NEXT_PUBLIC_API_URL | frontend | Public API base URL, initially http://localhost:4000/api; used by core API clients |
| NODE_ENV | backend | development locally, production when hosted |
| ENV | backend | development or production; controls inherited logging and error behavior |
| PORT | backend | 4000 locally; hosting provider may supply it |
| SERVER_URL | backend | Backend public origin, used in inherited email links |
| FRONTEND_URL | backend | Exact allowed browser origin for credentialed CORS |
| DATABASE_URL | backend | Required MongoDB connection string; also used by logging and rate limiting |
| EMAIL_SERVICE_API_KEY | backend | Optional Resend API key; email sending is skipped with a warning when unset |
| ACCESS_TOKEN_SECRET | backend | Required independent random secret for inherited access tokens |
| REFRESH_TOKEN_SECRET | backend | Required independent random secret for inherited refresh tokens |
| MIGRATE_MONGO_URI | backend | MongoDB URI for optional inherited migration CLI |
| MIGRATE_AUTOSYNC | backend | Optional migration setting; false in template |
| SALT_ROUNDS | backend | Inherited template variable; hashing currently uses fixed cost 10 |

For Atlas, create a cluster and database user, configure network access for your machine or backend host, and put the provided connection string in DATABASE_URL. URL-encode special characters in the password. Alternatively, install MongoDB locally and supply your own local URI. No database or account is provisioned by this setup.

Generate each JWT secret separately with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and save it only in backend/.env or hosting settings. Email is disabled until you uncomment EMAIL_SERVICE_API_KEY and supply a Resend key from your own account. The inherited sender is onboarding@resend.dev; verify a sender/domain and review account restrictions before using email beyond development. No email or database credentials are supplied.

## Validation

```bash
cd frontend
npm run lint
npm run typecheck
npm run build
```

```bash
cd backend
npm run build
npm run lint
npm run format:check
npm test -- --runInBand
```

Seedocs/verification.md for the setup run's actual results and inherited failures. Existing boilerplate tests and routes are not proof of completed ResQLink features.

## Git workflow

- main: stable releases only.
- dev: integration branch; merge reviewed feature PRs here.
- feature/*: create from the latest dev, one task per branch.

```bash
git switch dev
git pull --ff-only origin dev
git switch -c feature/your-task
# Make and validate your changes.
git add <specific-files>
git commit -m "feat: describe your change"
git push -u origin feature/your-task
```

Open a GitHub Pull Request with base `dev`. The Tech Lead reviews and merges. Promote validated dev releases to main through a PR. Never force-push shared branches. Configure GitHub branch protection/rulesets for main and dev to require PR review; branch naming alone does not enforce review.

## Deployment overview (nothing deployed)

- Vercel: choose frontend as the project root, use the Next.js preset, and configure NEXT_PUBLIC_API_URL to the hosted backend URL plus /api before building. Public Next.js variables are embedded at build time; rebuild after changes.
- Render or Railway: choose backend as the service root, install development dependencies for TypeScript compilation (`npm ci --include=dev`), build with `npm run build`, and start with `npm run serve`. Set ENV=production, NODE_ENV=production, SERVER_URL, FRONTEND_URL, DATABASE_URL, and both token secrets; email key is optional. Use the provider's PORT.
- MongoDB Atlas: configure the database user and network access for the backend host. The backend also stores logs and rate-limit state in MongoDB. Local log files are ephemeral on hosting platforms.
- Existing backend Docker assets are preserved for provenance but are not needed for this workflow. No Docker or CI/CD additions were made.

Before public launch, review the inherited authentication, email sender, CORS, and health behavior with the team. Use docs/api-contracts.md for implemented core APIs and frontend integration.

Provider references: [Next.js CLI](https://nextjs.org/docs/app/api-reference/cli/create-next-app), [Vercel monorepo roots](https://vercel.com/docs/monorepos), [Render Express deployment](https://render.com/docs/deploy-node-express-app), [MongoDB setup](https://www.mongodb.com/docs/get-started/).

Backend core API contracts, coordinator setup, seed safeguards, and frontend integration are documented in [docs/api-contracts.md](docs/api-contracts.md). Demo seed: set DEMO_MODE=true, NODE_ENV=development, and a separate DEMO_DATABASE_URL ending in _demo, then run npm run seed:demo from backend. Core coordinator operations require an existing admin account; no authorization bypass is provided.

## Frontend foundation

The shared UI, coordinator login, typed API client, and teammate integration guide are in [docs/frontend-foundation.md](docs/frontend-foundation.md). Dashboard and SOS feature routes currently contain honest placeholders. Start the frontend with `cd frontend` then `npm run dev`; configure both public API URLs using `frontend/.env.example`.
