# EventHive hackathon scope

## Included user-facing features

Authentication; event discovery/details; search and filters; registration; waitlist/cancellation; My Events; profile; Living QR tickets; anonymous feedback; privacy; read-only Organizer Dashboard.

## Deliberately not exposed

Organizer create/edit/delete, participant-management UI, analytics charts, Best-Slot Finder, Squad Finder, Live Pulse, certificates, Vibe Search, two-hour search, Campus Passport, Department Cup, Campus Wrapped, Question Wall and admin UI.

The anonymous-feedback issuer and collector are retained because they are supporting security architecture, not extra user-facing features.

Some legacy database tables remain in migrations/seed data to avoid a risky schema rewrite immediately before the hackathon. They are not mounted as user-facing routes in the main API or frontend.
