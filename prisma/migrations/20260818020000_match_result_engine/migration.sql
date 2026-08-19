-- CreateEnum
CREATE TYPE "MatchOutcome" AS ENUM ('WIN', 'DRAW', 'LOSS');

-- CreateTable
-- Note : les deux CHECK ci-dessous (our_score/opponent_score >= 0) sont
-- ajoutés à la main dans ce fichier généré — Prisma 5.22 n'a pas d'attribut
-- déclaratif pour les CHECK constraints, exactement comme les policies RLS et
-- les fonctions SECURITY DEFINER de ce projet vivent entièrement en dehors de
-- schema.prisma (voir supabase/migrations/). Aucune divergence de schéma :
-- Prisma ignore simplement ces deux CHECK, qui restent appliqués en base.
CREATE TABLE "match_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "match_checkin_id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "our_score" INTEGER NOT NULL,
    "opponent_score" INTEGER NOT NULL,
    "outcome" "MatchOutcome" NOT NULL,
    "mvp_user_id" UUID,
    "recorded_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_results_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "match_results_our_score_check" CHECK ("our_score" >= 0),
    CONSTRAINT "match_results_opponent_score_check" CHECK ("opponent_score" >= 0)
);

-- CreateIndex
-- Garantit "au plus un résultat par match_checkin" (règle métier, voir audit
-- Phase A section 3) — la vraie contrainte d'unicité pour cette règle.
CREATE UNIQUE INDEX "match_results_match_checkin_id_key" ON "match_results"("match_checkin_id");

-- CreateIndex
-- Requis par Prisma pour la relation composite 1:1 ci-dessous (redondant avec
-- l'index ci-dessus pris seul, pas une règle métier supplémentaire).
CREATE UNIQUE INDEX "match_results_match_checkin_id_club_id_key" ON "match_results"("match_checkin_id", "club_id");

-- CreateIndex
CREATE INDEX "match_results_club_id_idx" ON "match_results"("club_id");

-- CreateIndex
-- Sur match_checkins (table existante, aucune colonne ajoutée) — nécessaire
-- pour que match_results puisse référencer (match_checkin_id, club_id) en FK
-- composite et garantir au niveau DB que club_id d'un résultat correspond
-- toujours au club réel du check-in référencé.
CREATE UNIQUE INDEX "match_checkins_id_club_id_key" ON "match_checkins"("id", "club_id");

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_match_checkin_id_club_id_fkey" FOREIGN KEY ("match_checkin_id", "club_id") REFERENCES "match_checkins"("id", "club_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_mvp_user_id_fkey" FOREIGN KEY ("mvp_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
-- Déviation volontaire par rapport à launched_by/responded_by (nullable +
-- SET NULL ailleurs dans ce schéma) : décision produit explicite pour
-- match_results — recorded_by ne doit jamais devenir orphelin, RESTRICT
-- empêche la suppression d'un compte OWNER/MANAGER tant qu'un résultat qu'il
-- a validé existe encore.
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
