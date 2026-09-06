# CPC UI Bible

Version 1.0

## Visual direction
CPC uses a cinematic competitive dark interface: premium sports utility, not neon-gaming clutter. The UI should feel fast, intentional and native on mobile.

## Existing canonical palette
The current code exposes these cinematic tokens and they are the baseline unless the Product Owner approves a redesign:
- background: #08090b
- surface: #131519
- elevated surface: #16191d
- border: #24272c
- accent/live: #39ff8a
- foreground: #f4f5f7
- muted foreground: #9aa0a8

Outcome semantics currently map:
- WIN: #39ff8a
- DRAW: #f5a623
- LOSS: #ff4d4f

Do not create arbitrary near-duplicate colors in screens. Extend tokens first.

## Typography
Repository includes Inter and Barlow Condensed. Doctrine:
- Inter for body, controls and dense information.
- Barlow Condensed for sports-display moments, scores, large numeric identity and selected headings.
- Avoid excessive all-caps paragraphs.

## Hierarchy
Screen hierarchy:
1. context/title;
2. current state or key metric;
3. primary action;
4. supporting content;
5. secondary actions.

A screen should remain understandable at a glance on a small phone.

## Surfaces
Use a small surface vocabulary: page background, card/surface, elevated/interactive surface, modal/sheet. Do not wrap every label in a card.

Borders should structure dark surfaces subtly. Shadows/glows are reserved for hierarchy and live/premium moments, not decoration everywhere.

## Accent discipline
Green accent communicates CPC energy, positive confirmation and LIVE emphasis. It is not a default fill for every component. Red is destructive/error/loss. Amber is warning/draw. PRO styling must remain distinct from earned trust/reputation.

## Components
Reuse/extend shared components before creating screen-local variants. Current component system includes primitives such as Button, Card, Badge, Input, ChipSelect, PulseDot, Skeleton, Screen and ToastHost.

Any new primitive must define:
- variants;
- sizes;
- disabled state;
- loading state if actionable;
- pressed/focus behavior;
- accessibility label strategy.

## Buttons
Primary: one dominant action per region/screen.
Secondary: lower visual weight.
Ghost/text: tertiary actions.
Destructive: explicit destructive semantics; never style a normal navigation action as destructive.

Do not use multiple identical primary buttons competing in one viewport.

## Cards
Cards summarize actionable entities: LIVE session, club, player, invitation/application. A card should answer identity + relevant state + next action. Avoid dashboard-card grids that merely restate labels.

## LIVE language
LIVE must be visually unmistakable but not visually exhausting. Pulse animation is allowed for the live indicator, not for whole cards. Time remaining/freshness should be textual when TTL is enabled.

## Status badges
Badges are compact state, not paragraphs. Use consistent semantic mapping. PENDING, ACCEPTED, REJECTED/DECLINED, RESERVED and expired states must not share ambiguous styling.

## Formation / Match Sheet
The pitch/formation is a functional visualization. Preserve slot legibility over realism. Slot labels remain readable; occupied/recruiting/empty states must be distinguishable without relying only on color.

## ClubPro Card
This is CPC's hero identity component. It may use stronger visual treatment/rarity language, but information must remain truthful and readable. CPC OVR and rarity are CPC constructs and should not visually counterfeit official EA cards.

## Motion
Motion communicates transition/state, not spectacle. Prefer short native-feeling transitions, restrained Moti/Reanimated use and haptics on meaningful confirmed actions. Respect reduced-motion behavior where feasible.

## Spacing and density
Use the existing Tailwind/NativeWind spacing scale. Maintain consistent page gutters. Dense operational screens may be compact, but tap targets and separation must remain usable.

## Icons
Use the existing icon family consistently (Lucide React Native in current dependencies). Do not mix unrelated icon packs without a system-level reason.

## Loading
Prefer skeletons for content lists/cards and local button loading for mutations. Avoid full-screen spinners after the app shell is established unless the entire route truly cannot render.

## Empty/error visuals
Keep them native to the design system. No random illustrations or emoji as permanent product UI unless explicitly approved.

## UI anti-patterns
Do not:
- introduce a new palette per feature;
- hardcode colors that already have tokens;
- create multiple Button/Card implementations;
- overuse gradients/glows;
- use tiny gray text for essential information;
- show fake activity or placeholder social proof in production;
- visually imply official EA endorsement;
- redesign unrelated screens during a scoped feature task.

## Screenshot acceptance
Before a UI phase is considered complete, inspect key states at minimum: normal, loading, empty, error, long text, smallest supported practical device width, keyboard-visible form state, and disabled/permission-restricted action state.