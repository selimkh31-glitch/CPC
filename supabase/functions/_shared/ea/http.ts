/**
 * Client HTTP Node-class vers proclubs.ea.com/api/fc (unofficiel, non garanti).
 * Chrome UA + Referer ea.com. Timeout + retries. Refuse le HTML Akamai (403).
 * Toujours un fetch direct — jamais un second hop ici (évite une boucle Deno).
 * BASE_URL swappable via EA_FC_BASE_URL (The Grounds) — jamais /api/fifa.
 */

import { getEaFcBaseUrl } from "./title.ts";

export { DEFAULT_EA_FC_BASE_URL as EA_FC_BASE_URL, getEaFcBaseUrl, resolveEaFcBaseUrl } from "./title.ts";
export const DEFAULT_EA_TIMEOUT_MS = 8000;
export const EA_MAX_RETRIES = 2;

export const EA_BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
  Referer: "https://www.ea.com/",
};

const ALLOWED_EA_PATHS: readonly RegExp[] = [
  /^\/allTimeLeaderboard\/search(\?|$)/,
  /^\/clubs\/info(\?|$)/,
  /^\/clubs\/overallStats(\?|$)/,
  /^\/clubs\/matches(\?|$)/,
  /^\/members\/stats(\?|$)/,
  /^\/members\/career\/stats(\?|$)/,
];

export function isAllowedEaPath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) return false;
  return ALLOWED_EA_PATHS.some((re) => re.test(path));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isEaJsonBody(contentType: string | null, body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("<")) return false;
  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("application/json") || ct.includes("+json")) return true;
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

/**
 * GET /api/fc{path} via le fetch du runtime courant (Node undici en hop / tests).
 * `path` = chemin + query, ex. `/clubs/info?platform=common-gen5&clubIds=1`.
 */
export async function fetchEaJson<T>(
  path: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = DEFAULT_EA_TIMEOUT_MS
): Promise<T> {
  if (!isAllowedEaPath(path)) {
    throw new Error(`Chemin /api/fc non autorisé: ${path}`);
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= EA_MAX_RETRIES; attempt++) {
    try {
      const res = await fetchImpl(`${getEaFcBaseUrl()}${path}`, {
        headers: EA_BROWSER_HEADERS,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const contentType = res.headers.get("content-type");
      const text = await res.text();
      if (!res.ok) {
        throw new Error(`EA /api/fc a répondu ${res.status} sur ${path}`);
      }
      if (!isEaJsonBody(contentType, text)) {
        throw new Error(`EA /api/fc a renvoyé un corps non-JSON sur ${path}`);
      }
      return JSON.parse(text) as T;
    } catch (err) {
      lastError = err;
      if (attempt < EA_MAX_RETRIES) await sleep(300 * Math.pow(3, attempt));
    }
  }
  throw new Error(`Échec EA /api/fc après ${EA_MAX_RETRIES + 1} tentatives sur ${path}: ${lastError}`);
}
