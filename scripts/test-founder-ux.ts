/**
 * Founder UX pass — membership rejoin, roster, tabs, CTAs, honest face stats.
 * Lancer : npx tsx scripts/test-founder-ux.ts
 */
// @ts-expect-error Expo tsconfig has no @types/node; tsx provides `fs` at runtime.
import { readFileSync } from "fs";

const root = process.cwd();
const assert = {
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
function read(rel: string) {
  return readFileSync(`${root}/${rel}`, "utf8");
}

console.log("Founder UX — club LIVE / feuille / members");

test("rejoin : leave clears membership leftovers ; accept upserts same-club row", () => {
  const sql = read("supabase/migrations/0032_rejoin_membership.sql");
  const apply = read("supabase/functions/apply/index.ts");
  assert.true(sql.includes("status = 'WITHDRAWN'"), "withdraw pending apps");
  assert.true(sql.includes("status = 'CANCELLED'"), "cancel pending invites");
  assert.true(sql.includes("on conflict (club_id, user_id) do update"), "upsert membership");
  assert.true(sql.includes("delete from public.slot_assignments"), "drop stale XI");
  assert.true(apply.includes("alreadyPending: true"), "idempotent pending apply");
  assert.true(apply.includes('in("role", ["MEMBER", "MANAGER"])'), "other-club MEMBER/MANAGER blocked");
  assert.false(apply.includes("do nothing"), "apply does not mention do nothing");
});

test("effectif visible : Membres list on feuille, preview, Accueil club", () => {
  const home = read("components/club/ClubHome.tsx");
  const feuille = read("components/club/ClubLiveFeuille.tsx");
  const preview = read("app/club/[id].tsx");
  const roster = read("components/club/ClubRosterList.tsx");
  assert.true(roster.includes("club_members"), "roster from members");
  assert.true(roster.includes("Membres"), "section title");
  assert.true(home.includes("ClubRosterList"), "player feuille roster");
  assert.true(feuille.includes("ClubRosterList"), "manager feuille roster");
  assert.true(feuille.includes("ClubCard"), "feuille club header");
  assert.true(preview.includes("ClubRosterList"), "LIVE preview roster");
  assert.true(preview.includes("FormationPitch"), "preview pitch");
  assert.true(preview.includes("interactive={false}"), "preview read-only pitch");
});

test("tabs Match ≠ Matchmaking ; pas de Lancer/Finir sur la feuille", () => {
  const clubTabs = read("app/(club)/(tabs)/_layout.tsx");
  const index = read("app/(club)/(tabs)/index.tsx");
  const match = read("app/(club)/(tabs)/match.tsx");
  const feuille = read("components/club/ClubLiveFeuille.tsx");
  const nav = read("components/nav/BottomNavigation.tsx");
  assert.true(index.includes("ClubLiveRecruit"), "matchmaking = recruit");
  assert.true(match.includes("ClubLiveFeuille"), "match = feuille");
  assert.false(index.includes("ClubLiveFeuille"), "not the same screen");
  assert.true(clubTabs.includes('title: "Match"'), "Match tab visible");
  assert.false(feuille.includes("MatchCheckinPanel"), "no check-in CTAs");
  assert.false(feuille.includes("Lancer le match"), "no lancer");
  assert.false(feuille.includes("Finir le match"), "no finir");
  assert.true(nav.includes('options.href === null'), "custom tab bar hides href null");
});

test("LIVE card ouvre un aperçu avant Rejoindre PENDING", () => {
  const card = read("components/live/LiveClubCard.tsx");
  const apply = read("components/club/ApplyForm.tsx");
  assert.true(card.includes("clubPublicHref"), "preview href");
  assert.true(card.includes("Aperçu"), "preview copy");
  assert.true(card.includes(">Voir<") || card.includes("Voir"), "Voir CTA");
  assert.true(apply.includes("Rejoindre"), "join on preview is Rejoindre");
  assert.false(card.includes("join-live-club"), "no auto-join edge");
});

test("owner peut supprimer ; membre quitte ; CTA primary blanc", () => {
  const del = read("components/club/DeleteClubButton.tsx");
  const home = read("components/club/ClubHome.tsx");
  const effectif = read("app/(club)/(tabs)/effectif.tsx");
  const depart = read("components/club/MyDepartureStatusCard.tsx");
  const button = read("components/ui/Button.tsx");
  const input = read("components/ui/Input.tsx");
  const chat = read("components/ui/ChatMessage.tsx");
  assert.true(del.includes("Supprimer le club"), "delete cta");
  assert.true(del.includes('style: "destructive"'), "confirm destructive");
  assert.true(home.includes("DeleteClubButton"), "owner on feuille");
  assert.true(effectif.includes("DeleteClubButton"), "owner on club tab");
  assert.true(depart.includes("Quitter le club"), "member leave stays");
  assert.true(button.includes('primary: "bg-white'), "white primary fill");
  assert.true(input.includes("color: cpcHex.textPrimary"), "input not black");
  assert.true(chat.includes("color: cpcHex.textPrimary"), "chat not black");
});

test("face stats restent honnêtes (DEV caption, jamais EA inventé)", () => {
  const face = read("lib/cardFace.ts");
  const card = read("components/player/PlayerCard.tsx");
  assert.true(face.includes("DEV — pas des stats EA"), "DEV caption");
  assert.true(card.includes("faceStatsCaption"), "caption on FULL card");
  assert.true(face.includes('identityKind === "USERNAME_EQUALITY"'), "EA pack gated");
});

test("slot vide : picker membres du club, pas auto-XI ; invite LIVE reste", () => {
  const feuille = read("components/club/ClubLiveFeuille.tsx");
  const sheet = read("components/club/AssignSlotMemberSheet.tsx");
  const session = read("lib/sessionState.ts");
  const hooks = read("lib/hooks/useClubs.ts");
  const search = read("app/player-search.tsx");
  assert.true(feuille.includes("AssignSlotMemberSheet"), "sheet on feuille");
  assert.true(feuille.includes('emptySlotHint="Placer un membre"'), "hint place");
  assert.false(feuille.includes("player-search?clubId"), "plus d'invite-only au tap +");
  assert.true(sheet.includes("membersAvailableForSlot"), "bench picker");
  assert.true(sheet.includes("Placer"), "assign CTA");
  assert.true(sheet.includes("Inviter un joueur"), "LIVE invite stays");
  assert.true(sheet.includes("player-search"), "invite route");
  assert.true(session.includes("membersAvailableForSlot"), "helper");
  assert.true(hooks.includes("useAssignClubMemberSlot"), "insert slot");
  assert.true(hooks.includes("n'est pas membre de ce club"), "member guard");
  assert.true(search.includes("excludeUserIds"), "search still skips members");
  assert.true(search.includes("useInvitePlayer"), "search still invites");
});

test("postes profil : 2e tap retire ; toast seulement à l'ajout d'un 4e", () => {
  const ident = read("lib/profileIdentity.ts");
  const overview = read("components/profile/ProfileOverview.tsx");
  const chips = read("components/ui/ChipSelect.tsx");
  assert.true(ident.includes("deselectPosition"), "toggle off helper");
  assert.true(ident.includes("jamais au retrait"), "max not on remove");
  assert.true(overview.includes('if (next.reason === "max")'), "toast only max");
  assert.true(chips.includes("onMax"), "chips toast on add-over-max");
  assert.true(chips.includes("value.includes(v)"), "chips can deselect");
});

test("onboarding cold start : validation + signup copy + mode door reset DEV", () => {
  const onboarding = read("app/onboarding.tsx");
  const login = read("app/(auth)/login.tsx");
  const door = read("app/mode-door.tsx");
  const profile = read("app/(player)/(tabs)/profile.tsx");
  const clubTab = read("app/(club)/(tabs)/effectif.tsx");
  const reset = read("components/profile/DevClearModeButton.tsx");
  const home = read("components/home/HomeScreen.tsx");
  assert.true(onboarding.includes("validateProfileIdentity"), "onboarding validates");
  assert.true(onboarding.includes("2 postes secondaires max."), "onboarding max toast");
  assert.true(login.includes("Compte créé"), "signup not silent");
  assert.true(login.includes("Première fois"), "signup hint");
  assert.true(door.includes("MODE_DOOR_COPY"), "mode door stays");
  assert.true(reset.includes("clearMode"), "DEV reset calls clearMode");
  assert.true(reset.includes("__DEV__"), "DEV reset gated");
  assert.true(profile.includes("DevClearModeButton"), "DEV revoir porte profil");
  assert.true(clubTab.includes("DevClearModeButton"), "DEV revoir porte club");
  assert.true(home.includes("Sans club."), "player empty stays");
  assert.true(home.includes("Trouve un club LIVE"), "empty points to MM");
});

test("email confirm : session reprise sans reload Metro", () => {
  const cb = read("app/auth/callback.tsx");
  const auth = read("lib/providers/AuthProvider.tsx");
  const login = read("app/(auth)/login.tsx");
  assert.true(cb.includes("Email confirmé"), "leave spinner");
  assert.true(cb.includes("Continuer"), "cta");
  assert.true(auth.includes("consumeAuthCallbackUrl"), "deep link consume");
  assert.true(auth.includes("AppState"), "resume");
  assert.true(login.includes("Email confirmé, continuer"), "login cta");
});

console.log(`\n${passed} tests founder UX OK`);
