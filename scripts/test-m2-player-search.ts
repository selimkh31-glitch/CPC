/**
 * M2 — tests de la logique pure de filtrage (lib/playerSearchFilters.ts).
 * Aucune dépendance Supabase/React Native, aucune donnée persistée : exécuté
 * avec `tsx` (déjà en devDependency) sur des données en mémoire uniquement.
 *
 * Lancer : npx tsx scripts/test-m2-player-search.ts
 */
import { excludeFullyEngagedElsewhere } from "../lib/playerSearchFilters";

type Candidate = { id: string; username: string };

function candidate(id: string): Candidate {
  return { id, username: `player-${id}` };
}

// Mini-assertion sans dépendance (évite d'ajouter @types/node juste pour ce
// script tsx autonome, non inclus dans le bundle app).
const assert = {
  deepEqual(actual: unknown, expected: unknown) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) throw new Error(`Assertion échouée.\n  reçu: ${a}\n  attendu: ${b}`);
  },
};

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok — ${name}`);
}

console.log("M2 — excludeFullyEngagedElsewhere");

// 1. Joueur sans membership actif -> visible.
test("candidat sans aucun membership actif reste visible", () => {
  const candidates = [candidate("u1")];
  const result = excludeFullyEngagedElsewhere(candidates, []);
  assert.deepEqual(result, candidates);
});

// 2. Joueur MEMBER d'un autre club, sans départ en cours -> invisible.
test("candidat MEMBER ailleurs sans départ en cours est exclu", () => {
  const candidates = [candidate("u1"), candidate("u2")];
  const result = excludeFullyEngagedElsewhere(candidates, [{ user_id: "u1", active_departure_request_id: null }]);
  assert.deepEqual(
    result.map((c) => c.id),
    ["u2"]
  );
});

// 3. Joueur MANAGER d'un autre club, sans départ en cours -> invisible
//    (même mécanisme que MEMBER : la requête club_members ne distingue pas
//    MEMBER/MANAGER dans le calcul d'exclusion, les deux rôles sont scannés
//    ensemble par usePlayerSearch.ts, `.in("role", ["MEMBER","MANAGER"])`).
test("candidat MANAGER ailleurs sans départ en cours est exclu", () => {
  const candidates = [candidate("u1")];
  const result = excludeFullyEngagedElsewhere(candidates, [{ user_id: "u1", active_departure_request_id: null }]);
  assert.deepEqual(result, []);
});

// 4. Joueur OWNER uniquement -> visible (OWNER n'entre jamais dans
//    activeMemberships puisque usePlayerSearch.ts filtre role IN (MEMBER,MANAGER)
//    côté requête : simulé ici par activeMemberships vide pour ce candidat).
test("candidat OWNER uniquement (absent de activeMemberships) reste visible", () => {
  const candidates = [candidate("owner-1")];
  const result = excludeFullyEngagedElsewhere(candidates, []);
  assert.deepEqual(result, candidates);
});

// 6. Plusieurs candidats -> l'ordre des candidats restants est préservé.
test("l'ordre des candidats restants est préservé", () => {
  const candidates = [candidate("a"), candidate("b"), candidate("c"), candidate("d")];
  const result = excludeFullyEngagedElsewhere(candidates, [
    { user_id: "b", active_departure_request_id: null },
  ]);
  assert.deepEqual(
    result.map((c) => c.id),
    ["a", "c", "d"]
  );
});

// 7. Le filtrage n'altère pas les champs des candidats survivants.
test("les champs des candidats survivants sont inchangés", () => {
  const candidates = [{ id: "u1", username: "kylian", main_position: "ST", secondary_positions: ["LW"] }];
  const result = excludeFullyEngagedElsewhere(candidates, []);
  assert.deepEqual(result[0], candidates[0]);
});

// Cas 6 — transition ACCEPTED_NEXT_MATCH (ou PENDING, statut non lisible ici
// par design RLS) : un active_departure_request_id non nul ne doit JAMAIS
// exclure le candidat, quel que soit son contenu.
test("candidat avec un départ en cours (active_departure_request_id non nul) reste visible", () => {
  const candidates = [candidate("transition-1")];
  const result = excludeFullyEngagedElsewhere(candidates, [
    { user_id: "transition-1", active_departure_request_id: "dep-123" },
  ]);
  assert.deepEqual(result, candidates);
});

// Un joueur libéré (plus de ligne club_members active) redevient visible :
// simulé ici par activeMemberships qui ne le contient simplement plus.
test("un joueur sans plus aucun membership actif redevient visible", () => {
  const candidates = [candidate("freed-1")];
  const result = excludeFullyEngagedElsewhere(candidates, []);
  assert.deepEqual(result, candidates);
});

console.log(`\n${passed} test(s) passés.`);
