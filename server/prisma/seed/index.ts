import { prisma } from '../../src/db/prisma.js';
import { env } from '../../src/config/env.js';
import { hashPassword } from '../../src/lib/password.js';
import { Role } from '../../src/generated/prisma/enums.js';
import { achievements } from './data/achievements.js';
import { categories, equipment, muscleGroups } from './data/taxonomy.js';
import { planTemplates } from './data/templates.js';
import { seedExercises } from './exercises.js';
import { seedDemoHistory } from './demo.js';

/**
 * Idempotent seed. Safe to re-run: everything is upserted by slug, so an
 * existing database is updated in place rather than duplicated.
 */
async function main() {
  const started = Date.now();
  console.log('\nSeeding Forge\n');

  // --- Muscle groups (two passes: parents first, then link children) ------
  for (const [index, group] of muscleGroups.entries()) {
    await prisma.muscleGroup.upsert({
      where: { slug: group.slug },
      create: {
        slug: group.slug,
        name: group.name,
        bodyRegion: group.bodyRegion,
        colorHex: group.colorHex,
        sortOrder: index,
      },
      update: { name: group.name, bodyRegion: group.bodyRegion, colorHex: group.colorHex, sortOrder: index },
    });
  }

  const muscleIds = new Map(
    (await prisma.muscleGroup.findMany({ select: { id: true, slug: true } })).map((m) => [m.slug, m.id]),
  );

  for (const group of muscleGroups) {
    if (!group.parent) continue;
    const parentId = muscleIds.get(group.parent);
    if (parentId) await prisma.muscleGroup.update({ where: { slug: group.slug }, data: { parentId } });
  }
  console.log(`  muscle groups      ${muscleGroups.length}`);

  // --- Equipment ----------------------------------------------------------
  for (const [index, item] of equipment.entries()) {
    await prisma.equipment.upsert({
      where: { slug: item.slug },
      create: { ...item, sortOrder: index },
      update: { ...item, sortOrder: index },
    });
  }
  const equipmentIds = new Map(
    (await prisma.equipment.findMany({ select: { id: true, slug: true } })).map((e) => [e.slug, e.id]),
  );
  console.log(`  equipment          ${equipment.length}`);

  // --- Categories ---------------------------------------------------------
  for (const [index, item] of categories.entries()) {
    await prisma.exerciseCategory.upsert({
      where: { slug: item.slug },
      create: { ...item, sortOrder: index },
      update: { ...item, sortOrder: index },
    });
  }
  const categoryIds = new Map(
    (await prisma.exerciseCategory.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]),
  );
  console.log(`  categories         ${categories.length}`);

  // --- Exercise library ---------------------------------------------------
  const result = await seedExercises({
    muscles: muscleIds,
    equipment: equipmentIds,
    categories: categoryIds,
  });
  console.log(
    `  exercises          ${result.total} (${result.created} new, ${result.updated} updated, ${result.fromDataset} from public-domain dataset)`,
  );

  // --- Achievements -------------------------------------------------------
  for (const [index, achievement] of achievements.entries()) {
    await prisma.achievement.upsert({
      where: { slug: achievement.slug },
      create: { ...achievement, sortOrder: index },
      update: { ...achievement, sortOrder: index },
    });
  }
  console.log(`  achievements       ${achievements.length}`);

  // --- Plan templates ----------------------------------------------------
  for (const template of planTemplates) {
    const { structure, ...rest } = template;
    await prisma.planTemplate.upsert({
      where: { slug: template.slug },
      create: { ...rest, structure: structure as never },
      update: { ...rest, structure: structure as never },
    });
  }
  console.log(`  plan templates     ${planTemplates.length}`);

  // --- Accounts -----------------------------------------------------------
  const admin = await prisma.user.upsert({
    where: { email: env.SEED_ADMIN_EMAIL },
    create: {
      email: env.SEED_ADMIN_EMAIL,
      name: 'Forge Admin',
      passwordHash: await hashPassword(env.SEED_ADMIN_PASSWORD),
      role: Role.ADMIN,
      onboardedAt: new Date(),
      notificationPrefs: { create: {} },
    },
    update: { role: Role.ADMIN },
  });

  const demo = await prisma.user.upsert({
    where: { email: env.SEED_DEMO_EMAIL },
    create: {
      email: env.SEED_DEMO_EMAIL,
      name: 'Alex',
      passwordHash: await hashPassword(env.SEED_DEMO_PASSWORD),
      onboardedAt: new Date(),
      notificationPrefs: { create: {} },
    },
    update: {},
  });
  console.log(`  accounts           admin=${admin.email} demo=${demo.email}`);

  // --- Demo plan + history so the app is not empty on first login --------
  const demoSummary = await seedDemoHistory(demo.id);
  console.log(`  demo history       ${demoSummary.sessions} sessions, ${demoSummary.sets} sets`);

  console.log(`\nDone in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
  console.log(`  Sign in as  ${env.SEED_DEMO_EMAIL} / ${env.SEED_DEMO_PASSWORD}`);
  console.log(`  Admin       ${env.SEED_ADMIN_EMAIL} / ${env.SEED_ADMIN_PASSWORD}\n`);
}

main()
  .catch((err) => {
    console.error('\nSeed failed:\n', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
