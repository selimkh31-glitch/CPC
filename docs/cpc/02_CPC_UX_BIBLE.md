# CPC UX Bible

Version 1.0

## UX objective
CPC should feel like a live team operations product, not a database browser. Users should understand what is happening, what they can do next, and whether an action is committed.

## Global rules
- One dominant CTA per state.
- Do not hide important state in color alone; pair color with text/iconography.
- Every network screen defines loading, empty, error, stale and success states.
- Optimistic UI is allowed only when rollback is safe. Sensitive transitions wait for server confirmation.
- Destructive/commitment actions explain consequence before execution.
- Real-time updates should preserve scroll/context where possible.
- Never show a tappable control that the current role cannot actually execute.

## Navigation model
PLAYER context should prioritize LIVE/discovery, clubs, competitive context and profile.
CLUB context should prioritize match/LIVE operations, applications, squad/composition and club management.

Deep links/screens such as club profile, player profile, invitations, applications, pricing and match sheet sit above those contexts.

## Onboarding — Player
Minimum useful profile before discovery:
1. authentication;
2. username;
3. platform;
4. main position;
5. optional secondary positions;
6. play style;
7. languages/availability where required;
8. completion -> relevant discovery.

Rules: keep steps short, show progress, explain why position/platform matter, allow later editing. Do not ask for decorative data before the user reaches value.

## Club creation
1. create club identity;
2. choose level/languages;
3. choose formation;
4. land in club operations/composition;
5. invite/recruit as the natural next action.

OWNER membership must be automatic/server-consistent; UX must never ask the owner to join their own club.

## LIVE player journey
1. Open LIVE feed.
2. Immediately see active club, level/platform context, needed positions, freshness/time remaining and trust-relevant context.
3. Filter if needed.
4. Open club/session details.
5. Select compatible position or exact slot.
6. Candidater.
7. Receive clear PENDING confirmation.
8. Track response without needing to rediscover the club.

If the session expires during the flow, disable submission and explain that the LIVE need ended.

## Club LIVE journey
1. From match/club operations, select needed positions/slots.
2. Choose LIVE duration where TTL is enabled.
3. Publish.
4. See visible LIVE status and remaining duration.
5. Receive applications in real time.
6. Inspect player identity/trust.
7. Accept into an available valid slot or reject.
8. Stop LIVE when needs are filled.

## Application states
PENDING: show waiting state + ability to withdraw only if server supports it.
ACCEPTED: show resulting club/membership context and next action.
REJECTED: neutral, clear closure.
WITHDRAWN: closed state; no misleading active CTA.

Never present a local success before the sensitive acceptance transaction succeeds.

## Invitation journey
Player must see: inviting club, proposed slot if any, status and consequence of acceptance. If a transition is required because of current commitment, show that workflow instead of pretending the player can instantly switch.

## Match Sheet
The formation should be visually scannable. Each slot has exactly one clear state: empty, occupied, recruiting, pending candidate, or transition-related state if supported.

Tapping an empty/recruiting slot should open the most relevant action, not a generic menu. Player identity cards should not obscure the formation.

## Commitment/departure UX
Departure/release is a state machine, not a delete button.

Show:
- who initiated;
- current status;
- whether departure is immediate or after next match;
- any pending transition offer;
- what happens next.

Do not allow UI shortcuts around server lifecycle states.

## Check-in
Club launches check-in from a real session. Members see a focused confirmation. Club sees PRESENT/ABSENT/awaiting states. Deadline/state changes must be legible. Completion should lead naturally to result recording when appropriate.

## Match result
Result entry should be compact and guarded against accidental submission. After finalization, display immutable/authoritative result state unless a dedicated correction workflow exists.

## Profile / ClubPro Card
First viewport answers: who is this player, what do they play, on what platform, and can I trust them? CPC OVR/reliability/badges need explanatory affordances so users understand CPC-derived signals.

## Search
Filters must correspond to actual matchmaking decisions. Default state should return useful candidates, not require configuration. Active filters are always visible/removable. Zero results suggests how to broaden criteria.

## Empty states
Every empty state must explain both meaning and next action.
Examples:
- No LIVE clubs -> refresh/adjust filters; do not fabricate activity.
- No applications -> start LIVE or review needs.
- Empty slot -> recruit/invite.
- No invitations -> return to discovery/profile improvement.

## Error states
Translate technical failures into user actions. Preserve typed data after recoverable errors. Authentication/authorization errors must never be disguised as generic network errors.

## Feedback
Use haptics selectively for high-confidence actions/status changes. Toasts are for transient confirmation; persistent workflow state belongs in the screen itself.

## Accessibility
Maintain readable contrast, minimum practical touch targets, text alternatives for status, dynamic-text resilience where feasible, and no critical information encoded solely by green/red.

## UX acceptance test
For each feature, an agent must be able to answer:
- What is the user's goal?
- What is the primary CTA?
- What are loading/empty/error/success states?
- What changes on the server?
- What happens if the state changes concurrently?
- Where does the user land next?