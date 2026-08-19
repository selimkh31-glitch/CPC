/**
 * EA Data Foundation — tests de la couche de normalisation
 * (supabase/functions/_shared/ea/normalize.ts). Logique pure, aucune
 * dépendance réseau/Supabase : exécuté avec `tsx` sur des payloads EA en
 * mémoire (réalistes, malformés, partiels, vides — jamais un vrai appel
 * réseau, voir mission section 44 : ne jamais prétendre qu'une sync EA a
 * fonctionné si elle n'a pas été testée).
 *
 * Lancer : npx tsx scripts/test-ea-normalize.ts
 */
import { normalizeClub, normalizeClubStats, normalizeMatch, normalizePlayerMatchStats } from "../supabase/functions/_shared/ea/normalize";

const assert = {
  deepEqual(actual: unknown, expected: unknown, label: string) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) throw new Error(`Assertion échouée (${label}).\n  reçu: ${a}\n  attendu: ${b}`);
  },
  ok(value: unknown, label: string) {
    if (!value) throw new Error(`Assertion échouée (${label}) : valeur falsy.`);
  },
};

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok — ${name}`);
}

console.log("EA Data Foundation — normalize.ts");

// --- normalizeClub ----------------------------------------------------------

test("club EA complet (forme {clubId, name})", () => {
  const club = normalizeClub({ clubId: "12345", name: "Les Invincibles", crestId: "42" }, "proclubs-community", "common-gen5");
  assert.ok(club, "club non-null");
  assert.deepEqual(club?.externalId, "12345", "externalId");
  assert.deepEqual(club?.name, "Les Invincibles", "name");
});

test("club EA — forme alternative {id, clubName}", () => {
  const club = normalizeClub({ id: 999, clubName: "FC Test" }, "proclubs-community", null);
  assert.ok(club, "club non-null");
  assert.deepEqual(club?.externalId, "999", "externalId converti en string");
});

test("club EA sans id exploitable -> null (jamais un objet à moitié vide)", () => {
  const club = normalizeClub({ name: "Sans ID" }, "proclubs-community", null);
  assert.deepEqual(club, null, "club null");
});

test("club EA — payload non-objet (null/undefined/string) -> null, jamais d'exception", () => {
  assert.deepEqual(normalizeClub(null, "proclubs-community", null), null, "null");
  assert.deepEqual(normalizeClub(undefined, "proclubs-community", null), null, "undefined");
  assert.deepEqual(normalizeClub("oops", "proclubs-community", null), null, "string");
});

// --- normalizeClubStats ------------------------------------------------------

test("stats de club — champs numériques valides", () => {
  const stats = normalizeClubStats({ wins: 10, losses: "3", ties: 2 }, "12345", "proclubs-community", "common-gen5");
  assert.deepEqual(stats.wins, 10, "wins");
  assert.deepEqual(stats.losses, 3, "losses (string numérique convertie)");
  assert.deepEqual(stats.draws, 2, "draws (fallback ties)");
});

test("stats de club — payload vide -> tous les champs null, jamais d'exception", () => {
  const stats = normalizeClubStats({}, "12345", "proclubs-community", null);
  assert.deepEqual(stats.wins, null, "wins null");
  assert.deepEqual(stats.titlesWon, null, "titlesWon null");
});

// --- normalizePlayerMatchStats ------------------------------------------------

test("stats joueur d'un match — champs manquants retombent sur 0/null, pas d'exception", () => {
  const stats = normalizePlayerMatchStats({});
  assert.deepEqual(stats, { goals: 0, assists: 0, cleanSheetsAny: 0, rating: null }, "valeurs neutres");
});

test("stats joueur d'un match — rating de type inattendu (string non numérique) -> null", () => {
  const stats = normalizePlayerMatchStats({ goals: 2, rating: "abc" });
  assert.deepEqual(stats.goals, 2, "goals");
  assert.deepEqual(stats.rating, null, "rating invalide -> null");
});

// --- normalizeMatch ------------------------------------------------------------

test("match EA complet, deux clubs dans players — ne garde que le club demandé", () => {
  const raw = {
    matchId: "m1",
    matchType: "leagueMatch",
    timestamp: "1700000000",
    players: {
      clubA: { p1: { playername: "Joueur1", goals: 2, assists: 1, cleansheetsAny: 0, rating: "7.5" } },
      clubB: { p2: { playername: "Adversaire", goals: 0 } },
    },
  };
  const match = normalizeMatch(raw, "clubA", "proclubs-community", "common-gen5");
  assert.ok(match, "match non-null");
  assert.deepEqual(match?.matchType, "leagueMatch", "matchType");
  assert.deepEqual(Object.keys(match?.players ?? {}), ["p1"], "seul le club demandé est conservé");
  assert.deepEqual(match?.players.p1.goals, 2, "goals du joueur");
});

test("match EA — matchType inconnu/absent -> 'unknown', jamais une valeur inventée", () => {
  const match = normalizeMatch({ players: {} }, "clubA", "proclubs-community", null);
  assert.deepEqual(match?.matchType, "unknown", "matchType");
});

test("match EA — club demandé absent de players -> liste de joueurs vide, pas d'exception", () => {
  const match = normalizeMatch({ matchType: "friendlyMatch", players: { autreClub: {} } }, "clubA", "proclubs-community", null);
  assert.ok(match, "match non-null");
  assert.deepEqual(match?.players, {}, "players vide");
});

test("match EA — payload totalement malformé (tableau, string, null) -> null", () => {
  assert.deepEqual(normalizeMatch([], "clubA", "proclubs-community", null), null, "tableau");
  assert.deepEqual(normalizeMatch("oops", "clubA", "proclubs-community", null), null, "string");
  assert.deepEqual(normalizeMatch(null, "clubA", "proclubs-community", null), null, "null");
});

console.log(`\n${passed} test(s) passés.`);
