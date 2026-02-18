import { Router, Request, Response } from "express";
import { prisma } from "../prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createExpenseTypeSchema,
  updateExpenseTypeSchema,
  createExpenseArticleSchema,
  updateExpenseArticleSchema,
} from "../schemas/expense.js";

const router = Router({ mergeParams: true });

router.use(authMiddleware);

async function checkEntityOwnership(entityId: string, userId: string) {
  const entity = await prisma.entity.findUnique({ where: { id: entityId } });
  if (!entity) return { error: 404 as const, message: "Entity not found" };
  if (entity.ownerId !== userId) return { error: 403 as const, message: "Access denied" };
  return { entity };
}

// ===== EXPENSE TYPES =====

// GET /api/entities/:entityId/expense-types
router.get("/", async (req: Request, res: Response) => {
  try {
    const check = await checkEntityOwnership(req.params.entityId, req.user!.userId);
    if ("error" in check) {
      res.status(check.error).json({ message: check.message });
      return;
    }

    const types = await prisma.expenseType.findMany({
      where: { entityId: req.params.entityId },
      include: { articles: { orderBy: { sortOrder: "asc" } } },
      orderBy: { sortOrder: "asc" },
    });

    res.json(types);
  } catch (error) {
    console.error("List expense types error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/entities/:entityId/expense-types
router.post("/", validate(createExpenseTypeSchema), async (req: Request, res: Response) => {
  try {
    const check = await checkEntityOwnership(req.params.entityId, req.user!.userId);
    if ("error" in check) {
      res.status(check.error).json({ message: check.message });
      return;
    }

    const type = await prisma.expenseType.create({
      data: {
        name: req.body.name,
        sortOrder: req.body.sortOrder ?? 0,
        entityId: req.params.entityId,
      },
      include: { articles: true },
    });

    res.status(201).json(type);
  } catch (error) {
    console.error("Create expense type error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/entities/:entityId/expense-types/:typeId
router.put("/:typeId", validate(updateExpenseTypeSchema), async (req: Request, res: Response) => {
  try {
    const check = await checkEntityOwnership(req.params.entityId, req.user!.userId);
    if ("error" in check) {
      res.status(check.error).json({ message: check.message });
      return;
    }

    const type = await prisma.expenseType.findFirst({
      where: { id: req.params.typeId, entityId: req.params.entityId },
    });
    if (!type) {
      res.status(404).json({ message: "Expense type not found" });
      return;
    }

    const updated = await prisma.expenseType.update({
      where: { id: req.params.typeId },
      data: req.body,
      include: { articles: { orderBy: { sortOrder: "asc" } } },
    });

    res.json(updated);
  } catch (error) {
    console.error("Update expense type error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/entities/:entityId/expense-types/:typeId
router.delete("/:typeId", async (req: Request, res: Response) => {
  try {
    const check = await checkEntityOwnership(req.params.entityId, req.user!.userId);
    if ("error" in check) {
      res.status(check.error).json({ message: check.message });
      return;
    }

    const type = await prisma.expenseType.findFirst({
      where: { id: req.params.typeId, entityId: req.params.entityId },
    });
    if (!type) {
      res.status(404).json({ message: "Expense type not found" });
      return;
    }

    await prisma.expenseType.delete({ where: { id: req.params.typeId } });
    res.status(204).send();
  } catch (error) {
    console.error("Delete expense type error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ===== EXPENSE ARTICLES =====

// POST /api/entities/:entityId/expense-types/:typeId/articles
router.post("/:typeId/articles", validate(createExpenseArticleSchema), async (req: Request, res: Response) => {
  try {
    const check = await checkEntityOwnership(req.params.entityId, req.user!.userId);
    if ("error" in check) {
      res.status(check.error).json({ message: check.message });
      return;
    }

    const type = await prisma.expenseType.findFirst({
      where: { id: req.params.typeId, entityId: req.params.entityId },
    });
    if (!type) {
      res.status(404).json({ message: "Expense type not found" });
      return;
    }

    const article = await prisma.expenseArticle.create({
      data: {
        name: req.body.name,
        sortOrder: req.body.sortOrder ?? 0,
        expenseTypeId: req.params.typeId,
      },
    });

    res.status(201).json(article);
  } catch (error) {
    console.error("Create expense article error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/entities/:entityId/expense-types/:typeId/articles/:articleId
router.put("/:typeId/articles/:articleId", validate(updateExpenseArticleSchema), async (req: Request, res: Response) => {
  try {
    const check = await checkEntityOwnership(req.params.entityId, req.user!.userId);
    if ("error" in check) {
      res.status(check.error).json({ message: check.message });
      return;
    }

    const article = await prisma.expenseArticle.findFirst({
      where: { id: req.params.articleId, expenseTypeId: req.params.typeId },
    });
    if (!article) {
      res.status(404).json({ message: "Expense article not found" });
      return;
    }

    const updated = await prisma.expenseArticle.update({
      where: { id: req.params.articleId },
      data: req.body,
    });

    res.json(updated);
  } catch (error) {
    console.error("Update expense article error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/entities/:entityId/expense-types/:typeId/articles/:articleId
router.delete("/:typeId/articles/:articleId", async (req: Request, res: Response) => {
  try {
    const check = await checkEntityOwnership(req.params.entityId, req.user!.userId);
    if ("error" in check) {
      res.status(check.error).json({ message: check.message });
      return;
    }

    const article = await prisma.expenseArticle.findFirst({
      where: { id: req.params.articleId, expenseTypeId: req.params.typeId },
    });
    if (!article) {
      res.status(404).json({ message: "Expense article not found" });
      return;
    }

    await prisma.expenseArticle.delete({ where: { id: req.params.articleId } });
    res.status(204).send();
  } catch (error) {
    console.error("Delete expense article error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
