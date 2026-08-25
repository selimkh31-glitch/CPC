/**
 * Filtres UI du feed LIVE joueur — affichage uniquement.
 * Ne change pas le moteur de matching (poste + plateforme + TTL + besoin).
 */

export interface LiveFiltersState {
  position: string;
  level: string;
  language: string;
  platform: string;
}

export const EMPTY_LIVE_FILTERS: LiveFiltersState = {
  position: "",
  level: "",
  language: "",
  platform: "",
};

export function liveFiltersAreEmpty(filters: LiveFiltersState): boolean {
  return !filters.position && !filters.level && !filters.language && !filters.platform;
}

/**
 * Élargit d'un cran, du plus secondaire au plus structurant :
 * langue → niveau → plateforme → poste.
 * Ne fabrique aucun club : le caller réapplique simplement le modèle existant.
 */
export function widenLiveFilters(filters: LiveFiltersState): LiveFiltersState {
  if (filters.language) return { ...filters, language: "" };
  if (filters.level) return { ...filters, level: "" };
  if (filters.platform) return { ...filters, platform: "" };
  if (filters.position) return { ...filters, position: "" };
  return filters;
}

export function canWidenLiveFilters(filters: LiveFiltersState): boolean {
  return !liveFiltersAreEmpty(filters);
}

/** Même prédicat que l'ancien Live Feed joueur — aucun critère ajouté. */
export function clubSessionMatchesLiveFilters(
  item: {
    needed_positions: string[];
    club?: {
      level?: string;
      languages?: string[];
      owner?: { platform?: string | null } | null;
    } | null;
  },
  filters: LiveFiltersState
): boolean {
  if (!item.club) return false;
  if ((item.needed_positions?.length ?? 0) === 0) return false;
  if (filters.position && !item.needed_positions.includes(filters.position)) return false;
  if (filters.platform && item.club.owner?.platform !== filters.platform) return false;
  if (filters.level && item.club.level !== filters.level) return false;
  if (filters.language && !(item.club.languages ?? []).includes(filters.language)) return false;
  return true;
}
