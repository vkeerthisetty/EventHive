# Verification report

Prepared for the scoped hackathon build.

## Checks completed in the preparation environment

**PASS** — source archive extracted and edited from the supplied EventHive project rather than rebuilt from an unrelated template.

**PASS** — frontend route scope check: only the requested pages are mounted.

**PASS** — main API mount scope check: auth, events, registrations/My Events, anonymous feedback grant, and read-only organizer routes are mounted; excluded main routers are not mounted.

**PASS** — demo account contract: the login one-click credentials exactly match `scripts/seed.ts`.

**PASS** — organizer signup contract: organizer code is sent and valid department enum values are used.

**PASS** — search/filter UI contract: category, query, sort, past toggle, price, venue, date, accessibility and dietary controls are URL-backed and the API has matching query handling.

**PASS** — waitlist promotion path creates a notification, and `/api/me/notifications` + read-all endpoints exist for the navbar.

**PASS** — Living QR browser generation and server verification use the same `EH1.<registrationId>.<30s window>.<20 hex HMAC>` format. A direct WebCrypto-vs-Node-HMAC parity check produced identical MACs. Server accepts current ±1 window and uses constant-time MAC comparison.

**PASS** — browser crypto boundary: the browser shared entrypoint no longer exports the Node-only QR verifier; the blind-signature browser helper contains no Node `crypto` import or `Buffer` dependency.

**PASS** — anonymous feedback grant is restricted to `purpose=feedback`, checked-in confirmed registrations, after event end and before the event feedback-window deadline.

**PASS** — read-only organizer dashboard API/UI contract field names were aligned and organizer mutation routes are not mounted in the scoped main API.

**PASS** — Vercel config, JSON manifests and same-origin main-API proxy syntax check.

**PASS** — all local relative TypeScript imports resolve after scope cleanup.

**PASS** — TypeScript parser/transpile checks (`tsc --noCheck`) succeeded for shared, API, issuer, collector, web, migrate, seed and embedded-Postgres scripts.

**PASS** — `package-lock.json` was synchronized offline with the scoped package manifests; npm reported 0 known vulnerabilities from the available lock metadata.

## Runtime-build limitation of this verification environment

A dependency-backed `npm run build` / Vitest run could not be executed **inside this particular preparation container** because it runs Node 22 while `@cloudflare/blindrsa-ts@0.4.6` requires Node 24, and outbound npm package downloads failed (`EAI_AGAIN`; the local npm cache was also missing packages such as `date-fns-tz`). Docker/PostgreSQL were not available in this container either.

This is an environment limitation, not a pass result. Therefore this report does **not** falsely claim that a full live PostgreSQL end-to-end run occurred here.

To close that gap automatically, `.github/workflows/verify.yml` runs on Node 24 after you push: `npm ci`, static verification, full build, unit tests, Docker PostgreSQL, migrations, seed, and health smoke checks. A green workflow is the final runtime verification signal.
