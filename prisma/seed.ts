/**
 * Seed data (section 10) — 30 users, 10 clubs, 5 sessions live, candidatures,
 * reviews, et une saison active avec season_stats. De quoi que le feed et les
 * classements soient vivants dès le premier lancement.
 *
 * NOTE : les users seedés ont un id (uuid) généré localement, PAS un compte
 * Supabase Auth réel — ils servent à peupler le feed/les classements/l'annuaire
 * pour la démo. Pour te connecter et tester en tant que joueur, crée un compte
 * via /login (email/mot de passe) puis termine l'onboarding normalement.
 */

import { PrismaClient, Platform, Position, PlayStyle, ClubLevel, ClubRole, ApplicationStatus } from "@prisma/client";
import { faker } from "@faker-js/faker";
import { computeReliabilityScore, nextStreak } from "../lib/reliability";

const prisma = new PrismaClient();

const PLATFORMS = Object.values(Platform);
const POSITIONS = Object.values(Position);
const PLAY_STYLES = Object.values(PlayStyle);
const LANGUAGE_POOL = ["FR", "EN", "ES", "DE", "PT", "AR", "IT"];

function sample<T>(arr: T[], n: number): T[] {
  return faker.helpers.arrayElements(arr, n);
}

async function main() {
  console.log("🌱 Seed ClubPro Connect — début");

  // --- Users ---------------------------------------------------------------
  const userIds: string[] = [];
  for (let i = 0; i < 30; i++) {
    const id = faker.string.uuid();
    const mainPosition = faker.helpers.arrayElement(POSITIONS);
    const currentStreak = faker.number.int({ min: 0, max: 15 });

    const user = await prisma.user.create({
      data: {
        id,
        username: faker.internet.username().replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 20) + faker.number.int(99),
        platform: faker.helpers.arrayElement(PLATFORMS),
        mainPosition,
        secondaryPositions: sample(
          POSITIONS.filter((p) => p !== mainPosition),
          faker.number.int({ min: 0, max: 2 })
        ),
        playStyle: faker.helpers.arrayElement(PLAY_STYLES),
        languages: sample(LANGUAGE_POOL, faker.number.int({ min: 1, max: 3 })),
        availability: { slots: sample(["weekday_evening", "weekend", "daytime", "late_night"], 2) },
        currentStreak,
        bestStreak: currentStreak + faker.number.int({ min: 0, max: 10 }),
        plan: faker.helpers.weightedArrayElement([
          { value: "FREE", weight: 8 },
          { value: "PRO", weight: 2 },
        ]),
        badges: currentStreak >= 10 ? ["streak_10"] : currentStreak >= 5 ? ["streak_5"] : [],
      },
    });
    userIds.push(user.id);
  }
  console.log(`✅ ${userIds.length} users créés`);

  // --- Clubs -----------------------------------------------------------------
  const clubIds: string[] = [];
  for (let i = 0; i < 10; i++) {
    const ownerId = userIds[i];
    const club = await prisma.club.create({
      data: {
        name: `${faker.word.adjective({ length: { min: 4, max: 9 } })} ${faker.word.noun({ length: { min: 4, max: 9 } })}`.replace(
          /^./,
          (c) => c.toUpperCase()
        ),
        ownerId,
        level: faker.helpers.arrayElement(Object.values(ClubLevel)),
        description: faker.lorem.sentence({ min: 8, max: 18 }),
        languages: sample(LANGUAGE_POOL, faker.number.int({ min: 1, max: 2 })),
        members: { create: { userId: ownerId, role: ClubRole.OWNER } },
      },
    });
    clubIds.push(club.id);

    // 3-8 membres additionnels par club.
    const memberCount = faker.number.int({ min: 3, max: 8 });
    const potentialMembers = faker.helpers.arrayElements(
      userIds.filter((id) => id !== ownerId),
      memberCount
    );
    for (const userId of potentialMembers) {
      await prisma.clubMember.upsert({
        where: { clubId_userId: { clubId: club.id, userId } },
        create: { clubId: club.id, userId, role: ClubRole.MEMBER },
        update: {},
      });
    }
  }
  console.log(`✅ ${clubIds.length} clubs créés`);

  // --- Sessions live -----------------------------------------------------------
  const liveClubIds = faker.helpers.arrayElements(clubIds, 5);
  const sessionIds: string[] = [];
  for (const clubId of liveClubIds) {
    const session = await prisma.clubSession.create({
      data: {
        clubId,
        isLive: true,
        neededPositions: sample(POSITIONS, faker.number.int({ min: 1, max: 3 })),
        note: faker.helpers.maybe(() => faker.lorem.sentence({ min: 4, max: 10 }), { probability: 0.6 }) ?? null,
      },
    });
    sessionIds.push(session.id);
  }
  console.log(`✅ ${sessionIds.length} sessions live créées`);

  // --- Applications --------------------------------------------------------
  for (const sessionId of sessionIds) {
    const session = await prisma.clubSession.findUniqueOrThrow({ where: { id: sessionId } });
    const applicants = faker.helpers.arrayElements(userIds, faker.number.int({ min: 1, max: 4 }));
    for (const userId of applicants) {
      await prisma.application.create({
        data: {
          userId,
          clubId: session.clubId,
          sessionId,
          position: faker.helpers.arrayElement(session.neededPositions),
          status: faker.helpers.arrayElement(Object.values(ApplicationStatus)),
          message: faker.helpers.maybe(() => faker.lorem.sentence({ min: 3, max: 8 }), { probability: 0.5 }) ?? null,
        },
      });
    }
  }
  console.log("✅ candidatures créées");

  // --- Reviews + recalcul reliability_score ---------------------------------
  for (const targetUserId of userIds) {
    const reviewers = faker.helpers.arrayElements(
      userIds.filter((id) => id !== targetUserId),
      faker.number.int({ min: 0, max: 6 })
    );
    const reviewsData: Array<{ ratingSkill: number; ratingBehavior: number; showedUp: boolean }> = [];
    for (const reviewerId of reviewers) {
      const showedUp = faker.datatype.boolean({ probability: 0.8 });
      const data = {
        ratingSkill: faker.number.int({ min: 2, max: 5 }),
        ratingBehavior: faker.number.int({ min: 2, max: 5 }),
        showedUp,
      };
      reviewsData.push(data);
      await prisma.review.create({
        data: {
          reviewerId,
          targetUserId,
          ...data,
          comment: faker.helpers.maybe(() => faker.lorem.sentence({ min: 4, max: 12 }), { probability: 0.4 }) ?? null,
        },
      });
    }

    if (reviewsData.length > 0) {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: targetUserId } });
      let streak = user.currentStreak;
      for (const r of reviewsData) streak = nextStreak(streak, r.showedUp);
      const reliabilityScore = computeReliabilityScore({
        reviews: reviewsData,
        currentStreak: streak,
        verifiedStats: null,
      });
      await prisma.user.update({ where: { id: targetUserId }, data: { reliabilityScore } });
    }
  }
  console.log("✅ reviews créées + reliability_score recalculé");

  // --- Saison active + season_stats -------------------------------------------
  const season = await prisma.season.create({
    data: {
      name: "Saison 1 — Été 2026",
      startsAt: faker.date.recent({ days: 20 }),
      endsAt: faker.date.soon({ days: 20 }),
      isActive: true,
    },
  });

  for (const userId of userIds) {
    const goals = faker.number.int({ min: 0, max: 25 });
    const assists = faker.number.int({ min: 0, max: 18 });
    const cleanSheets = faker.number.int({ min: 0, max: 10 });
    const matchesPlayed = faker.number.int({ min: 1, max: 30 });
    const mvpCount = faker.number.int({ min: 0, max: 6 });
    const points = goals * 4 + assists * 3 + cleanSheets * 2 + mvpCount * 5;

    await prisma.seasonStat.create({
      data: {
        seasonId: season.id,
        userId,
        goals,
        assists,
        cleanSheets,
        matchesPlayed,
        mvpCount,
        points,
        division: faker.number.int({ min: 1, max: 5 }),
      },
    });
  }
  console.log("✅ saison active + season_stats créées");

  console.log("🌱 Seed terminé avec succès.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
