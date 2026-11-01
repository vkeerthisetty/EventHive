# EventHive

**Every event on campus, from discovery to feedback.**

Hackathon-scoped EventHive build. The UI exposes only:

- Authentication (student + organizer signup/login)
- Event discovery and event details
- URL-based search and filters
- Registration
- Waitlist, cancellation and automatic promotion
- My Events
- Profile
- Living QR tickets
- Anonymous feedback with RSA blind signatures
- Privacy page
- Read-only Organizer Dashboard

## Architecture

- `apps/web` — React 18 + Vite frontend
- `apps/api` — identity, events, registrations, QR and organizer read API
- `apps/issuer` — attendance eligibility + blind-signature issuer
- `apps/collector` — anonymous feedback collector
- `packages/shared` — shared schemas, constants, browser-safe token helpers
- PostgreSQL 16 — separate main, issuer and collector databases/roles

The issuer and collector stay separate because that separation is part of the anonymous-feedback design.

## Requirements

- **Node.js 24.x** (required by `@cloudflare/blindrsa-ts@0.4.6`)
- npm
- Docker + Docker Compose for the easiest local PostgreSQL setup

## Local setup

```bash
cp .env.example .env
npm ci
docker compose up -d postgres
npm run migrate
npm run seed
npm run build
npm test
npm run dev
```

Open `http://localhost:5173`.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Student | `riya@eventhive.test` | `Student@123` |
| Organizer | `tech@eventhive.test` | `Organizer@123` |
| Admin | `admin@eventhive.test` | `Admin@123` |

The login screen has one-click buttons for these exact seeded accounts. Riya also has a checked-in completed event in the seed data, so the anonymous-feedback flow is demoable immediately.

Organizer signup code in the development env example: `ORG2026`.

## Verification

Run:

```bash
npm run verify:static
npm run build
npm test
docker compose up -d postgres
npm run migrate
npm run seed
```

A GitHub Actions workflow at `.github/workflows/verify.yml` runs Node 24 dependency install, scope checks, full build, unit tests, migrations, seed, and backend health checks on every push/PR.

See `VERIFICATION.md` for exactly what was verified while preparing this archive and the one environment limitation of that verification run.

## Vercel

The frontend is prepared for Vercel at the repository root. The `/api/*` path is proxied through `api/[...path].js` to the deployed main API so the `eh_session` cookie remains same-origin to the browser.

See `VERCEL_DEPLOYMENT.md` before deploying. The issuer and collector must remain separate HTTPS origins for the privacy design.
