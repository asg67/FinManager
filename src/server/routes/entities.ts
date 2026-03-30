import { Router, Request, Response } from "express";
import { prisma } from "../prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createEntitySchema, updateEntitySchema } from "../schemas/entity.js";
import { seedEntityAccounts } from "../helpers/seedAccounts.js";
import { buildEntityFilter, checkEntityAccess } from "../helpers/entityAccess.js";

const router = Router();

// All routes require auth
router.use(authMiddleware);

// GET /api/entities — list entities for current user
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const filter = await buildEntityFilter(userId);

    const entities = await prisma.entity.findMany({
      where: filter,
      include: { _count: { select: { accounts: true } } },
      orderBy: { createdAt: "asc" },
    });

    res.json(entities);
  } catch (error) {
    console.error("List entities error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/entities/:id — get single entity
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const check = await checkEntityAccess(req.params.id, req.user!.userId);
    if ("error" in check) {
      res.status(check.error).json({ message: check.message });
      return;
    }

    const entity = await prisma.entity.findUnique({
      where: { id: req.params.id },
      include: {
        accounts: { orderBy: { createdAt: "asc" } },
        expenseTypes: {
          orderBy: { sortOrder: "asc" },
          include: { articles: { orderBy: { sortOrder: "asc" }, include: { directions: { orderBy: { sortOrder: "asc" } } } } },
        },
      },
    });

    res.json(entity);
  } catch (error) {
    console.error("Get entity error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/entities — create entity
router.post("/", validate(createEntitySchema), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });

    // In company mode, only owners can create entities
    if (user?.companyId && req.user!.role !== "owner") {
      res.status(403).json({ message: "Only owners can create entities" });
      return;
    }

    const entity = await prisma.entity.create({
      data: {
        name: req.body.name,
        ownerId: req.user!.userId,
        companyId: user?.companyId || null,
      },
    });
    await seedEntityAccounts(entity.id);

    // Auto-create EntityAccess for the creator
    if (user?.companyId) {
      await prisma.entityAccess.create({
        data: { userId: req.user!.userId, entityId: entity.id },
      });
    }

    res.status(201).json(entity);
  } catch (error) {
    console.error("Create entity error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/entities/:id — update entity (owner only)
router.put("/:id", validate(updateEntitySchema), async (req: Request, res: Response) => {
  try {
    const entity = await prisma.entity.findUnique({
      where: { id: req.params.id },
    });

    if (!entity) {
      res.status(404).json({ message: "Entity not found" });
      return;
    }

    if (entity.ownerId !== req.user!.userId) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    const updated = await prisma.entity.update({
      where: { id: req.params.id },
      data: { name: req.body.name },
    });

    res.json(updated);
  } catch (error) {
    console.error("Update entity error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/entities/:id — delete entity (owner only)
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const entity = await prisma.entity.findUnique({
      where: { id: req.params.id },
    });

    if (!entity) {
      res.status(404).json({ message: "Entity not found" });
      return;
    }

    if (entity.ownerId !== req.user!.userId) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    await prisma.entity.delete({ where: { id: req.params.id } });

    res.status(204).send();
  } catch (error) {
    console.error("Delete entity error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
