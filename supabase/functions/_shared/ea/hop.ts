import { fetchEaJson, isAllowedEaPath } from "./http.ts";
import { jsonResponse } from "../cors.ts";
import { readEnv } from "./env.ts";

/**
 * Hop Node CPC-owned : RN n'appelle jamais ceci. Seules les Edge Functions
 * (link-ea-club / ea-sync) POST ici avec EA_HTTP_HOP_SECRET, puis le hop
 * fetch proclubs.ea.com avec le client Node. Pas une URL produit publique.
 */

export function hopSecretOk(req: Request): boolean {
  const expected = readEnv("EA_HTTP_HOP_SECRET");
  if (!expected) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${expected}`;
}

export async function handleEaHopRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200 });
  if (req.method !== "POST") return jsonResponse({ error: "Méthode non autorisée" }, 405);
  if (!hopSecretOk(req)) return jsonResponse({ error: "Non autorisé" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  const path = typeof body.path === "string" ? body.path : "";
  if (!isAllowedEaPath(path)) {
    return jsonResponse({ error: "Chemin /api/fc non autorisé." }, 400);
  }

  try {
    const json = await fetchEaJson<unknown>(path);
    return jsonResponse(json, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Échec hop EA";
    return jsonResponse({ error: message }, 502);
  }
}
