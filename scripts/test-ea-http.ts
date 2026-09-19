/**
 * Allowlist /api/fc — fetch mocké, jamais un appel live EA.
 * Lancer : npx tsx scripts/test-ea-http.ts
 */
import { fetchEaJson, isAllowedEaPath, isEaJsonBody } from "../supabase/functions/_shared/ea/http";

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

function jsonResponse(body: unknown, status = 200, contentType = "application/json"): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "Content-Type": contentType },
  });
}

const originalFetch = globalThis.fetch;

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
  globalThis.fetch = (async (input: RequestInfo | URL) => handler(String(input))) as typeof fetch;
}

async function run() {
  console.log("EA /api/fc — allowlist + Node client");

  await test("allowlist — CSL search + allTime + members, refuse SSRF", () => {
    assert.ok(isAllowedEaPath("/currentSeasonLeaderboard/search?platform=common-gen5&clubName=Possibly"), "CSL search");
    assert.ok(isAllowedEaPath("/allTimeLeaderboard/search?platform=common-gen5&clubName=Possibly"), "allTime search");
    assert.ok(isAllowedEaPath("/members/stats?platform=common-gen5&clubId=42450"), "members");
    assert.ok(isAllowedEaPath("/clubs/info?platform=common-gen5&clubIds=42450"), "info");
    assert.deepEqual(isAllowedEaPath("https://evil.example/"), false, "ssrf");
    assert.deepEqual(isAllowedEaPath("/api/fifa/foo"), false, "fifa");
    assert.deepEqual(isAllowedEaPath("//proclubs.ea.com"), false, "protocol-relative");
    assert.deepEqual(isAllowedEaPath("/clubs/seasonalStats"), false, "inconnu");
  });

  await test("isEaJsonBody — refuse HTML Akamai", () => {
    assert.deepEqual(isEaJsonBody("text/html", "<HTML><TITLE>Access Denied</TITLE>"), false, "html");
    assert.ok(isEaJsonBody("application/json", '{"clubId":"42450"}'), "json");
  });

  await test("fetchEaJson — 200 JSON mock, pas de live EA", async () => {
    mockFetch((url) => {
      assert.ok(url.includes("/currentSeasonLeaderboard/search"), "CSL");
      return jsonResponse([{ clubId: "42450", name: "Possibly FC" }]);
    });
    const raw = await fetchEaJson<unknown[]>(
      "/currentSeasonLeaderboard/search?platform=common-gen5&clubName=Possibly"
    );
    assert.deepEqual((raw[0] as { clubId: string }).clubId, "42450", "json");
  });

  await test("fetchEaJson — chemin hors allowlist", async () => {
    let caught = false;
    try {
      await fetchEaJson("/not/a/path");
    } catch {
      caught = true;
    }
    assert.ok(caught, "throw");
  });

  globalThis.fetch = originalFetch;
  console.log(`\n${passed} test(s) passés.`);
}

run().catch((err) => {
  globalThis.fetch = originalFetch;
  console.error(err);
  process.exit(1);
});
