import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getCallingUser } from "../_shared/supabase.ts";
import { moderateText } from "../_shared/ai.ts";
import { requireString, ValidationError } from "../_shared/validate.ts";

/** Endpoint de modération générique (section 5) — filtrage léger de messages signalés. */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let text: string;
  try {
    const body = await req.json();
    text = requireString(body.text, "text", { min: 1, max: 500 });
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  const result = await moderateText(text);
  return jsonResponse(result);
});
