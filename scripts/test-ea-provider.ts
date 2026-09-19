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

  await test("searchClub — CSL d'abord, jamais first-hit", async () => {
    const urls: string[] = [];
    mockFetch((url) => {
      urls.push(url);
      if (url.includes("/currentSeasonLeaderboard/search")) {
        return jsonResponse([
          { clubId: "42450", name: "Possibly FC", regionId: 49552 },
          { clubId: "2", name: "Possibly United" },
        ]);
      }
      throw new Error("allTime ne doit pas être appelé si CSL a des candidats");
    });
    const clubs = await provider.searchClub("Possibly");
    assert.ok(clubs, "non-null");
    assert.deepEqual(clubs?.map((c) => c.externalId), ["42450", "2"], "liste");
    assert.ok(urls[0]?.includes("/currentSeasonLeaderboard/search"), "CSL first");
  });

  await test("searchClub — CSL vide → fallback allTimeLeaderboard/search", async () => {
    const urls: string[] = [];
    mockFetch((url) => {
      urls.push(url);
      if (url.includes("/currentSeasonLeaderboard/search")) return jsonResponse([]);
      return jsonResponse([{ clubId: "2582784", name: "United" }]);
    });
    const clubs = await provider.searchClub("United");
    assert.deepEqual(clubs?.map((c) => c.externalId), ["2582784"], "allTime");
    assert.ok(urls.some((u) => u.includes("/allTimeLeaderboard/search")), "fallback");
  });

  await test("searchClub — CSL en échec → fallback allTime", async () => {
    mockFetch((url) => {
      if (url.includes("/currentSeasonLeaderboard/search")) {
        return new Response("nope", { status: 500 });
      }
      return jsonResponse([{ clubId: "1", name: "Alpha" }]);
    });
    const clubs = await provider.searchClub("Alpha");
    assert.deepEqual(clubs?.map((c) => c.externalId), ["1"], "fallback ok");
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
      return jsonResponse([
        { matchId: "F1", matchType: "friendlyMatch", players: { clubA: { p1: { playername: "Selim", goals: 2 } } } },
        "garbage",
      ]);
    });
    const matches = await provider.getClubMatches("clubA");
    assert.deepEqual(matches?.map((m) => m.matchId), ["L1", "F1"], "10+10 dual GET");
  });

  await test("getPlayerStats — rapprochement par playername, pas la clé persona", async () => {
    mockFetch((url) => {
      if (url.includes("friendlyMatch")) return jsonResponse([]);
      return jsonResponse([
        { matchId: "m1", matchType: "leagueMatch", players: { clubA: { persona99: { playername: "Selim", goals: 3 } } } },
      ]);
    });
    const stats = await provider.getPlayerStats("clubA", "selim");
    assert.deepEqual(stats?.goals, 3, "goals");
    assert.deepEqual(stats?.matchesPlayed, 1, "matches");
  });

  await test("getClubMembers — noms réels, hop/fetch mocké", async () => {
    mockFetch((url) => {
      assert.ok(url.includes("/members/stats"), "members path");
      return jsonResponse({ members: [{ name: "Ramsen7" }, { playername: "cpc_lm" }] });
    });
    const members = await provider.getClubMembers("42450");
    assert.deepEqual(members?.map((m) => m.name), ["Ramsen7", "cpc_lm"], "names");
  });

  await test("getClubMembers — échec → null (preview dégradé)", async () => {
    mockFetch(() => {
      throw new Error("hop down");
    });
    const members = await provider.getClubMembers("42450");
    assert.deepEqual(members, null, "null");
  });

  const stubs = [
    "getClub",
    "getClubStats",
    "getPlayerCareerStats",
    "getLeaderboard",
    "getPlayoffData",
  ] as const;

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
