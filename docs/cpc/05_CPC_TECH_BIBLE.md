# CPC Technical Bible

Version 1.0

## Current stack
- React Native 0.86.x
- React 19.2.x
- Expo SDK 57
- Expo Router
- TypeScript strict intent
- NativeWind/Tailwind
- TanStack React Query
- Supabase Auth + Postgres + Realtime + RLS + Edge Functions
- Prisma for schema/migrations/seed tooling, not runtime mobile ORM
- Expo notifications
- RevenueCat/react-native-purchases scaffold
- Reanimated/Moti for motion
- Lucide React Native icons

Do not replace major stack choices during feature work without explicit approval.

## Architectural doctrine
Client renders state and performs safe/simple RLS-protected operations. Sensitive, multi-step or reputation/entitlement mutations are server-authoritative through SQL/RPC/Edge Functions.

Never move a sensitive server invariant into client-only code for convenience.

## Data access
- Mobile runtime uses supabase-js.
- React Query owns server-state caching.
- Realtime invalidates/updates relevant queries.
- Avoid duplicate local stores for server truth unless a specific offline design is approved.
- Use explicit public user columns; do not broaden sensitive selects.

## Authentication
users.id maps to Supabase Auth UID. Protected screens require session. Authorization is separate from authentication: club roles and ownership are validated at DB/server level.

## Database changes
Any schema change must include:
1. migration strategy;
2. existing-row/backfill analysis;
3. RLS/grant impact;
4. indexes/uniqueness impact;
5. Edge Function/RPC compatibility;
6. TypeScript type updates;
7. rollback or forward-fix strategy.

Never edit historical production migrations merely to make the final folder look clean. Add a new migration unless the Product Owner explicitly confirms the migration has never been deployed anywhere.

## RLS
RLS is part of product correctness, not cleanup.

Rules:
- authenticated vs anon access is explicit;
- ownership/manager/member permissions are explicit;
- sensitive columns such as push tokens and server-owned engagement counters stay protected;
- hiding a button is never authorization;
- service_role functions must authenticate caller and validate authorization themselves.

## Atomicity
Use database transaction/RPC/server function for workflows that mutate multiple related entities or enforce cross-row invariants: application acceptance, invitation acceptance, departures/transitions, check-in finalization, match results, trust updates.

## Realtime
Realtime is used where state freshness materially changes decisions: LIVE, applications/invitations, squad/slot state and relevant operational events. Every subscription must have cleanup and scoped channel identity. Avoid subscribing to broad tables without filters when a narrower strategy exists.

## LIVE TTL target
TTL must be server-grounded. Preferred shape: persisted expires_at or equivalent server-derived expiry, indexed query for active sessions, safe expiry job/function, UI countdown derived from server timestamp. Client timers are presentation only.

## Shared business logic
Existing shared modules such as reliability, OVR, formations, theme/constants should remain canonical. Do not duplicate algorithms into screens and Edge Functions. If runtime boundaries make sharing unsafe, create explicit server/client adapters with test vectors.

## Edge Functions
Current architecture includes functions for applications/responses, reviews, EA linking/sync scaffolding, rankings, smart matching/scouting, moderation and RevenueCat webhook; later migrations/functions also implement engagement workflows.

Function requirements:
- validate JWT/caller where user initiated;
- validate payload;
- enforce role/ownership;
- use idempotency/uniqueness where retries are possible;
- return typed, stable errors;
- never expose service-role secrets to mobile.

## External data / EA
Treat any EA integration as capability-gated and source-specific. Do not scrape, fabricate or infer official stats and label them verified. The existence of a generic FC community API does not automatically mean Clubs profile data is available or authorized for CPC.

## RevenueCat
Public SDK keys may be mobile configuration; webhook secrets/service credentials stay server-side. Entitlement changes must be synchronized safely and not grant trust/reputation.

## Notifications
Push registration requires device/build realities. Tokens are sensitive operational data. Notification failure must not fail the underlying business transaction; send best-effort after authoritative state succeeds.

## Error model
Server should return stable machine-readable error codes plus safe human message. UI maps known codes to actionable copy. Do not branch product logic by parsing arbitrary English error strings.

## Testing gates
At minimum for each implementation phase:
- npm run typecheck
- npm run lint where configured/working
- targeted tests/scripts
- Expo bundle/export sanity for changed runtime paths when practical
- migration SQL review for schema work
- manual state-machine test plan for sensitive flows

## Performance
Avoid N+1 client fetches in lists. Paginate potentially unbounded directories/history. Keep LIVE feed payload focused. Images/assets must not block operational UI.

## Security
Never commit .env/secrets. Never log auth tokens/service keys. Validate deep links and externally opened URLs. Rate-limit/abuse-protect public-ish actions where necessary. Moderation/blocking becomes mandatory with user-generated messaging/social surfaces.

## Agent scope discipline
Feature work must not opportunistically upgrade Expo/React Native/Supabase/Prisma or rewrite navigation. Dependency upgrades are separate tasks with separate validation.