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
  playerCardHeroNumber,
  resolvePlayerCardDensity,
  resolvePlayerCardTemplate,
  visibleEaStatBlocks,
  visibleCpcBadges,
} from "../lib/playerCard";
import { computeOvr, rarityForOvr, OVR_CPC_LABEL } from "../lib/ovr";
import { FACE_STAT_KEYS } from "../lib/cardFace";
// @ts-expect-error Expo tsconfig has no @types/node; tsx provides `fs` at runtime.
import { readFileSync } from "fs";
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
  assert.equal(formatCpcMatchCount(3), "3 matchs", "label");
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

test("secondaryPositions — déduplique et exclut le principal", () => {
  const data = buildPlayerCardData(
    baseUser({
      main_position: "CB",
      secondary_positions: ["CB", "CB", "ST", "ST"],
    })
  );
  assert.deepEqual(data.secondaryPositions, ["ST"], "unique without main");
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

test("cpcMatchesPlayed omis -> null (pas la longueur d'une liste d'historique)", () => {
  const data = buildPlayerCardData(baseUser());
  assert.equal(data.cpcMatchesPlayed, null, "omit");
  assert.equal(formatCpcMatchCount(undefined), null, "undefined");
  assert.equal(formatCpcMatchCount(null), null, "null");
});

test("LIVE context flag + note, sans inventer un statut", () => {
  const off = buildPlayerCardData(baseUser());
  assert.equal(off.live, false, "default");
  const on = buildPlayerCardData(baseUser(), { live: true, liveNote: "Dispo 21h" });
  assert.equal(on.live, true, "live");
  assert.equal(on.liveNote, "Dispo 21h", "note");
});

test("copy EA vide : C'est mon club, pas de chiffres inventés", () => {
  assert.equal(PLAYER_CARD_COPY.linkClub, "C'est mon club", "cta");
  assert.equal(PLAYER_CARD_COPY.eaUnlinked.includes("invent"), false, "unlinked no inventer");
  assert.equal(PLAYER_CARD_COPY.eaLinkedPending.includes("pas encore"), true, "pending");
  const unlinked = buildPlayerCardData(baseUser({ ea_club_linked: null }));
  assert.equal(unlinked.eaClubLinked, false, "unlinked");
  assert.deepEqual(visibleEaStatBlocks(unlinked.eaStats), [], "no blocks");
});

test("playerCardHeroNumber — OVR gagne, sinon matchs, jamais un 0", () => {
  assert.deepEqual(
    playerCardHeroNumber({ ovr: 72, cpcMatchesPlayed: 3 }),
    { value: 72, label: PLAYER_CARD_COPY.ovrLabel },
    "ovr"
  );
  assert.deepEqual(playerCardHeroNumber({ ovr: null, cpcMatchesPlayed: 3 }), { value: 3, label: "matchs" }, "matches");
  assert.deepEqual(playerCardHeroNumber({ ovr: null, cpcMatchesPlayed: 1 }), { value: 1, label: "match" }, "one");
  assert.equal(playerCardHeroNumber({ ovr: null, cpcMatchesPlayed: 0 }), null, "zero");
  assert.equal(playerCardHeroNumber({ ovr: null, cpcMatchesPlayed: null }), null, "none");
});

test("visibleEaStatBlocks — seulement chiffres stockés, jamais SHO/PAS/TAC vides", () => {
  assert.deepEqual(visibleEaStatBlocks(null), [], "null");
  assert.deepEqual(visibleEaStatBlocks({}), [], "empty");
  assert.deepEqual(visibleEaStatBlocks({ avgRating: 0 }), [], "note 0 omise");
  const blocks = visibleEaStatBlocks({ goals: 3, assists: 1, matchesPlayed: 5, avgRating: 7.4 });
  assert.equal(blocks.length, 4, "four real");
  assert.equal(blocks[0]?.label, PLAYER_CARD_COPY.eaGoals, "goals");
  assert.equal(blocks[3]?.value, "7.4", "rating 1 decimal");
  const labels = blocks.map((b) => b.label).join(" ");
  assert.equal(labels.includes("SHO"), false, "no SHO");
  assert.equal(labels.includes("PAS"), false, "no PAS");
  assert.equal(labels.includes("TAC"), false, "no TAC");
  const mixed = visibleEaStatBlocks({ pac: 90, sho: 88, goals: 3 });
  assert.equal(mixed.length, 1, "face attrs are not career");
  assert.equal(mixed[0]?.label, PLAYER_CARD_COPY.eaGoals, "goals only");
});

test("faceStats — prod isDev false → null ; DEV sans attrs → DEV, showEaStats false", () => {
  const prod = buildPlayerCardData(baseUser(), { isDev: false });
  assert.equal(prod.faceStats, null, "prod null");
  assert.equal(prod.showEaStats, false, "prod no career");
  const dev = buildPlayerCardData(baseUser({ verified_stats: null }), { isDev: true });
  assert.equal(dev.faceStats?.source, "DEV", "dev overlay");
  assert.equal(dev.showEaStats, false, "DEV is not Buts EA");
  assert.equal(FACE_STAT_KEYS.every((k) => typeof dev.faceStats?.values[k] === "number"), true, "six mock");
});

test("faceStats — attrs + USERNAME_EQUALITY même isDev true → EA, pas de pad DEV", () => {
  const data = buildPlayerCardData(
    baseUser({
      ea_identity_kind: "USERNAME_EQUALITY",
      ea_club_linked: "club-1",
      verified_stats: { pac: 81, sho: 90, goals: 4 },
    }),
    { isDev: true }
  );
  assert.equal(data.faceStats?.source, "EA", "real wins");
  assert.equal(data.faceStats?.values.pac, 81, "pac");
  assert.equal(data.faceStats?.values.pas, undefined, "no pad");
  assert.equal(data.showEaStats, true, "career still shown");
  assert.equal(data.ovr, 50, "ovr still CPC from reliability");
});

test("FULL a la grille face ; MINI/COMPACT non", () => {
  const src = readFileSync(`${process.cwd()}/components/player/PlayerCard.tsx`, "utf8");
  const full = src.slice(src.indexOf("function FullBody"), src.indexOf("function EaSlot"));
  const mini = src.slice(src.indexOf("function MiniBody"), src.indexOf("function CompactBody"));
  const compact = src.slice(src.indexOf("function CompactBody"), src.indexOf("function FullBody"));
  assert.equal(full.includes("visibleFaceStatCells"), true, "full grid");
  assert.equal(full.includes("faceStatsCaption"), true, "full caption");
  assert.equal(full.includes("PLAYER_CARD_COPY.watermark"), true, "ClubPro watermark");
  assert.equal(full.includes("Sans club") || full.includes("sansClub"), true, "sans club");
  assert.equal(mini.includes("visibleFaceStatCells"), false, "mini no grid");
  assert.equal(compact.includes("visibleFaceStatCells"), false, "compact no grid");
  assert.equal(full.includes("EaSlot"), true, "EaSlot stays");
  assert.equal(full.includes("cpcHex.accent"), true, "green glow");
});

console.log(`\n${passed} test(s) passés.`);
