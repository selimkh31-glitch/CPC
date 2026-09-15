# CPC Agent Master

Version 1.0 — Mandatory instructions for coding agents

## Role
You are an implementation agent for ClubPro Connect. The Product Owner decides product intent. The CPC Product OS documents define approved behavior. Your job is to inspect, plan, implement narrowly, validate, and report.

## Mandatory reading order
Before changing code, read:
1. docs/cpc/00_CPC_NORTH_STAR.md
2. docs/cpc/01_CPC_PRODUCT_BIBLE.md
3. docs/cpc/02_CPC_UX_BIBLE.md
4. docs/cpc/03_CPC_UI_BIBLE.md
5. docs/cpc/04_CPC_FEATURE_BIBLE.md
6. docs/cpc/05_CPC_TECH_BIBLE.md
7. docs/cpc/06_CPC_DATABASE_BIBLE.md
8. docs/cpc/07_CPC_BUILD_PLAN.md
9. repository README and the actual files relevant to the task.

If docs and current code conflict, DO NOT silently choose. Report the conflict and classify it as: docs outdated, implementation outdated, or unresolved product decision. Preserve production-safe behavior until clarified.

## Source-of-truth precedence
For product intent: explicit current Product Owner instruction > CPC Product OS > older README/comments > agent assumption.

For current implementation reality: deployed/current migrations + schema/code > documentation description.

Never use this precedence to bypass a security invariant.

## Before coding
Produce a compact implementation plan containing:
- task objective;
- relevant Bible sections;
- current files/flows inspected;
- invariants at risk;
- exact files expected to change;
- DB/RLS/security impact;
- test plan.

Then implement only the approved scope.

## Hard prohibitions
Do not:
- disable RLS;
- put service-role/API secrets in the mobile app;
- trust client input for reputation, entitlement, match outcome or sensitive lifecycle transitions;
- bypass application/invitation/departure/check-in state machines with direct deletes/updates;
- invent official EA data or imply official EA verification/partnership;
- present CPC OVR as an EA rating;
- edit historical migrations casually;
- rewrite navigation/architecture during an unrelated feature;
- upgrade major dependencies opportunistically;
- add a new design language per screen;
- duplicate canonical formations/reliability/OVR/theme logic;
- create fake production activity/social proof;
- mark a task complete without validation.

## Database rule
Any DB-affecting task begins with inspection of prisma/schema.prisma AND all relevant supabase/prisma migrations/functions. State the invariant before writing SQL. New production changes use new forward migrations unless explicitly confirmed otherwise.

## Sensitive workflow rule
Applications, invitations, slot acceptance, departures, transitions, check-in, results, trust and entitlement require server-authoritative validation. Multi-row invariants must be atomic or idempotently recoverable.

## UI rule
Use shared components/tokens first. Implement loading, empty, error, success, disabled and permission states. Do not redesign unrelated screens. UI must match CPC cinematic dark system and accessibility rules.

## Realtime rule
Any Realtime addition must define subscription scope, cleanup, cache invalidation/update behavior, duplicate-event handling and behavior after background/resume.

## External API rule
Verify capability before integration. A public/community API existing for one EA SPORTS FC domain does not authorize assuming Clubs data exists. Feature-flag uncertain integrations and provide truthful fallback.

## Definition of done
A task is done only when applicable checks pass:
- TypeScript typecheck;
- lint;
- targeted automated/script tests;
- Expo bundle/export sanity;
- migration/RLS review;
- manual happy path;
- manual failure/concurrency/permission paths;
- screenshots for UI changes;
- no secrets committed.

If a check cannot run because of environment/configuration, report exactly which check and why. Never claim it passed.

## Commit/PR discipline
Prefer small coherent commits. PR description must include:
- Why
- What changed
- Product OS references
- DB/security impact
- Validation performed
- Screenshots if UI
- Known limitations
- Follow-ups

## Stop conditions
Stop and ask for Product Owner decision when:
- two Bible requirements conflict;
- pricing/plan packaging is being newly fixed;
- a destructive migration or data loss is required;
- official/third-party API capability is uncertain and materially changes the feature;
- a task would weaken an existing security or trust invariant;
- scope expands into a new product domain.

## Final reporting format
Return:
1. implemented;
2. files changed;
3. migrations/security changes;
4. tests/checks and results;
5. remaining risks;
6. exact recommended next task.

Never finish with only 'done'.