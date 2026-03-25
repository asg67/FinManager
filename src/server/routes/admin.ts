import { Router, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { seedEntityAccounts } from "../helpers/seedAccounts.js";

const router = Router();

router.use(authMiddleware);

// All admin routes require owner role
router.use((req: Request, res: Response, next) => {
  if (req.user!.role !== "owner") {
    res.status(403).json({ message: "Admin access required" });
    return;
  }
  next();
});

// GET /api/admin/stats — counts for dashboard
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const [companiesCount, usersCount] = await Promise.all([
      prisma.company.count(),
      prisma.user.count(),
    ]);
    res.json({ companiesCount, usersCount });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/admin/companies — all companies list
router.get("/companies", async (_req: Request, res: Response) => {
  try {
    const companies = await prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { users: true, entities: true } },
      },
    });

    res.json(companies.map((c) => ({
      id: c.id,
      name: c.name,
      mode: c.mode,
      onboardingDone: c.onboardingDone,
      usersCount: c._count.users,
      entitiesCount: c._count.entities,
      createdAt: c.createdAt.toISOString(),
    })));
  } catch (error) {
    console.error("Admin list companies error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/admin/users — all users with last activity
router.get("/users", async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        mode: true,
        companyId: true,
        company: { select: { name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Get last DDS operation and last PDF upload per user
    const userIds = users.map((u) => u.id);

    const [lastDds, lastPdf] = await Promise.all([
      prisma.ddsOperation.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds } },
        _max: { createdAt: true },
      }),
      prisma.pdfUpload.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds } },
        _max: { createdAt: true },
      }),
    ]);

    const ddsMap = new Map(lastDds.map((d) => [d.userId, d._max.createdAt]));
    const pdfMap = new Map(lastPdf.map((p) => [p.userId, p._max.createdAt]));

    const result = users.map((u) => {
      const lastDdsDate = ddsMap.get(u.id);
      const lastPdfDate = pdfMap.get(u.id);

      let lastAction: { type: string; date: string } | null = null;
      if (lastDdsDate && lastPdfDate) {
        lastAction = lastDdsDate > lastPdfDate
          ? { type: "dds", date: lastDdsDate.toISOString() }
          : { type: "pdf", date: lastPdfDate.toISOString() };
      } else if (lastDdsDate) {
        lastAction = { type: "dds", date: lastDdsDate.toISOString() };
      } else if (lastPdfDate) {
        lastAction = { type: "pdf", date: lastPdfDate.toISOString() };
      }

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        mode: u.mode ?? null,
        companyName: u.company?.name || null,
        lastAction,
        createdAt: u.createdAt.toISOString(),
      };
    });

    res.json(result);
  } catch (error) {
    console.error("Admin list users error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/admin/users/:id/mode — set user mode
router.put("/users/:id/mode", async (req: Request, res: Response) => {
  try {
    const { mode } = req.body;
    if (mode !== null && mode !== "full" && mode !== "dds_only") {
      res.status(400).json({ message: "Mode must be 'full', 'dds_only', or null" });
      return;
    }
    await prisma.user.update({
      where: { id: req.params.id },
      data: { mode },
    });
    res.json({ ok: true });
  } catch (error) {
    console.error("Admin set user mode error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/admin/companies/:id — company detail
router.get("/companies/:id", async (req: Request, res: Response) => {
  try {
    const companyId = req.params.id as string;
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      res.status(404).json({ message: "Company not found" });
      return;
    }

    const [members, entities] = await Promise.all([
      prisma.user.findMany({
        where: { companyId },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.entity.findMany({
        where: { companyId },
        include: { _count: { select: { accounts: true } } },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    res.json({
      id: company.id,
      name: company.name,
      mode: company.mode,
      onboardingDone: company.onboardingDone,
      createdAt: company.createdAt.toISOString(),
      members: members.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
      })),
      entities: entities.map((e) => ({
        id: e.id,
        name: e.name,
        accountsCount: e._count.accounts,
      })),
    });
  } catch (error) {
    console.error("Admin get company error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/admin/companies/:id/operations — DDS operations for a company
router.get("/companies/:id/operations", async (req: Request, res: Response) => {
  try {
    const companyId = req.params.id as string;
    const entityId = req.query.entityId as string | undefined;
    const operationType = req.query.operationType as string | undefined;
    const page = req.query.page as string | undefined;
    const limit = req.query.limit as string | undefined;

    const pageNum = Math.max(1, parseInt(page || "1") || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || "20") || 20));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.DdsOperationWhereInput = {
      entity: { companyId },
    };

    if (entityId) where.entityId = entityId;
    if (operationType) where.operationType = operationType;

    const [operations, total] = await Promise.all([
      prisma.ddsOperation.findMany({
        where,
        include: {
          entity: { select: { name: true } },
          fromAccount: { select: { name: true, type: true } },
          toAccount: { select: { name: true, type: true } },
          expenseType: { select: { name: true } },
          expenseArticle: { select: { name: true } },
          incomeType: { select: { name: true } },
          incomeArticle: { select: { name: true } },
          user: { select: { name: true } },
          customFieldValues: { include: { customField: { select: { name: true, fieldType: true } } } },
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
    console.error("Admin list operations error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/admin/companies/:id/entities/:entityId — entity detail
router.get("/companies/:id/entities/:entityId", async (req: Request, res: Response) => {
  try {
    const entity = await prisma.entity.findUnique({
      where: { id: req.params.entityId as string },
    });

    if (!entity || entity.companyId !== req.params.id) {
      res.status(404).json({ message: "Entity not found" });
      return;
    }

    const accounts = await prisma.account.findMany({
      where: { entityId: entity.id },
      include: { _count: { select: { bankStatements: true } } },
      orderBy: { createdAt: "asc" },
    });

    // Get recent bank transactions for this entity's accounts
    const accountIds = accounts.map((a) => a.id);
    const transactions = accountIds.length > 0
      ? await prisma.bankTransaction.findMany({
          where: { accountId: { in: accountIds } },
          include: { account: { select: { name: true, bank: true } } },
          orderBy: { date: "desc" },
          take: 50,
        })
      : [];

    res.json({
      id: entity.id,
      name: entity.name,
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        bank: a.bank,
        accountNumber: a.accountNumber,
        enabled: a.enabled,
        transactionCount: a._count.bankStatements,
      })),
      recentTransactions: transactions.map((t) => ({
        id: t.id,
        date: t.date.toISOString(),
        amount: t.amount,
        direction: t.direction,
        counterparty: t.counterparty,
        purpose: t.purpose,
        accountName: t.account.name,
        bank: t.account.bank,
      })),
    });
  } catch (error) {
    console.error("Admin get entity error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ===== INVITE =====

// POST /api/admin/companies/:id/invites — create invite link for company
router.post("/companies/:id/invites", async (req: Request, res: Response) => {
  try {
    const companyId = req.params.id as string;
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      res.status(404).json({ message: "Company not found" });
      return;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = await prisma.invite.create({
      data: {
        companyId,
        createdById: req.user!.userId,
        expiresAt,
      },
    });

    res.status(201).json({
      id: invite.id,
      token: invite.token,
      expiresAt: invite.expiresAt.toISOString(),
      createdAt: invite.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Admin create invite error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ===== ENTITY CRUD =====

// POST /api/admin/companies/:id/entities — create entity in company
router.post("/companies/:id/entities", async (req: Request, res: Response) => {
  try {
    const companyId = req.params.id as string;
    const { name } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ message: "Name is required" });
      return;
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      res.status(404).json({ message: "Company not found" });
      return;
    }

    const entity = await prisma.entity.create({
      data: {
        name: name.trim(),
        ownerId: req.user!.userId,
        companyId,
      },
    });
    await seedEntityAccounts(entity.id);

    res.status(201).json(entity);
  } catch (error) {
    console.error("Admin create entity error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/admin/accounts/:id/toggle — enable/disable account
router.put("/accounts/:id/toggle", async (req: Request, res: Response) => {
  try {
    const account = await prisma.account.findUnique({ where: { id: req.params.id as string } });
    if (!account) {
      res.status(404).json({ message: "Account not found" });
      return;
    }
    const updated = await prisma.account.update({
      where: { id: req.params.id as string },
      data: { enabled: !account.enabled },
    });
    res.json({ id: updated.id, enabled: updated.enabled });
  } catch (error) {
    console.error("Admin toggle account error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/admin/entities/:id — rename entity
router.put("/entities/:id", async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ message: "Name is required" });
      return;
    }

    const entity = await prisma.entity.findUnique({ where: { id: req.params.id as string } });
    if (!entity) {
      res.status(404).json({ message: "Entity not found" });
      return;
    }

    const updated = await prisma.entity.update({
      where: { id: entity.id },
      data: { name: name.trim() },
    });

    res.json(updated);
  } catch (error) {
    console.error("Admin update entity error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/admin/entities/:id — delete entity (cascade)
router.delete("/entities/:id", async (req: Request, res: Response) => {
  try {
    const entity = await prisma.entity.findUnique({ where: { id: req.params.id as string } });
    if (!entity) {
      res.status(404).json({ message: "Entity not found" });
      return;
    }

    await prisma.entity.delete({ where: { id: entity.id } });
    res.status(204).send();
  } catch (error) {
    console.error("Admin delete entity error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ===== EXPENSE TYPES CRUD =====

// GET /api/admin/companies/:id/expense-types — list ALL types across all entities in company
router.get("/companies/:id/expense-types", async (req: Request, res: Response) => {
  try {
    const companyId = req.params.id as string;
    const types = await prisma.expenseType.findMany({
      where: { entity: { companyId } },
      include: { articles: { orderBy: { sortOrder: "asc" } } },
      orderBy: { sortOrder: "asc" },
    });
    res.json(types);
  } catch (error) {
    console.error("Admin list company expense types error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/admin/companies/:id/expense-types — create type (assigns to first entity)
router.post("/companies/:id/expense-types", async (req: Request, res: Response) => {
  try {
    const companyId = req.params.id as string;
    const { name } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ message: "Name is required" });
      return;
    }

    // Find first entity in the company to anchor the expense type
    const entity = await prisma.entity.findFirst({
      where: { companyId },
      orderBy: { createdAt: "asc" },
    });
    if (!entity) {
      res.status(400).json({ message: "Company has no entities" });
      return;
    }

    const type = await prisma.expenseType.create({
      data: {
        name: name.trim(),
        entityId: entity.id,
      },
      include: { articles: true },
    });

    res.status(201).json(type);
  } catch (error) {
    console.error("Admin create expense type error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/admin/expense-types/:id — rename type
router.put("/expense-types/:id", async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ message: "Name is required" });
      return;
    }

    const type = await prisma.expenseType.findUnique({ where: { id: req.params.id as string } });
    if (!type) {
      res.status(404).json({ message: "Expense type not found" });
      return;
    }

    const updated = await prisma.expenseType.update({
      where: { id: type.id },
      data: { name: name.trim() },
      include: { articles: { orderBy: { sortOrder: "asc" } } },
    });

    res.json(updated);
  } catch (error) {
    console.error("Admin update expense type error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/admin/expense-types/:id — delete type (cascade articles)
router.delete("/expense-types/:id", async (req: Request, res: Response) => {
  try {
    const type = await prisma.expenseType.findUnique({ where: { id: req.params.id as string } });
    if (!type) {
      res.status(404).json({ message: "Expense type not found" });
      return;
    }

    await prisma.expenseType.delete({ where: { id: type.id } });
    res.status(204).send();
  } catch (error) {
    console.error("Admin delete expense type error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ===== EXPENSE ARTICLES CRUD =====

// POST /api/admin/expense-types/:typeId/articles — create article
router.post("/expense-types/:typeId/articles", async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ message: "Name is required" });
      return;
    }

    const type = await prisma.expenseType.findUnique({ where: { id: req.params.typeId as string } });
    if (!type) {
      res.status(404).json({ message: "Expense type not found" });
      return;
    }

    const article = await prisma.expenseArticle.create({
      data: {
        name: name.trim(),
        expenseTypeId: type.id,
      },
    });

    res.status(201).json(article);
  } catch (error) {
    console.error("Admin create article error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/admin/articles/:id — rename article
router.put("/articles/:id", async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ message: "Name is required" });
      return;
    }

    const article = await prisma.expenseArticle.findUnique({ where: { id: req.params.id as string } });
    if (!article) {
      res.status(404).json({ message: "Expense article not found" });
      return;
    }

    const updated = await prisma.expenseArticle.update({
      where: { id: article.id },
      data: { name: name.trim() },
    });

    res.json(updated);
  } catch (error) {
    console.error("Admin update article error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/admin/articles/:id — delete article
router.delete("/articles/:id", async (req: Request, res: Response) => {
  try {
    const article = await prisma.expenseArticle.findUnique({ where: { id: req.params.id as string } });
    if (!article) {
      res.status(404).json({ message: "Expense article not found" });
      return;
    }

    await prisma.expenseArticle.delete({ where: { id: article.id } });
    res.status(204).send();
  } catch (error) {
    console.error("Admin delete article error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ===== COMPANY MODE =====

// PUT /api/admin/companies/:id/mode — set company mode
router.put("/companies/:id/mode", async (req: Request, res: Response) => {
  try {
    const { mode } = req.body;
    if (!mode || !["full", "dds_only"].includes(mode)) {
      res.status(400).json({ message: "Mode must be 'full' or 'dds_only'" });
      return;
    }

    const company = await prisma.company.findUnique({ where: { id: req.params.id as string } });
    if (!company) {
      res.status(404).json({ message: "Company not found" });
      return;
    }

    const updated = await prisma.company.update({
      where: { id: company.id },
      data: { mode },
    });

    res.json({ id: updated.id, mode: updated.mode });
  } catch (error) {
    console.error("Admin set company mode error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ===== INCOME TYPES CRUD (admin) =====

// GET /api/admin/companies/:id/income-types
router.get("/companies/:id/income-types", async (req: Request, res: Response) => {
  try {
    const companyId = req.params.id as string;
    const types = await prisma.incomeType.findMany({
      where: { entity: { companyId } },
      include: { articles: { orderBy: { sortOrder: "asc" } } },
      orderBy: { sortOrder: "asc" },
    });
    res.json(types);
  } catch (error) {
    console.error("Admin list income types error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/admin/companies/:id/income-types
router.post("/companies/:id/income-types", async (req: Request, res: Response) => {
  try {
    const companyId = req.params.id as string;
    const { name } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ message: "Name is required" });
      return;
    }

    const entity = await prisma.entity.findFirst({
      where: { companyId },
      orderBy: { createdAt: "asc" },
    });
    if (!entity) {
      res.status(400).json({ message: "Company has no entities" });
      return;
    }

    const type = await prisma.incomeType.create({
      data: { name: name.trim(), entityId: entity.id },
      include: { articles: true },
    });

    res.status(201).json(type);
  } catch (error) {
    console.error("Admin create income type error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/admin/income-types/:id
router.put("/income-types/:id", async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ message: "Name is required" });
      return;
    }

    const type = await prisma.incomeType.findUnique({ where: { id: req.params.id as string } });
    if (!type) {
      res.status(404).json({ message: "Income type not found" });
      return;
    }

    const updated = await prisma.incomeType.update({
      where: { id: type.id },
      data: { name: name.trim() },
      include: { articles: { orderBy: { sortOrder: "asc" } } },
    });

    res.json(updated);
  } catch (error) {
    console.error("Admin update income type error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/admin/income-types/:id
router.delete("/income-types/:id", async (req: Request, res: Response) => {
  try {
    const type = await prisma.incomeType.findUnique({ where: { id: req.params.id as string } });
    if (!type) {
      res.status(404).json({ message: "Income type not found" });
      return;
    }

    await prisma.incomeType.delete({ where: { id: type.id } });
    res.status(204).send();
  } catch (error) {
    console.error("Admin delete income type error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/admin/income-types/:typeId/articles
router.post("/income-types/:typeId/articles", async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ message: "Name is required" });
      return;
    }

    const type = await prisma.incomeType.findUnique({ where: { id: req.params.typeId as string } });
    if (!type) {
      res.status(404).json({ message: "Income type not found" });
      return;
    }

    const article = await prisma.incomeArticle.create({
      data: { name: name.trim(), incomeTypeId: type.id },
    });

    res.status(201).json(article);
  } catch (error) {
    console.error("Admin create income article error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/admin/income-articles/:id
router.put("/income-articles/:id", async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ message: "Name is required" });
      return;
    }

    const article = await prisma.incomeArticle.findUnique({ where: { id: req.params.id as string } });
    if (!article) {
      res.status(404).json({ message: "Income article not found" });
      return;
    }

    const updated = await prisma.incomeArticle.update({
      where: { id: article.id },
      data: { name: name.trim() },
    });

    res.json(updated);
  } catch (error) {
    console.error("Admin update income article error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/admin/income-articles/:id
router.delete("/income-articles/:id", async (req: Request, res: Response) => {
  try {
    const article = await prisma.incomeArticle.findUnique({ where: { id: req.params.id as string } });
    if (!article) {
      res.status(404).json({ message: "Income article not found" });
      return;
    }

    await prisma.incomeArticle.delete({ where: { id: article.id } });
    res.status(204).send();
  } catch (error) {
    console.error("Admin delete income article error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ===== CUSTOM FIELDS CRUD =====

// GET /api/admin/companies/:id/custom-fields
router.get("/companies/:id/custom-fields", async (req: Request, res: Response) => {
  try {
    const fields = await prisma.customField.findMany({
      where: { companyId: req.params.id as string },
      orderBy: { sortOrder: "asc" },
    });
    res.json(fields);
  } catch (error) {
    console.error("Admin list custom fields error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/admin/companies/:id/custom-fields
router.post("/companies/:id/custom-fields", async (req: Request, res: Response) => {
  try {
    const companyId = req.params.id as string;
    const { name, fieldType, options, showWhen, required } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ message: "Name is required" });
      return;
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      res.status(404).json({ message: "Company not found" });
      return;
    }

    const field = await prisma.customField.create({
      data: {
        companyId,
        name: name.trim(),
        fieldType: fieldType || "select",
        options: options || null,
        showWhen: showWhen || null,
        required: required || false,
      },
    });

    res.status(201).json(field);
  } catch (error) {
    console.error("Admin create custom field error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/admin/custom-fields/:id
router.put("/custom-fields/:id", async (req: Request, res: Response) => {
  try {
    const field = await prisma.customField.findUnique({ where: { id: req.params.id as string } });
    if (!field) {
      res.status(404).json({ message: "Custom field not found" });
      return;
    }

    const data: Record<string, unknown> = {};
    if (req.body.name !== undefined) data.name = req.body.name.trim();
    if (req.body.fieldType !== undefined) data.fieldType = req.body.fieldType;
    if (req.body.options !== undefined) data.options = req.body.options;
    if (req.body.showWhen !== undefined) data.showWhen = req.body.showWhen;
    if (req.body.required !== undefined) data.required = req.body.required;
    if (req.body.sortOrder !== undefined) data.sortOrder = req.body.sortOrder;

    const updated = await prisma.customField.update({
      where: { id: field.id },
      data,
    });

    res.json(updated);
  } catch (error) {
    console.error("Admin update custom field error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/admin/custom-fields/:id
router.delete("/custom-fields/:id", async (req: Request, res: Response) => {
  try {
    const field = await prisma.customField.findUnique({ where: { id: req.params.id as string } });
    if (!field) {
      res.status(404).json({ message: "Custom field not found" });
      return;
    }

    await prisma.customField.delete({ where: { id: field.id } });
    res.status(204).send();
  } catch (error) {
    console.error("Admin delete custom field error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/admin/operations/:id — delete any DDS operation
router.delete("/operations/:id", async (req: Request, res: Response) => {
  try {
    const op = await prisma.ddsOperation.findUnique({ where: { id: req.params.id as string } });
    if (!op) {
      res.status(404).json({ message: "Operation not found" });
      return;
    }
    await prisma.ddsOperation.delete({ where: { id: op.id } });
    res.status(204).send();
  } catch (error) {
    console.error("Admin delete operation error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
