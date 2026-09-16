/**
 * Mode Joueur / Manager — porte, persistance, bascule uniquement Profil / Club.
 * Sans réseau / sans Expo. Lancer : npx tsx scripts/test-app-mode.ts
 */
// @ts-expect-error Expo tsconfig has no @types/node; tsx provides `fs` at runtime.
import { existsSync, readFileSync } from "fs";
import {
  MODE_DOOR_COPY,
  appModeStorageKey,
  effectiveAppMode,
  parseStoredAppMode,
  shouldShowModeDoor,
} from "../lib/appMode";
import { splitMemberships } from "../lib/monClubNav";

const root = process.cwd();

const assert = {
  equal(actual: unknown, expected: unknown, label: string) {
    if (actual !== expected) {
      throw new Error(`Assertion échouée (${label}).\n  reçu: ${JSON.stringify(actual)}\n  attendu: ${JSON.stringify(expected)}`);
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

function read(rel: string) {
  return readFileSync(`${root}/${rel}`, "utf8");
}

console.log("Mode Joueur / Manager — porte + identité");

test("parseStoredAppMode — PLAYER / CLUB / invalid", () => {
  assert.equal(parseStoredAppMode("PLAYER"), "PLAYER", "player");
  assert.equal(parseStoredAppMode("CLUB"), "CLUB", "club");
  assert.equal(parseStoredAppMode(null), null, "null");
  assert.equal(parseStoredAppMode(""), null, "empty");
  assert.equal(parseStoredAppMode("MANAGER"), null, "manager label is not storage");
});

test("clé SecureStore par user", () => {
  assert.equal(appModeStorageKey("u1"), "cpc.appMode.u1", "key");
});

test("porte seulement si hydraté et aucun mode", () => {
  assert.true(shouldShowModeDoor({ hydrated: true, mode: null }), "first open");
  assert.false(shouldShowModeDoor({ hydrated: false, mode: null }), "wait storage");
  assert.false(shouldShowModeDoor({ hydrated: true, mode: "PLAYER" }), "stored player");
  assert.false(shouldShowModeDoor({ hydrated: true, mode: "CLUB" }), "stored manager");
});

test("effectiveAppMode — null → joueur", () => {
  assert.equal(effectiveAppMode(null), "PLAYER", "null");
  assert.equal(effectiveAppMode(undefined), "PLAYER", "undefined");
  assert.equal(effectiveAppMode("CLUB"), "CLUB", "club");
});

test("copy porte — tu, joueur = je joue, manager = je gère, pas UI 1/2", () => {
  assert.equal(MODE_DOOR_COPY.title, "Tu joues ou tu gères ?", "title");
  assert.equal(MODE_DOOR_COPY.player, "JOUEUR", "player");
  assert.equal(MODE_DOOR_COPY.playerHint, "Je joue.", "player hint");
  assert.equal(MODE_DOOR_COPY.manager, "MANAGER", "manager");
  assert.equal(MODE_DOOR_COPY.managerHint, "Je gère le club.", "manager hint");
  assert.equal(MODE_DOOR_COPY.toManager, "Passer en manager", "to manager");
  assert.equal(MODE_DOOR_COPY.toPlayer, "Passer en joueur", "to player");
  const blob = Object.values(MODE_DOOR_COPY).join(" ");
  assert.false(/UI\s*[12]/i.test(blob), "no UI 1 / UI 2");
});

test("écran porte existe, un tap, pas de lien EA ni carousel", () => {
  assert.true(existsSync(`${root}/app/mode-door.tsx`), "mode-door.tsx");
  const door = read("app/mode-door.tsx");
  assert.true(door.includes("MODE_DOOR_COPY.player"), "joueur door");
  assert.true(door.includes("MODE_DOOR_COPY.manager"), "manager door");
  assert.true(door.includes('choose("PLAYER")'), "tap joueur");
  assert.true(door.includes('choose("CLUB")'), "tap manager");
  assert.false(door.includes("ea_"), "no EA gate");
  assert.false(/carousel|tutoriel/i.test(door), "no carousel");
});

test("root : porte si mode null, arbres joueur/club, stack partagé exige un mode", () => {
  const layout = read("app/_layout.tsx");
  assert.true(layout.includes('name="mode-door"'), "door screen");
  assert.true(layout.includes("hydrated && mode === null"), "door guard");
  assert.true(layout.includes('mode === "PLAYER"'), "player tree");
  assert.true(layout.includes('mode === "CLUB"'), "club tree");
  assert.true(
    layout.includes("Boolean(session) && Boolean(profile) && Boolean(mode)"),
    "shared stack waits for mode"
  );
});

test("persistance SecureStore dans AppModeProvider, pas de reset PLAYER au login", () => {
  const provider = read("lib/providers/AppModeProvider.tsx");
  assert.true(provider.includes("SecureStore"), "secure store");
  assert.true(provider.includes("appModeStorageKey"), "per-user key");
  assert.true(provider.includes("parseStoredAppMode"), "parse stored");
  assert.false(/setModeState\("PLAYER"\)/.test(provider), "no force PLAYER");
});

test("club layout : sans club on garde les tabs, pas de rebond Joueur", () => {
  const clubLayout = read("app/(club)/_layout.tsx");
  assert.true(clubLayout.includes("managedClubs.length === 0"), "zero clubs branch");
  assert.true(clubLayout.includes("return <Slot />"), "tabs still mount");
  assert.true(clubLayout.includes("setSelectedManagedClubId(null)"), "clear stale id");
  assert.false(clubLayout.includes("setMode"), "no mode bounce");
});

test("LIVE / Recrutement / Match / /clubs / tab bars : pas de bascule", () => {
  const chrome = [
    "app/(club)/(tabs)/index.tsx",
    "app/(club)/(tabs)/candidatures.tsx",
    "app/(club)/(tabs)/match.tsx",
    "components/club/ClubLiveFeuille.tsx",
    "app/(player)/(tabs)/index.tsx",
    "app/(player)/(tabs)/activity.tsx",
    "app/(player)/(tabs)/clubs.tsx",
    "app/(player)/(tabs)/_layout.tsx",
    "app/(club)/(tabs)/_layout.tsx",
  ];
  for (const rel of chrome) {
    const src = read(rel);
    assert.false(src.includes("ModeLifeToggle"), `${rel} no ModeLifeToggle`);
    assert.false(src.includes("ModeSwitch"), `${rel} no ModeSwitch`);
    assert.false(src.includes("Passer en manager"), `${rel} no toManager`);
    assert.false(src.includes("Passer en joueur"), `${rel} no toPlayer`);
    assert.false(src.includes("Retour mode Joueur"), `${rel} no bounce copy`);
  }
});

test("bascule ModeLifeToggle seulement Profil et page identité Club", () => {
  const profile = read("app/(player)/(tabs)/profile.tsx");
  const clubTab = read("app/(club)/(tabs)/effectif.tsx");
  assert.true(profile.includes('ModeLifeToggle target="CLUB"'), "profil → manager");
  assert.true(profile.includes("MODE_DOOR_COPY") || profile.includes("ModeLifeToggle"), "toggle wired");
  assert.true(clubTab.includes('ModeLifeToggle target="PLAYER"'), "club → joueur");
  assert.false(profile.includes('target="PLAYER"'), "profil does not switch to self");
  assert.false(clubTab.includes('target="CLUB"'), "club tab does not switch to self");
});

test("splitMemberships — manager d'abord, sinon membre, jamais un club inventé", () => {
  const clubA = { id: "a", name: "Alpha" } as never;
  const clubB = { id: "b", name: "Beta" } as never;
  const none = splitMemberships([]);
  assert.equal(none.anyClub, null, "empty");
  const memberOnly = splitMemberships([{ role: "MEMBER", club: clubA }]);
  assert.equal(memberOnly.anyClub?.club.id, "a", "member club");
  assert.equal(memberOnly.managed.length, 0, "not managed");
  const owner = splitMemberships([
    { role: "MEMBER", club: clubA },
    { role: "OWNER", club: clubB },
  ]);
  assert.equal(owner.managed.length, 1, "one managed");
  assert.equal(owner.anyClub?.club.id, "b", "owner wins");
});

test("pas de 3e arbre ; Accueil | Matchmaking | Activité / Recrutement", () => {
  const playerTabs = read("app/(player)/(tabs)/_layout.tsx");
  const clubTabs = read("app/(club)/(tabs)/_layout.tsx");
  assert.true(playerTabs.includes('title: "Accueil"'), "player Accueil");
  assert.true(playerTabs.includes('title: "Matchmaking"'), "player Matchmaking");
  assert.true(playerTabs.includes('title: "Activité"'), "player activité");
  assert.false(playerTabs.includes('title: "LIVE"'), "player tab not LIVE");
  assert.true(playerTabs.includes('href: null, title: "Profil"'), "player profil hidden");
  assert.true(playerTabs.includes('name="home"'), "player home file");
  assert.true(playerTabs.includes('name="index"'), "player index stays Matchmaking");
  assert.true(clubTabs.includes('title: "Accueil"'), "club Accueil");
  assert.true(clubTabs.includes('title: "Matchmaking"'), "club Matchmaking");
  assert.true(clubTabs.includes('title: "Recrutement"'), "club recrutement");
  assert.false(clubTabs.includes('title: "LIVE"'), "club tab not LIVE");
  assert.true(clubTabs.includes('href: null, title: "Club"'), "club identity hidden");
  assert.true(clubTabs.includes('name="home"'), "club home file");
  assert.true(clubTabs.includes('name="index"'), "club index stays feuille");
  assert.true(playerTabs.includes('initialRouteName: "home"'), "player lands Accueil");
  assert.true(clubTabs.includes('initialRouteName: "home"'), "club lands Accueil");
  assert.false(existsSync(`${root}/app/(manager)`), "no third tree");
});

test("menu avatar + hamburger : liste unique, pas de Ligues/Tournois/Groupes", () => {
  const header = read("components/nav/AppMenuHeader.tsx");
  const sheet = read("components/nav/AppMenuSheet.tsx");
  const settings = read("app/settings.tsx");
  const root = read("app/_layout.tsx");
  assert.true(header.includes("Avatar"), "avatar");
  assert.true(header.includes("Menu"), "hamburger");
  const menuIdx = header.indexOf("<Menu");
  const avatarIdx = header.indexOf("<Avatar");
  assert.true(menuIdx >= 0 && avatarIdx > menuIdx, "hamburger left of avatar");
  assert.true(header.includes('size="sm"'), "avatar sm");
  assert.true(header.includes('"/profile"'), "avatar opens /profile");
  assert.true(header.includes("justify-between"), "full-width row");
  assert.true((header.match(/<Pressable/g) ?? []).length >= 2, "two pressables");
  assert.true(header.includes("AppMenuSheet"), "one menu");
  assert.true(sheet.includes('label="Profil"'), "profil");
  assert.true(sheet.includes('label="Réglages"'), "réglages");
  assert.true(sheet.includes('label="Chat"'), "chat");
  assert.true(sheet.includes('label="Mon club"'), "one Mon club");
  assert.equal((sheet.match(/label="Mon club"/g) ?? []).length, 1, "one Mon club");
  assert.false(sheet.includes("Mon club (joueur)"), "no club joueur row");
  assert.false(sheet.includes("Mon club (manager)"), "no club manager row");
  const toggle = read("components/nav/ModeSegmentToggle.tsx");
  assert.true(sheet.includes("ModeSegmentToggle"), "sheet reuses toggle");
  assert.true(toggle.includes('"Joueur"'), "toggle Joueur");
  assert.true(toggle.includes('"Club"'), "toggle Club");
  assert.true(toggle.includes("setMode"), "toggle reuses AppModeProvider");
  const monClub = read("lib/hooks/useOpenMonClub.ts");
  const monClubNav = read("lib/monClubNav.ts");
  assert.true(monClubNav.includes("OWNER") && monClubNav.includes("MANAGER"), "Mon club by role");
  assert.true(monClub.includes("playerInvitationAcceptHref"), "member → ClubHome");
  assert.true(sheet.includes("useOpenMonClub"), "sheet uses shared Mon club");
  assert.true(sheet.includes('go("/pricing")'), "pro");
  assert.true(sheet.includes('plan !== "PRO"'), "hide if PRO");
  assert.true(sheet.includes("setMode"), "reuses AppModeProvider");
  assert.false(/label="Ligues"/.test(sheet), "no ligues");
  assert.false(/label="Tournois"/.test(sheet), "no tournois");
  assert.false(/label="Groupes"/.test(sheet), "no groupes");
  assert.true(settings.includes("Modifier le profil"), "settings edit");
  assert.true(settings.includes("Joueurs bloqués"), "settings blocked");
  assert.true(settings.includes("Déconnexion"), "settings signOut");
  assert.true(settings.includes("signOut()"), "uses auth signOut");
  assert.false(settings.includes("Ligues"), "settings no extra");
  assert.true(root.includes('name="settings"'), "settings on stack");
  assert.true(root.includes("AppMenuHeader"), "global chrome in RootNavigator");
  assert.true(root.includes("session && profile && mode"), "chrome only when session+profile+mode");
  assert.false(root.includes("vars("), "no NativeWind vars on Stack");
  assert.false(root.includes("nativewind"), "root does not import nativewind");
  const theme = read("lib/theme.ts");
  const tw = read("tailwind.config.js");
  const hex = read("lib/design/cpc-hex.cjs");
  assert.true(theme.includes('PLAYER: "#4DA3FF"'), "joueur blue");
  assert.true(theme.includes("CLUB: cpcHex.accent"), "club accent token");
  assert.true(theme.includes("export function useModeAccent"), "useModeAccent");
  assert.false(theme.includes("vars("), "theme no vars()");
  assert.false(theme.includes("nativewind"), "theme no nativewind");
  assert.true(hex.includes('accent: "#54e182"'), "CPC accent hex");
  assert.true(tw.includes("cpcHex.accent"), "tailwind accent from CPC hex");
  assert.false(tw.includes("--cpc-accent"), "tailwind no css var accent");
  assert.false(tw.includes("<alpha-value>"), "tailwind no rgb var accent");
  const playerTabs = read("app/(player)/(tabs)/_layout.tsx");
  const clubTabsLayout = read("app/(club)/(tabs)/_layout.tsx");
  assert.true(playerTabs.includes("useModeAccent"), "player tab tint");
  assert.true(clubTabsLayout.includes("useModeAccent"), "club tab tint");
  const glow = read("components/ui/Glow.tsx");
  assert.true(glow.includes("useModeAccent"), "glow live follows mode");
  assert.true(glow.includes("win: cpcHex.success"), "glow win stays result green");
  assert.true(read("components/club/ClubDiscoveryToggle.tsx").includes("useModeAccent"), "switch track follows mode");
  assert.false(read("app/(auth)/login.tsx").includes("AppMenuHeader"), "no menu on login");
  assert.false(read("app/onboarding.tsx").includes("AppMenuHeader"), "no menu on onboarding");
  assert.false(read("app/mode-door.tsx").includes("AppMenuHeader"), "no menu on mode-door");
  const livePlayer = read("app/(player)/(tabs)/index.tsx");
  const activity = read("app/(player)/(tabs)/activity.tsx");
  const liveClub = read("components/club/ClubLiveFeuille.tsx");
  const rec = read("app/(club)/(tabs)/candidatures.tsx");
  const profile = read("app/(player)/(tabs)/profile.tsx");
  assert.false(livePlayer.includes("AppMenuHeader"), "player LIVE no per-screen menu");
  assert.false(activity.includes("AppMenuHeader"), "activité no per-screen menu");
  assert.false(liveClub.includes("AppMenuHeader"), "club LIVE no per-screen menu");
  assert.false(rec.includes("AppMenuHeader"), "recrutement no per-screen menu");
  assert.true(livePlayer.includes("edges={[]}"), "player LIVE no double inset");
  assert.true(activity.includes("edges={[]}"), "activité no double inset");
  assert.true(liveClub.includes("edges={[]}"), "club LIVE no double inset");
  assert.true(rec.includes("edges={[]}"), "recrutement no double inset");
  assert.true(profile.includes("edges={[]}"), "profile no double inset");
  assert.true(livePlayer.includes("ModeSegmentToggle"), "player Matchmaking has mode toggle");
  assert.true(liveClub.includes("ModeSegmentToggle"), "club Matchmaking has mode toggle");
  assert.false(livePlayer.includes("font-display text-3xl text-fg\">Profil"), "no second Profil title on LIVE");
});

test("tokens CPC copiés à l'identique", () => {
  const tokens = read("lib/design/cpc-tokens.ts");
  const spec = read("docs/ux-handoff/cpc-tokens.ts");
  assert.equal(tokens, spec, "identical copy");
});

test("Accueil partagé : ClubPro Card, Mon club, À traiter, CTA Matchmaking", () => {
  const home = read("components/home/HomeScreen.tsx");
  const playerHome = read("app/(player)/(tabs)/home.tsx");
  const clubHome = read("app/(club)/(tabs)/home.tsx");
  assert.true(playerHome.includes("HomeScreen"), "player home shared");
  assert.true(clubHome.includes("HomeScreen"), "club home shared");
  assert.false(playerHome.includes("ClubProCard"), "no duplicated card in player home");
  assert.false(clubHome.includes("ClubProCard"), "no duplicated card in club home");
  assert.true(home.includes("ClubProCard"), "ClubPro Card");
  assert.true(home.includes("buildClubCardData"), "ClubCard from real club");
  assert.true(home.includes('variant="mini"'), "club mini");
  assert.true(home.includes("useOpenMonClub"), "same Mon club dest");
  assert.true(home.includes('mode === "CLUB"'), "create-club gated club mode");
  assert.true(home.includes("Sans club."), "player empty");
  assert.true(home.includes("Aucun club géré."), "club empty");
  assert.true(home.includes('router.push("/create-club")'), "créer un club");
  assert.false(home.includes("/find-club"), "no find-club");
  assert.true(home.includes("Rien à traiter."), "honest empty inbox");
  assert.true(home.includes("useMyInvitations"), "pending invites");
  assert.true(home.includes("useMyApplications"), "pending apps sent");
  assert.true(home.includes("useApplications"), "incoming if manager");
  assert.true(home.includes("est en ligne"), "club live line");
  assert.true(home.includes("Matchmaking"), "loud CTA");
  assert.true(home.includes("PLAYER_MATCHMAKING_HREF"), "CTA → player index");
  assert.true(home.includes("CLUB_MATCHMAKING_HREF"), "CTA → club index");
  assert.false(home.includes("LiveClubCard"), "no feed");
  assert.false(home.includes("LivePlayerCard"), "no player feed");
  assert.false(home.includes("ApplicationsPanel"), "no recrutement panel");
  assert.false(home.includes("ClubDiscoveryToggle"), "no En ligne on Accueil");
  assert.false(home.includes("PlayerLivePanel"), "no player LIVE panel");
  assert.true(home.includes("edges={[]}"), "accueil no double inset");
  assert.false(home.includes("AppMenuHeader"), "accueil uses global chrome");
  assert.true(read("app/(player)/(tabs)/index.tsx").includes("ModeSegmentToggle"), "toggle on player matchmaking");
  assert.true(read("components/nav/AppMenuSheet.tsx").includes("ModeSegmentToggle"), "toggle stays in drawer");
});

console.log(`\n${passed} tests OK`);
