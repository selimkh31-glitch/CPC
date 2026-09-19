/**
 * Client défensif pour les endpoints semi-publics EA Pro Clubs
 * (proclubs.ea.com/api/fc/...). NON officiels : pannes, SSL
 * intermittent, rate-limiting fréquents. Isolé ici (Edge Function only),
 * jamais appelé depuis l'app mobile. Désactivable via FEATURE_EA_STATS.
 *
 * Transport : Node 20 `fetch` (undici) parle JSON. Deno/Edge ne doit pas
 * fetch proclubs.ea.com si un hop Node est configuré (EA_HTTP_HOP_URL +
 * EA_HTTP_HOP_SECRET) — TLS Deno → souvent 403 HTML Akamai.
 * Jamais un fetch depuis React Native.
 */

import { EA_BROWSER_HEADERS, DEFAULT_EA_FC_BASE_URL, fetchEaJson, isAllowedEaPath } from "./ea/http.ts";

export { DEFAULT_EA_FC_BASE_URL as BASE_URL, EA_BROWSER_HEADERS as REALISTIC_HEADERS, fetchEaJson, getEaFcBaseUrl } from "./ea/http.ts";

function readEnv(key: string): string | undefined {
  const deno = (globalThis as { Deno?: { env?: { get?: (k: string) => string | undefined } } }).Deno;
  const fromDeno = deno?.env?.get?.(key);
  if (fromDeno !== undefined && fromDeno !== "") return fromDeno;
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env?.[key];
}

function isDenoRuntime(): boolean {
  return typeof (globalThis as { Deno?: unknown }).Deno !== "undefined";
}

export const FEATURE_EA_STATS = readEnv("FEATURE_EA_STATS") !== "false";

const DEFAULT_TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function eaGetViaHop<T>(path: string): Promise<T> {
  const hopUrl = readEnv("EA_HTTP_HOP_URL");
  const hopSecret = readEnv("EA_HTTP_HOP_SECRET");
  if (!hopUrl || !hopSecret) {
    throw new Error("Hop EA incomplet : définir EA_HTTP_HOP_URL et EA_HTTP_HOP_SECRET.");
  }

  const res = await fetch(hopUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${hopSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path }),
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Hop EA a renvoyé un corps non-JSON (${res.status})`);
  }
  if (!res.ok) {
    const errMsg =
      json && typeof json === "object" && typeof (json as { error?: unknown }).error === "string"
        ? (json as { error: string }).error
        : `Hop EA ${res.status}`;
    throw new Error(errMsg);
  }
  return json as T;
}

/** Fetch Deno direct — fallback si le hop n'est pas déployé. */
async function eaGetDirect<T>(path: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${DEFAULT_EA_FC_BASE_URL}${path}`, {
        headers: EA_BROWSER_HEADERS,
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`EA API a répondu ${res.status} sur ${path}`);
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) await sleep(300 * Math.pow(3, attempt));
    }
  }
  throw new Error(`Échec EA API après ${MAX_RETRIES + 1} tentatives sur ${path}: ${lastError}`);
}

/** Seul point réseau EA pour les Edge Functions / le hop Node. */
export async function eaGet<T>(path: string): Promise<T> {
  if (!isAllowedEaPath(path)) {
    throw new Error(`Chemin /api/fc non autorisé: ${path}`);
  }
  if (isDenoRuntime()) {
    const hopUrl = readEnv("EA_HTTP_HOP_URL");
    const hopSecret = readEnv("EA_HTTP_HOP_SECRET");
    if (hopUrl && hopSecret) return eaGetViaHop<T>(path);
    return eaGetDirect<T>(path);
  }
  return fetchEaJson<T>(path);
}
