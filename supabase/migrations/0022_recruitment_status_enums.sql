-- ==============================================================================
-- P1 — nouveaux états de recrutement (enum only).
-- ADD VALUE est commité ici, PUIS utilisé dans 0023 (PG : une nouvelle
-- valeur d'enum n'est pas utilisable dans la même transaction).
-- ==============================================================================

alter type "ApplicationStatus" add value if not exists 'DECLINED';
alter type "ApplicationStatus" add value if not exists 'CANCELLED';
alter type "ApplicationStatus" add value if not exists 'EXPIRED';

alter type "InvitationStatus" add value if not exists 'EXPIRED';
