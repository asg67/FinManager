import { Router, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { authMiddleware } from "../middleware/auth.js";

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

export default router;
