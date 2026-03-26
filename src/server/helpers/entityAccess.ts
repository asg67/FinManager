import { prisma } from "../prisma.js";

/**
 * Build a Prisma entity filter for the current user.
 * - No company: personal entities only (ownerId = userId, companyId = null)
 * - Owner role: all company entities
 * - Member role: entities they own OR have explicit EntityAccess to
 */
export async function buildEntityFilter(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { companyId: true, role: true },
  });

  if (!user?.companyId) {
    return { ownerId: userId, companyId: null };
  }

  if (user.role === "owner") {
    return { companyId: user.companyId };
  }

  // Member: entities they own or have explicit access to
  return {
    companyId: user.companyId,
    OR: [
      { ownerId: userId },
      { entityAccess: { some: { userId } } },
    ],
  };
}

/**
 * Check if user has access to a specific entity.
 * Returns { entity } on success, { error, message } on failure.
 */
export async function checkEntityAccess(entityId: string, userId: string) {
  const entity = await prisma.entity.findUnique({ where: { id: entityId } });
  if (!entity) return { error: 404 as const, message: "Entity not found" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { companyId: true, role: true },
  });

  // Personal entity: only owner
  if (entity.companyId === null) {
    if (entity.ownerId === userId) return { entity };
    return { error: 403 as const, message: "Access denied" };
  }

  // Company entity: must be in same company
  if (!user?.companyId || entity.companyId !== user.companyId) {
    return { error: 403 as const, message: "Access denied" };
  }

  // Company owner: full access to all company entities
  if (user.role === "owner") return { entity };

  // Company member: need ownership or explicit EntityAccess
  if (entity.ownerId === userId) return { entity };

  const access = await prisma.entityAccess.findUnique({
    where: { userId_entityId: { userId, entityId } },
  });
  if (access) return { entity };

  return { error: 403 as const, message: "Access denied" };
}
