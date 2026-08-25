/**
 * EA adapter — search liste, payloads vides, stubs NotImplementedError.
 * Aucun appel réseau réel : `fetch` est mocké. Ne jamais viser proclubs.ea.com.
 *
 * Lancer : npx tsx scripts/test-ea-provider.ts
 */
import { NotImplementedError } from "../supabase/functions/_shared/ea/provider";
import { ProClubsEAProvider } from "../supabase/functions/_shared/ea/proClubsAdapter";

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
function test(name: string, fn: () => void | Promise<void>) {
  const result = fn();
  if (result && typeof (result as Promise<void>).then === "function") {
    return result.then(() => {
      passed += 1;
      console.log(`  ok — ${name}`);
    });
  }
  passed += 1;
  console.log(`  ok — ${name}`);
  return Promise.resolve();
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const originalFetch = globalThis.fetch;
const provider = new ProClubsEAProvider();

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
  globalThis.fetch = (async (input: RequestInfo | URL) => handler(String(input))) as typeof fetch;
}

async function run() {
  console.log("EA Data Foundation — ProClubsEAProvider");

  await test("searchClub — liste complète, jamais first-hit", async () => {
    mockFetch(() =>
      jsonResponse([
        { clubId: "1", name: "Alpha" },
        { clubId: "2", name: "Alpha United" },
      ])
    );
    const clubs = await provider.searchClub("Alpha");
    assert.ok(clubs, "non-null");
    assert.deepEqual(clubs?.map((c) => c.externalId), ["1", "2"], "liste");
  });

  await test("searchClub — payload vide -> [] pas un club inventé", async () => {
    mockFetch(() => jsonResponse({}));
    const clubs = await provider.searchClub("Fantôme");
    assert.deepEqual(clubs, [], "vide");
  });

  await test("searchClub — payload malformé -> []", async () => {
    mockFetch(() => jsonResponse("oops"));
    const clubs = await provider.searchClub("X");
    assert.deepEqual(clubs, [], "malformé");
  });

  await test("searchClub — fetch en échec -> null (EA down, pas de fake)", async () => {
    mockFetch(() => {
      throw new Error("network down");
    });
    const clubs = await provider.searchClub("X");
    assert.deepEqual(clubs, null, "null");
  });

  await test("getClubMatches — payload malformé -> [] pas d'exception", async () => {
    mockFetch(() => jsonResponse({ not: "an array" }));
    const matches = await provider.getClubMatches("clubA");
    assert.deepEqual(matches, [], "vide défensif");
  });

  await test("getClubMatches — mix league+friendly, skip objets nuls", async () => {
    mockFetch((url) => {
      if (url.includes("leagueMatch")) {
        return jsonResponse([
          { matchId: "L1", matchType: "leagueMatch", players: { clubA: { p1: { playername: "Selim", goals: 1 } } } },
        ]);
      }
      if (url.includes("playoffMatch")) return jsonResponse([]);
      return jsonResponse([
        { matchId: "F1", matchType: "friendlyMatch", players: { clubA: { p1: { playername: "Selim", goals: 2 } } } },
        "garbage",
      ]);
    });
    const matches = await provider.getClubMatches("clubA");
    assert.deepEqual(matches?.map((m) => m.matchId), ["L1", "F1"], "league+friendly+playoff");
  });

  await test("getClubMatches — inclut playoffMatch", async () => {
    mockFetch((url) => {
      if (url.includes("playoffMatch")) {
        return jsonResponse([
          { matchId: "P1", matchType: "playoffMatch", players: { clubA: { p1: { playername: "Selim" } } } },
        ]);
      }
      return jsonResponse([]);
    });
    const matches = await provider.getClubMatches("clubA");
    assert.deepEqual(matches?.map((m) => m.matchId), ["P1"], "playoff");
    assert.deepEqual(matches?.[0]?.matchType, "playoffMatch", "type");
  });

  await test("getClub — /clubs/info indexé par clubId", async () => {
    mockFetch(() => jsonResponse({ "2582784": { clubId: 2582784, name: "United", customKit: { crestAssetId: "19" } } }));
    const club = await provider.getClub("2582784");
    assert.deepEqual(club?.name, "United", "name");
    assert.deepEqual(club?.crestId, "19", "crest");
  });

  await test("getClub — payload vide -> null, pas de club inventé", async () => {
    mockFetch(() => jsonResponse({}));
    assert.deepEqual(await provider.getClub("2582784"), null, "null");
  });

  await test("getClubStats — overallStats tableau", async () => {
    mockFetch(() => jsonResponse([{ clubId: "2582784", wins: "10", losses: "3", ties: "2", gamesPlayed: "15" }]));
    const stats = await provider.getClubStats("2582784");
    assert.deepEqual(stats?.wins, 10, "wins");
    assert.deepEqual(stats?.draws, 2, "ties");
    assert.deepEqual(stats?.gamesPlayed, 15, "gamesPlayed");
  });

  await test("getClubMembers — liste vide reste vide", async () => {
    mockFetch(() => jsonResponse({ members: [] }));
    assert.deepEqual(await provider.getClubMembers("2582784"), [], "vide");
  });

  await test("getClubMembers — playername, jamais la clé persona", async () => {
    mockFetch(() =>
      jsonResponse({
        members: [{ name: "Selim", proPos: "ST", gamesPlayed: "8", blazeId: "persona-do-not-use" }],
      })
    );
    const members = await provider.getClubMembers("2582784");
    assert.deepEqual(members?.map((m) => m.name), ["Selim"], "name");
    assert.deepEqual(members?.[0]?.proPosition, "ST", "proPos");
    assert.deepEqual((members?.[0] as { blazeId?: unknown })?.blazeId, undefined, "pas de blazeId persisté");
  });

  await test("getClubCareerStats / getPlayerCareerStats — club-scoped /api/fc", async () => {
    mockFetch(() =>
      jsonResponse({
        members: [
          { name: "Selim", gamesPlayed: "40", goals: "20" },
          { name: "Alex", gamesPlayed: "3" },
        ],
      })
    );
    const all = await provider.getClubCareerStats("2582784");
    assert.deepEqual(all?.map((c) => c.externalId), ["Selim", "Alex"], "liste");
    const one = await provider.getPlayerCareerStats("2582784", "selim");
    assert.deepEqual(one?.gamesPlayed, 40, "filtre playername");
    assert.deepEqual(await provider.getPlayerCareerStats("2582784", "inconnu"), null, "absent");
  });

  await test("getPlayerStats — rapprochement par playername, pas la clé persona", async () => {
    mockFetch((url) => {
      if (url.includes("leagueMatch")) {
        return jsonResponse([
          { matchId: "m1", matchType: "leagueMatch", players: { clubA: { persona99: { playername: "Selim", goals: 3 } } } },
        ]);
      }
      return jsonResponse([]);
    });
    const stats = await provider.getPlayerStats("clubA", "selim");
    assert.deepEqual(stats?.goals, 3, "goals");
    assert.deepEqual(stats?.matchesPlayed, 1, "matches");
  });

  const stubs = ["getLeaderboard", "getPlayoffData"] as const;

  for (const method of stubs) {
    await test(`stub ${method} lève NotImplementedError`, async () => {
      let caught: unknown;
      try {
        await (provider[method] as (id: string) => Promise<unknown>)("x");
      } catch (err) {
        caught = err;
      }
      assert.ok(caught instanceof NotImplementedError, `${method} NotImplementedError`);
      assert.ok(caught instanceof Error && caught.message.includes(method), "message méthode");
    });
  }

  globalThis.fetch = originalFetch;
  console.log(`\n${passed} test(s) passés.`);
}

run().catch((err) => {
  globalThis.fetch = originalFetch;
  console.error(err);
  process.exit(1);
});
