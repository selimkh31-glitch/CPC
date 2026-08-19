/** Types de retour des Edge Functions IA (voir supabase/functions/_shared/ai.ts). */

export interface SmartMatchResult {
  clubId: string;
  score: number;
  reason: string;
}

export interface ScoutReport {
  summary: string;
  strengths: string[];
  to_improve: string[];
}
