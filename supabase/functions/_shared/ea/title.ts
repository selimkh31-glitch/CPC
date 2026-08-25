/**
 * Titre EA FC (Pro Clubs). CPC produit = FC 27. Les stats Pro Clubs
 * repartent à zéro à chaque titre : ne jamais mélanger un snapshot live
 * (aujourd'hui encore l'ancien titre derrière /api/fc) dans le ledger fc27.
 *
 * Cutover The Grounds (25 Sep 2026) : poser EA_FC_TITLE=fc27 (et
 * EA_FC_BASE_URL si l'origine /api/fc change). Pas de bascule auto à la date.
 */
import { readEnv } from "./env.ts";

/** Ledger produit CPC — jour 1 vide jusqu'à ce que le live soit fc27. */
export const PRODUCT_EA_TITLE = "fc27";

/** /api/fc live avant The Grounds — ne pas écrire ça dans le ledger produit. */
export const DEFAULT_LIVE_EA_TITLE = "fc26";

export const DEFAULT_EA_FC_BASE_URL = "https://proclubs.ea.com/api/fc";

const TITLE_RE = /^fc[0-9]{2}$/;

export function parseEaFcTitle(raw: string | undefined | null): string {
  const v = (raw ?? "").trim().toLowerCase();
  if (TITLE_RE.test(v)) return v;
  return DEFAULT_LIVE_EA_TITLE;
}

/** Titre que représente le JSON live /api/fc (env EA_FC_TITLE). */
export function getLiveEaTitle(): string {
  return parseEaFcTitle(readEnv("EA_FC_TITLE"));
}

export function writesToProductLedger(liveTitle: string = getLiveEaTitle()): boolean {
  return liveTitle === PRODUCT_EA_TITLE;
}

/**
 * Origine HTTP swappable. Interdit /api/fifa. Clubs Pro : /api/fc ou /api/fcNN.
 */
export function resolveEaFcBaseUrl(raw?: string | null): string {
  const source = (raw ?? readEnv("EA_FC_BASE_URL") ?? DEFAULT_EA_FC_BASE_URL).trim();
  const url = source.replace(/\/+$/, "");
  if (!/^https:\/\//i.test(url)) {
    throw new Error("EA_FC_BASE_URL doit être https");
  }
  if (/\/api\/fifa(\/|$)/i.test(url)) {
    throw new Error("EA_FC_BASE_URL /api/fifa interdit — Clubs Pro /api/fc seulement");
  }
  if (!/\/api\/fc(\d+)?$/i.test(url)) {
    throw new Error("EA_FC_BASE_URL doit rester une origine /api/fc (swappable, pas une autre famille)");
  }
  return url;
}

export function getEaFcBaseUrl(): string {
  return resolveEaFcBaseUrl();
}
