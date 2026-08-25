/**
 * Tests de lib/playerCard.ts — builder unique, données honnêtes.
 * Lancer : npx tsx scripts/test-player-card.ts
 */
import {
  PLAYER_CARD_COPY,
  PLAYER_CARD_TEMPLATES,
  buildPlayerCardData,
  formatCpcMatchCount,
  formatPositionsLine,
  isPlayerCardTemplateSelectable,
  playerNeedFitLabel,
  resolvePlayerCardDensity,
  resolvePlayerCardTemplate,
  visibleCpcBadges,
} from "../lib/playerCard";
import { computeOvr, rarityForOvr, OVR_CPC_LABEL } from "../lib/ovr";
import type { UserRow } from "../lib/types";

const assert = {
  equal(actual: unknown, expected: unknown, label: string) {
    if (actual !== expected) throw new Error(`Assertion échouée (${label}).\n  reçu: ${JSON.stringify(actual)}\n  attendu: ${JSON.stringify(expected)}`);
  },
  deepEqual(actual: unknown, expected: unknown, label: string) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) throw new Error(`Assertion échouée (${label}).\n  reçu: ${a}\n  attendu: ${b}`);
  },
};

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok — ${name}`);
}

function baseUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: "u1",
    username: "Selim",
    platform: "PS",
    main_position: "ST",
    secondary_positions: [],
    play_style: "ATTACKING",
    languages: ["FR"],
    availability: {},
    reliability_score: 50,
    verified_stats: null,
    ea_club_linked: null,
    ea_identity_kind: "NONE",
    plan: "FREE",
    current_streak: 0,
    best_streak: 0,
    badges: [],
    applications_today: 0,
    applications_reset_at: new Date().toISOString(),
    push_token: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

console.log("lib/playerCard.ts — buildPlayerCardData");

test("joueur sans club EA lié -> eaClubLinked=false, pas de stats EA affichées", () => {
  const data = buildPlayerCardData(baseUser({ ea_club_linked: null, verified_stats: null }));
  assert.equal(data.eaClubLinked, false, "eaClubLinked");
  assert.equal(data.showEaStats, false, "showEaStats");
  assert.equal(data.eaStats, null, "eaStats");
  assert.equal(data.eaUsername, null, "eaUsername");
});

test("club EA lié SANS USERNAME_EQUALITY -> pas de stats EA (club lié ≠ id joueur)", () => {
  const stats = { goals: 3, assists: 1, matchesPlayed: 5 };
  const data = buildPlayerCardData(
    baseUser({ ea_club_linked: "12345", verified_stats: stats, ea_identity_kind: "NONE" })
  );
  assert.equal(data.eaClubLinked, true, "club lié");
  assert.equal(data.showEaStats, false, "stats gated");
  assert.equal(data.eaStats, null, "eaStats hidden");
});

test("EA stats seulement si USERNAME_EQUALITY ET chiffre stocké", () => {
  const stats = { goals: 3, assists: 1, matchesPlayed: 5 };
  const data = buildPlayerCardData(
    baseUser({ ea_club_linked: "12345", verified_stats: stats, ea_identity_kind: "USERNAME_EQUALITY" })
  );
  assert.equal(data.showEaStats, true, "show");
  assert.deepEqual(data.eaStats, stats, "eaStats");
  assert.equal(data.eaUsername, "Selim", "pseudo rapprochement");
});

test("USERNAME_EQUALITY sans chiffre stocké -> pas de layout EA vide", () => {
  const data = buildPlayerCardData(
    baseUser({ ea_club_linked: "123", ea_identity_kind: "USERNAME_EQUALITY", verified_stats: {} })
  );
  assert.equal(data.showEaStats, false, "no numbers");
  assert.equal(data.eaStats, null, "null");
});

test("joueur sans match CPC -> cpcMatchesPlayed 0, pas de fake stats, copy vide", () => {
  const data = buildPlayerCardData(baseUser({ reliability_score: 0 }), { cpcMatchesPlayed: 0 });
  assert.equal(data.cpcMatchesPlayed, 0, "played");
  assert.equal(data.ovr, null, "pas d'OVR décoratif");
  assert.equal(formatCpcMatchCount(data.cpcMatchesPlayed), null, "pas de ligne matchs");
  assert.equal(PLAYER_CARD_COPY.noMatch, "Pas encore de match enregistré", "copy");
  assert.equal(data.eaStats, null, "pas de buts inventés");
});

test("joueur avec participations réelles -> match count reflété, toujours pas de buts/passes joueur", () => {
  const data = buildPlayerCardData(baseUser({ reliability_score: 62 }), { cpcMatchesPlayed: 3 });
  assert.equal(data.cpcMatchesPlayed, 3, "played");
  assert.equal(formatCpcMatchCount(3), "3 matchs CPC", "label");
  assert.equal(data.showEaStats, false, "pas de stats joueur inventées");
});

test("OVR CPC dérivé de computeOvr (fiabilité), label OVR CPC, EA n'influe pas", () => {
  const user = baseUser({ reliability_score: 72, verified_stats: { goals: 2, matchesPlayed: 4, avgRating: 7.5 } });
  const data = buildPlayerCardData(user);
  const expectedOvr = computeOvr({ reliabilityScore: 72, verifiedStats: { goals: 2, matchesPlayed: 4, avgRating: 7.5 } });
  assert.equal(data.ovr, expectedOvr, "ovr");
  assert.equal(data.ovr, 72, "72 pas gonflé par EA");
  assert.equal(data.rarity, rarityForOvr(72), "rarity");
  assert.equal(PLAYER_CARD_COPY.ovrLabel, OVR_CPC_LABEL, "label");
});

test("reliability_score=0 -> ovr null même si verified_stats EA énormes", () => {
  const data = buildPlayerCardData(
    baseUser({
      reliability_score: 0,
      verified_stats: { goals: 90, assists: 90, matchesPlayed: 10, avgRating: 10 },
      ea_identity_kind: "USERNAME_EQUALITY",
      ea_club_linked: "ea",
    })
  );
  assert.equal(data.ovr, null, "hidden");
  assert.equal(data.showEaStats, true, "EA stats gated correctly, séparées de l'OVR");
});

test("currentStreak/badges/secondaryPositions absents -> tableaux/0 vides", () => {
  const partial = baseUser();
  // @ts-expect-error — champs absents
  delete partial.current_streak;
  // @ts-expect-error
  delete partial.badges;
  // @ts-expect-error
  delete partial.secondary_positions;

  const data = buildPlayerCardData(partial);
  assert.equal(data.currentStreak, 0, "currentStreak");
  assert.deepEqual(data.badges, [], "badges");
  assert.deepEqual(data.secondaryPositions, [], "secondaryPositions");
});

test("clubName absent par défaut -> null ; fourni -> tel quel", () => {
  assert.equal(buildPlayerCardData(baseUser()).clubName, null, "default");
  assert.equal(buildPlayerCardData(baseUser(), { clubName: "Les Invincibles" }).clubName, "Les Invincibles", "set");
});

test("badges : seulement ids CPC connus persistés — pas de Premier match inventé", () => {
  assert.deepEqual(visibleCpcBadges(["streak_5", "premier_match", "season_gold"]), [{ id: "streak_5", label: "Fiable x5" }], "filter");
  assert.deepEqual(visibleCpcBadges([]), [], "empty");
  const data = buildPlayerCardData(baseUser({ badges: ["streak_10"] }));
  assert.equal(data.badges[0]?.label, "Pilier x10", "stored");
});

test("need-fit honnête : poste correspondant, jamais un %", () => {
  assert.equal(playerNeedFitLabel("ST", ["CAM"], "ST"), PLAYER_CARD_COPY.needFitPrimary, "main");
  assert.equal(playerNeedFitLabel("ST", ["CAM"], ["CAM"]), PLAYER_CARD_COPY.needFitSecondary, "secondary");
  assert.equal(playerNeedFitLabel("ST", ["CAM"], "GK"), null, "no fit");
  assert.equal(PLAYER_CARD_COPY.needFitPrimary.includes("%"), false, "no percent");
  const data = buildPlayerCardData(baseUser(), { needPositions: ["ST", "CAM"] });
  assert.equal(data.needFitLabel, "Poste correspondant", "builder");
});

test("templates : STANDARD live ; LOCKED non sélectionnables ; client ne peut pas spoof ELITE", () => {
  assert.equal(isPlayerCardTemplateSelectable("STANDARD"), true, "standard");
  assert.equal(isPlayerCardTemplateSelectable("ELITE"), false, "elite");
  assert.equal(isPlayerCardTemplateSelectable("LEGEND"), false, "legend");
  assert.equal(PLAYER_CARD_TEMPLATES.COMPETITIVE.status, "LOCKED", "competitive");
  assert.equal(resolvePlayerCardTemplate("ELITE").id, "STANDARD", "spoof ignored");
  assert.equal(resolvePlayerCardTemplate("STANDARD").id, "STANDARD", "ok");
  const data = buildPlayerCardData(baseUser(), { templateId: "CHAMPION" });
  assert.equal(data.templateId, "STANDARD", "forced standard");
  assert.equal(data.templateStatus, "FREE", "free");
});

test("densités : hero/standard aliases -> full/compact ; mini reste mini", () => {
  assert.equal(resolvePlayerCardDensity("hero"), "full", "hero");
  assert.equal(resolvePlayerCardDensity("full"), "full", "full");
  assert.equal(resolvePlayerCardDensity("standard"), "compact", "standard");
  assert.equal(resolvePlayerCardDensity("compact"), "compact", "compact");
  assert.equal(resolvePlayerCardDensity("mini"), "mini", "mini");
});

test("formatPositionsLine — principal seul, puis secondaires uniques sans mur de chips", () => {
  assert.equal(formatPositionsLine("ST"), "ST · Attaquant", "principal");
  assert.equal(
    formatPositionsLine("ST", ["CAM", "ST", "RW"]),
    "ST · Attaquant  ·  CAM · Milieu offensif  ·  RW · Ailier droit",
    "secondaires dédupliqués"
  );
});

test("LIVE context flag + note, sans inventer un statut", () => {
  const off = buildPlayerCardData(baseUser());
  assert.equal(off.live, false, "default");
  const on = buildPlayerCardData(baseUser(), { live: true, liveNote: "Dispo 21h" });
  assert.equal(on.live, true, "live");
  assert.equal(on.liveNote, "Dispo 21h", "note");
});

console.log(`\n${passed} test(s) passés.`);
