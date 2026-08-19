import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

export class EdgeFunctionError extends Error {}

/**
 * Fix A — @supabase/supabase-js@2.112.3 (donc @supabase/functions-js@2.112.3,
 * vérifié dans node_modules) : `supabase.functions.invoke()` lève une
 * `FunctionsHttpError` dès que la réponse HTTP n'est pas 2xx, AVANT de lire le
 * body (voir FunctionsClient.ts : `if (!response.ok) throw new
 * FunctionsHttpError(response)`, le parsing JSON ne se produit que dans la
 * branche `response.ok`). `data` vaut donc toujours `null` dans ce cas — tout
 * le body métier ({ error: "..." }, convention jsonResponse() de nos Edge
 * Functions) ne vit que dans `error.context`, qui EST cette Response HTTP
 * brute, jamais encore consommée. On la lit nous-mêmes ici.
 */
async function extractHttpErrorMessage(error: FunctionsHttpError): Promise<string> {
  const response = error.context as Response | undefined;
  if (!response) return error.message;

  // Une seule lecture du flux (`.text()`), jamais `.json()` puis `.text()` en
  // repli sur le même Response — un flux déjà consommé lève une erreur à la
  // deuxième lecture. On tente ensuite JSON.parse sur le texte obtenu.
  let raw: string;
  try {
    raw = await response.text();
  } catch {
    // Body illisible (flux déjà consommé, erreur réseau...) — le gestionnaire
    // d'erreur ne doit jamais planter pour autant.
    return error.message;
  }

  try {
    const body = JSON.parse(raw);
    if (body && typeof body.error === "string" && body.error.length > 0) {
      return body.error;
    }
    // JSON valide mais sans champ `error` exploitable — repli propre.
    return error.message;
  } catch {
    // Body non-JSON — repli sur le texte brut s'il existe, sinon générique.
    return raw.length > 0 ? raw : error.message;
  }
}

/** Appelle une Supabase Edge Function et normalise les erreurs. */
export async function callEdgeFunction<T>(name: string, body?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const message = error instanceof FunctionsHttpError ? await extractHttpErrorMessage(error) : (error.message ?? "Une erreur est survenue.");
    throw new EdgeFunctionError(message);
  }
  if (data?.error) throw new EdgeFunctionError(data.error);
  return data as T;
}
