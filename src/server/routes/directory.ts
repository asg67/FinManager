import { Router, Request, Response } from "express";
import { prisma } from "../prisma.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

async function getCompanyUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { permission: true },
  });
  if (!user?.companyId) return null;
  return user;
}

async function canEditCheck(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;
  return !!user.companyId;
}

// ===== EXPENSE TYPES =====

router.get("/expense-types", async (req: Request, res: Response) => {
  try {
    const user = await getCompanyUser(req.user!.userId);
    if (!user) { res.status(403).json({ message: "No company" }); return; }

    const types = await prisma.expenseType.findMany({
      where: { OR: [{ companyId: user.companyId! }, { entity: { companyId: user.companyId! } }] },
      include: { articles: { orderBy: { sortOrder: "asc" }, include: { directions: { orderBy: { sortOrder: "asc" } } } } },
      orderBy: { sortOrder: "asc" },
    });
    res.json(types);
  } catch (error) {
    console.error("Directory list expense types error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/expense-types", async (req: Request, res: Response) => {
  try {
    if (!(await canEditCheck(req.user!.userId))) { res.status(403).json({ message: "Access denied" }); return; }
    const user = await getCompanyUser(req.user!.userId);
    if (!user) { res.status(403).json({ message: "No company" }); return; }

    const { name } = req.body;
    if (!name?.trim()) { res.status(400).json({ message: "Name is required" }); return; }

    const company = await prisma.company.findUnique({ where: { id: user.companyId! } });
    if (!company) { res.status(404).json({ message: "Company not found" }); return; }

    let data: { name: string; companyId?: string; entityId?: string };
    if (company.mode === "dds_only") {
      data = { name: name.trim(), companyId: user.companyId! };
    } else {
      const entity = await prisma.entity.findFirst({ where: { companyId: user.companyId! }, orderBy: { createdAt: "asc" } });
      if (!entity) { res.status(400).json({ message: "No entities" }); return; }
      data = { name: name.trim(), entityId: entity.id };
    }

    const type = await prisma.expenseType.create({
      data,
      include: { articles: { include: { directions: true } } },
    });
    res.status(201).json(type);
  } catch (error) {
    console.error("Directory create expense type error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/expense-types/:id", async (req: Request, res: Response) => {
  try {
    if (!(await canEditCheck(req.user!.userId))) { res.status(403).json({ message: "Access denied" }); return; }
    const { name } = req.body;
    if (!name?.trim()) { res.status(400).json({ message: "Name is required" }); return; }

    const id = req.params.id as string;
    const updated = await prisma.expenseType.update({
      where: { id },
      data: { name: name.trim() },
      include: { articles: { orderBy: { sortOrder: "asc" }, include: { directions: { orderBy: { sortOrder: "asc" } } } } },
    });
    res.json(updated);
  } catch (error) {
    console.error("Directory update expense type error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/expense-types/:id", async (req: Request, res: Response) => {
  try {
    if (!(await canEditCheck(req.user!.userId))) { res.status(403).json({ message: "Access denied" }); return; }
    const id = req.params.id as string;
    await prisma.expenseType.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error("Directory delete expense type error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ===== EXPENSE ARTICLES =====

router.post("/expense-types/:typeId/articles", async (req: Request, res: Response) => {
  try {
    if (!(await canEditCheck(req.user!.userId))) { res.status(403).json({ message: "Access denied" }); return; }
    const { name } = req.body;
    if (!name?.trim()) { res.status(400).json({ message: "Name is required" }); return; }

    const typeId = req.params.typeId as string;
    const article = await prisma.expenseArticle.create({
      data: { name: name.trim(), expenseTypeId: typeId },
      include: { directions: true },
    });
    res.status(201).json(article);
  } catch (error) {
    console.error("Directory create article error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/articles/:id", async (req: Request, res: Response) => {
  try {
    if (!(await canEditCheck(req.user!.userId))) { res.status(403).json({ message: "Access denied" }); return; }
    const { name } = req.body;
    if (!name?.trim()) { res.status(400).json({ message: "Name is required" }); return; }

    const id = req.params.id as string;
    const updated = await prisma.expenseArticle.update({
      where: { id },
      data: { name: name.trim() },
      include: { directions: { orderBy: { sortOrder: "asc" } } },
    });
    res.json(updated);
  } catch (error) {
    console.error("Directory update article error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/articles/:id", async (req: Request, res: Response) => {
  try {
    if (!(await canEditCheck(req.user!.userId))) { res.status(403).json({ message: "Access denied" }); return; }
    const id = req.params.id as string;
    await prisma.expenseArticle.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error("Directory delete article error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ===== DIRECTIONS =====

router.post("/articles/:articleId/directions", async (req: Request, res: Response) => {
  try {
    if (!(await canEditCheck(req.user!.userId))) { res.status(403).json({ message: "Access denied" }); return; }
    const { name } = req.body;
    if (!name?.trim()) { res.status(400).json({ message: "Name is required" }); return; }

    const articleId = req.params.articleId as string;
    const direction = await prisma.articleDirection.create({
      data: { name: name.trim(), expenseArticleId: articleId },
    });
    res.status(201).json(direction);
  } catch (error) {
    console.error("Directory create direction error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/directions/:id", async (req: Request, res: Response) => {
  try {
    if (!(await canEditCheck(req.user!.userId))) { res.status(403).json({ message: "Access denied" }); return; }
    const { name } = req.body;
    if (!name?.trim()) { res.status(400).json({ message: "Name is required" }); return; }

    const id = req.params.id as string;
    const updated = await prisma.articleDirection.update({
      where: { id },
      data: { name: name.trim() },
    });
    res.json(updated);
  } catch (error) {
    console.error("Directory update direction error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/directions/:id", async (req: Request, res: Response) => {
  try {
    if (!(await canEditCheck(req.user!.userId))) { res.status(403).json({ message: "Access denied" }); return; }
    const id = req.params.id as string;
    await prisma.articleDirection.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error("Directory delete direction error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ===== ACCOUNTS =====

router.get("/accounts", async (req: Request, res: Response) => {
  try {
    const user = await getCompanyUser(req.user!.userId);
    if (!user) { res.status(403).json({ message: "No company" }); return; }

    const own = req.query.own === "true";

    let entityFilter: any = { companyId: user.companyId! };
    if (own) {
      const accessRecords = await prisma.entityAccess.findMany({
        where: { userId: user.id },
        select: { entityId: true },
      });
      const accessIds = accessRecords.map((r) => r.entityId);
      entityFilter = {
        companyId: user.companyId!,
        OR: [
          { ownerId: user.id },
          ...(accessIds.length > 0 ? [{ id: { in: accessIds } }] : []),
        ],
      };
    }

    const accounts = await prisma.account.findMany({
      where: { entity: entityFilter },
      include: {
        entity: { select: { name: true } },
        linkedAccount: { select: { id: true, name: true } },
      },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });

    res.json(accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      bank: a.bank,
      accountNumber: a.accountNumber,
      enabled: a.enabled,
      entityName: a.entity.name,
      entityId: a.entityId,
      linkedAccountId: a.linkedAccountId,
      linkedAccountName: a.linkedAccount?.name ?? null,
    })));
  } catch (error) {
    console.error("Directory list accounts error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/accounts/:id/toggle", async (req: Request, res: Response) => {
  try {
    if (!(await canEditCheck(req.user!.userId))) { res.status(403).json({ message: "Access denied" }); return; }

    const id = req.params.id as string;
    const account = await prisma.account.findUnique({ where: { id } });
    if (!account) { res.status(404).json({ message: "Account not found" }); return; }

    const updated = await prisma.account.update({
      where: { id },
      data: { enabled: !account.enabled },
    });
    res.json({ id: updated.id, enabled: updated.enabled });
  } catch (error) {
    console.error("Directory toggle account error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ===== ENTITIES LIST (for account creation) =====

router.get("/entities", async (req: Request, res: Response) => {
  try {
    const user = await getCompanyUser(req.user!.userId);
    if (!user) { res.status(403).json({ message: "No company" }); return; }

    const entities = await prisma.entity.findMany({
      where: { companyId: user.companyId! },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    });
    res.json(entities);
  } catch (error) {
    console.error("Directory list entities error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ===== ACCOUNT CRUD =====

router.post("/accounts", async (req: Request, res: Response) => {
  try {
    if (!(await canEditCheck(req.user!.userId))) { res.status(403).json({ message: "Access denied" }); return; }
    const user = await getCompanyUser(req.user!.userId);
    if (!user) { res.status(403).json({ message: "No company" }); return; }

    const { entityId, name, type, bank, accountNumber } = req.body;
    if (!name?.trim()) { res.status(400).json({ message: "Name is required" }); return; }
    if (!type?.trim()) { res.status(400).json({ message: "Type is required" }); return; }

    const entity = await prisma.entity.findFirst({ where: { id: entityId, companyId: user.companyId! } });
    if (!entity) { res.status(400).json({ message: "Invalid entity" }); return; }

    const account = await prisma.account.create({
      data: {
        name: name.trim(),
        type: type.trim(),
        bank: bank?.trim() || null,
        accountNumber: accountNumber?.trim() || null,
        entityId: entity.id,
      },
      include: { entity: { select: { name: true } } },
    });

    res.status(201).json({
      id: account.id,
      name: account.name,
      type: account.type,
      bank: account.bank,
      accountNumber: account.accountNumber,
      enabled: account.enabled,
      entityName: account.entity.name,
      entityId: account.entityId,
    });
  } catch (error) {
    console.error("Directory create account error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/accounts/:id", async (req: Request, res: Response) => {
  try {
    if (!(await canEditCheck(req.user!.userId))) { res.status(403).json({ message: "Access denied" }); return; }

    const id = req.params.id as string;
    const { name, type, bank, accountNumber } = req.body;

    const data: any = {};
    if (name !== undefined) data.name = name.trim();
    if (type !== undefined) data.type = type.trim();
    if (bank !== undefined) data.bank = bank?.trim() || null;
    if (accountNumber !== undefined) data.accountNumber = accountNumber?.trim() || null;

    const account = await prisma.account.update({
      where: { id },
      data,
      include: { entity: { select: { name: true } } },
    });

    res.json({
      id: account.id,
      name: account.name,
      type: account.type,
      bank: account.bank,
      accountNumber: account.accountNumber,
      enabled: account.enabled,
      entityName: account.entity.name,
      entityId: account.entityId,
    });
  } catch (error) {
    console.error("Directory update account error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/accounts/:id", async (req: Request, res: Response) => {
  try {
    if (!(await canEditCheck(req.user!.userId))) { res.status(403).json({ message: "Access denied" }); return; }
    const id = req.params.id as string;
    await prisma.account.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error("Directory delete account error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ===== ACCOUNT LINK =====

router.put("/accounts/:id/link", async (req: Request, res: Response) => {
  try {
    if (!(await canEditCheck(req.user!.userId))) { res.status(403).json({ message: "Access denied" }); return; }

    const id = req.params.id as string;
    const { linkedAccountId } = req.body;

    if (linkedAccountId) {
      if (linkedAccountId === id) { res.status(400).json({ message: "Cannot link to self" }); return; }
      const target = await prisma.account.findUnique({ where: { id: linkedAccountId } });
      if (!target) { res.status(404).json({ message: "Target account not found" }); return; }
    }

    const updated = await prisma.account.update({
      where: { id },
      data: { linkedAccountId: linkedAccountId || null },
      include: { linkedAccount: { select: { id: true, name: true } } },
    });

    res.json({
      id: updated.id,
      linkedAccountId: updated.linkedAccountId,
      linkedAccountName: updated.linkedAccount?.name ?? null,
    });
  } catch (error) {
    console.error("Directory link account error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ===== INCOME TYPES =====

router.get("/income-types", async (req: Request, res: Response) => {
  try {
    const user = await getCompanyUser(req.user!.userId);
    if (!user) { res.status(403).json({ message: "No company" }); return; }

    const types = await prisma.incomeType.findMany({
      where: { OR: [{ companyId: user.companyId! }, { entity: { companyId: user.companyId! } }] },
      include: { articles: { orderBy: { sortOrder: "asc" } } },
      orderBy: { sortOrder: "asc" },
    });
    res.json(types);
  } catch (error) {
    console.error("Directory list income types error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/directory/directions-list — unique directions across company
router.get("/directions-list", async (req: Request, res: Response) => {
  try {
    const user = await getCompanyUser(req.user!.userId);
    if (!user) { res.status(403).json({ message: "No company" }); return; }

    const directions = await prisma.articleDirection.findMany({
      where: {
        expenseArticle: {
          expenseType: {
            OR: [{ companyId: user.companyId! }, { entity: { companyId: user.companyId! } }],
          },
        },
      },
      include: { expenseArticle: { select: { name: true } } },
      orderBy: { sortOrder: "asc" },
    });

    const unique = new Map<string, { name: string; articleName: string }>();
    for (const d of directions) {
      if (!unique.has(d.name)) {
        unique.set(d.name, { name: d.name, articleName: d.expenseArticle.name });
      }
    }

    res.json(Array.from(unique.values()));
  } catch (error) {
    console.error("Directory list directions error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ===== CATEGORY RULES (auto-categorization) =====

router.get("/category-rules", async (req: Request, res: Response) => {
  try {
    const user = await getCompanyUser(req.user!.userId);
    if (!user) { res.status(403).json({ message: "No company" }); return; }

    const rules = await prisma.categoryRule.findMany({
      where: { companyId: user.companyId! },
      orderBy: { priority: "desc" },
    });
    res.json(rules);
  } catch (error) {
    console.error("Directory list category rules error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/category-rules", async (req: Request, res: Response) => {
  try {
    if (!(await canEditCheck(req.user!.userId))) { res.status(403).json({ message: "Access denied" }); return; }
    const user = await getCompanyUser(req.user!.userId);
    if (!user) { res.status(403).json({ message: "No company" }); return; }

    const { pattern, matchField, direction, expenseTypeName, expenseArticleName, directionName, priority } = req.body;
    if (!pattern?.trim()) { res.status(400).json({ message: "Pattern is required" }); return; }

    const rule = await prisma.categoryRule.create({
      data: {
        companyId: user.companyId!,
        pattern: pattern.trim(),
        matchField: matchField || "counterparty",
        direction: direction || null,
        expenseTypeName: expenseTypeName || null,
        expenseArticleName: expenseArticleName || null,
        directionName: directionName || null,
        priority: priority ?? 0,
      },
    });
    res.status(201).json(rule);
  } catch (error) {
    console.error("Directory create category rule error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/category-rules/:id", async (req: Request, res: Response) => {
  try {
    if (!(await canEditCheck(req.user!.userId))) { res.status(403).json({ message: "Access denied" }); return; }
    const id = req.params.id as string;
    const { pattern, matchField, direction, expenseTypeName, expenseArticleName, directionName, priority } = req.body;

    const data: any = {};
    if (pattern !== undefined) data.pattern = pattern.trim();
    if (matchField !== undefined) data.matchField = matchField;
    if (direction !== undefined) data.direction = direction || null;
    if (expenseTypeName !== undefined) data.expenseTypeName = expenseTypeName || null;
    if (expenseArticleName !== undefined) data.expenseArticleName = expenseArticleName || null;
    if (directionName !== undefined) data.directionName = directionName || null;
    if (priority !== undefined) data.priority = priority;

    const updated = await prisma.categoryRule.update({ where: { id }, data });
    res.json(updated);
  } catch (error) {
    console.error("Directory update category rule error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/category-rules/:id", async (req: Request, res: Response) => {
  try {
    if (!(await canEditCheck(req.user!.userId))) { res.status(403).json({ message: "Access denied" }); return; }
    const id = req.params.id as string;
    await prisma.categoryRule.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error("Directory delete category rule error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/directory/can-edit
router.get("/can-edit", async (req: Request, res: Response) => {
  try {
    const result = await canEditCheck(req.user!.userId);
    res.json({ canEdit: result });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
