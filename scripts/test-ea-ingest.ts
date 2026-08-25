/**
 * Ingest unofficial /api/fc → tables CPC. Aucun réseau live.
 * Lancer : npx tsx scripts/test-ea-ingest.ts
 */
import {
  buildIngestPlan,
  emptyProductClubHistory,
  loadProductClubHistory,
  persistIngestPlan,
  type IngestPlan,
} from "../supabase/functions/_shared/ea/ingest";
import { PRODUCT_EA_TITLE } from "../supabase/functions/_shared/ea/title";
import { normalizeMatch } from "../supabase/functions/_shared/ea/normalize";
import type { EAClub, EAClubStats, EAMatch, EAPlayer, EAPlayerCareerStats } from "../supabase/functions/_shared/ea/types";

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

const provenance = {
  provider: "proclubs-community" as const,
  externalPlatform: "common-gen5",
  syncedAt: "2026-08-25T00:00:00.000Z",
};

function club(name: string, id: string): EAClub {
  return { ...provenance, externalId: id, name, crestId: "19" };
}

function stats(id: string): EAClubStats {
  return { ...provenance, externalId: id, wins: 10, losses: 2, draws: 1, titlesWon: null, gamesPlayed: 13 };
}

function member(name: string): EAPlayer {
  return {
    ...provenance,
    externalId: "c1",
    name,
    proPosition: "ST",
    gamesPlayed: 8,
    goals: 3,
    assists: 1,
    ratingAve: 7.2,
    proName: name,
  };
}

function career(name: string): EAPlayerCareerStats {
  return {
    ...provenance,
    externalId: name,
    proName: name,
    proOverall: 80,
    gamesPlayed: 40,
    goals: 20,
    assists: 5,
    ratingAve: 7,
    proPosition: "ST",
  };
}

function match(matchId: string, playerName: string): EAMatch {
  return normalizeMatch(
    { matchId, matchType: "leagueMatch", timestamp: "1700000000", players: { c1: { p1: { playername: playerName, goals: 1 } } } },
    "c1",
    "proclubs-community",
    "common-gen5"
  )!;
}

function memoryAdmin(existingMatchIds: string[] = []) {
  const clubs: unknown[] = [];
  const members: unknown[] = [];
  const matches: unknown[] = existingMatchIds.map((id) => ({ ea_match_id: id }));
  return {
    clubs,
    members,
    matches,
    from(table: string) {
      if (table === "ea_imported_matches") {
        return {
          select: () => ({
            eq: async () => ({ data: matches.map((m) => ({ ea_match_id: (m as { ea_match_id: string }).ea_match_id })) }),
          }),
          upsert: async (rows: unknown) => {
            const list = Array.isArray(rows) ? rows : [rows];
            matches.push(...list);
            return {};
          },
        };
      }
      if (table === "ea_imported_clubs") {
        return {
          select: () => ({ eq: async () => ({ data: clubs }) }),
          upsert: async (row: unknown) => {
            clubs.push(row);
            return {};
          },
        };
      }
      return {
        select: () => ({ eq: async () => ({ data: members }) }),
        upsert: async (row: unknown) => {
          members.push(row);
          return {};
        },
      };
    },
  };
}

async function run() {
  console.log("EA ingest — unofficial /api/fc → CPC DB");

  await test("listes EA vides -> aucune ligne inventée", () => {
    const plan = buildIngestPlan({
      clubId: "c1",
      platform: "common-gen5",
      eaTitle: "fc26",
      nowIso: provenance.syncedAt,
      club: null,
      clubStats: null,
      members: [],
      career: [],
      matches: [],
      existingMatchIds: [],
    });
    assert.deepEqual(plan.clubRow, null, "pas de club");
    assert.deepEqual(plan.memberRows, [], "pas de membres");
    assert.deepEqual(plan.newMatches, [], "pas de matchs");
  });

  await test("null (EA down) -> pas de fake snapshot", () => {
    const plan = buildIngestPlan({
      clubId: "c1",
      platform: "common-gen5",
      eaTitle: "fc26",
      club: null,
      clubStats: null,
      members: null,
      career: null,
      matches: null,
      existingMatchIds: [],
    });
    assert.deepEqual(plan.clubRow, null, "null club");
    assert.deepEqual(plan.memberRows.length, 0, "null members");
  });

  await test("snapshot club + membres (stats + carrière) + matchs nouveaux", () => {
    const plan = buildIngestPlan({
      clubId: "c1",
      platform: "common-gen5",
      eaTitle: "fc26",
      nowIso: provenance.syncedAt,
      club: club("United", "c1"),
      clubStats: stats("c1"),
      members: [member("Selim")],
      career: [career("Selim"), career("Alex")],
      matches: [match("m1", "Selim"), match("m2", "Selim")],
      existingMatchIds: ["m1"],
    });
    assert.ok(plan.clubRow, "club");
    assert.deepEqual(plan.clubRow?.name, "United", "name");
    assert.deepEqual(plan.clubRow?.wins, 10, "wins");
    assert.deepEqual(plan.clubRow?.unverified, true, "unverified");
    assert.deepEqual(plan.clubRow?.source, "unofficial_api_fc", "source");
    assert.deepEqual(plan.clubRow?.ea_title, "fc26", "live title");
    assert.deepEqual(plan.eaTitle, "fc26", "plan title");
    assert.deepEqual(
      plan.memberRows.map((m) => m.playername),
      ["Selim", "Alex"],
      "membres + carrière seule"
    );
    assert.deepEqual(plan.memberRows[0]?.career_games_played, 40, "carrière fusionnée");
    assert.deepEqual(
      plan.newMatches.map((m) => m.ea_match_id),
      ["m2"],
      "m1 déjà en table"
    );
    assert.deepEqual(plan.skippedMatchCount, 1, "skip");
    assert.deepEqual(plan.newMatches[0]?.players.p1.name, "Selim", "ligne joueur");
  });

  await test("match sans id ignoré (pas de fake id)", () => {
    const noId = normalizeMatch({ matchType: "friendlyMatch", players: {} }, "c1", "proclubs-community", null)!;
    const plan = buildIngestPlan({
      clubId: "c1",
      platform: "common-gen5",
      eaTitle: "fc26",
      club: club("United", "c1"),
      clubStats: null,
      members: null,
      career: null,
      matches: [noId],
      existingMatchIds: [],
    });
    assert.deepEqual(plan.newMatches, [], "sans id");
  });

  await test("persistIngestPlan écrit club + membres + matchs (admin mémoire)", async () => {
    const admin = memoryAdmin(["m1"]);
    const plan: IngestPlan = buildIngestPlan({
      clubId: "c1",
      platform: "common-gen5",
      eaTitle: "fc26",
      nowIso: provenance.syncedAt,
      club: club("United", "c1"),
      clubStats: stats("c1"),
      members: [member("Selim")],
      career: [career("Selim")],
      matches: [match("m1", "Selim"), match("m3", "Selim")],
      existingMatchIds: ["m1"],
    });
    await persistIngestPlan(admin, plan);
    assert.deepEqual(admin.clubs.length, 1, "1 club");
    assert.deepEqual(admin.members.length, 1, "1 membre");
    assert.deepEqual(
      plan.newMatches.map((m) => m.ea_match_id),
      ["m3"],
      "seulement m3"
    );
    const storedNew = admin.matches.filter((m) => (m as { ea_match_id?: string }).ea_match_id === "m3");
    assert.deepEqual(storedNew.length, 1, "insert m3");
  });

  await test("fc26 ingest n'écrit pas le ledger fc27", () => {
    const plan = buildIngestPlan({
      clubId: "c1",
      platform: "common-gen5",
      eaTitle: "fc26",
      nowIso: provenance.syncedAt,
      club: club("United", "c1"),
      clubStats: stats("c1"),
      members: [member("Selim")],
      career: null,
      matches: [match("m1", "Selim")],
      existingMatchIds: [],
    });
    assert.deepEqual(plan.clubRow?.ea_title, "fc26", "club fc26");
    assert.deepEqual(plan.memberRows.every((m) => m.ea_title === "fc26"), true, "membres fc26");
    assert.deepEqual(plan.newMatches.every((m) => m.ea_title === "fc26"), true, "matchs fc26");
    assert.deepEqual(plan.clubRow?.ea_title === PRODUCT_EA_TITLE, false, "pas fc27");
  });

  await test("ledger produit fc27 vide tant qu'il n'y a que du fc26", async () => {
    const admin = memoryAdmin();
    const plan = buildIngestPlan({
      clubId: "c1",
      platform: "common-gen5",
      eaTitle: "fc26",
      nowIso: provenance.syncedAt,
      club: club("United", "c1"),
      clubStats: stats("c1"),
      members: [member("Selim")],
      career: null,
      matches: [match("m1", "Selim")],
      existingMatchIds: [],
    });
    await persistIngestPlan(admin, plan);
    const product = await loadProductClubHistory(admin, "c1", "common-gen5");
    assert.deepEqual(product, emptyProductClubHistory(), "fc27 vide");
    assert.deepEqual(product.members, [], "pas de membres fc27");
    assert.deepEqual(product.matches, [], "pas de matchs fc27");
  });

  await test("ids fc26 ne skip pas l'ingest fc27 (ledgers séparés)", () => {
    const plan = buildIngestPlan({
      clubId: "c1",
      platform: "common-gen5",
      eaTitle: "fc27",
      nowIso: provenance.syncedAt,
      club: club("United", "c1"),
      clubStats: null,
      members: [],
      career: [],
      matches: [match("m1", "Selim")],
      existingMatchIds: [],
    });
    assert.deepEqual(plan.newMatches.map((m) => m.ea_match_id), ["m1"], "m1 nouveau pour fc27");
    assert.deepEqual(plan.clubRow?.ea_title, "fc27", "club fc27");
  });

  console.log(`\n${passed} test(s) passés.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
