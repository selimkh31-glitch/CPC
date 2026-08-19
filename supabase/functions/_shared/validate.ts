/**
 * Validation d'entrée minimale, partagée par les Edge Functions. Les bornes
 * côté client (maxLength, ChipSelect...) sont un confort UX, pas une garantie :
 * n'importe qui peut appeler ces fonctions directement avec le bearer token
 * d'un compte légitime. Ces vérifications sont donc la source de vérité.
 */

export class ValidationError extends Error {}

export function requireString(value: unknown, field: string, opts: { min?: number; max?: number } = {}): string {
  if (typeof value !== "string") throw new ValidationError(`${field} doit être une chaîne.`);
  const trimmed = value.trim();
  if (opts.min !== undefined && trimmed.length < opts.min) {
    throw new ValidationError(`${field} doit contenir au moins ${opts.min} caractère(s).`);
  }
  if (opts.max !== undefined && trimmed.length > opts.max) {
    throw new ValidationError(`${field} doit contenir au plus ${opts.max} caractères.`);
  }
  return trimmed;
}

export function optionalString(value: unknown, field: string, opts: { max?: number } = {}): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requireString(value, field, { max: opts.max });
}

export function requireUuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new ValidationError(`${field} doit être un uuid valide.`);
  }
  return value;
}

export function requireIntInRange(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new ValidationError(`${field} doit être un entier entre ${min} et ${max}.`);
  }
  return value;
}

export function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new ValidationError(`${field} doit être un booléen.`);
  return value;
}

export function requireEnum<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new ValidationError(`${field} doit être l'une des valeurs : ${allowed.join(", ")}.`);
  }
  return value as T;
}
