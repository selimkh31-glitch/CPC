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

test("pas de 3e nav ; onglets LIVE|Activité et LIVE|Recrutement", () => {
  const playerTabs = read("app/(player)/(tabs)/_layout.tsx");
  const clubTabs = read("app/(club)/(tabs)/_layout.tsx");
  assert.true(playerTabs.includes('title: "LIVE"'), "player LIVE");
  assert.true(playerTabs.includes('title: "Activité"'), "player activité");
  assert.true(playerTabs.includes('href: null, title: "Profil"'), "player profil hidden");
  assert.true(clubTabs.includes('title: "LIVE"'), "club LIVE");
  assert.true(clubTabs.includes('title: "Recrutement"'), "club recrutement");
  assert.true(clubTabs.includes('href: null, title: "Club"'), "club identity hidden");
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
  assert.equal((sheet.match(/label="Mon club"/g) ?? []).length, 1, "one Mon club");
  assert.false(sheet.includes("Mon club (joueur)"), "no club joueur row");
  assert.false(sheet.includes("Mon club (manager)"), "no club manager row");
  assert.true(sheet.includes('"Joueur"'), "toggle Joueur");
  assert.true(sheet.includes('"Club"'), "toggle Club");
  assert.true(sheet.includes("OWNER") && sheet.includes("MANAGER"), "Mon club by role");
  assert.true(sheet.includes("playerInvitationAcceptHref"), "member → ClubHome");
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
  assert.true(theme.includes('PLAYER: "#4DA3FF"'), "joueur blue");
  assert.true(theme.includes('CLUB: "#39ff8a"'), "club green");
  assert.true(theme.includes("export function useModeAccent"), "useModeAccent");
  assert.false(theme.includes("vars("), "theme no vars()");
  assert.false(theme.includes("nativewind"), "theme no nativewind");
  assert.true(tw.includes('DEFAULT: "#39ff8a"'), "tailwind accent stays hex green");
  assert.false(tw.includes("--cpc-accent"), "tailwind no css var accent");
  assert.false(tw.includes("<alpha-value>"), "tailwind no rgb var accent");
  const playerTabs = read("app/(player)/(tabs)/_layout.tsx");
  const clubTabsLayout = read("app/(club)/(tabs)/_layout.tsx");
  assert.true(playerTabs.includes("useModeAccent"), "player tab tint");
  assert.true(clubTabsLayout.includes("useModeAccent"), "club tab tint");
  const glow = read("components/ui/Glow.tsx");
  assert.true(glow.includes("useModeAccent"), "glow live follows mode");
  assert.true(glow.includes('win: "#39ff8a"'), "glow win stays result green");
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
  assert.false(livePlayer.includes("font-display text-3xl text-fg\">Profil"), "no second Profil title on LIVE");
});

console.log(`\n${passed} tests OK`);
