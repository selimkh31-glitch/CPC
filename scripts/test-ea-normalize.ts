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
  confirmClubInSearch,
  normalizeCareerList,
  normalizeClub,
  normalizeClubStats,
  normalizeMatch,
  normalizeMemberList,
  normalizePlayerMatchStats,
  normalizeSearchResults,
  pickClubInfoRecord,
  pickClubStatsRecord,
} from "../supabase/functions/_shared/ea/normalize";
import {
  buildVerifiedStatsForPlayer,
  collectMatchIds,
  filterNewMatches,
  mergeVerifiedStats,
  previousStatsForTitle,
  readImportedMatchIds,
} from "../supabase/functions/_shared/ea/verified";

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

// --- normalizeSearchResults / confirmClubInSearch -----------------------------

test("search results — liste complète, jamais silent list[0]", () => {
  const clubs = normalizeSearchResults(
    [
      { clubId: "1", name: "Alpha" },
      { clubId: "2", name: "Alpha United" },
    ],
    "proclubs-community",
    "common-gen5"
  );
  assert.deepEqual(clubs.map((c) => c.externalId), ["1", "2"], "deux candidats");
  assert.deepEqual(clubs.map((c) => c.name), ["Alpha", "Alpha United"], "noms");
});

test("search results — forme { clubs: [...] }, ids numériques", () => {
  const clubs = normalizeSearchResults(
    { clubs: [{ id: 10, clubName: "FC A" }, { clubId: "11", name: "FC B" }] },
    "proclubs-community",
    null
  );
  assert.deepEqual(clubs.map((c) => c.externalId), ["10", "11"], "ids");
});

test("search results — payload vide/malformé -> liste vide, pas de club inventé", () => {
  assert.deepEqual(normalizeSearchResults(null, "proclubs-community", null), [], "null");
  assert.deepEqual(normalizeSearchResults(undefined, "proclubs-community", null), [], "undefined");
  assert.deepEqual(normalizeSearchResults({}, "proclubs-community", null), [], "objet vide");
  assert.deepEqual(normalizeSearchResults({ clubs: null }, "proclubs-community", null), [], "clubs null");
  assert.deepEqual(normalizeSearchResults("oops", "proclubs-community", null), [], "string");
  assert.deepEqual(normalizeSearchResults({ clubs: "nope" }, "proclubs-community", null), [], "clubs non-array");
});

test("search results — id sans nom + fallbackName (terme cherché), jamais un fake id", () => {
  const clubs = normalizeSearchResults(
    [{ clubId: "55" }, { clubId: "56", name: "Réel" }],
    "proclubs-community",
    null,
    "Les Invincibles"
  );
  assert.deepEqual(clubs.map((c) => c.externalId), ["55", "56"], "deux ids");
  assert.deepEqual(clubs[0]?.name, "Les Invincibles", "fallback terme cherché");
  assert.deepEqual(clubs[1]?.name, "Réel", "nom EA conservé");
});

test("search results — mix valide/invalide, déduplique par id", () => {
  const clubs = normalizeSearchResults(
    [{ name: "Sans id" }, { clubId: "7", name: "OK" }, { clubId: "7", name: "Doublon" }, null],
    "proclubs-community",
    null
  );
  assert.deepEqual(clubs.map((c) => c.externalId), ["7"], "un seul id 7");
  assert.deepEqual(clubs[0]?.name, "OK", "premier occurrence conservée");
});

test("confirmClubInSearch — id connu vs id inconnu (rejet link)", () => {
  const candidates = normalizeSearchResults(
    [{ clubId: "1", name: "Alpha" }, { clubId: "2", name: "Beta" }],
    "proclubs-community",
    null
  );
  assert.deepEqual(confirmClubInSearch(candidates, "1")?.externalId, "1", "match");
  assert.deepEqual(confirmClubInSearch(candidates, " 2 ")?.externalId, "2", "trim");
  assert.deepEqual(confirmClubInSearch(candidates, "99"), null, "inconnu rejeté");
  assert.deepEqual(confirmClubInSearch(candidates, ""), null, "vide rejeté");
  assert.deepEqual(confirmClubInSearch([], "1"), null, "liste vide");
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
  assert.deepEqual(stats.gamesPlayed, null, "gamesPlayed null");
});

test("club info — crestAssetId sous customKit", () => {
  const club = normalizeClub(
    { clubId: "2582784", name: "United", customKit: { crestAssetId: "19" } },
    "proclubs-community",
    "common-gen5"
  );
  assert.deepEqual(club?.crestId, "19", "crest from customKit");
});

test("pickClubInfoRecord — objet indexé par clubId", () => {
  const raw = { "2582784": { clubId: 2582784, name: "United" }, "9": { name: "Autre" } };
  const picked = pickClubInfoRecord(raw, "2582784");
  assert.deepEqual((picked as { name: string }).name, "United", "info keyed");
  assert.deepEqual(pickClubInfoRecord({}, "2582784"), null, "vide");
});

test("pickClubStatsRecord — tableau overallStats, club absent -> null", () => {
  const raw = [{ clubId: "1", wins: "10", losses: "2", ties: "1", gamesPlayed: "13" }];
  const hit = pickClubStatsRecord(raw, "1") as { wins: string };
  assert.deepEqual(hit.wins, "10", "found");
  assert.deepEqual(pickClubStatsRecord(raw, "99"), null, "absent");
  assert.deepEqual(pickClubStatsRecord([], "1"), null, "liste vide");
});

test("members/stats — { members: [] } -> liste vide, pas de joueur inventé", () => {
  assert.deepEqual(normalizeMemberList({ members: [] }, "clubA", "proclubs-community", null), [], "vide objet");
  assert.deepEqual(normalizeMemberList([], "clubA", "proclubs-community", null), [], "vide array");
  assert.deepEqual(normalizeMemberList({}, "clubA", "proclubs-community", null), [], "objet sans members");
  assert.deepEqual(normalizeMemberList(null, "clubA", "proclubs-community", null), [], "null");
});

test("members/stats — name + proPos, ignore entrée sans nom, déduplique", () => {
  const list = normalizeMemberList(
    {
      members: [
        { name: "Selim", proPos: "ST", gamesPlayed: "12", goals: "4", assists: "1", ratingAve: "7.2", proName: "S" },
        { goals: 9 },
        { name: "selim", proPos: "CAM" },
      ],
    },
    "clubA",
    "proclubs-community",
    "common-gen5"
  );
  assert.deepEqual(list.map((m) => m.name), ["Selim"], "un seul Selim");
  assert.deepEqual(list[0]?.proPosition, "ST", "proPos");
  assert.deepEqual(list[0]?.gamesPlayed, 12, "gamesPlayed");
});

test("members/career/stats — liste + filtre identite playername, pas de persona login", () => {
  const list = normalizeCareerList(
    {
      members: [
        { name: "Selim", gamesPlayed: "40", goals: "20", assists: "8", ratingAve: "7.1", proOverall: "82", proPos: "ST" },
        { playername: "Alex", gamesPlayed: "3" },
      ],
    },
    "clubA",
    "proclubs-community",
    null
  );
  assert.deepEqual(list.map((c) => c.externalId), ["Selim", "Alex"], "playername comme identite");
  assert.deepEqual(list[0]?.gamesPlayed, 40, "career games");
  assert.deepEqual(list[0]?.proOverall, 82, "proOverall du JSON");
});

test("members/career/stats — payload vide -> []", () => {
  assert.deepEqual(normalizeCareerList({ members: [] }, "clubA", "proclubs-community", null), [], "vide");
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

test("match EA — matchId numérique converti en string (skip incrémental)", () => {
  const match = normalizeMatch({ matchId: 4242, players: {} }, "clubA", "proclubs-community", null);
  assert.deepEqual(match?.matchId, "4242", "matchId string");
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

// --- incremental skip / verified_stats.importedMatchIds -----------------------

function matchWithId(
  matchId: string | number | undefined,
  players: Record<string, { name: string; goals?: number; assists?: number; cleansheetsAny?: number; rating?: number | null }>
) {
  return normalizeMatch(
    { matchId, matchType: "leagueMatch", players: { clubA: players } },
    "clubA",
    "proclubs-community",
    "common-gen5"
  )!;
}

test("filterNewMatches — skip les matchId déjà dans importedMatchIds", () => {
  const m1 = matchWithId("m1", { p1: { name: "Selim", goals: 1 } });
  const m2 = matchWithId("m2", { p1: { name: "Selim", goals: 2 } });
  const fresh = filterNewMatches([m1, m2], ["m1"]);
  assert.deepEqual(fresh.map((m) => m.matchId), ["m2"], "m1 sauté");
});

test("filterNewMatches — match sans matchId reste dans la fenêtre (impossible à skip)", () => {
  const noId = matchWithId(undefined, { p1: { name: "Selim", goals: 1 } });
  const known = matchWithId("m1", { p1: { name: "Selim", goals: 9 } });
  const fresh = filterNewMatches([noId, known], ["m1"]);
  assert.deepEqual(fresh.length, 1, "un seul restant");
  assert.deepEqual(fresh[0]?.matchId, null, "celui sans id");
});

test("readImportedMatchIds — JSON malformé / partiel -> [] ou ids string uniques", () => {
  assert.deepEqual(readImportedMatchIds(null), [], "null");
  assert.deepEqual(readImportedMatchIds({}), [], "objet vide");
  assert.deepEqual(readImportedMatchIds({ importedMatchIds: "m1" }), [], "non-array");
  assert.deepEqual(readImportedMatchIds({ importedMatchIds: ["m1", " m1 ", 2, ""] }), ["m1"], "dédup + ignore non-string");
});

test("buildVerifiedStatsForPlayer — skip incrémental, merge, noShowsDetected=0", () => {
  const m1 = matchWithId("m1", { p1: { name: "Selim", goals: 2, assists: 1, rating: 8 } });
  const m2 = matchWithId("m2", { p1: { name: "Selim", goals: 1, assists: 0, rating: 6 } });
  const first = buildVerifiedStatsForPlayer([m1, m2], "Selim", null, "proclubs-community", "clubA", "common-gen5", "2026-01-01T00:00:00.000Z");
  assert.ok(first, "first non-null");
  assert.deepEqual(first?.goals, 3, "goals fenêtre initiale");
  assert.deepEqual(first?.importedMatchIds, ["m1", "m2"], "ids enregistrés");
  assert.deepEqual(first?.noShowsDetected, 0, "EA ne fournit pas noShows");

  const m3 = matchWithId("m3", { p1: { name: "Selim", goals: 4, assists: 2, rating: 9 } });
  const second = buildVerifiedStatsForPlayer(
    [m1, m2, m3],
    "Selim",
    first,
    "proclubs-community",
    "clubA",
    "common-gen5",
    "2026-01-02T00:00:00.000Z"
  );
  assert.ok(second, "second non-null");
  assert.deepEqual(second?.goals, 7, "m1/m2 skip, +4 de m3");
  assert.deepEqual(second?.assists, 3, "assists accumulés");
  assert.deepEqual(second?.matchesPlayed, 3, "3 matchs distincts");
  assert.deepEqual(second?.importedMatchIds, ["m1", "m2", "m3"], "ids fusionnés");
  assert.deepEqual(second?.matchesPlayedRecent, 1, "seulement le nouveau");
  assert.deepEqual(second?.noShowsDetected, 0, "toujours 0");
});

test("buildVerifiedStatsForPlayer — tout déjà importé -> null (garde le cache)", () => {
  const m1 = matchWithId("m1", { p1: { name: "Selim", goals: 2 } });
  const stats = buildVerifiedStatsForPlayer(
    [m1],
    "Selim",
    { importedMatchIds: ["m1"], goals: 2, matchesPlayed: 1 },
    "proclubs-community",
    "clubA",
    "common-gen5"
  );
  assert.deepEqual(stats, null, "rien de nouveau");
});

test("verified_stats — blob fc26 / sans titre non fusionné dans fc27", () => {
  const m1 = matchWithId("m1", { p1: { name: "Selim", goals: 2 } });
  const fromOld = buildVerifiedStatsForPlayer(
    [m1],
    "Selim",
    { importedMatchIds: ["m1"], goals: 99, matchesPlayed: 10, eaTitle: "fc26" },
    "proclubs-community",
    "clubA",
    "common-gen5",
    "2026-09-25T00:00:00.000Z",
    "fc27"
  );
  assert.ok(fromOld, "nouvelle fenêtre fc27");
  assert.deepEqual(fromOld?.goals, 2, "pas les 99 de fc26");
  assert.deepEqual(fromOld?.eaTitle, "fc27", "titre produit");
  assert.deepEqual(previousStatsForTitle({ eaTitle: "fc26", goals: 1 }, "fc27"), null, "mix rejeté");
  assert.deepEqual(previousStatsForTitle({ goals: 1, importedMatchIds: ["m1"] }, "fc27"), null, "sans titre rejeté");
});

test("mergeVerifiedStats / collectMatchIds — ids nouveaux uniquement", () => {
  const merged = mergeVerifiedStats(
    {
      goals: 1,
      assists: 0,
      cleanSheets: 0,
      matchesPlayed: 1,
      avgRating: 7,
      matchesPlayedRecent: 1,
      noShowsDetected: 0,
      lastSyncedAt: "t0",
      importedMatchIds: ["m1"],
    },
    { goals: 2, assists: 1, cleanSheets: 0, matchesPlayed: 1, avgRating: 9 },
    ["m1", "m2"],
    "t1"
  );
  assert.deepEqual(merged.goals, 3, "merge goals");
  assert.deepEqual(merged.importedMatchIds, ["m1", "m2"], "m1 pas dupliqué");
  assert.deepEqual(merged.avgRating, 8, "(7+9)/2");
  assert.deepEqual(collectMatchIds([matchWithId("m2", { p1: { name: "X" } })]), ["m2"], "collect");
});

console.log(`\n${passed} test(s) passés.`);
