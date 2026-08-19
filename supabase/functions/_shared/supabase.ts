import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Client admin (service_role) — contourne RLS. SERVEUR UNIQUEMENT (Edge Functions).
 * La clé vit dans les secrets Supabase (`supabase secrets set`), jamais côté mobile.
 */
export function getAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/**
 * Résout l'utilisateur appelant à partir du header Authorization (JWT transmis
 * automatiquement par `supabase.functions.invoke()` côté client). Retourne
 * `null` si le token est absent/invalide.
 */
export async function getCallingUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await client.auth.getUser();
  return user;
}
