import { jsonResponse } from "./cors.ts";

export async function usersAreBlocked(
  admin: { rpc: Function },
  a: string,
  b: string
): Promise<{ blocked: boolean; error?: string }> {
  const { data, error } = await admin.rpc("users_are_blocked", { p_a: a, p_b: b });
  if (error) return { blocked: false, error: error.message };
  return { blocked: Boolean(data) };
}

/** 403 si la paire est bloquée ; 500 si la RPC safety est injoignable. */
export async function rejectIfBlocked(
  admin: { rpc: Function },
  a: string,
  b: string
): Promise<Response | null> {
  const result = await usersAreBlocked(admin, a, b);
  if (result.error) {
    console.error("[blocked] users_are_blocked:", result.error);
    return jsonResponse({ error: "Vérification de blocage indisponible." }, 500);
  }
  if (result.blocked) {
    return jsonResponse({ error: "Tu ne peux pas interagir avec ce joueur." }, 403);
  }
  return null;
}

export async function blockedCounterpartIds(
  admin: { from: Function },
  userId: string
): Promise<Set<string>> {
  const { data, error } = await admin
    .from("user_blocks")
    .select("blocker_id, blocked_id")
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
  if (error) {
    console.error("[blocked] list:", error.message);
    return new Set();
  }
  const ids = new Set<string>();
  for (const row of data ?? []) {
    ids.add(row.blocker_id === userId ? row.blocked_id : row.blocker_id);
  }
  return ids;
}
