/**
 * Tests de lib/live.ts — expiry LIVE joueur/club (P0).
 * Logique pure, aucune dépendance réseau.
 *
 * Lancer : npx tsx scripts/test-live.ts
 */
// @ts-expect-error Expo tsconfig has no @types/node; tsx provides `fs` at runtime.
import { readFileSync } from "fs";
import {
  computeLiveExpiresAt,
  clubLiveLayout,
  CLUB_MATCH_SHEET_HREF,
  DEFAULT_LIVE_DURATION_MS,
  DEV_LIVE_DURATION_MS,
  findActiveLiveSession,
  formatLiveRemaining,
  isLiveActive,
  liveFeedEmptyCopy,
  liveSessionDurationMs,
  liveUiState,
  LIVE_UX_COPY,
  parseLiveDurationMs,
  remainingLiveMs,
} from "../lib/live";

const assert = {
  equal(actual: unknown, expected: unknown, label: string) {
    if (actual !== expected) {
      throw new Error(`Assertion échouée (${label}).\n  reçu: ${actual}\n  attendu: ${expected}`);
    }
  },
  true(actual: unknown, label: string) {
    if (actual !== true) throw new Error(`Assertion échouée (${label}) : attendu true, reçu ${actual}`);
  },
  false(actual: unknown, label: string) {
    if (actual !== false) throw new Error(`Assertion échouée (${label}) : attendu false, reçu ${actual}`);
  },
};

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok — ${name}`);
}

console.log("lib/live.ts — LIVE expiry");

const NOW = Date.parse("2026-08-24T12:00:00.000Z");

test("isLiveActive — is_live false -> inactif même avec expiry future", () => {
  assert.equal(
    isLiveActive({ is_live: false, expires_at: "2026-08-24T14:00:00.000Z" }, NOW),
    false,
    "offline"
  );
});

test("isLiveActive — is_live true sans expires_at -> inactif (pas de LIVE éternel)", () => {
  assert.equal(isLiveActive({ is_live: true, expires_at: null }, NOW), false, "null expiry");
});

test("isLiveActive — is_live true et expiry passée -> inactif", () => {
  assert.equal(
    isLiveActive({ is_live: true, expires_at: "2026-08-24T11:59:00.000Z" }, NOW),
    false,
    "expired"
  );
});

test("isLiveActive — is_live true et expiry future -> actif", () => {
  assert.equal(
    isLiveActive({ is_live: true, expires_at: "2026-08-24T12:01:00.000Z" }, NOW),
    true,
    "active"
  );
});

test("findActiveLiveSession — ignore is_live sans expiry / expiré", () => {
  const sessions = [
    { is_live: true, expires_at: null },
    { is_live: true, expires_at: "2026-08-24T11:00:00.000Z" },
    { is_live: true, expires_at: "2026-08-24T13:00:00.000Z", id: "ok" },
  ];
  const found = findActiveLiveSession(sessions, NOW);
  assert.equal(found && "id" in found ? found.id : null, "ok", "picks unexpired");
});

test("remainingLiveMs — 90 s restantes -> 90000", () => {
  assert.equal(remainingLiveMs("2026-08-24T12:01:30.000Z", NOW), 90_000, "90s");
});

test("remainingLiveMs — déjà expiré -> 0 (jamais négatif)", () => {
  assert.equal(remainingLiveMs("2026-08-24T11:00:00.000Z", NOW), 0, "past");
});

test("remainingLiveMs — expires_at invalide -> 0", () => {
  assert.equal(remainingLiveMs("not-a-date", NOW), 0, "invalid");
});

test("computeLiveExpiresAt — défaut = liveSessionDurationMs (2 h hors DEV)", () => {
  const expires = computeLiveExpiresAt(NOW);
  assert.equal(expires.toISOString(), new Date(NOW + liveSessionDurationMs()).toISOString(), "default duration");
  assert.equal(liveSessionDurationMs(), DEFAULT_LIVE_DURATION_MS, "node tests are not DEV");
});

test("computeLiveExpiresAt — durée 30 min respectée", () => {
  const expires = computeLiveExpiresAt(NOW, 30 * 60 * 1000);
  assert.equal(expires.toISOString(), "2026-08-24T12:30:00.000Z", "30min");
});

test("parseLiveDurationMs — valeur hors catalogue -> liveSessionDurationMs", () => {
  assert.equal(parseLiveDurationMs("999"), liveSessionDurationMs(), "unknown");
  assert.equal(parseLiveDurationMs(undefined), liveSessionDurationMs(), "undefined");
  assert.equal(parseLiveDurationMs("1800000"), 1_800_000, "30min allowed");
});

test("DEV TTL — 12 h constant ; catalogue prod inchangé ; expires_at jamais omis", () => {
  assert.equal(DEFAULT_LIVE_DURATION_MS, 2 * 60 * 60 * 1000, "prod 2h");
  assert.equal(DEV_LIVE_DURATION_MS, 12 * 60 * 60 * 1000, "dev 12h");
  assert.equal(parseLiveDurationMs(String(DEFAULT_LIVE_DURATION_MS)), DEFAULT_LIVE_DURATION_MS, "2h still allowed");
  const src = readFileSync(`${process.cwd()}/lib/live.ts`, "utf8");
  assert.true(src.includes("liveSessionDurationMs()"), "default via helper");
  assert.true(src.includes("allowed.push(DEV_LIVE_DURATION_MS)"), "DEV 12h allowed when __DEV__");
  assert.false(/expires_at:\s*null/.test(src), "never write null expiry");
  const create = readFileSync(`${process.cwd()}/lib/hooks/useClubs.ts`, "utf8");
  assert.true(create.includes("expires_at: expiresAt"), "create always sets expires_at");
});

test("formatLiveRemaining — moins d'une heure -> minutes ceil, mots humains", () => {
  assert.equal(formatLiveRemaining("2026-08-24T12:10:00.000Z", NOW), "encore 10 min", "10min");
});

test("formatLiveRemaining — exactement 2 h", () => {
  assert.equal(formatLiveRemaining("2026-08-24T14:00:00.000Z", NOW), "encore 2 h", "2h");
});

test("formatLiveRemaining — expiré", () => {
  assert.equal(formatLiveRemaining("2026-08-24T11:00:00.000Z", NOW), "C'est fini", "expired label");
});

test("empty LIVE — copy honnête, jamais un vide ni une session fake", () => {
  assert.equal(liveFeedEmptyCopy({ selfLive: false, liveClubCount: 0 }), LIVE_UX_COPY.emptyNoClubs, "no clubs");
  assert.equal(liveFeedEmptyCopy({ selfLive: true, liveClubCount: 0 }), LIVE_UX_COPY.emptySelfLive, "self live");
  assert.equal(liveFeedEmptyCopy({ selfLive: false, liveClubCount: 2 }), LIVE_UX_COPY.emptyNoPlayers, "players");
  assert.equal(LIVE_UX_COPY.goLive, "Passer LIVE", "cta");
  assert.equal(LIVE_UX_COPY.title, "Matchmaking", "title");
  assert.equal(LIVE_UX_COPY.backToLive, "Matchmaking", "back");
  assert.equal(LIVE_UX_COPY.emptyNoClubs, "Aucun club en LIVE.", "empty clubs");
  assert.equal(LIVE_UX_COPY.discoveryOn, "En ligne", "discovery on");
  assert.equal(LIVE_UX_COPY.discoveryHintOn, "Les joueurs te voient", "discovery hint");
  assert.equal(LIVE_UX_COPY.discoveryHintOff.includes("flag"), false, "no flag in hint");
  assert.equal(LIVE_UX_COPY.discoveryHintOff.includes("expiry"), false, "no expiry in hint");
  assert.equal(LIVE_UX_COPY.findClub, "Clubs en LIVE", "find");
  assert.equal(LIVE_UX_COPY.liveClubFilters, "Filtres", "filters");
  assert.equal(LIVE_UX_COPY.otherPlayers, "Ils veulent jouer", "others");
  assert.equal(LIVE_UX_COPY.emptyNoClubs.includes("invent"), false, "no fake");
});

test("joueur LIVE = club, pas un match ; club LIVE = joueurs", () => {
  assert.equal(LIVE_UX_COPY.playerHeadline, "Je cherche un club", "player headline");
  assert.equal(LIVE_UX_COPY.clubHeadline, "On cherche des joueurs", "club headline");
  assert.equal(LIVE_UX_COPY.clubOpenTitle, "Club en LIVE", "club open");
  assert.equal(LIVE_UX_COPY.emptySelfLive.includes("club"), true, "self live clubs");
  assert.equal(LIVE_UX_COPY.emptyNoPlayers.includes("club"), true, "empty players = club");
  assert.equal(/match/i.test(LIVE_UX_COPY.playerHeadline), false, "player title not match");
  assert.equal(/match/i.test(LIVE_UX_COPY.emptyNoClubs), false, "empty clubs not match");
  assert.equal(/match/i.test(LIVE_UX_COPY.emptySelfLive), false, "self empty not match");
  assert.equal(/match/i.test(LIVE_UX_COPY.emptyNoPlayers), false, "others empty not match");
  assert.equal(/On cherche un match/.test(LIVE_UX_COPY.clubHeadline), false, "club not match hunt");
});

test("liveUiState — ready > open > off", () => {
  assert.equal(liveUiState({ liveActive: false }), "off", "off");
  assert.equal(liveUiState({ liveActive: true }), "open", "open");
  assert.equal(liveUiState({ liveActive: true, matchActive: true }), "ready", "ready wins");
  assert.equal(liveUiState({ liveActive: false, matchActive: true }), "ready", "ready without live");
});

test("clubLiveLayout — ready ne cache pas Passer LIVE ; feuille remplie si match", () => {
  const off = clubLiveLayout({ canManage: true, liveActive: false, matchActive: false });
  assert.equal(off.showSessionPanel, true, "panel off");
  assert.equal(off.matchSheetFilled, false, "feuille ghost");
  assert.equal(off.showRecruit, false, "no recruit off");
  assert.equal(off.stopLabel, LIVE_UX_COPY.stop, "stop");

  const open = clubLiveLayout({ canManage: true, liveActive: true, matchActive: false });
  assert.equal(open.showSessionPanel, true, "panel open");
  assert.equal(open.showRecruit, true, "recruit while live");

  const locked = clubLiveLayout({ canManage: true, liveActive: false, matchActive: true });
  assert.equal(locked.showSessionPanel, true, "panel still there when match launched");
  assert.equal(locked.matchSheetFilled, true, "feuille filled");
  assert.equal(locked.stopLabel, LIVE_UX_COPY.quit, "quit uses toggle session");
  assert.equal(locked.showRecruit, false, "recruit needs live");

  const both = clubLiveLayout({ canManage: true, liveActive: true, matchActive: true });
  assert.equal(both.showSessionPanel, true, "live + match still has panel");
  assert.equal(both.matchSheetFilled, true, "feuille filled");
  assert.equal(both.showRecruit, true, "still searching");

  assert.equal(CLUB_MATCH_SHEET_HREF, "/match", "club feuille route");
  assert.equal(LIVE_UX_COPY.goLive, "Passer LIVE", "go live copy");
  assert.equal(LIVE_UX_COPY.quit, "Quitter", "quit");
  assert.equal(LIVE_UX_COPY.newLive, "Nouveau LIVE", "new live copy");
});

test("panels LIVE : joueur = playerHeadline, club LIVE = discovery + feuille", () => {
  const player = readFileSync(`${process.cwd()}/components/live/PlayerLivePanel.tsx`, "utf8");
  const toggle = readFileSync(`${process.cwd()}/components/club/ClubDiscoveryToggle.tsx`, "utf8");
  const feuille = readFileSync(`${process.cwd()}/components/club/ClubLiveFeuille.tsx`, "utf8");
  const liveTab = readFileSync(`${process.cwd()}/app/(club)/(tabs)/index.tsx`, "utf8");
  const matchTab = readFileSync(`${process.cwd()}/app/(club)/(tabs)/match.tsx`, "utf8");
  assert.true(player.includes("LIVE_UX_COPY.playerHeadline"), "player uses playerHeadline");
  assert.false(player.includes("LIVE_UX_COPY.clubHeadline"), "player not clubHeadline");
  assert.false(player.includes("On cherche un match"), "player panel no match hunt");
  assert.true(toggle.includes("LIVE_UX_COPY.discoveryOn"), "club toggle En ligne");
  assert.true(toggle.includes("LIVE_UX_COPY.discoveryHintOn"), "Les joueurs te voient");
  assert.false(toggle.includes("LIVE_UX_COPY.playerHeadline"), "club not playerHeadline");
  assert.true(feuille.includes("ClubDiscoveryToggle"), "feuille has toggle");
  assert.true(feuille.includes("FormationPitch"), "feuille has pitch");
  assert.true(feuille.includes("MatchCheckinPanel"), "check-in lower on feuille");
  assert.false(feuille.includes("LiveSessionPanel"), "no competing LIVE panel");
  assert.false(feuille.includes("ClubSessionStatus"), "no intern status card");
  assert.false(feuille.includes("flag + durée"), "no intern flag copy");
  assert.false(feuille.includes("HORS LIGNE"), "no HORS LIGNE");
  assert.false(feuille.includes("Pas de match lancé"), "no PAS DE MATCH");
  assert.false(toggle.includes("LIVE_DURATION_OPTIONS"), "no duration picker");
  assert.true(liveTab.includes("ClubLiveFeuille"), "LIVE tab is feuille");
  assert.true(matchTab.includes("ClubLiveFeuille"), "match same surface");
  assert.false(liveTab.includes("LiveSessionPanel"), "LIVE tab no old panel");
  assert.false(matchTab.includes("LiveSessionPanel"), "match no old panel");
});

test("pitch LIVE : SLOT 44, codes ST/LW, pas de libellé FR ni Inviter sur le terrain", () => {
  const pitch = readFileSync(`${process.cwd()}/components/club/FormationPitch.tsx`, "utf8");
  const feuille = readFileSync(`${process.cwd()}/components/club/ClubLiveFeuille.tsx`, "utf8");
  assert.true(pitch.includes("const SLOT_SIZE = 44"), "SLOT_SIZE 44");
  assert.true(pitch.includes("h-10 w-10"), "h-10 circles");
  assert.false(pitch.includes("h-14 w-14"), "no h-14 circles");
  assert.true(pitch.includes("{slot.position}"), "position CODE on pitch");
  assert.false(/\{emptySlotHint\}<\/Text>/.test(pitch), "hint not painted on pitch");
  assert.false(/\{positionLabel\}<\/Text>/.test(pitch), "French label not painted");
  assert.true(pitch.includes("accessibilityLabel"), "a11y keeps French + hint");
  assert.true(feuille.includes('emptySlotHint="Inviter sur ce poste"'), "feuille still passes hint");
  assert.true(feuille.includes("Annuler"), "Annuler stays");
});

test("club LIVE chrome : toggle ON = is_live + expires_at ; OFF = is_live false", () => {
  const toggle = readFileSync(`${process.cwd()}/components/club/ClubDiscoveryToggle.tsx`, "utf8");
  const create = readFileSync(`${process.cwd()}/lib/hooks/useClubs.ts`, "utf8");
  assert.true(toggle.includes("useCreateSession"), "create session");
  assert.true(toggle.includes("useToggleSession"), "toggle session");
  assert.true(toggle.includes("liveSessionDurationMs"), "DEV/prod TTL helper");
  assert.true(toggle.includes("durationMs: liveSessionDurationMs()"), "create uses helper");
  assert.true(toggle.includes("if (__DEV__) return"), "DEV never auto-cuts on empty pitch");
  assert.true(toggle.includes("if (!pitchReady) return"), "prod empty hydrate is not full roster");
  assert.true(toggle.includes("neededPositions"), "vacancies from pitch");
  const emptyBranch = toggle.slice(toggle.indexOf("if (neededPositions.length === 0)"), toggle.indexOf("if (neededKey === liveKey)"));
  assert.true(emptyBranch.includes("if (__DEV__) return"), "DEV return before auto-off");
  assert.true(emptyBranch.includes("if (!pitchReady) return"), "pitchReady before auto-off");
  assert.true(emptyBranch.includes("toggleSession.mutate"), "prod full roster still auto-off");
  const turnOff = toggle.slice(toggle.indexOf("const turnOff"), toggle.indexOf("return ("));
  assert.true(turnOff.includes("isLive: true"), "OFF passes isLive true so goingLive is false");
  assert.true(create.includes("is_live: true"), "insert is_live");
  assert.true(create.includes("expires_at: expiresAt"), "insert expires_at");
  assert.true(create.includes("const goingLive = !input.isLive"), "toggle inverts isLive");
});

test("LIVE joueur DEV : 12 h, pas de chips durée ; Arrêter reste le kill", () => {
  const player = readFileSync(`${process.cwd()}/components/live/PlayerLivePanel.tsx`, "utf8");
  assert.true(player.includes("liveSessionDurationMs"), "helper");
  assert.true(player.includes("String(liveSessionDurationMs())"), "default duration state");
  assert.true(player.includes("__DEV__ ? liveSessionDurationMs()"), "DEV start 12h");
  assert.true(player.includes("__DEV__ ? null"), "chips hidden in DEV");
  assert.true(player.includes("LIVE_DURATION_OPTIONS"), "prod chips still in file");
  const stop = player.slice(player.indexOf("const stop"), player.indexOf("const openSheet"));
  assert.true(stop.includes("goOffline.mutate"), "Arrêter still cuts LIVE");
  assert.false(/useEffect\(/.test(player), "no unmount effect");
});

test("LIVE joueur : clubs en LIVE sur le feed, pas cachés derrière un pane", () => {
  const feed = readFileSync(`${process.cwd()}/app/(player)/(tabs)/index.tsx`, "utf8");
  assert.true(feed.includes("LiveClubCard"), "cards on feed");
  assert.true(feed.includes("LIVE_UX_COPY.findClub"), "section label");
  assert.true(feed.includes("LIVE_UX_COPY.noLiveClubs"), "honest empty");
  assert.false(feed.includes("On cherche un match"), "no match hunt");
});

test("Matchmaking joueur : titre Matchmaking, clubs LIVE seulement", () => {
  const feed = readFileSync(`${process.cwd()}/app/(player)/(tabs)/index.tsx`, "utf8");
  assert.true(feed.includes("LIVE_UX_COPY.title"), "title");
  assert.true(feed.includes("LiveClubCard"), "LiveClubCard");
  assert.false(feed.includes("LivePlayerCard"), "no LivePlayerCard");
  assert.false(feed.includes("FindClubPanel"), "no FindClubPanel");
  assert.false(feed.includes("otherPlayers"), "no otherPlayers");
  assert.false(feed.includes("useLivePlayers"), "no useLivePlayers");
});

test("unmount / blur d'onglet LIVE ne coupe pas is_live", () => {
  const files = [
    "components/live/PlayerLivePanel.tsx",
    "components/club/ClubDiscoveryToggle.tsx",
    "components/club/ClubLiveFeuille.tsx",
    "app/(player)/(tabs)/index.tsx",
    "app/(club)/(tabs)/index.tsx",
    "app/(club)/(tabs)/match.tsx",
  ];
  for (const rel of files) {
    const src = readFileSync(`${process.cwd()}/${rel}`, "utf8");
    assert.false(/useEffect\([\s\S]*is_live:\s*false/.test(src), `${rel} no useEffect is_live false`);
    assert.false(/useFocusEffect\([\s\S]*is_live:\s*false/.test(src), `${rel} no focus is_live false`);
    assert.false(/AppState[\s\S]*is_live:\s*false/.test(src), `${rel} no AppState is_live false`);
  }
  const player = readFileSync(`${process.cwd()}/components/live/PlayerLivePanel.tsx`, "utf8");
  assert.false(/useEffect\(/.test(player), "player panel no effect");
  const stop = player.slice(player.indexOf("const stop"), player.indexOf("const openSheet"));
  assert.true(stop.includes("goOffline.mutate"), "Arrêter still cuts LIVE");
  const toggle = readFileSync(`${process.cwd()}/components/club/ClubDiscoveryToggle.tsx`, "utf8");
  const turnOff = toggle.slice(toggle.indexOf("const turnOff"), toggle.indexOf("return ("));
  assert.true(turnOff.includes("toggleSession.mutate"), "OFF toggle still cuts LIVE");
  assert.false(/return \(\) =>[\s\S]*is_live/.test(toggle), "club toggle no cleanup offline");
  assert.false(/cleanup[\s\S]*is_live/.test(toggle), "club toggle no cleanup offline comment-write");
  const create = readFileSync(`${process.cwd()}/lib/hooks/useClubs.ts`, "utf8");
  assert.true(create.includes("update({ is_live: true }).in(\"id\", previousIds)"), "restore club LIVE if insert fails");
  const playerHook = readFileSync(`${process.cwd()}/lib/hooks/usePlayerLive.ts`, "utf8");
  assert.true(playerHook.includes("restorePrevious"), "restore player LIVE if insert fails");
});

console.log(`\n${passed} tests live OK`);
