import { Router, Request, Response } from "express";
import { prisma } from "../prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createOperationSchema,
  updateOperationSchema,
  createTemplateSchema,
  updateTemplateSchema,
} from "../schemas/dds.js";
import { Prisma } from "@prisma/client";

const router = Router();
router.use(authMiddleware);

// ===== OPERATIONS =====

// POST /api/dds/operations
router.post("/operations", validate(createOperationSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { operationType, amount, entityId, fromAccountId, toAccountId, expenseTypeId, expenseArticleId, orderNumber, comment } = req.body;

    // Verify entity belongs to user's company
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const entity = await prisma.entity.findUnique({ where: { id: entityId } });
    if (!entity) {
      res.status(404).json({ message: "Entity not found" });
      return;
    }
    if (!user?.companyId || entity.companyId !== user.companyId) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    const operation = await prisma.ddsOperation.create({
      data: {
        operationType,
        amount: new Prisma.Decimal(amount),
        entityId,
        fromAccountId: fromAccountId ?? null,
        toAccountId: toAccountId ?? null,
        expenseTypeId: expenseTypeId ?? null,
        expenseArticleId: expenseArticleId ?? null,
        orderNumber: orderNumber ?? null,
        comment: comment ?? null,
        userId,
      },
      include: {
        entity: { select: { name: true } },
        fromAccount: { select: { name: true, type: true } },
        toAccount: { select: { name: true, type: true } },
        expenseType: { select: { name: true } },
        expenseArticle: { select: { name: true } },
        user: { select: { name: true } },
      },
    });

    res.status(201).json(operation);
  } catch (error) {
    console.error("Create operation error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/dds/operations
router.get("/operations", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const { entityId, operationType, accountId, from, to, search, page, limit } =
      req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Get user's company
    const user = await prisma.user.findUnique({ where: { id: userId } });

    // Build where clause — all company members see all operations
    const where: Prisma.DdsOperationWhereInput = {};
    if (user?.companyId) {
      where.entity = { companyId: user.companyId };
    } else {
      where.entity = { ownerId: userId };
    }

    if (entityId) where.entityId = entityId;
    if (operationType) where.operationType = operationType;
    if (accountId) {
      where.OR = [{ fromAccountId: accountId }, { toAccountId: accountId }];
    }
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }
    if (search) {
      where.OR = [
        { comment: { contains: search, mode: "insensitive" } },
        { orderNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    const [operations, total] = await Promise.all([
      prisma.ddsOperation.findMany({
        where,
        include: {
          entity: { select: { name: true } },
          fromAccount: { select: { name: true, type: true } },
          toAccount: { select: { name: true, type: true } },
          expenseType: { select: { name: true } },
          expenseArticle: { select: { name: true } },
          user: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.ddsOperation.count({ where }),
    ]);

    res.json({
      data: operations,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error("List operations error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/dds/operations/:id
router.put("/operations/:id", validate(updateOperationSchema), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    const op = await prisma.ddsOperation.findUnique({
      where: { id: req.params.id },
      include: { entity: true },
    });

    if (!op) {
      res.status(404).json({ message: "Operation not found" });
      return;
    }

    if (!user?.companyId || op.entity.companyId !== user.companyId) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    const updated = await prisma.ddsOperation.update({
      where: { id: req.params.id },
      data: req.body,
      include: {
        entity: { select: { name: true } },
        fromAccount: { select: { name: true, type: true } },
        toAccount: { select: { name: true, type: true } },
        expenseType: { select: { name: true } },
        expenseArticle: { select: { name: true } },
        user: { select: { name: true } },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("Update operation error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/dds/operations/:id
router.delete("/operations/:id", async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    const op = await prisma.ddsOperation.findUnique({
      where: { id: req.params.id },
      include: { entity: true },
    });

    if (!op) {
      res.status(404).json({ message: "Operation not found" });
      return;
    }

    if (!user?.companyId || op.entity.companyId !== user.companyId) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    await prisma.ddsOperation.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    console.error("Delete operation error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ===== TEMPLATES =====

// GET /api/dds/templates
router.get("/templates", async (req: Request, res: Response) => {
  try {
    const templates = await prisma.ddsTemplate.findMany({
      where: { userId: req.user!.userId },
      include: {
        entity: { select: { name: true } },
        expenseType: { select: { name: true } },
        expenseArticle: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(templates);
  } catch (error) {
    console.error("List templates error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/dds/templates
router.post("/templates", validate(createTemplateSchema), async (req: Request, res: Response) => {
  try {
    const template = await prisma.ddsTemplate.create({
      data: {
        name: req.body.name,
        operationType: req.body.operationType,
        entityId: req.body.entityId,
        fromAccountId: req.body.fromAccountId ?? null,
        toAccountId: req.body.toAccountId ?? null,
        expenseTypeId: req.body.expenseTypeId ?? null,
        expenseArticleId: req.body.expenseArticleId ?? null,
        userId: req.user!.userId,
      },
    });

    res.status(201).json(template);
  } catch (error) {
    console.error("Create template error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/dds/templates/:id
router.put("/templates/:id", validate(updateTemplateSchema), async (req: Request, res: Response) => {
  try {
    const template = await prisma.ddsTemplate.findUnique({ where: { id: req.params.id } });
    if (!template || template.userId !== req.user!.userId) {
      res.status(404).json({ message: "Template not found" });
      return;
    }

    const updated = await prisma.ddsTemplate.update({
      where: { id: req.params.id },
      data: req.body,
    });

    res.json(updated);
  } catch (error) {
    console.error("Update template error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/dds/templates/:id
router.delete("/templates/:id", async (req: Request, res: Response) => {
  try {
    const template = await prisma.ddsTemplate.findUnique({ where: { id: req.params.id } });
    if (!template || template.userId !== req.user!.userId) {
      res.status(404).json({ message: "Template not found" });
      return;
    }

    await prisma.ddsTemplate.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    console.error("Delete template error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
