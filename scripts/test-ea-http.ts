/**
 * Client HTTP Node-class /api/fc — fetch mocké, jamais un appel live EA.
 * Lancer : npx tsx scripts/test-ea-http.ts
 */
import { fetchEaJson, isAllowedEaPath, isEaJsonBody } from "../supabase/functions/_shared/ea/http";
import { eaGet } from "../supabase/functions/_shared/ea";
import { handleEaHopRequest } from "../supabase/functions/_shared/ea/hop";

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

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(String(input), init)) as typeof fetch;
}

async function run() {
  console.log("EA /api/fc — Node HTTP client + hop");

  await test("allowlist — chemins /api/fc connus seulement", () => {
    assert.ok(isAllowedEaPath("/clubs/info?platform=common-gen5&clubIds=1"), "info");
    assert.ok(isAllowedEaPath("/members/career/stats?clubId=1"), "career");
    assert.deepEqual(isAllowedEaPath("https://evil.example/"), false, "ssrf");
    assert.deepEqual(isAllowedEaPath("/api/fifa/foo"), false, "famille inconnue");
    assert.deepEqual(isAllowedEaPath("//proclubs.ea.com"), false, "protocol-relative");
  });

  await test("isEaJsonBody — refuse HTML Akamai", () => {
    assert.deepEqual(isEaJsonBody("text/html", "<HTML><TITLE>Access Denied</TITLE>"), false, "html");
    assert.ok(isEaJsonBody("application/json", '{"clubId":"1"}'), "json ct");
    assert.ok(isEaJsonBody("text/plain", '[{"clubId":"1"}]'), "array sans ct json");
  });

  await test("fetchEaJson — 200 JSON (mock, pas de live EA)", async () => {
    mockFetch((url) => {
      assert.ok(url.startsWith("https://proclubs.ea.com/api/fc/allTimeLeaderboard/search"), "base /api/fc");
      return jsonResponse([{ clubId: "2582784", name: "United" }]);
    });
    const raw = await fetchEaJson<unknown[]>("/allTimeLeaderboard/search?platform=common-gen5&clubName=United");
    assert.deepEqual(raw[0], { clubId: "2582784", name: "United" }, "json");
  });

  await test("fetchEaJson — HTML 403 n'est pas du JSON", async () => {
    mockFetch(() => jsonResponse("<HTML><TITLE>Access Denied</TITLE></HTML>", 403, "text/html"));
    let caught = false;
    try {
      await fetchEaJson("/clubs/info?platform=common-gen5&clubIds=1");
    } catch {
      caught = true;
    }
    assert.ok(caught, "throw");
  });

  await test("Node eaGet — fetch direct proclubs (pas de hop)", async () => {
    mockFetch((url) => {
      assert.ok(url.includes("proclubs.ea.com"), "direct");
      assert.deepEqual(url.includes("hop"), false, "pas hop");
      return jsonResponse({ ok: true });
    });
    const raw = await eaGet<{ ok: boolean }>("/clubs/info?platform=common-gen5&clubIds=1");
    assert.deepEqual(raw.ok, true, "ok");
  });

  await test("Deno eaGet — POST hop Node, jamais proclubs.ea.com", async () => {
    const g = globalThis as { Deno?: { env: { get: (k: string) => string | undefined } } };
    const prev = g.Deno;
    g.Deno = {
      env: {
        get: (k: string) => {
          if (k === "EA_HTTP_HOP_URL") return "https://cpc-hop.test/ea";
          if (k === "EA_HTTP_HOP_SECRET") return "hop-secret";
          return undefined;
        },
      },
    };
    mockFetch((url, init) => {
      if (url.includes("proclubs.ea.com")) throw new Error("Deno ne doit pas fetch proclubs.ea.com");
      assert.deepEqual(url, "https://cpc-hop.test/ea", "hop url");
      assert.deepEqual(init?.method, "POST", "POST");
      const headers = new Headers(init?.headers);
      assert.deepEqual(headers.get("authorization"), "Bearer hop-secret", "secret");
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(body.path, "/clubs/info?platform=common-gen5&clubIds=1", "path");
      return jsonResponse({ "1": { clubId: 1, name: "United" } });
    });
    try {
      const raw = await eaGet<{ "1": { name: string } }>("/clubs/info?platform=common-gen5&clubIds=1");
      assert.deepEqual(raw["1"].name, "United", "json hop");
    } finally {
      if (prev) g.Deno = prev;
      else delete g.Deno;
    }
  });

  await test("hop — 401 sans secret", async () => {
    const res = await handleEaHopRequest(new Request("https://hop/", { method: "POST", body: "{}" }));
    assert.deepEqual(res.status, 401, "401");
  });

  await test("hop — refuse chemin hors allowlist", async () => {
    const g = globalThis as { process: { env: Record<string, string | undefined> } };
    const prev = g.process.env.EA_HTTP_HOP_SECRET;
    g.process.env.EA_HTTP_HOP_SECRET = "s";
    try {
      const res = await handleEaHopRequest(
        new Request("https://hop/", {
          method: "POST",
          headers: { Authorization: "Bearer s", "Content-Type": "application/json" },
          body: JSON.stringify({ path: "https://example.com/" }),
        })
      );
      assert.deepEqual(res.status, 400, "400");
    } finally {
      g.process.env.EA_HTTP_HOP_SECRET = prev;
    }
  });

  await test("hop — 200 JSON via fetchEaJson mocké", async () => {
    const g = globalThis as { process: { env: Record<string, string | undefined> } };
    const prev = g.process.env.EA_HTTP_HOP_SECRET;
    g.process.env.EA_HTTP_HOP_SECRET = "s";
    mockFetch((url) => {
      assert.ok(url.includes("proclubs.ea.com/api/fc/clubs/info"), "hop fetch EA");
      return jsonResponse({ "1": { name: "United", clubId: 1 } });
    });
    try {
      const res = await handleEaHopRequest(
        new Request("https://hop/", {
          method: "POST",
          headers: { Authorization: "Bearer s", "Content-Type": "application/json" },
          body: JSON.stringify({ path: "/clubs/info?platform=common-gen5&clubIds=1" }),
        })
      );
      assert.deepEqual(res.status, 200, "200");
      const json = (await res.json()) as { "1": { name: string } };
      assert.deepEqual(json["1"].name, "United", "body");
    } finally {
      g.process.env.EA_HTTP_HOP_SECRET = prev;
    }
  });

  globalThis.fetch = originalFetch;
  console.log(`\n${passed} test(s) passés.`);
}

run().catch((err) => {
  globalThis.fetch = originalFetch;
  console.error(err);
  process.exit(1);
});
