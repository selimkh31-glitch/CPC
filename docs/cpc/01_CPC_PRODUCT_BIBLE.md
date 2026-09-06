# CPC Product Bible

Version 1.0 — Product source of truth

## 1. Product
ClubPro Connect (CPC) is a mobile matchmaking, club-operations and reputation product for EA SPORTS FC Clubs.

Two primary modes coexist: PLAYER and CLUB. The product must make switching context understandable without creating two disconnected apps.

## 2. Jobs to be done
Player: find live opportunities, find clubs, apply to a relevant position/slot, handle invitations, join and leave clubs predictably, show availability/identity, and build CPC reputation.

Club: create and configure a club, select formation, assign members to slots, declare immediate needs, review applications, invite players, manage departures/releases, check players in, record results, and maintain a reliable squad.

## 3. Core loop
1. Club creates or updates its squad.
2. Club opens a LIVE recruiting session with needed positions.
3. Relevant players discover the session.
4. Player applies to a position/slot OR club invites a player.
5. Server validates eligibility and transition.
6. Accepted player becomes a member/slot occupant according to the workflow.
7. Club launches match/check-in.
8. Participation/result is recorded.
9. CPC trust/reputation evolves.
10. Better identity improves future matching.

## 4. Existing domain model that must be preserved
Current code contains User, Club, ClubMember, ClubSession, Application, SlotAssignment, Invitation, Review, Season/SeasonStat plus engagement/departure/check-in and match-result concepts. Do not collapse distinct concepts merely to simplify UI.

Important distinctions:
- Application = player -> club.
- Invitation = club -> player.
- ClubMember = persistent membership.
- SlotAssignment = current formation occupancy; deleting a slot assignment must not implicitly delete membership.
- ClubSession = LIVE recruiting context.
- Match check-in/result = evidence of actual participation, not recruiting state.

## 5. Roles
OWNER: ultimate club authority.
MANAGER: delegated operational authority where server rules allow it.
MEMBER: club participant.

Authorization is never inferred only from what a button hides. Server/RLS authorization remains mandatory.

## 6. LIVE
LIVE is the urgency engine of CPC.

Requirements:
- a club can expose current recruiting needs;
- players see relevant active sessions;
- needed positions are explicit;
- exact slot targeting is supported where available;
- expired/inactive sessions must not behave as live;
- UI must clearly distinguish LIVE from persistent club recruitment;
- state changes should propagate through Realtime/query invalidation.

TTL policy must be represented explicitly by the implementation. Existing product direction supports 30/60/120-minute live windows with 120 minutes as the default. If current master lacks persisted TTL, treat it as a planned contract rather than silently inventing database state.

## 7. Applications
- Player chooses a valid needed position.
- Optional exact slot may be pinned.
- Duplicate or contradictory PENDING states must be prevented by server/database rules.
- Free-plan daily gating, when enabled, is server-enforced.
- Accept/reject is a sensitive multi-step mutation.
- Acceptance must preserve membership and slot invariants atomically.

## 8. Invitations
- Club -> player, separate from applications.
- May target an exact slot or be general.
- Normal states: PENDING, ACCEPTED, DECLINED, CANCELLED.
- RESERVED is reserved for the transition/departure workflow and must not be reused casually.

## 9. Commitment and departure
Membership is not disposable UI state. CPC models player departure/release and may support immediate exit, next-match exit, refusal/expiry/forced exit, and transition offers. Agent changes must preserve the server-controlled lifecycle and never bypass it with direct client deletes.

## 10. Match Sheet
A club formation is selected from the canonical application formation catalog. Slot assignments represent occupancy of formation slots. Formation definitions are code-owned; the database stores the selected formation, not a duplicate formation catalog.

## 11. Check-in and results
Check-in is tied to a real club session. Participation distinguishes PRESENT/ABSENT. Match outcome is server-derived/validated. Result recording must not become a client-trusted reputation exploit.

## 12. Trust Engine
Trust is earned from CPC activity. Existing concepts include reliability score, current/best streak, badges, reviews and show-up behavior.

Rules:
- no pay-to-trust;
- no self-review;
- no client-authoritative score edits;
- distinguish skill feedback from behavior/reliability;
- reputation changes should be explainable.

## 13. CPC OVR / ClubPro Card
CPC OVR is a CPC-derived identity signal. It is not an official EA overall rating. Any UI displaying it must label/contextualize it as CPC-derived. Verified game stats, if later sourced legitimately, remain separate data.

## 14. Discovery
Player discovery should prioritize relevance over endless browsing. Filters can include platform, position/slot compatibility, club level, language and live state. Club player-search follows the same principle.

## 15. Notifications
High-value notifications: new application, application response, invitation, transition/departure decision, relevant check-in, and other time-sensitive club actions. Avoid notification spam for low-intent events.

## 16. Monetization
Plans: FREE and PRO.
Current repository contains RevenueCat scaffolding and a PRO entitlement. Pricing and exact packaging are commercial configuration, not hard architectural truth.

FREE must preserve the core playable loop. PRO may add higher limits, smart matching/scouting, advanced filters/insights and convenience. Trust, acceptance priority and fake performance must never be sold.

## 17. AI
AI is optional enhancement, never a hard dependency for the core loop. Smart Match, Scout Report and moderation must have deterministic/safe fallbacks. AI output cannot override server truth.

## 18. Social
Follow/social/community features are a later layer. They must reinforce recurring play and team formation, not transform CPC into a generic content feed before the core loop is proven.

## 19. Product language
Prefer concrete action language: LIVE, Postes recherchés, Candidater, Inviter, Composition, Check-in, Présent, Absent, Club, Joueur.
Avoid claiming official EA verification unless a real authorized source supports it.

## 20. V1 success
A new user can onboard, establish a usable player identity, discover a relevant club/LIVE need, apply or receive an invitation, reach a valid accepted state, participate in a match/check-in, and see CPC trust reflect real behavior without administrative intervention.