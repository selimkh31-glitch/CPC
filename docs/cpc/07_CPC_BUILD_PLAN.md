# CPC Build Plan

Version 1.0

## Principle
Current master is not a blank MVP: it already contains substantial product, DB and engagement work. Therefore the plan starts with stabilization and truth reconciliation, not a rewrite.

Each phase ships as a narrow PR. No phase may silently redesign unrelated areas.

## P0 — Baseline and safety
Goal: establish reproducible current state.
- inventory routes/components/hooks/functions/migrations;
- run typecheck/lint/export checks;
- document env-dependent failures separately from code failures;
- verify current master against schema/migrations;
- establish protected baseline commit/tag;
- identify dead routes and duplicate old/new navigation paths without deleting them yet.

Exit: known baseline + issue list + no ambiguous starting point.

## P1 — Product OS adoption
Goal: make docs authoritative for agents.
- merge docs/cpc bibles;
- link README to Product OS;
- add agent instructions;
- define decision log/change process.

Exit: every coding task references relevant Bible sections.

## P2 — Core identity/onboarding audit
Goal: one reliable first-run path.
- auth guard;
- onboarding completion;
- profile edits;
- platform/position/language validation;
- CPC OVR/reliability labeling.

Exit: new account reaches usable player profile with no manual DB work.

## P3 — Club and Match Sheet hardening
Goal: club can operate a real squad.
- club creation + owner membership;
- formation selection;
- slot assignment invariants;
- owner/manager/member permissions;
- empty/occupied/recruiting slot UX.

Exit: club formation remains consistent under concurrent actions.

## P4 — LIVE V2 with real TTL
Goal: make LIVE a trustworthy urgency layer.
- choose persisted expiry design;
- migration + index;
- 30/60/120 min durations, default 120;
- server-side active/expired semantics;
- expiration worker/function strategy;
- countdown/freshness UI;
- Realtime/query behavior;
- stop LIVE when appropriate.

Exit: no session remains actionable after authoritative expiry.

## P5 — Applications and invitations hardening
Goal: recruiting transitions are atomic.
- duplicate PENDING invariant;
- exact position/slot validation;
- Free quota behavior;
- accept/reject/withdraw;
- invitation accept/decline/cancel;
- overbooking/concurrency tests;
- push notifications best-effort.

Exit: two devices cannot create contradictory accepted slot/member state.

## P6 — Commitment / departure / transition QA
Goal: preserve the advanced engagement model already present.
- test player departure;
- owner release;
- immediate vs next-match exit;
- RESERVED transition invitation;
- expiry/force-exit semantics;
- client UX for each state.

Exit: no normal UX path bypasses server lifecycle.

## P7 — Check-in and Match Result Engine QA
Goal: convert matchmaking into evidence.
- launch check-in only from valid session;
- present/absent flow;
- strike/commitment effects;
- result recording/finalization;
- MVP if retained;
- idempotency and duplicate-finalization tests;
- result history presentation.

Exit: completed play can safely feed trust/history.

## P8 — Trust Engine V2
Goal: make reputation credible and understandable.
- audit reliability formula;
- define event inputs;
- review eligibility;
- anti-abuse/duplicate rules;
- score explanation UI;
- badges/streak semantics;
- CPC OVR separation from official EA data.

Exit: score can be explained from auditable CPC events.

## P9 — Search/matching quality
Goal: reduce time to relevant connection.
- player search filters;
- LIVE relevance ranking;
- compatibility scoring;
- deterministic Smart Match baseline;
- optional AI explanation/ranking on top of deterministic eligibility.

Exit: AI outage does not break matching.

## P10 — Notifications and retention
Goal: bring users back for high-intent events.
- push permission timing;
- application/invitation responses;
- check-in/departure alerts;
- notification preferences if volume requires;
- deep-link destinations.

Exit: notification opens correct current state, including expired/changed cases.

## P11 — Monetization
Goal: monetize convenience without corrupting trust.
- finalize FREE/PRO matrix with Product Owner;
- RevenueCat products/entitlement;
- restore purchase;
- server sync/webhook;
- paywall UX;
- test Store sandbox builds.

Exit: entitlement is recoverable and core free loop remains functional.

## P12 — Social foundations
Goal: add social only after operational loop is stable.
Before coding, write a dedicated social RFC covering follow graph, privacy, block/report, moderation, notifications, feed purpose and chat permissions.

Exit: social reinforces repeat play rather than replacing CPC's core.

## P13 — Release hardening
- crash/error telemetry decision;
- privacy policy/data inventory;
- account deletion/data-rights flow;
- abuse/report handling;
- App Store/Play assets;
- EAS production builds;
- device matrix QA;
- load/security review of high-risk endpoints;
- seed/demo data separation from production.

## PR template for every phase
Each PR must contain: objective, Bible references, files changed, DB changes, security/RLS impact, user-visible states, tests run, known limitations, screenshots for UI work, and rollback/forward-fix note for migrations.