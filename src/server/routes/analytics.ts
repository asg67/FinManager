import { Router, Request, Response } from "express";
import { prisma } from "../prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { Prisma } from "@prisma/client";

const router = Router();
router.use(authMiddleware);

async function entityFilter(companyId: string | null, userId: string, mine: boolean) {
  if (!companyId) return { ownerId: userId };
  if (!mine) return { companyId };

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, name: true } });

  // Owner sees all company entities
  if (user?.role === "owner") return { companyId };

  // Check if user has explicit entity access
  const accessCount = await prisma.entityAccess.count({ where: { userId } });
  if (accessCount > 0) {
    return {
      companyId,
      OR: [{ ownerId: userId }, { entityAccess: { some: { userId } } }],
    };
  }

  // No explicit access — match by last name (first word of user name)
  const lastName = user?.name?.split(" ")[0];
  if (lastName && lastName.length >= 2) {
    return { companyId, name: { contains: lastName, mode: "insensitive" } };
  }

  return { companyId, ownerId: userId };
}

// GET /api/analytics/summary — total income, expense, count for a period
router.get("/summary", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { entityId, from, to, mine } = req.query as Record<string, string>;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const where: Prisma.DdsOperationWhereInput = {};
    where.entity = await entityFilter(user?.companyId ?? null, userId, mine === "true");
    if (entityId) where.entityId = entityId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    // DDS operations
    const [incomeAgg, expenseAgg, ddsCount] = await Promise.all([
      prisma.ddsOperation.aggregate({
        where: { ...where, operationType: "income" },
        _sum: { amount: true },
      }),
      prisma.ddsOperation.aggregate({
        where: { ...where, operationType: "expense" },
        _sum: { amount: true },
      }),
      prisma.ddsOperation.count({ where }),
    ]);

    // Bank transactions (same entity filter, date filter)
    const bankWhere: Prisma.BankTransactionWhereInput = {
      account: { entity: where.entity },
    };
    if (where.createdAt) {
      bankWhere.date = {};
      if ((where.createdAt as any).gte) (bankWhere.date as any).gte = (where.createdAt as any).gte;
      if ((where.createdAt as any).lte) (bankWhere.date as any).lte = (where.createdAt as any).lte;
    }

    const [bankIncomeAgg, bankExpenseAgg, bankCount] = await Promise.all([
      prisma.bankTransaction.aggregate({
        where: { ...bankWhere, direction: "income" },
        _sum: { amount: true },
      }),
      prisma.bankTransaction.aggregate({
        where: { ...bankWhere, direction: "expense" },
        _sum: { amount: true },
      }),
      prisma.bankTransaction.count({ where: bankWhere }),
    ]);

    const totalIncome = (incomeAgg._sum.amount?.toNumber() ?? 0) + (bankIncomeAgg._sum.amount?.toNumber() ?? 0);
    const totalExpense = (expenseAgg._sum.amount?.toNumber() ?? 0) + (bankExpenseAgg._sum.amount?.toNumber() ?? 0);

    res.json({
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      operationsCount: ddsCount + bankCount,
    });
  } catch (error) {
    console.error("Summary error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/analytics/by-category — expenses grouped by expense type
router.get("/by-category", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { entityId, from, to, mine } = req.query as Record<string, string>;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const where: Prisma.DdsOperationWhereInput = {
      operationType: "expense",
      expenseTypeId: { not: null },
    };
    where.entity = await entityFilter(user?.companyId ?? null, userId, mine === "true");
    if (entityId) where.entityId = entityId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const groups = await prisma.ddsOperation.groupBy({
      by: ["expenseTypeId"],
      where,
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: "desc" } },
    });

    // Enrich with expense type names
    const typeIds = groups.map((g) => g.expenseTypeId!).filter(Boolean);
    const types = await prisma.expenseType.findMany({
      where: { id: { in: typeIds } },
      select: { id: true, name: true },
    });
    const typeMap = new Map(types.map((t) => [t.id, t.name]));

    const result = groups.map((g) => ({
      expenseTypeId: g.expenseTypeId,
      name: typeMap.get(g.expenseTypeId!) ?? "Unknown",
      total: g._sum.amount?.toNumber() ?? 0,
      count: g._count,
    }));

    res.json(result);
  } catch (error) {
    console.error("By category error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/analytics/timeline — daily aggregated amounts for line chart
router.get("/timeline", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { entityId, days, mine, from, accountType } = req.query as Record<string, string>;

    let startDate: Date;
    if (from) {
      startDate = new Date(from + "T00:00:00");
    } else {
      const numDays = parseInt(days) || 30;
      startDate = new Date();
      startDate.setDate(startDate.getDate() - numDays);
    }
    startDate.setHours(0, 0, 0, 0);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const where: Prisma.DdsOperationWhereInput = {
      createdAt: { gte: startDate },
    };
    where.entity = await entityFilter(user?.companyId ?? null, userId, mine === "true");
    if (entityId) where.entityId = entityId;

    // Account type filter for operations
    if (accountType) {
      where.OR = [
        { fromAccount: { type: accountType } },
        { toAccount: { type: accountType } },
      ];
    }

    const bankTxWhere: Prisma.BankTransactionWhereInput = {
      account: {
        entity: where.entity as Prisma.EntityRelationFilter,
        ...(accountType ? { type: accountType } : {}),
      },
      date: { gte: startDate },
    };

    const [operations, bankTxs] = await Promise.all([
      prisma.ddsOperation.findMany({
        where,
        select: {
          operationType: true,
          amount: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.bankTransaction.findMany({
        where: bankTxWhere,
        select: {
          direction: true,
          amount: true,
          date: true,
        },
        orderBy: { date: "asc" },
      }),
    ]);

    // Group by day
    const dayMap = new Map<string, { income: number; expense: number }>();

    // Initialize all days
    for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, { income: 0, expense: 0 });
    }

    for (const op of operations) {
      const key = op.createdAt.toISOString().slice(0, 10);
      const entry = dayMap.get(key) ?? { income: 0, expense: 0 };
      const amount = op.amount.toNumber();
      if (op.operationType === "income") {
        entry.income += amount;
      } else if (op.operationType === "expense") {
        entry.expense += amount;
      }
      dayMap.set(key, entry);
    }

    // Add bank transactions
    for (const tx of bankTxs) {
      const key = tx.date.toISOString().slice(0, 10);
      const entry = dayMap.get(key) ?? { income: 0, expense: 0 };
      const amount = tx.amount.toNumber();
      if (tx.direction === "income") {
        entry.income += amount;
      } else {
        entry.expense += amount;
      }
      dayMap.set(key, entry);
    }

    // Convert to array with running balance
    let runningBalance = 0;
    const timeline = Array.from(dayMap.entries()).map(([date, { income, expense }]) => {
      runningBalance += income - expense;
      return { date, income, expense, balance: runningBalance };
    });

    res.json(timeline);
  } catch (error) {
    console.error("Timeline error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/analytics/account-balances — calculated balance per account
router.get("/account-balances", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { entityId, mine } = req.query as Record<string, string>;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const accountWhere: Prisma.AccountWhereInput = {};
    accountWhere.entity = await entityFilter(user?.companyId ?? null, userId, mine === "true");
    if (entityId) accountWhere.entityId = entityId;

    const accounts = await prisma.account.findMany({
      where: accountWhere,
      select: {
        id: true,
        name: true,
        type: true,
        bank: true,
        entityId: true,
        entity: { select: { name: true } },
      },
    });

    const balances = await Promise.all(
      accounts.map(async (acc) => {
        const [incomingAgg, outgoingAgg, bankIncomeAgg, bankExpenseAgg] = await Promise.all([
          prisma.ddsOperation.aggregate({
            where: { toAccountId: acc.id },
            _sum: { amount: true },
          }),
          prisma.ddsOperation.aggregate({
            where: { fromAccountId: acc.id },
            _sum: { amount: true },
          }),
          prisma.bankTransaction.aggregate({
            where: { accountId: acc.id, direction: "income" },
            _sum: { amount: true },
          }),
          prisma.bankTransaction.aggregate({
            where: { accountId: acc.id, direction: "expense" },
            _sum: { amount: true },
          }),
        ]);

        const ddsIncoming = incomingAgg._sum.amount?.toNumber() ?? 0;
        const ddsOutgoing = outgoingAgg._sum.amount?.toNumber() ?? 0;
        const bankIncome = bankIncomeAgg._sum.amount?.toNumber() ?? 0;
        const bankExpense = bankExpenseAgg._sum.amount?.toNumber() ?? 0;

        return {
          id: acc.id,
          name: acc.name,
          type: acc.type,
          bank: acc.bank,
          entityName: acc.entity.name,
          balance: (ddsIncoming - ddsOutgoing) + (bankIncome - bankExpense),
        };
      }),
    );

    // Hide zero-balance accounts (auto-created but unused)
    res.json(balances.filter((b) => b.balance !== 0));
  } catch (error) {
    console.error("Account balances error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/analytics/recent — latest operations (DDS + bank transactions)
router.get("/recent", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const limitNum = Math.min(20, parseInt(req.query.limit as string) || 10);
    const mine = (req.query.mine as string) === "true";

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const entFilter = await entityFilter(user?.companyId ?? null, userId, mine);

    const [ddsOps, bankTxs] = await Promise.all([
      prisma.ddsOperation.findMany({
        where: { entity: entFilter },
        include: {
          entity: { select: { name: true } },
          fromAccount: { select: { name: true } },
          toAccount: { select: { name: true } },
          expenseType: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limitNum,
      }),
      prisma.bankTransaction.findMany({
        where: { account: { entity: entFilter } },
        include: {
          account: { select: { name: true, bank: true } },
        },
        orderBy: { date: "desc" },
        take: limitNum,
      }),
    ]);

    // Merge and sort by date
    const merged = [
      ...ddsOps.map((op) => ({
        id: op.id,
        source: "dds" as const,
        date: op.createdAt.toISOString(),
        type: op.operationType,
        amount: op.amount.toNumber(),
        description: op.comment ?? op.expenseType?.name ?? op.operationType,
        entity: op.entity.name,
        account: op.operationType === "income"
          ? op.toAccount?.name
          : op.fromAccount?.name,
      })),
      ...bankTxs.map((tx) => ({
        id: tx.id,
        source: "bank" as const,
        date: tx.date.toISOString(),
        type: tx.direction,
        amount: tx.amount.toNumber(),
        description: tx.counterparty ?? tx.purpose ?? tx.direction,
        entity: null as string | null,
        account: tx.account.name,
      })),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limitNum);

    res.json(merged);
  } catch (error) {
    console.error("Recent error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
