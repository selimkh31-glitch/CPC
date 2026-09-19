/** Deep link cible des emails Supabase Confirm signup (PKCE). */
export const AUTH_EMAIL_REDIRECT = "clubproconnect://auth/callback";

export type ParsedAuthCallback =
  | { kind: "code"; code: string }
  | { kind: "otp"; tokenHash: string; type: "signup" | "email" | "magiclink" | "invite" | "recovery" | "email_change" }
  | { kind: "error"; message: string }
  | { kind: "empty" };

function firstString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return typeof value === "string" ? value.trim() : "";
}

function readParam(search: URLSearchParams, key: string): string {
  return (search.get(key) ?? "").trim();
}

function otpType(
  raw: string
): "signup" | "email" | "magiclink" | "invite" | "recovery" | "email_change" | null {
  if (
    raw === "signup" ||
    raw === "email" ||
    raw === "magiclink" ||
    raw === "invite" ||
    raw === "recovery" ||
    raw === "email_change"
  ) {
    return raw;
  }
  return null;
}

/**
 * Query + hash. Couvre `clubproconnect://auth/callback?code=` et le hash
 * implicit (`#code=` / `#error=`). Aucun token n'est loggé.
 */
export function parseAuthCallbackUrl(raw: string | null | undefined): ParsedAuthCallback {
  if (!raw || typeof raw !== "string") return { kind: "empty" };
  const hashAt = raw.indexOf("#");
  const queryAt = raw.indexOf("?");
  const query = queryAt >= 0 ? raw.slice(queryAt + 1, hashAt >= 0 ? hashAt : undefined) : "";
  const hash = hashAt >= 0 ? raw.slice(hashAt + 1) : "";
  return parseAuthCallbackSearch(query, hash);
}

export function parseAuthCallbackSearch(query: string, hash = ""): ParsedAuthCallback {
  const fromQuery = new URLSearchParams(query);
  const fromHash = new URLSearchParams(hash);

  const error = readParam(fromQuery, "error") || readParam(fromHash, "error");
  if (error) {
    const description =
      readParam(fromQuery, "error_description") || readParam(fromHash, "error_description") || error;
    return { kind: "error", message: description.replace(/\+/g, " ") };
  }

  const code = readParam(fromQuery, "code") || readParam(fromHash, "code");
  if (code) return { kind: "code", code };

  const tokenHash = readParam(fromQuery, "token_hash") || readParam(fromHash, "token_hash");
  const type = otpType(readParam(fromQuery, "type") || readParam(fromHash, "type") || "signup");
  if (tokenHash && type) return { kind: "otp", tokenHash, type };

  return { kind: "empty" };
}

export function parseAuthCallbackParams(params: {
  code?: string | string[];
  error?: string | string[];
  error_description?: string | string[];
  token_hash?: string | string[];
  type?: string | string[];
}): ParsedAuthCallback {
  const error = firstString(params.error);
  if (error) {
    return { kind: "error", message: firstString(params.error_description) || error };
  }
  const code = firstString(params.code);
  if (code) return { kind: "code", code };
  const tokenHash = firstString(params.token_hash);
  const type = otpType(firstString(params.type) || "signup");
  if (tokenHash && type) return { kind: "otp", tokenHash, type };
  return { kind: "empty" };
}

/** Après confirm : profil manquant → onboarding, sinon Accueil / porte. */
export function destAfterEmailConfirm(hasProfile: boolean): "/onboarding" | "/" {
  return hasProfile ? "/" : "/onboarding";
}
