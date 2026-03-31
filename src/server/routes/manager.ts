import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { createExcelResponse } from "../utils/excel.js";

const router = Router();

router.use(authMiddleware);

// Ensure only managers access this router
router.use((req: Request, res: Response, next: NextFunction) => {
  if (req.user!.role !== "manager") {
    res.status(403).json({ message: "Manager access required" });
    return;
  }
  next();
});

// Helper: verify manager has access to company
async function checkManagerAccess(userId: string, companyId: string): Promise<boolean> {
  const access = await prisma.managerCompanyAccess.findUnique({
    where: { userId_companyId: { userId, companyId } },
  });
  return !!access;
}

// GET /api/manager/companies — list manager's companies
router.get("/companies", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const accesses = await prisma.managerCompanyAccess.findMany({
      where: { userId },
      include: {
        company: {
          include: {
            _count: { select: { entities: true, users: true } },
          },
        },
      },
      orderBy: { company: { name: "asc" } },
    });

    const companyIds = accesses.map((a) => a.companyId);

    // Get last DDS operation date per company
    const lastDdsList = await prisma.ddsOperation.groupBy({
      by: ["entityId"],
      where: { entity: { companyId: { in: companyIds } } },
      _max: { createdAt: true },
    });

    // Map entityId -> companyId for last DDS lookup
    const entities = await prisma.entity.findMany({
      where: { companyId: { in: companyIds } },
      select: { id: true, companyId: true },
    });
    const entityToCompany = new Map(entities.map((e) => [e.id, e.companyId]));

    const lastDdsByCompany = new Map<string, Date>();
    for (const item of lastDdsList) {
      const cid = entityToCompany.get(item.entityId);
      if (cid && item._max.createdAt) {
        const existing = lastDdsByCompany.get(cid);
        if (!existing || item._max.createdAt > existing) {
          lastDdsByCompany.set(cid, item._max.createdAt);
        }
      }
    }

    const result = accesses.map((a) => ({
      id: a.company.id,
      name: a.company.name,
      mode: a.company.mode,
      entitiesCount: a.company._count.entities,
      usersCount: a.company._count.users,
      lastDdsAt: lastDdsByCompany.get(a.company.id)?.toISOString() ?? null,
    }));

    res.json(result);
  } catch (error) {
    console.error("Manager companies error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/manager/companies/:companyId — company details + stats
router.get("/companies/:companyId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.user!;
    const { companyId } = req.params;
    const { from, to } = req.query as Record<string, string>;

    if (!(await checkManagerAccess(userId, companyId))) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        entities: {
          include: { _count: { select: { accounts: true } } },
          orderBy: { name: "asc" },
        },
      },
    });
    if (!company) {
      res.status(404).json({ message: "Company not found" });
      return;
    }

    const entityIds = company.entities.map((e) => e.id);

    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to + "T23:59:59");

    const opWhere: any = { entityId: { in: entityIds } };
    if (from || to) opWhere.createdAt = dateFilter;

    const [incomeAgg, expenseAgg, totalCount] = await Promise.all([
      prisma.ddsOperation.aggregate({
        where: { ...opWhere, operationType: "income" },
        _sum: { amount: true },
      }),
      prisma.ddsOperation.aggregate({
        where: { ...opWhere, operationType: "expense" },
        _sum: { amount: true },
      }),
      prisma.ddsOperation.count({ where: opWhere }),
    ]);

    const totalIncome = incomeAgg._sum.amount?.toNumber() ?? 0;
    const totalExpense = expenseAgg._sum.amount?.toNumber() ?? 0;

    res.json({
      id: company.id,
      name: company.name,
      mode: company.mode,
      entities: company.entities.map((e) => ({
        id: e.id,
        name: e.name,
        accountsCount: e._count.accounts,
      })),
      stats: {
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense,
        operationsCount: totalCount,
      },
    });
  } catch (error) {
    console.error("Manager company detail error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/manager/companies/:companyId/operations — paginated DDS operations
router.get("/companies/:companyId/operations", async (req: Request, res: Response) => {
  try {
    const { userId } = req.user!;
    const { companyId } = req.params;
    const { entityId, operationType, from, to, search, page, limit } = req.query as Record<string, string>;

    if (!(await checkManagerAccess(userId, companyId))) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where: any = { entity: { companyId } };
    if (entityId) where.entityId = entityId;
    if (operationType) where.operationType = operationType;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to + "T23:59:59");
    }
    if (search) {
      where.OR = [
        { comment: { contains: search, mode: "insensitive" } },
        { orderNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    const [operations, total] = await Promise.all([
      (prisma.ddsOperation.findMany as any)({
        where,
        include: {
          entity: { select: { name: true } },
          fromAccount: { select: { name: true } },
          toAccount: { select: { name: true } },
          expenseType: { select: { name: true } },
          expenseArticle: { select: { name: true } },
          incomeType: { select: { name: true } },
          incomeArticle: { select: { name: true } },
          direction: { select: { name: true } },
          user: { select: { name: true } },
          customFieldValues: { include: { customField: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.ddsOperation.count({ where }),
    ]);

    res.json({
      data: operations.map((op: any) => ({
        ...op,
        amount: op.amount.toNumber(),
        createdAt: op.createdAt.toISOString(),
        updatedAt: op.updatedAt.toISOString(),
      })),
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error("Manager operations error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/manager/companies/:companyId/users — users with last activity
router.get("/companies/:companyId/users", async (req: Request, res: Response) => {
  try {
    const { userId } = req.user!;
    const { companyId } = req.params;

    if (!(await checkManagerAccess(userId, companyId))) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    const users = await prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    });

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

    const ddsMap = new Map(lastDds.map((r) => [r.userId, r._max.createdAt]));
    const pdfMap = new Map(lastPdf.map((r) => [r.userId, r._max.createdAt]));

    const result = users.map((u) => {
      const ddsDate = ddsMap.get(u.id);
      const pdfDate = pdfMap.get(u.id);
      let lastAction: { type: string; date: string } | null = null;

      if (ddsDate && (!pdfDate || ddsDate >= pdfDate)) {
        lastAction = { type: "dds", date: ddsDate.toISOString() };
      } else if (pdfDate) {
        lastAction = { type: "pdf", date: pdfDate.toISOString() };
      } else if (u.lastLoginAt) {
        lastAction = { type: "login", date: u.lastLoginAt.toISOString() };
      }

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        lastAction,
        createdAt: u.createdAt.toISOString(),
      };
    });

    // Sort by lastAction desc
    result.sort((a, b) => {
      if (!a.lastAction && !b.lastAction) return 0;
      if (!a.lastAction) return 1;
      if (!b.lastAction) return -1;
      return new Date(b.lastAction.date).getTime() - new Date(a.lastAction.date).getTime();
    });

    res.json(result);
  } catch (error) {
    console.error("Manager users error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/manager/companies/:companyId/stats/by-category
router.get("/companies/:companyId/stats/by-category", async (req: Request, res: Response) => {
  try {
    const { userId } = req.user!;
    const { companyId } = req.params;
    const { entityId, from, to } = req.query as Record<string, string>;

    if (!(await checkManagerAccess(userId, companyId))) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    const where: any = { entity: { companyId }, operationType: "expense", expenseTypeId: { not: null } };
    if (entityId) where.entityId = entityId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to + "T23:59:59");
    }

    const ops = await (prisma.ddsOperation.findMany as any)({
      where,
      select: {
        amount: true,
        expenseType: { select: { name: true } },
      },
    });

    const totals = new Map<string, number>();
    for (const op of ops) {
      const name = op.expenseType?.name ?? "Прочее";
      totals.set(name, (totals.get(name) ?? 0) + op.amount.toNumber());
    }

    const result = Array.from(totals.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);

    res.json(result);
  } catch (error) {
    console.error("Manager stats by category error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/manager/companies/:companyId/stats/by-month — income & expense per month
router.get("/companies/:companyId/stats/by-month", async (req: Request, res: Response) => {
  try {
    const { userId } = req.user!;
    const { companyId } = req.params;
    const { entityId } = req.query as Record<string, string>;

    if (!(await checkManagerAccess(userId, companyId))) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    const where: any = {
      entity: { companyId },
      operationType: { in: ["income", "expense"] },
    };
    if (entityId) where.entityId = entityId;

    const ops = await (prisma.ddsOperation.findMany as any)({
      where,
      select: { amount: true, operationType: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const monthMap = new Map<string, { month: string; income: number; expense: number }>();
    for (const op of ops) {
      const month = op.createdAt.toISOString().slice(0, 7); // "2026-01"
      if (!monthMap.has(month)) monthMap.set(month, { month, income: 0, expense: 0 });
      const entry = monthMap.get(month)!;
      if (op.operationType === "income") entry.income += op.amount.toNumber();
      else entry.expense += op.amount.toNumber();
    }

    res.json(Array.from(monthMap.values()));
  } catch (error) {
    console.error("Manager stats by month error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/manager/companies/:companyId/export/dds-excel
router.get("/companies/:companyId/export/dds-excel", async (req: Request, res: Response) => {
  try {
    const { userId } = req.user!;
    const { companyId } = req.params;
    const { entityId, from, to } = req.query as Record<string, string>;

    if (!(await checkManagerAccess(userId, companyId))) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });

    const where: any = { entity: { companyId } };
    if (entityId) where.entityId = entityId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to + "T23:59:59");
    }

    const ops: any[] = await (prisma.ddsOperation.findMany as any)({
      where,
      include: {
        entity: { select: { name: true } },
        user: { select: { name: true } },
        fromAccount: { select: { name: true } },
        toAccount: { select: { name: true } },
        expenseType: { select: { name: true } },
        expenseArticle: { select: { name: true } },
        incomeType: { select: { name: true } },
        incomeArticle: { select: { name: true } },
        direction: { select: { name: true } },
        customFieldValues: { include: { customField: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    const cfNameSet = new Set<string>();
    for (const op of ops) {
      for (const cfv of op.customFieldValues ?? []) cfNameSet.add(cfv.customField.name);
    }
    const cfNames = [...cfNameSet];

    const typeLabels: Record<string, string> = { income: "Приход", expense: "Расход", transfer: "Перевод" };

    const rows = ops.map((op: any) => {
      const row: Record<string, unknown> = {
        date: op.createdAt.toLocaleDateString("ru-RU"),
        user: op.user?.name ?? "",
        entity: op.entity.name,
        type: typeLabels[op.operationType] ?? op.operationType,
        from: op.fromAccount?.name ?? "",
        to: op.toAccount?.name ?? "",
        amount: op.amount.toNumber(),
        category: op.expenseType?.name ?? op.incomeType?.name ?? "",
        article: op.expenseArticle?.name ?? op.incomeArticle?.name ?? "",
        direction: op.direction?.name ?? "",
        orderNumber: op.orderNumber ?? "",
        comment: op.comment ?? "",
      };
      for (const name of cfNames) {
        const cfv = (op.customFieldValues ?? []).find((v: any) => v.customField.name === name);
        row[`cf_${name}`] = cfv?.value ?? "";
      }
      return row;
    });

    const columns = [
      { header: "Дата", key: "date", width: 12 },
      { header: "Пользователь", key: "user", width: 20 },
      { header: "Юрлицо", key: "entity", width: 22 },
      { header: "Тип", key: "type", width: 10 },
      { header: "Со счёта", key: "from", width: 22 },
      { header: "На счёт", key: "to", width: 22 },
      { header: "Сумма", key: "amount", width: 15 },
      { header: "Категория", key: "category", width: 18 },
      { header: "Статья", key: "article", width: 18 },
      { header: "Направление", key: "direction", width: 18 },
      { header: "№ заказа", key: "orderNumber", width: 14 },
      { header: "Комментарий", key: "comment", width: 30 },
      ...cfNames.map((name) => ({ header: name, key: `cf_${name}`, width: 18 })),
    ];

    const safeName = (company?.name ?? "company").replace(/[^a-zA-Zа-яА-Я0-9]/g, "-");
    const date = new Date().toISOString().slice(0, 10);
    await createExcelResponse(res, `dds-${safeName}-${date}.xlsx`, columns, rows);
  } catch (error) {
    console.error("Manager export error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
