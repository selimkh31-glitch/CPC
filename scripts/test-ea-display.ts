/**
 * Vues lecture fc27 (club / joueur / match). Aucun réseau live.
 * Lancer : npx tsx scripts/test-ea-display.ts
 */
import {
  buildEaProductDisplay,
  emptyEaProductDisplay,
} from "../supabase/functions/_shared/ea/display";
import { emptyProductClubHistory } from "../supabase/functions/_shared/ea/ingest";
import { PRODUCT_EA_TITLE } from "../supabase/functions/_shared/ea/title";
import type {
  EaImportedClubRow,
  EaImportedMatchRow,
  EaImportedMemberRow,
  ProductClubHistoryPayload,
} from "../supabase/functions/_shared/ea/ingest";

const assert = {
  deepEqual(actual: unknown, expected: unknown, label: string) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) throw new Error(`Assertion échouée (${label}).\n  reçu: ${a}\n  attendu: ${b}`);
  },
  ok(value: unknown, label: string) {
    if (!value) throw new Error(`Assertion échouée (${label}) : valeur falsy.`);
  },
  equal(actual: unknown, expected: unknown, label: string) {
    if (actual !== expected) {
      throw new Error(`Assertion échouée (${label}).\n  reçu: ${String(actual)}\n  attendu: ${String(expected)}`);
    }
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

function clubRow(title: string): EaImportedClubRow {
  return {
    ea_title: title,
    ea_club_id: "2582784",
    platform: "common-gen5",
    name: "United",
    crest_id: "19",
    wins: 10,
    losses: 2,
    draws: 1,
    titles_won: null,
    games_played: 13,
    source: "unofficial_api_fc",
    unverified: true,
    imported_at: "2026-09-25T00:00:00.000Z",
    updated_at: "2026-09-25T00:00:00.000Z",
  };
}

function memberRow(title: string, playername: string): EaImportedMemberRow {
  return {
    ea_title: title,
    ea_club_id: "2582784",
    platform: "common-gen5",
    playername,
    pro_position: "ST",
    pro_name: playername,
    games_played: 8,
    goals: 3,
    assists: 1,
    rating_ave: 7.2,
    career_games_played: 40,
    career_goals: 20,
    career_assists: 5,
    career_rating_ave: 7,
    career_pro_overall: 80,
    source: "unofficial_api_fc",
    unverified: true,
    imported_at: "2026-09-25T00:00:00.000Z",
    updated_at: "2026-09-25T00:00:00.000Z",
  };
}

function matchRow(title: string, matchId: string, players: EaImportedMatchRow["players"]): EaImportedMatchRow {
  return {
    ea_title: title,
    ea_club_id: "2582784",
    ea_match_id: matchId,
    platform: "common-gen5",
    match_type: "leagueMatch",
    played_at: "2026-09-26T18:00:00.000Z",
    players,
    source: "unofficial_api_fc",
    unverified: true,
    imported_at: "2026-09-25T00:00:00.000Z",
  };
}

function fc27History(): ProductClubHistoryPayload {
  return {
    eaTitle: PRODUCT_EA_TITLE,
    club: clubRow(PRODUCT_EA_TITLE),
    members: [memberRow(PRODUCT_EA_TITLE, "Selim"), memberRow(PRODUCT_EA_TITLE, "Alex")],
    matches: [
      matchRow(PRODUCT_EA_TITLE, "m1", {
        "persona-abc": { name: "Selim", goals: 2, assists: 1, cleanSheetsAny: 0, rating: 8.1 },
        "persona-xyz": { name: "Alex", goals: 0, assists: 1, cleanSheetsAny: 0, rating: 6.4 },
      }),
    ],
  };
}

async function run() {
  console.log("EA display — ledger produit fc27 (club / joueur / match)");

  await test("ledger fc27 vide -> vues vides honnêtes", () => {
    const view = buildEaProductDisplay(emptyProductClubHistory());
    assert.deepEqual(view, emptyEaProductDisplay(), "empty");
    assert.equal(view.eaTitle, "fc27", "title");
    assert.equal(view.club, null, "club");
    assert.deepEqual(view.members, [], "members");
    assert.deepEqual(view.matches, [], "matches");
    assert.equal(view.player, null, "player non demandé");
  });

  await test("joueur demandé sur ledger vide -> member null, matches []", () => {
    const view = buildEaProductDisplay(emptyProductClubHistory(), "Selim");
    assert.equal(view.club, null, "club");
    assert.deepEqual(view.player, { member: null, matches: [] }, "slice vide");
  });

  await test("history fc26 -> display produit vide (pas de mix)", () => {
    const history: ProductClubHistoryPayload = {
      eaTitle: "fc26",
      club: clubRow("fc26"),
      members: [memberRow("fc26", "Selim")],
      matches: [
        matchRow("fc26", "old", {
          p1: { name: "Selim", goals: 99, assists: 99, cleanSheetsAny: 0, rating: 9 },
        }),
      ],
    };
    const view = buildEaProductDisplay(history, "Selim");
    assert.equal(view.eaTitle, "fc27", "produit");
    assert.equal(view.club, null, "pas de club fc26");
    assert.deepEqual(view.members, [], "pas de membres fc26");
    assert.deepEqual(view.matches, [], "pas de matchs fc26");
    assert.deepEqual(view.player, { member: null, matches: [] }, "joueur fc26 masqué");
    assert.equal(JSON.stringify(view).includes("99"), false, "stats fc26 absentes");
  });

  await test("fc27 club + effectif + matchs", () => {
    const view = buildEaProductDisplay(fc27History());
    assert.equal(view.club?.eaClubId, "2582784", "clubId");
    assert.equal(view.club?.name, "United", "name");
    assert.equal(view.club?.wins, 10, "wins");
    assert.deepEqual(
      view.members.map((m) => m.playername),
      ["Selim", "Alex"],
      "effectif"
    );
    assert.equal(view.matches.length, 1, "1 match");
    assert.equal(view.player, null, "pas de slice");
  });

  await test("slice joueur par playername (pas la clé persona)", () => {
    const view = buildEaProductDisplay(fc27History(), "selim");
    assert.equal(view.player?.member?.playername, "Selim", "member");
    assert.equal(view.player?.member?.goals, 3, "goals saison");
    assert.equal(view.player?.matches.length, 1, "match du joueur");
    assert.deepEqual(
      view.player?.matches[0]?.players.map((p) => p.name),
      ["Selim", "Alex"],
      "feuille match par nom"
    );
  });

  await test("playername inconnu -> member null, matches []", () => {
    const view = buildEaProductDisplay(fc27History(), "Inconnu");
    assert.deepEqual(view.player, { member: null, matches: [] }, "inconnu");
  });

  await test("lignes match = { name, goals, assists, rating } sans clé persona", () => {
    const view = buildEaProductDisplay(fc27History());
    const players = view.matches[0]?.players ?? [];
    assert.deepEqual(
      players,
      [
        { name: "Selim", goals: 2, assists: 1, rating: 8.1 },
        { name: "Alex", goals: 0, assists: 1, rating: 6.4 },
      ],
      "vue joueurs"
    );
    const blob = JSON.stringify(players);
    assert.equal(blob.includes("persona-abc"), false, "pas persona-abc");
    assert.equal(blob.includes("persona-xyz"), false, "pas persona-xyz");
    assert.equal(blob.includes("cleanSheetsAny"), false, "pas cleanSheetsAny");
  });

  console.log(`\n${passed} test(s) passés.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
