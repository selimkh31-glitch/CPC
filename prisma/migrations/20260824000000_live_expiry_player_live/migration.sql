-- P0 LIVE expiry (club + joueur) + unique PENDING applications.
--
-- IMPORTANT — SUPERSEDÉ pour l'application distante (Option B) : ne PAS
-- appliquer via `prisma migrate deploy` sur le projet Supabase distant.
-- Le DDL canonique appliqué est supabase/migrations/0021_live_expiry_player_live.sql.
-- Ce fichier reste pour la continuité Prisma locale (schema.prisma sync).

ALTER TABLE "club_sessions" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "player_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "is_live" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_sessions_pkey" PRIMARY KEY ("id")
);
