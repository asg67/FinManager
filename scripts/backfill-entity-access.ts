/**
 * One-time script to backfill EntityAccess records for existing entities.
 * Creates EntityAccess for entity owners who don't have explicit access records.
 * Also creates EntityAccess for company members to entities matching their lastName.
 *
 * Run: npx tsx scripts/backfill-entity-access.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting EntityAccess backfill...\n");

  // 1. All company entities with their owners
  const entities = await prisma.entity.findMany({
    where: { companyId: { not: null } },
    select: { id: true, name: true, ownerId: true, companyId: true },
  });

  let created = 0;

  for (const entity of entities) {
    // Ensure owner has EntityAccess
    if (entity.ownerId) {
      const existing = await prisma.entityAccess.findUnique({
        where: { userId_entityId: { userId: entity.ownerId, entityId: entity.id } },
      });
      if (!existing) {
        await prisma.entityAccess.create({
          data: { userId: entity.ownerId, entityId: entity.id },
        });
        console.log(`  + Owner access: entity "${entity.name}" → user ${entity.ownerId}`);
        created++;
      }
    }
  }

  // 2. For company members without EntityAccess, match by lastName
  const members = await prisma.user.findMany({
    where: { companyId: { not: null }, role: { not: "owner" } },
    select: { id: true, name: true, companyId: true },
  });

  for (const member of members) {
    const accessCount = await prisma.entityAccess.count({ where: { userId: member.id } });
    if (accessCount > 0) continue; // Already has access, skip

    const lastName = member.name?.split(" ")[0];
    if (!lastName || lastName.length < 2) continue;

    const matchingEntities = await prisma.entity.findMany({
      where: {
        companyId: member.companyId!,
        name: { contains: lastName, mode: "insensitive" },
      },
      select: { id: true, name: true },
    });

    for (const entity of matchingEntities) {
      const existing = await prisma.entityAccess.findUnique({
        where: { userId_entityId: { userId: member.id, entityId: entity.id } },
      });
      if (!existing) {
        await prisma.entityAccess.create({
          data: { userId: member.id, entityId: entity.id },
        });
        console.log(`  + Name match: entity "${entity.name}" → member "${member.name}"`);
        created++;
      }
    }
  }

  // 3. Give company owners access to ALL company entities
  const owners = await prisma.user.findMany({
    where: { role: "owner", companyId: { not: null } },
    select: { id: true, name: true, companyId: true },
  });

  for (const owner of owners) {
    const companyEntities = await prisma.entity.findMany({
      where: { companyId: owner.companyId! },
      select: { id: true, name: true },
    });

    for (const entity of companyEntities) {
      const existing = await prisma.entityAccess.findUnique({
        where: { userId_entityId: { userId: owner.id, entityId: entity.id } },
      });
      if (!existing) {
        await prisma.entityAccess.create({
          data: { userId: owner.id, entityId: entity.id },
        });
        console.log(`  + Owner all: entity "${entity.name}" → owner "${owner.name}"`);
        created++;
      }
    }
  }

  console.log(`\nDone! Created ${created} EntityAccess records.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
