/**
 * Confirmation email — parse deep link + sortie du spinner sans reload.
 * Lancer : npx tsx scripts/test-auth-callback.ts
 */
// @ts-expect-error Expo tsconfig has no @types/node; tsx provides `fs` at runtime.
import { readFileSync } from "fs";
import {
  AUTH_EMAIL_REDIRECT,
  destAfterEmailConfirm,
  parseAuthCallbackParams,
  parseAuthCallbackUrl,
} from "../lib/auth/emailConfirmParse";

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
  deepEqual(actual: unknown, expected: unknown, label: string) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) throw new Error(`Assertion échouée (${label}).\n  reçu: ${a}\n  attendu: ${b}`);
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

console.log("Auth email confirm callback");

test("AUTH_EMAIL_REDIRECT = scheme app + /auth/callback", () => {
  assert.equal(AUTH_EMAIL_REDIRECT, "clubproconnect://auth/callback", "redirect");
});

test("parseAuthCallbackUrl — code query, hash, erreur, vide", () => {
  assert.deepEqual(
    parseAuthCallbackUrl("clubproconnect://auth/callback?code=pkce-abc"),
    { kind: "code", code: "pkce-abc" },
    "query code"
  );
  assert.deepEqual(
    parseAuthCallbackUrl("clubproconnect://auth/callback#code=from-hash"),
    { kind: "code", code: "from-hash" },
    "hash code"
  );
  assert.deepEqual(
    parseAuthCallbackUrl("clubproconnect://auth/callback?error=access_denied&error_description=Nope"),
    { kind: "error", message: "Nope" },
    "error"
  );
  assert.deepEqual(parseAuthCallbackUrl("clubproconnect://auth/callback"), { kind: "empty" }, "empty");
  assert.deepEqual(parseAuthCallbackUrl(null), { kind: "empty" }, "null");
});

test("parseAuthCallbackUrl — token_hash signup + params router", () => {
  assert.deepEqual(
    parseAuthCallbackUrl("clubproconnect://auth/callback?token_hash=th1&type=signup"),
    { kind: "otp", tokenHash: "th1", type: "signup" },
    "otp"
  );
  assert.deepEqual(parseAuthCallbackParams({ code: "abc" }), { kind: "code", code: "abc" }, "params code");
  assert.deepEqual(
    parseAuthCallbackParams({ error: "expired", error_description: "Lien expiré" }),
    { kind: "error", message: "Lien expiré" },
    "params error"
  );
});

test("destAfterEmailConfirm — nouveau user → onboarding", () => {
  assert.equal(destAfterEmailConfirm(false), "/onboarding", "no profile");
  assert.equal(destAfterEmailConfirm(true), "/", "has profile");
});

test("callback : plus de spinner infini ; session / CTA / timeout", () => {
  const cb = read("app/auth/callback.tsx");
  assert.true(cb.includes("consumeParsedAuthCallback"), "exchange helper");
  assert.true(cb.includes("destAfterEmailConfirm"), "leave dest");
  assert.true(cb.includes("refreshSession"), "resume session");
  assert.true(cb.includes("Email confirmé"), "success copy");
  assert.true(cb.includes("Continuer"), "CTA");
  assert.true(cb.includes("SPINNER_MAX_MS"), "timeout");
  assert.true(cb.includes("Linking.addEventListener"), "deep link while open");
  assert.false(cb.includes("console.log"), "no diagnostic logs");
  assert.false(cb.includes("DIAGNOSTIC TEMPORAIRE"), "no temp diagnostic");
});

test("AuthProvider reprend la session au retour Mail + deep link", () => {
  const auth = read("lib/providers/AuthProvider.tsx");
  assert.true(auth.includes("AppState"), "AppState");
  assert.true(auth.includes('state !== "active"'), "resume active");
  assert.true(auth.includes("getSession"), "getSession on resume");
  assert.true(auth.includes("consumeAuthCallbackUrl"), "consume deep link");
  assert.true(auth.includes("Linking.addEventListener"), "url listener");
  assert.true(auth.includes("refreshSession"), "exposed refresh");
});

test("login : signup confirm → écran d'attente + CTA sans kill", () => {
  const login = read("app/(auth)/login.tsx");
  assert.true(login.includes("AUTH_EMAIL_REDIRECT"), "same redirect");
  assert.true(login.includes("awaitingEmail"), "waiting state");
  assert.true(login.includes("Email confirmé, continuer"), "CTA");
  assert.true(login.includes("signInWithPassword"), "password fallback");
  assert.true(login.includes("refreshSession"), "session first");
});

console.log(`\n${passed} tests auth callback OK`);
