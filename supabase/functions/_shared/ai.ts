/**
 * Provider IA unique — toute feature IA passe par `completeJson()`. Pour
 * changer de modèle/fournisseur, ne modifie que ce fichier. Porté depuis
 * lib/ai/ (version Next.js). SERVEUR UNIQUEMENT (Edge Function), clé jamais
 * exposée à l'app mobile.
 */

export const FEATURE_AI = Deno.env.get("FEATURE_AI") !== "false";

interface CompleteJsonOptions {
  system: string;
  prompt: string;
  maxTokens?: number;
}

export async function completeJson<T>({ system, prompt, maxTokens = 512 }: CompleteJsonOptions): Promise<T> {
  const apiKey = Deno.env.get("AI_API_KEY");
  if (!FEATURE_AI) throw new Error("Feature IA désactivée (FEATURE_AI=false)");
  if (!apiKey || apiKey === "sk-placeholder") throw new Error("AI_API_KEY non configurée");

  const baseUrl = Deno.env.get("AI_API_BASE_URL") ?? "https://api.anthropic.com";
  const model = Deno.env.get("AI_MODEL") ?? "claude-sonnet-4-5";

  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: `${system}\n\nRéponds UNIQUEMENT avec un JSON valide, sans texte autour.`,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`Provider IA a répondu ${res.status}`);
  const data = await res.json();
  const text = data?.content?.[0]?.text ?? "{}";
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Réponse IA non parsable en JSON");
  }
}

// --- Prompts versionnés -----------------------------------------------------

export const SMART_MATCH_PROMPT_V1 = {
  system:
    "Tu es le moteur de matchmaking de ClubPro Connect, une app mobile pour joueurs EA SPORTS FC Pro Clubs. " +
    "Tu reçois le profil d'un joueur et une liste de clubs actuellement live. " +
    "Pour CHAQUE club, calcule un score de compatibilité de 0 à 100 basé sur : poste manquant couvert par le joueur, " +
    "niveau du club vs. niveau du joueur, langue commune, disponibilité, style de jeu, fiabilité du club/joueur. " +
    'Réponds avec un JSON strictement de la forme {"matches":[{"clubId":"...","score":0-100,"reason":"une phrase courte en français"}]}.',
  buildPrompt: (player: unknown, clubs: unknown) =>
    `Profil joueur:\n${JSON.stringify(player)}\n\nClubs live:\n${JSON.stringify(clubs)}`,
};

export const SCOUT_REPORT_PROMPT_V1 = {
  system:
    "Tu es un scout e-sport pour ClubPro Connect. Tu reçois les reviews récentes et les stats vérifiées EA " +
    "d'un joueur de Pro Clubs. Génère un mini-résumé de performance hebdomadaire, factuel et bienveillant, en français. " +
    'Réponds avec un JSON strictement de la forme {"summary":"2-3 phrases","strengths":["..."],"to_improve":["..."]}.',
  buildPrompt: (reviews: unknown, stats: unknown) =>
    `Reviews récentes:\n${JSON.stringify(reviews)}\n\nStats vérifiées:\n${JSON.stringify(stats)}`,
};

export const MODERATION_PROMPT_V1 = {
  system:
    "Tu es un modérateur léger pour ClubPro Connect. Tu reçois un texte (message ou commentaire de review) " +
    "et tu dois détecter s'il contient de la toxicité (insultes, harcèlement, discrimination). " +
    'Réponds avec un JSON strictement de la forme {"toxic":true|false,"reason":"courte explication ou null","severity":"low"|"medium"|"high"|null}.',
  buildPrompt: (text: string) => `Texte à modérer:\n"""${text}"""`,
};

// --- Fonctions haut-niveau avec fallback déterministe -----------------------

export interface SmartMatchResult {
  clubId: string;
  score: number;
  reason: string;
}

function fallbackSmartMatch(player: any, clubs: any[]): SmartMatchResult[] {
  return clubs
    .map((club) => {
      let score = 40;
      const reasons: string[] = [];
      const needsPlayerPosition =
        club.neededPositions?.includes(player.mainPosition) ||
        player.secondaryPositions?.some((p: string) => club.neededPositions?.includes(p));
      if (needsPlayerPosition) {
        score += 30;
        reasons.push("cherche ton poste");
      }
      const sharedLanguage = player.languages?.some((l: string) => club.languages?.includes(l));
      if (sharedLanguage) {
        score += 15;
        reasons.push("langue commune");
      }
      if (club.level === "COMPETITIVE" && player.reliabilityScore >= 60) {
        score += 10;
        reasons.push("niveau compétitif adapté");
      } else if (club.level === "CASUAL") {
        score += 5;
      }
      return {
        clubId: club.id,
        score: Math.min(100, score),
        reason: reasons.length ? `Ce club ${reasons.join(", ")}.` : "Compatibilité de base.",
      };
    })
    .sort((a, b) => b.score - a.score);
}

export async function computeSmartMatch(player: any, clubs: any[]): Promise<SmartMatchResult[]> {
  if (!FEATURE_AI || clubs.length === 0) return fallbackSmartMatch(player, clubs);
  try {
    const result = await completeJson<{ matches: SmartMatchResult[] }>({
      system: SMART_MATCH_PROMPT_V1.system,
      prompt: SMART_MATCH_PROMPT_V1.buildPrompt(player, clubs),
    });
    if (!result?.matches?.length) return fallbackSmartMatch(player, clubs);
    return result.matches.sort((a, b) => b.score - a.score);
  } catch (err) {
    console.warn("[ai] Smart Match a échoué, fallback déterministe:", err);
    return fallbackSmartMatch(player, clubs);
  }
}

export interface ScoutReport {
  summary: string;
  strengths: string[];
  to_improve: string[];
}

function fallbackScoutReport(reviews: any[], stats: any): ScoutReport {
  const positive = reviews.filter((r) => r.showedUp ?? r.showed_up).length;
  return {
    summary:
      reviews.length > 0
        ? `${positive}/${reviews.length} sessions honorées récemment. Continue comme ça.`
        : "Pas encore assez de données pour un rapport détaillé.",
    strengths: (stats?.goals ?? 0) > (stats?.assists ?? 0) ? ["Finition"] : ["Vision de jeu"],
    to_improve: ["Régularité des présences"],
  };
}

export async function generateScoutReport(reviews: any[], stats: any): Promise<ScoutReport> {
  if (!FEATURE_AI) return fallbackScoutReport(reviews, stats);
  try {
    return await completeJson<ScoutReport>({
      system: SCOUT_REPORT_PROMPT_V1.system,
      prompt: SCOUT_REPORT_PROMPT_V1.buildPrompt(reviews, stats),
    });
  } catch (err) {
    console.warn("[ai] Scout Report a échoué, fallback:", err);
    return fallbackScoutReport(reviews, stats);
  }
}

export interface ModerationResult {
  toxic: boolean;
  reason: string | null;
  severity: "low" | "medium" | "high" | null;
}

const BASIC_BLOCKLIST = ["idiot", "connard", "pute", "nazi", "raciste"];

function fallbackModeration(text: string): ModerationResult {
  const lower = text.toLowerCase();
  const hit = BASIC_BLOCKLIST.find((w) => lower.includes(w));
  return hit
    ? { toxic: true, reason: `Terme signalé: "${hit}"`, severity: "medium" }
    : { toxic: false, reason: null, severity: null };
}

export async function moderateText(text: string): Promise<ModerationResult> {
  if (!FEATURE_AI) return fallbackModeration(text);
  try {
    return await completeJson<ModerationResult>({
      system: MODERATION_PROMPT_V1.system,
      prompt: MODERATION_PROMPT_V1.buildPrompt(text),
    });
  } catch (err) {
    console.warn("[ai] Modération a échoué, fallback blocklist:", err);
    return fallbackModeration(text);
  }
}
