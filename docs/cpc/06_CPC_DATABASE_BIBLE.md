# CPC Database Bible

Version 1.0

This document describes invariants, not a replacement for prisma/schema.prisma and SQL migrations. Schema + deployed migrations remain implementation truth; this Bible defines what agents must preserve.

## User
Primary key equals Supabase Auth UUID. Important domains: identity/profile, platform/positions/play style/languages, availability, reliability/streak/badges, plan, optional external/verified data, application quota counters and push token.

Server-owned/sensitive fields must not become freely client-writable.

## Club
Owned by a User. Contains persistent club identity, level/languages, optional external club id, selected formation and voice link. Owner relation is not equivalent to arbitrary membership row; creation trigger ensures OWNER membership consistency.

## ClubMember
Persistent user membership in a club with OWNER/MANAGER/MEMBER role. Unique (club_id,user_id). Engagement counters and active departure request are server-managed.

Invariant: removing a SlotAssignment does not remove ClubMember.

## ClubSession
Recruiting/LIVE session for a club. Contains live state and needed positions. Current updated_at semantics support freshness ordering.

TARGET TTL: add a server-grounded expiry contract before UI countdown is treated as authoritative.

## Application
Player -> club/session recruiting intent.
Fields include user, club, session, position, optional slot, status, optional message, timestamp.

Invariants:
- referenced club/session relationship must be valid;
- requested position/slot compatibility is server-validated;
- active duplicate intent is prevented according to the current workflow;
- acceptance cannot overbook a slot or create contradictory membership state.

## SlotAssignment
Current occupancy of a formation slot.
Uniqueness:
- one occupant per (club,slot);
- one slot per (club,user).

Slot ids must belong to the selected formation at the time server accepts/assigns them.

## Invitation
Club -> player recruiting intent. Optional slot and inviter. RESERVED is a transition-only state. Transition linkage must remain nullable for normal invitations.

## Review
Reviewer -> target user with skill, behavior, showed-up and optional comment. Reputation recalculation is server-authoritative. Add uniqueness/eligibility rules based on actual match/session evidence before scaling reviews if not already enforced.

## Season / SeasonStat
Competitive/ranking domain. Changes must not couple core recruiting availability to a season being active.

## ClubDeparture
Engagement state machine for player-requested departure or owner-initiated release. Its statuses and relationships exist to preserve commitment semantics. Do not bypass with direct membership deletion from normal client flows.

## MatchCheckin / MatchParticipation
Check-in belongs to a real ClubSession/Club. Participation records user presence/absence. Server functions own lifecycle changes that affect commitment/strikes.

## MatchResult
Authoritative match-result domain. Outcome is WIN/DRAW/LOSS and must be server-derived/validated. Any trust/stat updates caused by result finalization belong in the same trusted workflow or an idempotent downstream process.

## Formation catalog
Not a DB table by design. Canonical definitions live in lib/formations.ts; Club.formation stores the selected key and SlotAssignment stores slot ids. Do not duplicate the catalog in Postgres without an explicit architecture decision.

## RLS/grants invariants
- Every user-facing table has intentional RLS.
- Client cannot read private operational columns merely because it can read a public profile row.
- Client cannot update trust/engagement counters directly.
- Owner/manager permissions are explicit and scoped to their club.
- Service-role functions validate caller before acting.

## Migration history observed on current master
Current repository contains an evolving SQL migration series including initial RLS/triggers, push-token grants, LIVE workflow, schema grants, Match Sheet RLS/grants, application-slot acceptance and engagement model/functions. Treat later migrations as cumulative history and inspect all migrations before altering a related invariant.

## Required DB change checklist
Before writing SQL, agent states:
1. current invariant;
2. desired invariant;
3. tables/columns/functions/policies affected;
4. compatibility with existing rows;
5. concurrent-write behavior;
6. uniqueness/index needs;
7. RLS/grant changes;
8. realtime implications;
9. TypeScript/client changes;
10. verification SQL/test plan.

## Forbidden shortcuts
- disabling RLS to make a feature work;
- service-role key in mobile;
- client-generated trust score;
- client-only duplicate prevention;
- deleting historical migrations to hide conflicts;
- broad GRANTs as a substitute for policy design;
- relying on UI role checks for authorization;
- creating formation data in multiple sources of truth.