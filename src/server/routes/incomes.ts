import { Router, Request, Response } from "express";
import { prisma } from "../prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createIncomeTypeSchema,
  updateIncomeTypeSchema,
  createIncomeArticleSchema,
  updateIncomeArticleSchema,
} from "../schemas/income.js";

const router = Router({ mergeParams: true });

router.use(authMiddleware);

async function checkEntityOwnership(entityId: string, userId: string) {
  const entity = await prisma.entity.findUnique({ where: { id: entityId } });
  if (!entity) return { error: 404 as const, message: "Entity not found" };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.companyId || entity.companyId !== user.companyId) {
    return { error: 403 as const, message: "Access denied" };
  }

  return { entity };
}

// ===== INCOME TYPES =====

// GET /api/entities/:entityId/income-types
router.get("/", async (req: Request, res: Response) => {
  try {
    const check = await checkEntityOwnership(req.params.entityId, req.user!.userId);
    if ("error" in check) {
      res.status(check.error).json({ message: check.message });
      return;
    }

    const types = await prisma.incomeType.findMany({
      where: { entityId: req.params.entityId },
      include: { articles: { orderBy: { sortOrder: "asc" } } },
      orderBy: { sortOrder: "asc" },
    });

    res.json(types);
  } catch (error) {
    console.error("List income types error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/entities/:entityId/income-types
router.post("/", validate(createIncomeTypeSchema), async (req: Request, res: Response) => {
  try {
    const check = await checkEntityOwnership(req.params.entityId, req.user!.userId);
    if ("error" in check) {
      res.status(check.error).json({ message: check.message });
      return;
    }

    const type = await prisma.incomeType.create({
      data: {
        name: req.body.name,
        sortOrder: req.body.sortOrder ?? 0,
        entityId: req.params.entityId,
      },
      include: { articles: true },
    });

    res.status(201).json(type);
  } catch (error) {
    console.error("Create income type error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/entities/:entityId/income-types/:typeId
router.put("/:typeId", validate(updateIncomeTypeSchema), async (req: Request, res: Response) => {
  try {
    const check = await checkEntityOwnership(req.params.entityId, req.user!.userId);
    if ("error" in check) {
      res.status(check.error).json({ message: check.message });
      return;
    }

    const type = await prisma.incomeType.findFirst({
      where: { id: req.params.typeId, entityId: req.params.entityId },
    });
    if (!type) {
      res.status(404).json({ message: "Income type not found" });
      return;
    }

    const updated = await prisma.incomeType.update({
      where: { id: req.params.typeId },
      data: req.body,
      include: { articles: { orderBy: { sortOrder: "asc" } } },
    });

    res.json(updated);
  } catch (error) {
    console.error("Update income type error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/entities/:entityId/income-types/:typeId
router.delete("/:typeId", async (req: Request, res: Response) => {
  try {
    const check = await checkEntityOwnership(req.params.entityId, req.user!.userId);
    if ("error" in check) {
      res.status(check.error).json({ message: check.message });
      return;
    }

    const type = await prisma.incomeType.findFirst({
      where: { id: req.params.typeId, entityId: req.params.entityId },
    });
    if (!type) {
      res.status(404).json({ message: "Income type not found" });
      return;
    }

    await prisma.incomeType.delete({ where: { id: req.params.typeId } });
    res.status(204).send();
  } catch (error) {
    console.error("Delete income type error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ===== INCOME ARTICLES =====

// POST /api/entities/:entityId/income-types/:typeId/articles
router.post("/:typeId/articles", validate(createIncomeArticleSchema), async (req: Request, res: Response) => {
  try {
    const check = await checkEntityOwnership(req.params.entityId, req.user!.userId);
    if ("error" in check) {
      res.status(check.error).json({ message: check.message });
      return;
    }

    const type = await prisma.incomeType.findFirst({
      where: { id: req.params.typeId, entityId: req.params.entityId },
    });
    if (!type) {
      res.status(404).json({ message: "Income type not found" });
      return;
    }

    const article = await prisma.incomeArticle.create({
      data: {
        name: req.body.name,
        sortOrder: req.body.sortOrder ?? 0,
        incomeTypeId: req.params.typeId,
      },
    });

    res.status(201).json(article);
  } catch (error) {
    console.error("Create income article error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/entities/:entityId/income-types/:typeId/articles/:articleId
router.put("/:typeId/articles/:articleId", validate(updateIncomeArticleSchema), async (req: Request, res: Response) => {
  try {
    const check = await checkEntityOwnership(req.params.entityId, req.user!.userId);
    if ("error" in check) {
      res.status(check.error).json({ message: check.message });
      return;
    }

    const article = await prisma.incomeArticle.findFirst({
      where: { id: req.params.articleId, incomeTypeId: req.params.typeId },
    });
    if (!article) {
      res.status(404).json({ message: "Income article not found" });
      return;
    }

    const updated = await prisma.incomeArticle.update({
      where: { id: req.params.articleId },
      data: req.body,
    });

    res.json(updated);
  } catch (error) {
    console.error("Update income article error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/entities/:entityId/income-types/:typeId/articles/:articleId
router.delete("/:typeId/articles/:articleId", async (req: Request, res: Response) => {
  try {
    const check = await checkEntityOwnership(req.params.entityId, req.user!.userId);
    if ("error" in check) {
      res.status(check.error).json({ message: check.message });
      return;
    }

    const article = await prisma.incomeArticle.findFirst({
      where: { id: req.params.articleId, incomeTypeId: req.params.typeId },
    });
    if (!article) {
      res.status(404).json({ message: "Income article not found" });
      return;
    }

    await prisma.incomeArticle.delete({ where: { id: req.params.articleId } });
    res.status(204).send();
  } catch (error) {
    console.error("Delete income article error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
