import { supabase } from "@/lib/supabase/client";
import {
  parseAuthCallbackUrl,
  type ParsedAuthCallback,
} from "@/lib/auth/emailConfirmParse";

export {
  AUTH_EMAIL_REDIRECT,
  destAfterEmailConfirm,
  parseAuthCallbackParams,
  parseAuthCallbackSearch,
  parseAuthCallbackUrl,
  type ParsedAuthCallback,
} from "@/lib/auth/emailConfirmParse";

export type ConsumeAuthResult =
  | { ok: true }
  | { ok: false; reason: "empty" | "error" | "exchange"; message?: string };

const handledCodes = new Set<string>();
const handledOtps = new Set<string>();
const inflight = new Map<string, Promise<ConsumeAuthResult>>();

async function runExclusive(key: string, work: () => Promise<ConsumeAuthResult>): Promise<ConsumeAuthResult> {
  const existing = inflight.get(key);
  if (existing) return existing;
  const pending = work().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, pending);
  return pending;
}

export async function consumeAuthCode(code: string): Promise<ConsumeAuthResult> {
  const trimmed = code.trim();
  if (!trimmed) return { ok: false, reason: "empty" };
  if (handledCodes.has(trimmed)) return { ok: true };
  return runExclusive(`code:${trimmed}`, async () => {
    const { data, error } = await supabase.auth.exchangeCodeForSession(trimmed);
    if (data.session) {
      handledCodes.add(trimmed);
      return { ok: true };
    }
    const { data: existing } = await supabase.auth.getSession();
    if (existing.session) {
      handledCodes.add(trimmed);
      return { ok: true };
    }
    return { ok: false, reason: "exchange", message: error?.message ?? "Session absente." };
  });
}

export async function consumeAuthOtp(input: {
  tokenHash: string;
  type: "signup" | "email" | "magiclink" | "invite" | "recovery" | "email_change";
}): Promise<ConsumeAuthResult> {
  const tokenHash = input.tokenHash.trim();
  if (!tokenHash) return { ok: false, reason: "empty" };
  if (handledOtps.has(tokenHash)) return { ok: true };
  return runExclusive(`otp:${tokenHash}`, async () => {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: input.type,
    });
    if (data.session) {
      handledOtps.add(tokenHash);
      return { ok: true };
    }
    const { data: existing } = await supabase.auth.getSession();
    if (existing.session) {
      handledOtps.add(tokenHash);
      return { ok: true };
    }
    return { ok: false, reason: "exchange", message: error?.message ?? "Session absente." };
  });
}

export async function consumeParsedAuthCallback(parsed: ParsedAuthCallback): Promise<ConsumeAuthResult> {
  if (parsed.kind === "empty") return { ok: false, reason: "empty" };
  if (parsed.kind === "error") return { ok: false, reason: "error", message: parsed.message };
  if (parsed.kind === "otp") return consumeAuthOtp(parsed);
  return consumeAuthCode(parsed.code);
}

export async function consumeAuthCallbackUrl(url: string | null | undefined): Promise<ConsumeAuthResult> {
  return consumeParsedAuthCallback(parseAuthCallbackUrl(url));
}
