/**
 * Client défensif pour les endpoints non officiels EA FC Pro Clubs
 * (proclubs.ea.com/api/fc/...). Pannes, 403 Akamai, rate-limiting fréquents.
 * Isolé ici (serveur seulement), jamais appelé depuis l'app mobile.
 * Désactivable via FEATURE_EA_STATS.
 *
 * Transport : Node 20 `fetch` (undici) est le client qui parle JSON.
 * Deno/Edge ne fetch PAS proclubs.ea.com (TLS curl-class → 403 HTML Akamai).
 * Edge appelle un hop Node CPC-owned (EA_HTTP_HOP_URL + EA_HTTP_HOP_SECRET).
 * Jamais un proxy ClubsZone / club-champions.eu.
 */

import { fetchEaJson } from "./ea/http.ts";
import { isDenoRuntime, readEnv } from "./ea/env.ts";

export { EA_FC_BASE_URL as BASE_URL, EA_BROWSER_HEADERS as REALISTIC_HEADERS, getEaFcBaseUrl } from "./ea/http.ts";
export { fetchEaJson } from "./ea/http.ts";
export { getLiveEaTitle, PRODUCT_EA_TITLE } from "./ea/title.ts";

export const FEATURE_EA_STATS = readEnv("FEATURE_EA_STATS") !== "false";

async function eaGetViaHop<T>(path: string): Promise<T> {
  const hopUrl = readEnv("EA_HTTP_HOP_URL");
  const hopSecret = readEnv("EA_HTTP_HOP_SECRET");
  if (!hopUrl || !hopSecret) {
    throw new Error(
      "Deno ne fetch pas proclubs.ea.com ; définir EA_HTTP_HOP_URL et EA_HTTP_HOP_SECRET (hop Node CPC)."
    );
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

/** Seul point réseau EA pour les Edge Functions / le hop Node. */
export async function eaGet<T>(path: string): Promise<T> {
  if (isDenoRuntime()) {
    return eaGetViaHop<T>(path);
  }
  return fetchEaJson<T>(path);
}
