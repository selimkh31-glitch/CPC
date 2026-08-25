/**
 * Client défensif pour les endpoints semi-publics EA Pro Clubs
 * EA Pro Clubs (proclubs.ea.com/api/fc/...). NON officiels : pannes, SSL
 * intermittent, rate-limiting fréquents. Isolé ici (Edge Function only),
 * jamais appelé depuis l'app mobile. Désactivable via FEATURE_EA_STATS.
 *
 * Porté depuis lib/ea/ (version Next.js) — logique identique, adaptée à Deno.
 *
 * Seul point de fetch vers proclubs.ea.com. Les Edge Functions passent par
 * ProClubsEAProvider (searchClub / getClubMatches / getPlayerStats), qui
 * appelle eaGet puis normalize — jamais un second client HTTP, jamais depuis
 * app/ lib/hooks/ components/.
 */

// Exportés (lecture seule) pour supabase/functions/_shared/ea/proClubsAdapter.ts —
// l'adapter EAProvider réutilise EXACTEMENT ce client défensif (retries,
// timeout, headers) plutôt que de le dupliquer. Aucune valeur ni logique
// changée ici, seule la visibilité (`export`) est ajoutée.
export const BASE_URL = "https://proclubs.ea.com/api/fc";
const DEFAULT_TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;

export const REALISTIC_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
  Referer: "https://www.ea.com/",
};

function readDenoEnv(key: string): string | undefined {
  const deno = (globalThis as { Deno?: { env?: { get?: (k: string) => string | undefined } } }).Deno;
  return deno?.env?.get?.(key);
}

export const FEATURE_EA_STATS = readDenoEnv("FEATURE_EA_STATS") !== "false";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function eaGet<T>(path: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        headers: REALISTIC_HEADERS,
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
