# EventHive scoped build decisions

The supplied 39-page specification describes a much larger product than the hackathon scope requested for this repository. For this build, the user's explicit feature list overrides the broader P0/P1/P2 feature set.

## 1. User-facing scope

Only authentication, event discovery/detail, search/filters, registration, waitlist/cancellation, My Events, profile, Living QR tickets, anonymous feedback, privacy, and a read-only Organizer Dashboard are mounted in the frontend.

Organizer CRUD, squads, slot finder, certificates, pulse, passport, wrapped, department cup, question wall, admin UI and other extended features are not mounted.

## 2. Organizer dashboard

The organizer dashboard is intentionally read-only. The scoped main API exposes only `GET /api/organizer/dashboard`; create/edit/delete/participant-management/analytics organizer routes are not mounted.

## 3. Anonymous feedback architecture

The issuer and collector remain separate services/databases because their separation is required for the blind-signature privacy design. This is supporting architecture for the retained anonymous-feedback feature, not additional product scope.

Browser token code is kept free of Node-only `crypto`/`Buffer` dependencies. Server-only key encryption and Living QR verification live in server packages.

## 4. Living QR

QR payload: `EH1.<registrationId>.<window>.<mac>`, where `window=floor(unixSeconds/30)` and `mac` is the first 20 hex characters of HMAC-SHA256 over `<registrationId>.<window>`. Verification accepts current ±1 window and compares MACs in constant time.

## 5. Vercel

Vercel hosts the frontend and a same-origin `/api` proxy. The main API, issuer and collector remain separate backend origins/services. The project targets Node 24.x because the pinned blind-RSA package requires Node 24+.

## 6. Legacy schema

Some tables for excluded features remain in the existing migrations/seed script. Rewriting historical migrations immediately before the hackathon would add deployment risk without changing the exposed product. Excluded main-API routers and frontend routes are not mounted.

## 7. Verification

`VERIFICATION.md` is the authoritative verification report. `.github/workflows/verify.yml` performs the dependency-backed Node 24 build/test/database smoke sequence on push.
