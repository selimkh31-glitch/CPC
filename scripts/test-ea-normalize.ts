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
import {
  aggregatePlayerStats,
  normalizeClub,
  normalizeClubStats,
  normalizeMatch,
  normalizePlayerMatchStats,
} from "../supabase/functions/_shared/ea/normalize";

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
  assert.deepEqual(stats, { name: "", goals: 0, assists: 0, cleanSheetsAny: 0, rating: null }, "valeurs neutres");
});

test("stats joueur d'un match — rating de type inattendu (string non numérique) -> null", () => {
  const stats = normalizePlayerMatchStats({ goals: 2, rating: "abc" });
  assert.deepEqual(stats.goals, 2, "goals");
  assert.deepEqual(stats.rating, null, "rating invalide -> null");
});

test("stats joueur d'un match — playername préservé (clé de rapprochement, jamais l'id EA)", () => {
  const stats = normalizePlayerMatchStats({ playername: "Selim", goals: 1 });
  assert.deepEqual(stats.name, "Selim", "name");
});

test("stats joueur d'un match — playername absent -> name vide, jamais null/undefined", () => {
  const stats = normalizePlayerMatchStats({ goals: 1 });
  assert.deepEqual(stats.name, "", "name vide");
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

// --- aggregatePlayerStats ------------------------------------------------------
//
// Régression : ProClubsEAProvider.getPlayerStats indexait auparavant
// `match.players[playerName.toLowerCase()]` directement — `players` étant
// keyé par id EA brut (jamais par nom), cette méthode retournait TOUJOURS
// `null` en pratique. Ces tests couvrent le chemin réellement emprunté par
// getPlayerStats (recherche par valeur sur `.name`, insensible à la casse)
// pour que cette régression précise ne puisse plus repasser inaperçue.

// Champs bruts EA (avant normalisation) : `cleansheetsAny`, casse exacte de
// l'API — ne pas confondre avec `cleanSheetsAny` (nom du champ normalisé en
// sortie, EAPlayerMatchStats).
function match(players: Record<string, { name: string; goals?: number; assists?: number; cleansheetsAny?: number; rating?: number | null }>) {
  return normalizeMatch(
    { matchType: "leagueMatch", players: { clubA: players } },
    "clubA",
    "proclubs-community",
    "common-gen5"
  )!;
}

test("aggregatePlayerStats — retrouve un joueur par nom (insensible à la casse), sur plusieurs matchs", () => {
  const matches = [
    match({ p1: { name: "Selim", goals: 2, assists: 1, cleansheetsAny: 0, rating: 8 } }),
    match({ p1: { name: "selim", goals: 1, assists: 0, cleansheetsAny: 1, rating: 6 } }),
  ];
  const stats = aggregatePlayerStats(matches, "SELIM", "proclubs-community", "clubA", "common-gen5");
  assert.ok(stats, "stats non-null");
  assert.deepEqual(stats?.goals, 3, "goals cumulés");
  assert.deepEqual(stats?.assists, 1, "assists cumulés");
  assert.deepEqual(stats?.cleanSheets, 1, "cleanSheets cumulés");
  assert.deepEqual(stats?.matchesPlayed, 2, "matchesPlayed");
  assert.deepEqual(stats?.avgRating, 7, "avgRating moyenne (8+6)/2");
});

test("aggregatePlayerStats — joueur absent de certains matchs, ignorés sans casser la moyenne", () => {
  const matches = [
    match({ p1: { name: "Selim", goals: 1, rating: 9 } }),
    match({ p2: { name: "Quelqu'un d'autre", goals: 5 } }),
  ];
  const stats = aggregatePlayerStats(matches, "Selim", "proclubs-community", "clubA", "common-gen5");
  assert.deepEqual(stats?.matchesPlayed, 1, "matchesPlayed ignore le match sans ce joueur");
  assert.deepEqual(stats?.goals, 1, "goals du joueur uniquement, jamais ceux d'un autre");
});

test("aggregatePlayerStats — joueur introuvable dans aucun match -> null (jamais 0 déguisé en donnée réelle)", () => {
  const matches = [match({ p1: { name: "Quelqu'un d'autre", goals: 5 } })];
  const stats = aggregatePlayerStats(matches, "Selim", "proclubs-community", "clubA", "common-gen5");
  assert.deepEqual(stats, null, "null, pas un objet à 0 partout");
});

test("aggregatePlayerStats — nom vide -> null immédiat, pas de parcours des matchs", () => {
  const stats = aggregatePlayerStats([match({ p1: { name: "Selim" } })], "   ", "proclubs-community", "clubA", "common-gen5");
  assert.deepEqual(stats, null, "null");
});

test("aggregatePlayerStats — ratings absents sur tous les matchs -> avgRating null, pas NaN/0", () => {
  const matches = [match({ p1: { name: "Selim", goals: 1, rating: null } })];
  const stats = aggregatePlayerStats(matches, "Selim", "proclubs-community", "clubA", "common-gen5");
  assert.deepEqual(stats?.avgRating, null, "avgRating null");
});

console.log(`\n${passed} test(s) passés.`);
