/** Lecture d'env Deno (Edge) ou Node (hop / tests tsx). */

export function readEnv(key: string): string | undefined {
  const deno = (globalThis as { Deno?: { env?: { get?: (k: string) => string | undefined } } }).Deno;
  const fromDeno = deno?.env?.get?.(key);
  if (fromDeno !== undefined) return fromDeno;
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env?.[key];
}

export function isDenoRuntime(): boolean {
  return typeof (globalThis as { Deno?: unknown }).Deno !== "undefined";
}

export function isNodeRuntime(): boolean {
  const proc = (globalThis as { process?: { versions?: { node?: string } } }).process;
  return Boolean(proc?.versions?.node);
}
