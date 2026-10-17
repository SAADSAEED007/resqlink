# Technical foundation

ResQLink uses two independent npm applications. There is no workspace package manager, shared build process, Turborepo, or Nx. The frontend can deploy to Vercel independently of the backend on Render/Railway.

The frontend uses Next.js App Router with TypeScript under src/, Tailwind CSS, ESLint, and the @/* import alias. The home page is a minimal project placeholder. NEXT_PUBLIC_API_URL documents the future API connection; no API client or business flow is implemented.

The backend was imported from https://github.com/SAADSAEED007/Base-Server-MERN at main commit 5afe3770ee791cc319a1a96a072bd17f9ff467cd. Its application architecture, middleware, controllers, services, repositories, models, tests, package lockfile, and license are retained. Original .git, logs, node_modules, generated files, and actual environment files were excluded.

Requests pass through Express security, cookie, CORS, and JSON middleware into the inherited API router, followed by not-found and error handlers. Controllers call services and MongoDB repositories/models. Bootstrap connects MongoDB and initializes rate limiting; Winston also connects to MongoDB for logging. The original server begins listening before bootstrap completes: a listening socket alone does not establish readiness. A working MongoDB connection is required for normal operation. Resend initializes during module import and needs an API key.

Small integration changes: backend CORS reads FRONTEND_URL instead of the upstream placeholder domain; the example backend port is 4000; frontend scripts include type checking. Other necessary build/start fixes, if any, are recorded in verification.md. Inherited authentication is boilerplate, not a completed ResQLink authentication design. No new business endpoints have been added.

Each app loads its own environment files. Secrets belong only in backend environment configuration. NEXT_PUBLIC_* values are public and embedded in browser builds. The root .env.example is a reference, not an application configuration loader.

Use feature branches from dev and PRs targeting dev. The setup PR must be merged before team members branch from dev for feature work. Agree on contracts and ownership before parallel frontend/backend development.
