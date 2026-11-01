# EventHive deployment with Vercel

## What goes on Vercel

Deploy the **repository root** as the Vercel project. Do not set the Vercel Root Directory to `apps/web` because the root also contains the `/api` same-origin proxy used for authentication cookies.

`vercel.json` builds the shared package and the Vite frontend, then serves `apps/web/dist` with SPA fallback routing.

## Required Vercel environment variables

Set these in Project Settings → Environment Variables:

- `API_BACKEND_URL=https://<main-api-host>`
- `VITE_ISSUER_URL=https://<issuer-host>`
- `VITE_COLLECTOR_URL=https://<collector-host>`

Use **Node.js 24.x** for the Vercel project.

## Backend services

The privacy architecture requires three services/databases. Deploy these as separate Node services:

1. Main API — `apps/api`, port 3000
2. Issuer — `apps/issuer`, port 3001
3. Collector — `apps/collector`, port 3002

They may be hosted on your Node hosting provider of choice. Configure three PostgreSQL databases/roles using the URLs in `.env.example` as the naming reference.

For the main API set:

- `WEB_ORIGIN=https://<your-vercel-domain>`
- `ISSUER_URL=https://<issuer-host>`
- `COLLECTOR_URL=https://<collector-host>`
- the three database URLs
- all signing/admin/session secrets

For the issuer and collector, set the same `WEB_ORIGIN` and their own database/admin/signing variables. Never expose private signing keys or database URLs as `VITE_*` variables.

## Production secret checklist

Replace every development secret from `.env.example`, especially:

- `SESSION_SECRET`
- `ISSUER_ADMIN_SECRET`
- `COLLECTOR_ADMIN_SECRET`
- `KEY_ENCRYPTION_SECRET`
- `GRANT_PRIVATE_KEY_JWK`
- `GRANT_PUBLIC_KEY_JWK`
- `ORGANIZER_SIGNUP_CODE`

Do not commit `.env`.

## Database initialization

Against the production database URLs:

```bash
npm ci
npm run build:shared
npm run migrate
npm run seed   # use for hackathon/demo data; omit for a clean production dataset
```

## Deployment smoke checks

After deployment verify:

- `https://<main-api-host>/health`
- `https://<issuer-host>/health`
- `https://<collector-host>/health`
- Vercel `/api/auth/me` reaches the main API through the proxy
- student demo login works
- event list/search/filters load
- register → cancel → waitlist promotion works
- Living QR rotates every 30 seconds
- Riya can open the seeded completed event and submit anonymous feedback
- organizer login shows the dashboard without create/edit/delete controls
