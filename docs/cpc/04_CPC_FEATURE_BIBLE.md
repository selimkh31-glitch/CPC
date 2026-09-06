# CPC Feature Bible

Version 1.0

Legend: CURRENT = evidenced in current master code/schema; TARGET = approved product direction that may require implementation; LATER = not required for core release.

## Authentication and onboarding — CURRENT
Email/session auth through Supabase. Authenticated user profile uses Supabase Auth UID as users.id. Onboarding creates the player identity needed by protected app routes.

Acceptance: unauthenticated users cannot access protected product state; authenticated users without completed profile are routed to onboarding; completed users reach correct context.

## Player profile — CURRENT
Fields include username, platform, main/secondary positions, play style, languages, availability, reliability, badges, plan and optional linked/verified data.

Rule: client cannot mutate server-owned trust fields.

## Club creation — CURRENT
Club identity includes owner, name, level, description/languages, optional EA club identifier, formation and voice link. OWNER membership is created atomically by database trigger.

## Formation and Match Sheet — CURRENT
Canonical formation catalog lives in application code. Database persists selected formation and SlotAssignment rows. One slot has at most one occupant and one user has at most one slot per club.

## LIVE recruiting — CURRENT + TARGET TTL
ClubSession is the recruiting-session entity with isLive and neededPositions. Realtime/feed behavior exists in current architecture.

TARGET: explicit 30/60/120 minute LIVE durations, default 120, automatic expiration, remaining-time UI and server-safe expiry. Do not fake TTL purely on client.

## Applications — CURRENT
Player -> club/session. Includes position and optional slotId. Status lifecycle: PENDING, ACCEPTED, REJECTED, WITHDRAWN.

Rules: position must be compatible with session need at submission; acceptance is sensitive/atomic; daily Free quota is server-side when active; prevent duplicate active intent according to DB/server invariant.

## Invitations — CURRENT
Club -> player. Optional slot. Statuses PENDING/ACCEPTED/DECLINED/CANCELLED; RESERVED only for transition workflow.

## Player search — CURRENT
Club-side player discovery exists. Filtering logic should remain centralized and testable. Future ranking may use compatibility/reliability but must not hide why a candidate is relevant.

## Trust Engine — CURRENT
Reliability score, streaks, badges, reviews and showed-up behavior exist. Shared reliability logic is intended as a single source of truth.

Rules: server-authoritative updates, no paid trust, no arbitrary client writes, explain score semantics.

## CPC OVR — CURRENT
CPC-derived overall/identity computation exists in shared code. It is a CPC metric, never an official EA rating.

## Departures / releases — CURRENT
Dedicated engagement lifecycle exists with initiator and statuses including PENDING, ACCEPTED_NOW, ACCEPTED_NEXT_MATCH, REFUSED, EXPIRED, FORCE_EXIT and OWNER_RELEASED. Active departure request is server-managed.

Rule: do not replace with direct deletion of ClubMember.

## Transition invitations — CURRENT
RESERVED invitation state and departure linkage support a player accepted for a future transition after fulfilling current commitment.

## Match check-in — CURRENT
Check-in is tied to a real ClubSession. Participation state includes PRESENT/ABSENT. Server functions own sensitive engagement mutations.

## Match Result Engine — CURRENT
Outcome supports WIN/DRAW/LOSS and is server-derived/validated. Match results connect club, recording actor and optional MVP concepts in schema.

## Notifications — CURRENT scaffold
Expo push token and notification infrastructure exist. Push tokens are sensitive and should not be broadly selectable client-side. Notify high-intent workflow events.

## RevenueCat / PRO — CURRENT scaffold
RevenueCat integration and entitlement plumbing exist behind feature configuration. Product packaging is not final merely because code contains a price/string.

## AI Smart Match / Scout — CURRENT scaffold
Edge-function architecture provides optional AI with deterministic fallback. AI may rank/explain; it cannot create factual stats or bypass eligibility.

## Leagues and seasons — CURRENT foundation
Season/ranking concepts and UI exist. Keep secondary to the core live recruiting loop until core reliability is validated.

## Social/follow graph — LATER
Social foundations may be developed after core stability. Requirements before implementation: explicit graph model, privacy/block behavior, notification rules, feed purpose, moderation and retention hypothesis. Do not bolt a generic feed onto CPC.

## Chat — TARGET/LATER
Chat should exist only where it reduces coordination friction. Before implementation define who can initiate, block/report behavior, retention, moderation, unread state, push policy and whether conversations are tied to applications/clubs.

## Blocking/reporting — TARGET
Required before broad social/chat rollout. A blocked relationship must affect discovery/contact surfaces consistently, not only hide one UI component.

## Freemium target
Core matchmaking remains usable on FREE. Current direction includes a limited daily application allowance and PRO convenience/intelligence. Exact quotas/pricing require Product Owner approval before hardcoding new values.

## Feature completion definition
A feature is not done when its happy-path screen exists. It is done when domain rules, authorization/RLS, concurrency, loading/error/empty states, realtime/cache behavior, analytics/logging needs, tests and rollback/migration implications are handled.